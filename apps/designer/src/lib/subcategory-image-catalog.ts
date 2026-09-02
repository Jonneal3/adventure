import { buildSuggestionLabel } from "@adventure/refinement-server";
import type { Json } from "@/types/database";
import { IMAGES_BUCKET, IMAGE_STORAGE_PREFIXES } from "@/storage/prefixes";

export const STYLE_SEED_GENERATED_FOR = "style_seed";
export const LEGACY_STYLE_SEED_GENERATED_FOR = "subcategory_catalog";
export const SUBCATEGORY_IMAGE_CATALOG_GENERATED_FOR = STYLE_SEED_GENERATED_FOR;
// Gallery inventory is generated outside the visitor's critical path, so optimize
// for first-impression quality instead of thumbnail latency.
export const SUBCATEGORY_IMAGE_CATALOG_MODEL_ID = "black-forest-labs/flux-2-pro";
// Keep a small floor inside each actual Step-2 scope bucket. This runs at
// catalog-seed time, never while a visitor is waiting in the form.
export const SUBCATEGORY_IMAGE_CATALOG_MIN_PER_SCOPE = 5;
// subcategory_scope is capped at 16 entries; add one whole-project bucket.
export const SUBCATEGORY_IMAGE_CATALOG_MAX_SCOPE_BUCKETS = 17;
export const SUBCATEGORY_IMAGE_CATALOG_MAX_IMAGES = 100;

const FINISH_TIER_DESCS: Record<string, string> = {
  value: "Budget-conscious materials, standard fixtures, clean and durable finishes.",
  mid: "Mid-tier materials, upgraded fixtures, and selective custom details.",
  premium: "Premium materials, custom details, and high-end fixtures.",
  luxury: "Bespoke finishes, custom millwork, and designer fixtures.",
};

const BEFORE_AFTER_RE = /\bbefore\s*(?:\/|-|&|and)\s*after\b/gi;

export type CatalogOptionInput = {
  description?: string | null;
  label?: string | null;
  value?: string | null;
  imagePrompt?: string | null;
  finishTier?: string | null;
  scope?: string | null;
  scopeKey?: string | null;
  /** Legacy generator response; normalized to finishTier before persistence. */
  priceTier?: string | null;
  manifest?: Record<string, any> | null;
  pricingPreflight?: Record<string, any> | null;
};

export function normalizeCatalogFinishTier(value: unknown): string {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "";
  if (/^(\$|starter|value|budget|economy)$/.test(raw)) return "value";
  if (/^(\$\$|mid|middle|standard|upper|upper-mid)$/.test(raw)) return "mid";
  if (/^(\$\$\$|plus|premium|high)$/.test(raw)) return "premium";
  if (/^(\$\$\$\$|luxury|lux|estate|bespoke)$/.test(raw)) return "luxury";
  return raw.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

type CatalogImageRow = {
  account_id: string | null;
  created_at: string | null;
  id: string;
  image_url: string;
  metadata: Record<string, any> | null;
  prompt_id: string | null;
  status: string | null;
  subcategory_id: string | null;
  user_id: string | null;
};

function slugifySegment(input: string): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "image";
}

function normalizeText(input: unknown): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizeVisualContextText(input: unknown): string {
  return String(input || "")
    .trim()
    .replace(BEFORE_AFTER_RE, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+/g, " ")
    .replace(/^[,\s;:-]+|[,\s;:-]+$/g, "")
    .trim();
}

function isHttpImageUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function isStyleSeedGeneratedFor(value: unknown): boolean {
  const generatedFor = String(value || "").trim();
  return generatedFor === STYLE_SEED_GENERATED_FOR || generatedFor === LEGACY_STYLE_SEED_GENERATED_FOR;
}

function isCatalogImage(row: CatalogImageRow, requireScopeTag = false): boolean {
  const meta = row?.metadata && typeof row.metadata === "object" ? row.metadata : null;
  return (
    isStyleSeedGeneratedFor(meta?.generated_for) &&
    String(meta?.ai_model || "").trim() === SUBCATEGORY_IMAGE_CATALOG_MODEL_ID &&
    (!requireScopeTag || Boolean(String(meta?.scope_key || "").trim()))
  );
}

function logCatalog(label: string, data: Record<string, unknown>) {
  try {
    const text = JSON.stringify(data);
    console.log(`[style-seed] ${label} ${text.length > 4000 ? `${text.slice(0, 4000)}...` : text}`);
  } catch {
    console.log(`[style-seed] ${label}`);
  }
}

function buildContextPrompt(params: {
  question?: string | null;
  serviceSummary?: string | null;
  categoryName?: string | null;
  subcategoryName?: string | null;
}): string {
  const serviceSummary = sanitizeVisualContextText(params.serviceSummary);
  const categoryName = sanitizeVisualContextText(params.categoryName);
  const subcategoryName = sanitizeVisualContextText(params.subcategoryName);
  const question = sanitizeVisualContextText(params.question) || "Choose a direction.";
  const subject = serviceSummary || [categoryName, subcategoryName].filter(Boolean).join(": ") || subcategoryName || "Service";
  return `${subject}: ${question}`;
}

export function buildCatalogKeyForOption(option: CatalogOptionInput): string {
  const raw =
    String(option.imagePrompt || "").trim() ||
    String(option.label || "").trim() ||
    String(option.value || "").trim();
  const tier = normalizeCatalogFinishTier(option.finishTier || option.priceTier);
  const scope = String(option.scopeKey || option.scope || "").trim();
  return normalizeText([scope, raw, tier].filter(Boolean).join(" "));
}

export function buildCatalogPromptForOption(params: {
  option: CatalogOptionInput;
  question?: string | null;
  serviceSummary?: string | null;
  categoryName?: string | null;
  subcategoryName?: string | null;
}): string {
  const promptText =
    sanitizeVisualContextText(params.option.imagePrompt) ||
    sanitizeVisualContextText(params.option.label) ||
    sanitizeVisualContextText(params.option.value) ||
    "Design direction";
  const description = sanitizeVisualContextText(params.option.description);
  const tier = normalizeCatalogFinishTier(params.option.finishTier || params.option.priceTier);
  const tierSuffix = tier && FINISH_TIER_DESCS[tier] ? ` Finish-quality cues: ${FINISH_TIER_DESCS[tier]}` : "";
  const scope = sanitizeVisualContextText(params.option.scope);
  const scopeSuffix = scope ? ` The visible project scope must specifically feature ${scope}.` : "";
  const context = buildContextPrompt(params);
  const descriptionSuffix = description ? ` Direction details: ${description}` : "";
  return `Photorealistic photo of one finished scene, not a split-screen or before-and-after layout. No text, no words, no letters, no labels, no captions, no watermarks, no signs. ${context}.${scopeSuffix} Option: ${promptText}.${descriptionSuffix}${tierSuffix}`;
}

export async function listCatalogImages(params: {
  supabase: any;
  subcategoryId: string;
  accountId?: string | null;
  includeGlobal?: boolean;
  requireScopeTag?: boolean;
}): Promise<CatalogImageRow[]> {
  const selectCols = "id, image_url, metadata, created_at, prompt_id, subcategory_id, status, account_id, user_id";
  const accountId = String(params.accountId || "").trim() || null;
  const [accountResult, globalResult] = await Promise.all([
    accountId
      ? params.supabase
          .from("images")
          .select(selectCols)
          .eq("subcategory_id", params.subcategoryId)
          .eq("account_id", accountId)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    params.includeGlobal === false
      ? Promise.resolve({ data: [], error: null })
      : params.supabase
          .from("images")
          .select(selectCols)
          .eq("subcategory_id", params.subcategoryId)
          .is("account_id", null)
          .eq("status", "completed")
          .order("created_at", { ascending: false })
          .limit(100),
  ]);

  const merged = [...(Array.isArray(accountResult.data) ? accountResult.data : []), ...(Array.isArray(globalResult.data) ? globalResult.data : [])];
  const seen = new Set<string>();
  const filtered: CatalogImageRow[] = [];
  for (const row of merged as CatalogImageRow[]) {
    if (!row?.id || seen.has(row.id) || !isCatalogImage(row, params.requireScopeTag === true)) continue;
    seen.add(row.id);
    filtered.push(row);
  }
  return filtered;
}

async function uploadCatalogImageFromUrl(params: {
  supabase: any;
  imageUrl: string;
  subcategoryId: string;
  fileHint: string;
}): Promise<{ publicUrl: string; storagePath: string } | null> {
  const resp = await fetch(params.imageUrl, { cache: "no-store" });
  if (!resp.ok) {
    logCatalog("upload_fetch_failed", {
      imageUrl: params.imageUrl,
      status: resp.status,
      subcategoryId: params.subcategoryId,
    });
    return null;
  }
  const contentType = String(resp.headers.get("content-type") || "image/webp").trim() || "image/webp";
  const storagePath = `${IMAGE_STORAGE_PREFIXES.subcategory}/${params.subcategoryId}/${Date.now()}-${slugifySegment(params.fileHint)}.webp`;
  const bytes = new Uint8Array(await resp.arrayBuffer());
  const upload = await params.supabase.storage.from(IMAGES_BUCKET).upload(storagePath, bytes, {
    cacheControl: "3600",
    contentType,
    upsert: false,
  });
  if (upload.error) {
    logCatalog("storage_upload_failed", {
      contentType,
      error: upload.error.message,
      storagePath,
      subcategoryId: params.subcategoryId,
    });
    return null;
  }
  const publicData = params.supabase.storage.from(IMAGES_BUCKET).getPublicUrl(upload.data.path);
  const publicUrl = String(publicData?.data?.publicUrl || "");
  if (!publicUrl) {
    logCatalog("public_url_missing", {
      storagePath,
      subcategoryId: params.subcategoryId,
    });
    return null;
  }
  return { publicUrl, storagePath };
}

export async function persistGeneratedCatalogImages(params: {
  supabase: any;
  generatedOptions: any[];
  options: CatalogOptionInput[];
  scope: "global" | "account";
  accountId?: string | null;
  instanceId?: string | null;
  subcategoryId: string;
  subcategoryName?: string | null;
  categoryName?: string | null;
  question?: string | null;
  serviceSummary?: string | null;
  source: "instance_seed" | "widget_option_images";
  stepId?: string | null;
}): Promise<number> {
  const currentRows = await listCatalogImages({
    accountId: params.scope === "account" ? params.accountId : null,
    includeGlobal: params.scope === "global",
    requireScopeTag: true,
    subcategoryId: params.subcategoryId,
    supabase: params.supabase,
  });
  const remainingSlots = Math.max(0, SUBCATEGORY_IMAGE_CATALOG_MAX_IMAGES - currentRows.length);
  if (remainingSlots === 0) return 0;

  const responseByKey = new Map<string, any>();
  for (const item of Array.isArray(params.generatedOptions) ? params.generatedOptions : []) {
    const key = buildCatalogKeyForOption({
      description: typeof item?.description === "string" ? item.description : typeof item?.descriptor === "string" ? item.descriptor : null,
      imagePrompt: typeof item?.image_prompt === "string" ? item.image_prompt : typeof item?.imagePrompt === "string" ? item.imagePrompt : null,
      label: typeof item?.label === "string" ? item.label : null,
      finishTier:
        typeof item?.finish_tier === "string"
          ? item.finish_tier
          : typeof item?.finishTier === "string"
            ? item.finishTier
            : typeof item?.price_tier === "string"
              ? item.price_tier
              : typeof item?.priceTier === "string"
                ? item.priceTier
                : null,
      scope:
        typeof item?.scope === "string"
          ? item.scope
          : typeof item?.scope_label === "string"
            ? item.scope_label
            : null,
      scopeKey:
        typeof item?.scopeKey === "string"
          ? item.scopeKey
          : typeof item?.scope_key === "string"
            ? item.scope_key
            : null,
      value: typeof item?.value === "string" ? item.value : null,
    });
    if (!key || responseByKey.has(key)) continue;
    responseByKey.set(key, item);
  }

  let stored = 0;

  for (const option of params.options) {
    if (stored >= remainingSlots) break;
    const key = buildCatalogKeyForOption(option);
    if (!key) continue;
    const generated = responseByKey.get(key);
    const manifest = option.manifest && typeof option.manifest === "object" ? option.manifest : null;
    const pricingPreflight = option.pricingPreflight && typeof option.pricingPreflight === "object"
      ? option.pricingPreflight
      : null;
    if (!manifest || manifest.version !== 1 || manifest.source !== "planned" || !Array.isArray(manifest.components) || !manifest.components.length) {
      logCatalog("manifest_preflight_missing", { key, subcategoryId: params.subcategoryId });
      continue;
    }
    if (pricingPreflight?.status !== "complete") {
      logCatalog("pricing_preflight_missing", { key, subcategoryId: params.subcategoryId });
      continue;
    }
    const imageUrl =
      typeof generated?.imageUrl === "string"
        ? generated.imageUrl
        : typeof generated?.image_url === "string"
          ? generated.image_url
          : typeof generated?.image === "string"
            ? generated.image
            : "";
    if (!isHttpImageUrl(imageUrl)) {
      logCatalog("missing_generated_image_url", {
        key,
        optionLabel: option.label || null,
        optionValue: option.value || null,
        subcategoryId: params.subcategoryId,
      });
      continue;
    }

    const promptText = buildCatalogPromptForOption({
      categoryName: params.categoryName,
      option,
      question: params.question,
      serviceSummary: params.serviceSummary,
      subcategoryName: params.subcategoryName,
    });
    const upload = await uploadCatalogImageFromUrl({
      fileHint: `${option.label || option.value || key}`,
      imageUrl,
      subcategoryId: params.subcategoryId,
      supabase: params.supabase,
    });
    if (!upload) {
      logCatalog("upload_failed", {
        imageUrl,
        key,
        subcategoryId: params.subcategoryId,
      });
      continue;
    }

    const promptInsert = await params.supabase
      .from("prompts")
      .insert({
        account_id: params.scope === "account" ? params.accountId || null : null,
        prompt: promptText,
        subcategory_id: params.subcategoryId,
        suggestion_label: buildSuggestionLabel(
          promptText,
          String(option.label || option.value || "").trim() || null
        ),
        variables: null,
      })
      .select("id")
      .single();
    if (promptInsert.error) {
      logCatalog("prompt_insert_failed", {
        error: promptInsert.error.message,
        key,
        subcategoryId: params.subcategoryId,
      });
    }
    const promptId = String(promptInsert?.data?.id || "");

    const imageInsert = await params.supabase
      .from("images")
      .insert({
        account_id: params.scope === "account" ? params.accountId || null : null,
        image_url: upload.publicUrl,
        instance_id: null,
        metadata: {
          ai_model: SUBCATEGORY_IMAGE_CATALOG_MODEL_ID,
          catalog_key: key,
          catalog_scope: params.scope,
          category_name: String(params.categoryName || "").trim() || null,
          generated_for: STYLE_SEED_GENERATED_FOR,
          image_prompt_source: String(option.imagePrompt || "").trim() || null,
          model_name: "Flux 2 Pro",
          model_provider: "Replicate",
          option_description: String(option.description || "").trim() || null,
          option_label: String(option.label || "").trim() || null,
          option_value: String(option.value || "").trim() || null,
          origin_instance_id: String(params.instanceId || "").trim() || null,
          finish_tier: normalizeCatalogFinishTier(option.finishTier || option.priceTier) || null,
          scope: String(option.scope || "").trim() || null,
          scope_key: String(option.scopeKey || option.scope || "").trim() || null,
          prompt_text: promptText,
          question_text: String(params.question || "").trim() || null,
          s3_path: upload.storagePath,
          source: params.source,
          source_step_id: String(params.stepId || "").trim() || null,
          subcategory_id: params.subcategoryId,
          subcategory_name: String(params.subcategoryName || "").trim() || null,
          priceable_manifest: manifest,
          gallery_enrichment: {
            version: 1,
            pipelineSource: "planned",
            provenance: { modelId: SUBCATEGORY_IMAGE_CATALOG_MODEL_ID },
            qa: { status: "keep", reason: "planned_manifest", scores: {}, artifacts: [] },
            priceableManifest: manifest,
            before: {
              status: "not_generated",
              attempts: 0,
              disclosure: "ai_generated_illustrative_before",
            },
            verification: {
              status: "uncertain",
              confidence: 0,
              sameScene: false,
              beforePlausible: false,
              afterQualityValid: false,
              manifestCoverage: [],
              verifiedComponents: [],
              unsupportedObservations: [],
              observedDelta: [],
              assumptions: [],
              failureReasons: [],
            },
            pricing: pricingPreflight,
            publish: { status: "pending" },
            stages: {
              manifest: { version: 1, status: "complete", attempts: 1 },
              pricePreflight: { version: 1, status: "complete", attempts: 1 },
              after: { version: 1, status: "complete", attempts: 1 },
            },
          },
        } as Json,
        model_id: null,
        negative_prompt: null,
        prompt_id: promptId || null,
        replicate_prediction_id: null,
        status: "completed",
        subcategory_id: params.subcategoryId,
        user_id: null,
      })
      .select("id")
      .single();

    if (imageInsert.error) {
      logCatalog("image_insert_failed", {
        error: imageInsert.error.message,
        key,
        storagePath: upload.storagePath,
        subcategoryId: params.subcategoryId,
      });
      await params.supabase.storage.from(IMAGES_BUCKET).remove([upload.storagePath]).catch(() => undefined);
      continue;
    }

    logCatalog("image_stored", {
      imageId: imageInsert.data?.id ?? null,
      key,
      storagePath: upload.storagePath,
      subcategoryId: params.subcategoryId,
    });
    stored += 1;
  }

  return stored;
}

export function isSystemOwnedSubcategory(row: { account_id?: string | null; user_id?: string | null } | null | undefined): boolean {
  return !row?.account_id && !row?.user_id;
}

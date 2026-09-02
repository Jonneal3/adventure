import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/server/logger';
import { buildStudioStarterConcepts } from '@/lib/studio/starter-concepts';
import { v2ScopeStarterKey } from '@/lib/adventure-v2/scope-starter-catalog';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

function coerceSubcategoryComponents(
  raw: unknown,
): Array<{ key: string; label: string; priority: number }> {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const items: Array<{ key: string; label: string; priority: number }> = [];
  for (const [index, entry] of raw.entries()) {
    if (!entry || typeof entry !== "object") continue;
    const key = typeof (entry as any).key === "string" ? (entry as any).key.trim() : "";
    if (!key) continue;
    const dedupeKey = key.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const label =
      typeof (entry as any).label === "string" && (entry as any).label.trim()
        ? (entry as any).label.trim()
        : key;
    const priorityRaw = Number((entry as any).priority);
    items.push({
      key,
      label,
      priority: Number.isFinite(priorityRaw) ? priorityRaw : index + 1,
    });
  }
  return items;
}

function coerceSubcategoryScope(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    const s = typeof x === "string" ? x.trim() : "";
    if (s.length < 1) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s.slice(0, 200));
    if (out.length >= 16) break;
  }
  return out;
}

/** Hero CTA fields live on category_subcategory_seo after migration 20260127000002. */
const CATEGORIES_SUBCAT_SELECT_WITH_SEO =
  "id, subcategory, category_id, service_summary, subcategory_components, subcategory_scope, customer_label, visual_eligible, photo_subject, photo_context, category_subcategory_seo(hero_cta_url, hero_cta_text), categories(name)";
const CATEGORIES_SUBCAT_SELECT_WITH_SEO_NO_PHOTO =
  "id, subcategory, category_id, service_summary, subcategory_components, subcategory_scope, customer_label, visual_eligible, category_subcategory_seo(hero_cta_url, hero_cta_text), categories(name)";
/** Pre-split DBs: hero_cta_* still on categories_subcategories. */
const CATEGORIES_SUBCAT_SELECT_WITH_HERO =
  "id, subcategory, category_id, service_summary, subcategory_components, subcategory_scope, customer_label, visual_eligible, photo_subject, photo_context, hero_cta_url, hero_cta_text, categories(name)";
const CATEGORIES_SUBCAT_SELECT_WITH_HERO_NO_PHOTO =
  "id, subcategory, category_id, service_summary, subcategory_components, subcategory_scope, customer_label, visual_eligible, hero_cta_url, hero_cta_text, categories(name)";
const CATEGORIES_SUBCAT_SELECT_BASE =
  "id, subcategory, category_id, service_summary, subcategory_components, subcategory_scope, customer_label, visual_eligible, photo_subject, photo_context, categories(name)";
const CATEGORIES_SUBCAT_SELECT_BASE_NO_PHOTO =
  "id, subcategory, category_id, service_summary, subcategory_components, subcategory_scope, customer_label, visual_eligible, categories(name)";
const CATEGORIES_SUBCAT_SELECT_MINIMAL =
  "id, subcategory, category_id, service_summary, subcategory_components, categories(name)";

/** Legacy selects without customer_label (pre-migration). */
const CATEGORIES_SUBCAT_SELECT_WITH_SEO_LEGACY =
  "id, subcategory, category_id, service_summary, subcategory_components, subcategory_scope, category_subcategory_seo(hero_cta_url, hero_cta_text), categories(name)";
const CATEGORIES_SUBCAT_SELECT_WITH_HERO_LEGACY =
  "id, subcategory, category_id, service_summary, subcategory_components, subcategory_scope, hero_cta_url, hero_cta_text, categories(name)";
const CATEGORIES_SUBCAT_SELECT_BASE_LEGACY =
  "id, subcategory, category_id, service_summary, subcategory_components, subcategory_scope, categories(name)";

function deriveCustomerLabel(businessLabel: string): string {
  const raw = String(businessLabel || "").trim();
  const cleaned = raw.replace(/\s*\(service\)\s*$/i, "").trim() || raw;
  const rules: Array<[RegExp, string]> = [
    [/^hardscaping$/i, "Patios, walkways & outdoor structures"],
    [/^landscaping$/i, "Yard & garden design"],
    [/^landscape design$/i, "Outdoor design"],
    [/^outdoor living$/i, "Outdoor living spaces"],
    [/^bathroom remodels?$/i, "Bathroom remodel"],
    [/^bathroom remodeling$/i, "Bathroom remodel"],
    [/^kitchen remodels?$/i, "Kitchen remodel"],
    [/^kitchen remodeling$/i, "Kitchen remodel"],
  ];
  for (const [re, label] of rules) {
    if (re.test(cleaned)) return label;
  }
  return cleaned.replace(/\bRemodeling\b/g, "Remodel");
}

function shouldRetryCategoriesSubcatSelect(err: unknown): boolean {
  const e = err as { code?: string; message?: string };
  const code = String(e?.code ?? "");
  const msg = String(e?.message ?? "");
  if (code === "42703" || code === "PGRST200") return true;
  if (/does not exist/i.test(msg)) return true;
  if (/relationship/i.test(msg) && /category_subcategory_seo/i.test(msg)) return true;
  return false;
}

async function fetchCategoriesSubcategoriesForWidget(
  supabase: SupabaseClient<any, 'public', any>,
  ids: string[],
): Promise<{ data: any[] | null; error: { message?: string; code?: string } | null }> {
  if (ids.length === 0) return { data: [], error: null };
  const trySelect = async (cols: string) =>
    supabase.from("categories_subcategories").select(cols).in("id", ids).limit(60);

  let res = await trySelect(CATEGORIES_SUBCAT_SELECT_WITH_SEO);
  if (!res.error) return res;

  const err0 = res.error as any;
  let msg0 = String(err0?.message || "");
  if (!shouldRetryCategoriesSubcatSelect(err0)) return res;

  // photo_subject / photo_context were added after the V8 upload experience.
  // Keep older databases readable while deployments roll through environments.
  if (/photo_subject|photo_context/i.test(msg0)) {
    res = await trySelect(CATEGORIES_SUBCAT_SELECT_WITH_SEO_NO_PHOTO);
    if (!res.error) return res;
    msg0 = String((res.error as any)?.message || msg0);
  }

  // customer_label / visual_eligible may be missing pre-migration.
  if (/customer_label|visual_eligible/i.test(msg0)) {
    res = await trySelect(CATEGORIES_SUBCAT_SELECT_WITH_SEO_LEGACY);
    if (!res.error) return res;
  }

  res = await trySelect(CATEGORIES_SUBCAT_SELECT_WITH_HERO);
  if (res.error && /photo_subject|photo_context/i.test(String((res.error as any)?.message || ""))) {
    res = await trySelect(CATEGORIES_SUBCAT_SELECT_WITH_HERO_NO_PHOTO);
  }
  if (!res.error) {
    logger.warn("[widget] categories_subcategories: using legacy hero_cta columns (no category_subcategory_seo embed)", {
      firstError: msg0,
    });
    return res;
  }

  const err1 = res.error as any;
  const msg1 = String(err1?.message || "");
  if (!shouldRetryCategoriesSubcatSelect(err1)) return res;

  if (/customer_label|visual_eligible/i.test(msg1)) {
    res = await trySelect(CATEGORIES_SUBCAT_SELECT_WITH_HERO_LEGACY);
    if (!res.error) return res;
  }

  res = await trySelect(CATEGORIES_SUBCAT_SELECT_BASE);
  if (res.error && /photo_subject|photo_context/i.test(String((res.error as any)?.message || ""))) {
    res = await trySelect(CATEGORIES_SUBCAT_SELECT_BASE_NO_PHOTO);
  }
  if (res.error && /customer_label|visual_eligible/i.test(String((res.error as any)?.message || ""))) {
    res = await trySelect(CATEGORIES_SUBCAT_SELECT_BASE_LEGACY);
  }
  if (!res.error) {
    logger.warn("[widget] categories_subcategories: using select without hero CTA", { firstError: msg0, secondError: msg1 });
    return res;
  }

  const err2 = res.error as any;
  const msg2 = String(err2?.message || "");
  if (!shouldRetryCategoriesSubcatSelect(err2)) return res;

  res = await trySelect(CATEGORIES_SUBCAT_SELECT_MINIMAL);
  if (!res.error) {
    logger.warn("[widget] categories_subcategories: using minimal select (subcategory_scope or other col missing)", {
      firstError: msg0,
      secondError: msg1,
      thirdError: msg2,
    });
  }
  return res;
}

function coerceHeroCtaText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t || null;
}

function normalizeCatalogFinishTier(raw: unknown): string | null {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return null;
  if (/^(\$|starter|value|budget|economy)$/.test(value)) return "value";
  if (/^(\$\$|mid|middle|standard|upper|upper-mid)$/.test(value)) return "mid";
  if (/^(\$\$\$|plus|premium|high)$/.test(value)) return "premium";
  if (/^(\$\$\$\$|luxury|lux|estate|bespoke)$/.test(value)) return "luxury";
  return value.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || null;
}

/** Prefer category_subcategory_seo (current schema); fall back to legacy columns on the row. */
function pickHeroCtaFromSubcatRow(s: any): { url: string | null; text: string | null } {
  const seo = s?.category_subcategory_seo;
  const nested = Array.isArray(seo) ? seo[0] : seo;
  if (nested && typeof nested === "object") {
    return {
      url: coerceHeroCtaUrl((nested as any).hero_cta_url),
      text: coerceHeroCtaText((nested as any).hero_cta_text),
    };
  }
  return {
    url: coerceHeroCtaUrl(s?.hero_cta_url),
    text: coerceHeroCtaText(s?.hero_cta_text),
  };
}

function coerceHeroCtaUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (lower.startsWith("http://") || lower.startsWith("https://")) return t;
  return null;
}

const V8_QUALITY_CATALOG_MODEL_ID = "black-forest-labs/flux-2-pro";
const V8_QUALITY_CATALOG_READY_COUNT = 24;

function isPublishReadyGalleryMetadata(metadata: any): boolean {
  return (
    metadata?.gallery_enrichment?.version === 1 &&
    metadata?.gallery_enrichment?.publish?.status === "ready"
  );
}

function buildCatalogStyleOptions(rows: any[]): {
  options: Array<{
    label: string;
    value: string;
    imageUrl: string;
    description?: string | null;
    finishTier?: string | null;
    priceTier?: string | null;
    featuredRank?: number | null;
    imageId?: string | null;
    catalogKey?: string | null;
    catalogSource?: "account" | "global";
    generatedFor?: string;
    timesShown?: number;
    timesSelected?: number;
    timesSaved?: number;
    conversions?: number;
    scope?: string | null;
    scopeKey?: string | null;
  }>;
  question: string | null;
} {
  const CATALOG_GENERATED_FOR = new Set([
    "style_seed",
    "subcategory_catalog",
    "adventure_v7",
    "adventure_v8",
    "v2_scope_starter",
    "v2_neutral_scope_starter",
    "v2_service_starter",
    "refinement_option",
  ]);

  const seen = new Set<string>();
  const qualityCatalogReady = (Array.isArray(rows) ? rows : []).filter((row) => {
    const meta = row?.metadata && typeof row.metadata === "object" ? row.metadata : null;
    return (
      isPublishReadyGalleryMetadata(meta) &&
      String(meta?.generated_for || "").trim() === "style_seed" &&
      String(meta?.ai_model || "").trim() === V8_QUALITY_CATALOG_MODEL_ID &&
      Boolean(String(meta?.scope_key || "").trim())
    );
  }).length >= V8_QUALITY_CATALOG_READY_COUNT;
  const options: Array<{
    label: string;
    value: string;
    imageUrl: string;
    description?: string | null;
    finishTier?: string | null;
    priceTier?: string | null;
    featuredRank?: number | null;
    imageId?: string | null;
    catalogKey?: string | null;
    catalogSource?: "account" | "global";
    generatedFor?: string;
    timesShown?: number;
    timesSelected?: number;
    timesSaved?: number;
    conversions?: number;
    scope?: string | null;
    scopeKey?: string | null;
  }> = [];
  let question: string | null = null;

  for (const row of Array.isArray(rows) ? rows : []) {
    const meta = row?.metadata && typeof row.metadata === "object" ? row.metadata : null;
    const generatedFor = String(meta?.generated_for || "").trim();
    if (!meta || !isPublishReadyGalleryMetadata(meta) || !CATALOG_GENERATED_FOR.has(generatedFor)) continue;
    // Keep the previous catalog visible while its quality backfill is running,
    // then retire fast-model seed rows from visitor retrieval in one swap.
    if (
      qualityCatalogReady &&
      generatedFor === "style_seed" &&
      (
        String(meta.ai_model || "").trim() !== V8_QUALITY_CATALOG_MODEL_ID ||
        !String(meta.scope_key || "").trim()
      )
    ) {
      continue;
    }

    const imageUrl = typeof row?.image_url === "string" ? row.image_url.trim() : "";
    if (!imageUrl) continue;

    // Different catalog generations store labels in different fields.
    const label = String(
      meta.option_label
        || meta.starter_variant_label
        || meta.refinement_variation_label
        || meta.starter_scope
        || meta.refinement_category_label
        || meta.service_name
        || meta.option_value
        || ""
    ).trim();
    const value = String(
      meta.option_value
        || meta.starter_variant_key
        || meta.refinement_variation_key
        || meta.starter_scope_key
        || meta.catalog_key
        || label
    ).trim();
    if (!label || !value) continue;

    const catalogKey = String(
      meta.catalog_key
        || meta.starter_variant_key
        || meta.refinement_variation_key
        || `${generatedFor}:${value}`
    ).trim();
    const dedupeKey = (catalogKey || value).toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const description = String(
      meta.option_description
        || meta.starter_scope
        || meta.refinement_reason
        || meta.refinement_category_label
        || ""
    ).trim();
    const scope = String(meta.scope || meta.starter_scope || meta.refinement_category_label || "").trim() || null;
    const finishTier = normalizeCatalogFinishTier(
      meta.finish_tier
        || meta.estimated_finish_tier
        || meta?.discovery?.estimated_finish_tier
        || meta.price_tier // legacy rows remain readable during migration
        || ""
    );
    const priceTier = typeof meta.price_tier === "string" && meta.price_tier.trim()
      ? meta.price_tier.trim()
      : null;

    const stats =
      meta.adventure_stats && typeof meta.adventure_stats === "object" ? meta.adventure_stats : null;

    const scopeKey = String(meta.scope_key || meta.starter_scope_key || (scope ? v2ScopeStarterKey(scope) : "") || "").trim() || null;

    options.push({
      label,
      value,
      imageUrl,
      ...(description ? { description } : {}),
      ...(finishTier ? { finishTier } : {}),
      ...(priceTier ? { priceTier } : {}),
      ...(Number.isFinite(Number(meta.featured_rank ?? meta.featuredRank)) && Number(meta.featured_rank ?? meta.featuredRank) > 0
        ? { featuredRank: Math.floor(Number(meta.featured_rank ?? meta.featuredRank)) }
        : {}),
      ...(typeof row?.id === "string" && row.id.trim() ? { imageId: row.id.trim() } : {}),
      ...(catalogKey ? { catalogKey } : {}),
      catalogSource: typeof row?.account_id === "string" && row.account_id.trim() ? "account" : "global",
      ...(scope ? { scope } : {}),
      ...(scopeKey ? { scopeKey } : {}),
      generatedFor,
      ...(stats
        ? {
            timesShown: Number(stats.shown || 0) || undefined,
            timesSelected: Number(stats.selected || 0) || undefined,
            timesSaved: Number(stats.saved || 0) || undefined,
            conversions: Number(stats.conversions || 0) || undefined,
          }
        : {}),
    });
    if (!question && typeof meta.question_text === "string" && meta.question_text.trim()) {
      question = meta.question_text.trim();
    }
  }

  return { options, question };
}

/**
 * Exact scope → cover map for Adventure V7 focus cards.
 * Only v2_scope_starter rows; account images win over global. No fuzzy matching.
 */
function buildScopeCovers(rows: any[]): Record<string, { imageUrl: string; imageId?: string; scopeKey: string }> {
  type Cover = { imageUrl: string; imageId?: string; scopeKey: string; account: boolean };
  const byKey = new Map<string, Cover>();
  const byLabel = new Map<string, Cover>();

  for (const row of Array.isArray(rows) ? rows : []) {
    const meta = row?.metadata && typeof row.metadata === "object" ? row.metadata : null;
    if (!meta || !isPublishReadyGalleryMetadata(meta) || String(meta.generated_for || "").trim() !== "v2_scope_starter") continue;
    const imageUrl = typeof row?.image_url === "string" ? row.image_url.trim() : "";
    if (!/^https?:\/\//i.test(imageUrl)) continue;
    const scopeLabel = String(meta.starter_scope || "").trim();
    const scopeKey = String(meta.starter_scope_key || (scopeLabel ? v2ScopeStarterKey(scopeLabel) : "") || "").trim();
    if (!scopeKey && !scopeLabel) continue;
    const account = typeof row?.account_id === "string" && Boolean(row.account_id.trim());
    const cover: Cover = {
      imageUrl,
      ...(typeof row?.id === "string" && row.id.trim() ? { imageId: row.id.trim() } : {}),
      scopeKey: scopeKey || v2ScopeStarterKey(scopeLabel),
      account,
    };
    const key = cover.scopeKey;
    const existing = byKey.get(key);
    if (!existing || (account && !existing.account)) {
      byKey.set(key, cover);
    }
    if (scopeLabel) {
      const labelKey = scopeLabel.toLowerCase();
      const existingLabel = byLabel.get(labelKey);
      if (!existingLabel || (account && !existingLabel.account)) {
        byLabel.set(labelKey, cover);
      }
    }
  }

  const out: Record<string, { imageUrl: string; imageId?: string; scopeKey: string }> = {};
  for (const [key, cover] of byKey) {
    const { account: _a, ...rest } = cover;
    out[key] = rest;
  }
  for (const [label, cover] of byLabel) {
    if (!out[label]) {
      const { account: _a, ...rest } = cover;
      out[label] = rest;
    }
  }
  return out;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  const timestamp = new Date().toISOString();
  const startedAtMs = Date.now();
  const requestId = `instance_${startedAtMs.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  
  try {
    const instanceId = params.instanceId;
    const requestUrl = new URL(request.url);
    const intakeOnly = requestUrl.searchParams.get("phase") === "intake";
    const debugEnabled = (() => {
      try {
        const v = (requestUrl.searchParams.get("debug") || requestUrl.searchParams.get("ai_form_debug") || requestUrl.searchParams.get("form_debug") || "")
          .trim()
          .toLowerCase();
        return v === "1" || v === "true" || v === "yes" || v === "on";
      } catch {
        return false;
      }
    })();
    const hintedServiceId = (() => {
      try {
        const raw =
          requestUrl.searchParams.get("serviceId") ||
          requestUrl.searchParams.get("service_id") ||
          requestUrl.searchParams.get("service") ||
          null;
        return raw ? String(raw).trim() : null;
      } catch {
        return null;
      }
    })();
    if (debugEnabled) {
      logger.info("[instance] REQUEST", {
        requestId,
        instanceId,
        hintedServiceId,
        method: request.method,
        url: request.url,
      });
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Try service role key first, fallback to anon key
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Missing environment variables' },
        { status: 500, headers: { "X-Request-Id": requestId } }
      );
    }

    // Create a fresh Supabase client for each request to avoid any caching
    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Cache-Bust': Date.now().toString()
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    // One instance read is enough: it both verifies existence and supplies config.
    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .select('*')
      .eq('id', instanceId)
      .single();
      
    // Log any query errors for debugging
    if (instanceError) {
      
    }

    if (instanceError) {
      
      return NextResponse.json({
        error: 'Instance not found',
        instanceId: instanceId,
        errorCode: instanceError.code,
        errorMessage: instanceError.message,
        details: 'This could be due to RLS policy blocking access (is_public = false) or instance does not exist'
      }, { status: 404, headers: { "X-Request-Id": requestId } });
    }

    const responseTimestamp = new Date().toISOString();

    // Provide deterministic service options to the client so the form can render
    // service-selection without needing to hit /api/ai-form/:id/generate-steps.
    let serviceOptions: Array<{
      label: string;
      value: string;
      industryId?: string | null;
      industryName?: string | null;
      serviceName?: string | null;
      serviceSummary?: string | null;
      photoSubject?: string | null;
      photoContext?: string | null;
      heroCtaUrl?: string | null;
      heroCtaText?: string | null;
      subcategoryComponents?: Array<{
        key: string;
        label: string;
        priority: number;
      }>;
      subcategoryScope?: string[];
      styleQuestion?: string | null;
      styleOptions?: Array<{
        label: string;
        value: string;
        imageUrl: string;
        description?: string | null;
        finishTier?: string | null;
        priceTier?: string | null;
        featuredRank?: number | null;
        imageId?: string | null;
        catalogKey?: string | null;
        catalogSource?: "account" | "global";
        generatedFor?: string;
        timesShown?: number;
        timesSelected?: number;
        timesSaved?: number;
        conversions?: number;
        scope?: string | null;
        scopeKey?: string | null;
      }>;
    }> = [];
    try {
      const { data: instanceSubcats, error: instanceSubcatsError } = await supabase
        .from("instance_subcategories")
        .select("category_subcategory_id")
        .eq("instance_id", instanceId);
      if (instanceSubcatsError) {
        logger.warn("[widget] Failed to read instance_subcategories for serviceOptions", {
          instanceId,
          error: instanceSubcatsError.message,
          code: (instanceSubcatsError as any).code,
        });
      }
      if (Array.isArray(instanceSubcats) && instanceSubcats.length > 0) {
        const ids = instanceSubcats
          .map((r: any) => r?.category_subcategory_id)
          .filter(Boolean) as string[];
        if (ids.length > 0) {
          const { data: subcats, error: subcatsError } = await fetchCategoriesSubcategoriesForWidget(supabase, ids);
          if (subcatsError) {
            logger.warn("[widget] Failed to read categories_subcategories for serviceOptions", {
              instanceId,
              error: subcatsError.message,
              code: (subcatsError as any).code,
            });
          }
          const metaById = new Map<
            string,
            {
              serviceName: string;
              industryId: string | null;
              industryName: string | null;
              serviceSummary: string | null;
              photoSubject: string | null;
              photoContext: string | null;
              customerLabel: string | null;
              visualEligible: boolean;
              heroCtaUrl: string | null;
              heroCtaText: string | null;
              subcategoryComponents: Array<{ key: string; label: string; priority: number }>;
              subcategoryScope: string[];
            }
          >(
            (Array.isArray(subcats) ? subcats : []).map((s: any) => {
              const serviceName = String(s?.subcategory || "Service");
              const industryId = s?.category_id ? String(s.category_id) : null;
              const serviceSummary = typeof (s as any)?.service_summary === "string" ? String((s as any).service_summary).trim() || null : null;
              const photoSubject = typeof (s as any)?.photo_subject === "string" ? String((s as any).photo_subject).trim() || null : null;
              const photoContext = typeof (s as any)?.photo_context === "string" ? String((s as any).photo_context).trim() || null : null;
              const storedCustomer =
                typeof (s as any)?.customer_label === "string" ? String((s as any).customer_label).trim() : "";
              const customerLabel = storedCustomer || deriveCustomerLabel(serviceName);
              const visualEligible =
                typeof (s as any)?.visual_eligible === "boolean" ? Boolean((s as any).visual_eligible) : true;
              const { url: heroCtaUrl, text: heroCtaText } = pickHeroCtaFromSubcatRow(s);
              const subcategoryComponents = coerceSubcategoryComponents((s as any)?.subcategory_components);
              const subcategoryScope = coerceSubcategoryScope((s as any)?.subcategory_scope);
              const cat = (s as any)?.categories;
              const industryName =
                cat && typeof cat === "object" && typeof (cat as any).name === "string"
                  ? String((cat as any).name)
                  : null;
              return [
                String(s.id),
                {
                  serviceName,
                  industryId,
                  industryName,
                  serviceSummary,
                  photoSubject,
                  photoContext,
                  customerLabel,
                  visualEligible,
                  heroCtaUrl,
                  heroCtaText,
                  subcategoryComponents,
                  subcategoryScope,
                },
              ];
            })
          );
          serviceOptions = ids
            .map((id) => {
              const meta = metaById.get(id) || {
                serviceName: "Service",
                industryId: null,
                industryName: null,
                serviceSummary: null,
                photoSubject: null,
                photoContext: null,
                customerLabel: "Service",
                visualEligible: true,
                heroCtaUrl: null as string | null,
                heroCtaText: null as string | null,
                subcategoryComponents: [],
                subcategoryScope: [] as string[],
              };
              const rawLabel = meta.serviceName || "Service";
              const businessLabel =
                rawLabel.replace(/\s*\(service\)\s*$/i, "").trim() || rawLabel;
              const customerLabel = meta.customerLabel || deriveCustomerLabel(businessLabel);
              return {
                value: id,
                label: customerLabel,
                businessLabel,
                customerLabel,
                serviceName: businessLabel,
                visualEligible: meta.visualEligible !== false,
                industryId: meta.industryId,
                industryName: meta.industryName,
                serviceSummary: meta.serviceSummary,
                photoSubject: meta.photoSubject,
                photoContext: meta.photoContext,
                ...(meta.heroCtaUrl != null ? { heroCtaUrl: meta.heroCtaUrl } : {}),
                ...(meta.heroCtaText != null ? { heroCtaText: meta.heroCtaText } : {}),
                ...(meta.subcategoryComponents.length > 0 ? { subcategoryComponents: meta.subcategoryComponents } : {}),
                ...(meta.subcategoryScope.length > 0 ? { subcategoryScope: meta.subcategoryScope } : {}),
              };
            })
            .filter((opt) => opt.visualEligible !== false)
            .slice(0, 40);
        }
      }
    } catch (e) {
      logger.warn("[widget] Failed to resolve serviceOptions", {
        instanceId,
        error: e instanceof Error ? e.message : String(e),
      });
    }

    // Fallbacks:
    // - If `instance_subcategories` isn't configured for this instance, use `config.aiFormConfig.services` when present.
    // - If the embed passes `?serviceId=...`, include that service so the form doesn't show a raw UUID text input.
    if (serviceOptions.length === 0) {
      const configServicesRaw = (instance as any)?.config?.aiFormConfig?.services;
      const configServices = Array.isArray(configServicesRaw)
        ? configServicesRaw.map((s: any) => (typeof s === "string" ? s.trim() : "")).filter(Boolean)
        : [];
      const candidateIds = (configServices.length > 0 ? configServices : hintedServiceId ? [hintedServiceId] : []).slice(
        0,
        40,
      );

      if (candidateIds.length > 0) {
        try {
          const { data: subcats, error: subcatsError } = await fetchCategoriesSubcategoriesForWidget(
            supabase,
            candidateIds,
          );
          if (subcatsError) {
            logger.warn("[widget] Failed to resolve fallback services from categories_subcategories", {
              instanceId,
              error: subcatsError.message,
              code: (subcatsError as any).code,
            });
          }

          const metaById = new Map<
            string,
            {
              label: string;
              industryId: string | null;
              industryName: string | null;
              serviceSummary: string | null;
              photoSubject: string | null;
              photoContext: string | null;
              heroCtaUrl: string | null;
              heroCtaText: string | null;
              subcategoryComponents: Array<{ key: string; label: string; priority: number }>;
              subcategoryScope: string[];
            }
          >(
            (Array.isArray(subcats) ? subcats : []).map((s: any) => {
              const rawLabel = String(s?.subcategory || "Service");
              const cleanedLabel = rawLabel.replace(/\s*\(service\)\s*$/i, "").trim() || rawLabel;
              const industryId = s?.category_id ? String(s.category_id) : null;
              const serviceSummary =
                typeof (s as any)?.service_summary === "string" ? String((s as any).service_summary).trim() || null : null;
              const photoSubject =
                typeof (s as any)?.photo_subject === "string" ? String((s as any).photo_subject).trim() || null : null;
              const photoContext =
                typeof (s as any)?.photo_context === "string" ? String((s as any).photo_context).trim() || null : null;
              const { url: heroCtaUrl, text: heroCtaText } = pickHeroCtaFromSubcatRow(s);
              const subcategoryComponents = coerceSubcategoryComponents((s as any)?.subcategory_components);
              const subcategoryScope = coerceSubcategoryScope((s as any)?.subcategory_scope);
              const cat = (s as any)?.categories;
              const industryName =
                cat && typeof cat === "object" && typeof (cat as any).name === "string"
                  ? String((cat as any).name)
                  : null;
              return [String(s.id), { label: cleanedLabel, industryId, industryName, serviceSummary, photoSubject, photoContext, heroCtaUrl, heroCtaText, subcategoryComponents, subcategoryScope }];
            }),
          );

          serviceOptions = candidateIds.map((id) => {
            const meta = metaById.get(id);
            const label = meta?.label || id;
            return {
              value: id,
              label,
              serviceName: label,
              industryId: meta?.industryId ?? null,
              industryName: meta?.industryName ?? null,
              serviceSummary: meta?.serviceSummary ?? null,
              photoSubject: meta?.photoSubject ?? null,
              photoContext: meta?.photoContext ?? null,
              ...(meta?.heroCtaUrl != null ? { heroCtaUrl: meta.heroCtaUrl } : {}),
              ...(meta?.heroCtaText != null ? { heroCtaText: meta.heroCtaText } : {}),
              ...(meta?.subcategoryComponents?.length ? { subcategoryComponents: meta.subcategoryComponents } : {}),
              ...(meta?.subcategoryScope?.length ? { subcategoryScope: meta.subcategoryScope } : {}),
            };
          });
        } catch (e) {
          logger.warn("[widget] Failed to build fallback serviceOptions", {
            instanceId,
            error: e instanceof Error ? e.message : String(e),
          });
          serviceOptions = candidateIds.map((id) => ({ value: id, label: id, serviceName: id }));
        }
      }
    }

    // Intake only needs labels and scope metadata. Catalog imagery is loaded by
    // the later visual stage, so keep it off the critical path for step one.
    if (serviceOptions.length > 0 && !intakeOnly) {
      try {
        const subcategoryIds = serviceOptions.map((opt) => String(opt.value || "").trim()).filter(Boolean);
        const accountId = typeof (instance as any)?.account_id === "string" ? String((instance as any).account_id).trim() : "";
        const selectCols = "id, subcategory_id, image_url, metadata, created_at, account_id";
        const [accountImages, globalImages] = await Promise.all([
          accountId
            ? supabase
                .from("images")
                .select(selectCols)
                .in("subcategory_id", subcategoryIds)
                .eq("account_id", accountId)
                .eq("status", "completed")
                .order("created_at", { ascending: false })
                .limit(500)
            : Promise.resolve({ data: [], error: null }),
          supabase
            .from("images")
            .select(selectCols)
            .in("subcategory_id", subcategoryIds)
            .is("account_id", null)
            .eq("status", "completed")
            .order("created_at", { ascending: false })
            .limit(500),
        ]);

        const rowsBySubcategory = new Map<string, any[]>();
        for (const row of [
          ...(Array.isArray(accountImages.data) ? accountImages.data : []),
          ...(Array.isArray(globalImages.data) ? globalImages.data : []),
        ]) {
          const subcategoryId = typeof row?.subcategory_id === "string" ? row.subcategory_id : "";
          if (!subcategoryId) continue;
          const bucket = rowsBySubcategory.get(subcategoryId) || [];
          bucket.push(row);
          rowsBySubcategory.set(subcategoryId, bucket);
        }

        serviceOptions = serviceOptions.map((opt) => {
          const subcategoryId = String(opt.value || "").trim();
          const rows = rowsBySubcategory.get(subcategoryId) || [];
          const catalog = buildCatalogStyleOptions(rows);
          const scopeCovers = buildScopeCovers(rows);
          const next = {
            ...opt,
            ...(Object.keys(scopeCovers).length > 0 ? { scopeCovers } : {}),
          };
          return catalog.options.length > 0
            ? {
                ...next,
                styleQuestion: catalog.question,
                styleOptions: catalog.options,
              }
            : next;
        });
      } catch (e) {
        logger.warn("[widget] Failed to resolve styleOptions", {
          instanceId,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // New Studio V1 reads this flat projection. Existing consumers continue using
    // serviceOptions[].styleOptions unchanged. The helper safely returns a shorter
    // set (including []) when a catalog does not have six valid public images yet.
    const starterConcepts = intakeOnly ? [] : buildStudioStarterConcepts(serviceOptions);

    const responseData = {
      success: true,
      instance: instance,
      serviceOptions,
      starterConcepts,
      images: [],
      totalImages: 0,
      fetchedAt: responseTimestamp,
      requestTimestamp: timestamp
    };
    
    const response = NextResponse.json(responseData);

    // Comprehensive cache control to prevent any caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    response.headers.set('Last-Modified', new Date().toUTCString());
    response.headers.set('ETag', `"${Date.now()}"`);
    response.headers.set("X-Request-Id", requestId);

    if (debugEnabled) {
      logger.info("[instance] RESPONSE", {
        requestId,
        instanceId,
        status: 200,
        durationMs: Date.now() - startedAtMs,
        hasServiceOptions: Array.isArray(serviceOptions) && serviceOptions.length > 0,
        starterConceptCount: starterConcepts.length,
        serviceOptions: (serviceOptions || []).slice(0, 20).map((opt: any) => ({
          serviceId: String(opt?.value || ""),
          label: typeof opt?.label === "string" ? opt.label : null,
          componentCount: Array.isArray(opt?.subcategoryComponents) ? opt.subcategoryComponents.length : 0,
          componentKeys: Array.isArray(opt?.subcategoryComponents)
            ? opt.subcategoryComponents.map((component: any) => String(component?.key || "")).filter(Boolean)
            : [],
        })),
      });
    }

    return response;

  } catch (error) {
    logger.error("[instance] ERROR", {
      requestId,
      instanceId: params.instanceId,
      durationMs: Date.now() - startedAtMs,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({
      error: 'Internal server error',
      instanceId: params.instanceId,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500, headers: { "X-Request-Id": requestId } });
  }
} 

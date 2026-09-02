import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import {
  isSystemOwnedSubcategory,
  listCatalogImages,
  persistGeneratedCatalogImages,
  SUBCATEGORY_IMAGE_CATALOG_MAX_SCOPE_BUCKETS,
  SUBCATEGORY_IMAGE_CATALOG_MIN_PER_SCOPE,
  SUBCATEGORY_IMAGE_CATALOG_MODEL_ID,
} from "@/lib/subcategory-image-catalog";
import {
  ensureRefinementLibraryForSubcategory,
  ensureSubcategoryScopeForSubcategory,
  resolveDspyServiceBaseUrls,
} from "@adventure/refinement-server";

export const dynamic = "force-dynamic";
// Quality catalog generation is intentionally off the visitor path and can
// take several provider rounds. Give the authenticated setup job enough room
// to finish its scope floor instead of dying at the platform's short default.
export const maxDuration = 300;

const SCOPE_SEED_CONCURRENCY = 3;

function resolveFormServiceBaseUrls(): string[] {
  return resolveDspyServiceBaseUrls();
}

function logSeed(label: string, data: Record<string, unknown>) {
  try {
    const text = JSON.stringify(data);
    console.log(`[subcategory-seed] ${label} ${text.length > 4000 ? `${text.slice(0, 4000)}...` : text}`);
  } catch {
    console.log(`[subcategory-seed] ${label}`);
  }
}

function scopeKey(value: unknown): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function catalogScopeBuckets(subcategory: any, subcategoryName: string): Array<{ key: string; label: string }> {
  const configured = Array.isArray(subcategory?.subcategory_scope) ? subcategory.subcategory_scope : [];
  const components = Array.isArray(subcategory?.subcategory_components) ? subcategory.subcategory_components : [];
  const raw = configured.length
    ? configured
    : components.map((item: any) => typeof item === "string" ? item : item?.label || item?.key);
  const fullLabel = /^full\b/i.test(subcategoryName) ? subcategoryName : `Full ${subcategoryName}`;
  const seen = new Set<string>();
  const out: Array<{ key: string; label: string }> = [];
  for (const value of [fullLabel, ...raw]) {
    const label = String(value || "").trim();
    const key = scopeKey(label);
    if (!label || !key || /^other$/i.test(label) || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label });
    if (out.length >= SUBCATEGORY_IMAGE_CATALOG_MAX_SCOPE_BUCKETS) break;
  }
  return out;
}

async function callFormServiceUpstream(params: {
  baseUrls: string[];
  path: string;
  payload: any;
}): Promise<{ ok: true; json: any } | { ok: false; error: any }> {
  let lastErr: any = null;
  for (const baseUrl of params.baseUrls) {
    const endpoint = new URL(params.path, baseUrl).toString();
    try {
      const resp = await fetch(endpoint, {
        body: JSON.stringify(params.payload),
        cache: "no-store",
        headers: { "content-type": "application/json" },
        method: "POST",
      });
      const text = await resp.text().catch(() => "");
      const json = text
        ? (() => {
            try {
              return JSON.parse(text);
            } catch {
              return null;
            }
          })()
        : null;
      if (!resp.ok) {
        lastErr = { details: json ?? text.slice(0, 2000), status: resp.status };
        continue;
      }
      return { json: json ?? {}, ok: true };
    } catch (error) {
      lastErr = error instanceof Error ? error.message : String(error);
    }
  }
  return { error: lastErr, ok: false };
}

async function seedScopeCatalog(params: {
  admin: any;
  baseUrls: string[];
  categoryName: string | null;
  instanceId: string;
  scopeValues: string[];
  serviceSummary: string;
  subcategory: any;
  subcategoryId: string;
  subcategoryName: string;
}): Promise<{ failures: string[]; skipped: boolean; stored: number }> {
  const scopedSubcategory = { ...params.subcategory, subcategory_scope: params.scopeValues };
  const scopeBuckets = catalogScopeBuckets(scopedSubcategory, params.subcategoryName);
  const existingCatalog = await listCatalogImages({
    accountId: null,
    includeGlobal: true,
    requireScopeTag: true,
    subcategoryId: params.subcategoryId,
    supabase: params.admin,
  });
  const existingByScope = new Map<string, number>();
  for (const row of existingCatalog) {
    const key = scopeKey(row?.metadata?.scope_key || row?.metadata?.scope);
    if (key) existingByScope.set(key, (existingByScope.get(key) || 0) + 1);
  }
  const missingBuckets = scopeBuckets
    .map((bucket) => ({
      ...bucket,
      missing: Math.max(0, SUBCATEGORY_IMAGE_CATALOG_MIN_PER_SCOPE - (existingByScope.get(bucket.key) || 0)),
    }))
    .filter((bucket) => bucket.missing > 0);
  if (!missingBuckets.length) return { failures: [], skipped: true, stored: 0 };

  const failures: string[] = [];
  let stored = 0;
  for (let offset = 0; offset < missingBuckets.length; offset += SCOPE_SEED_CONCURRENCY) {
    const batch = missingBuckets.slice(offset, offset + SCOPE_SEED_CONCURRENCY);
    await Promise.all(batch.map(async (bucket) => {
      const upstreamCatalog = await callFormServiceUpstream({
      baseUrls: params.baseUrls,
      path: "/v1/api/subcategory-catalog/generate",
      payload: {
        categoryName: params.categoryName,
        count: bucket.missing,
        industry: params.categoryName,
        instanceId: params.instanceId,
        modelId: SUBCATEGORY_IMAGE_CATALOG_MODEL_ID,
        scope: bucket.label,
        scopeKey: bucket.key,
        service: params.subcategoryName,
        serviceSummary: params.serviceSummary,
        session: {
          instanceId: params.instanceId,
          sessionId: `subcategory-seed:${params.subcategoryId}:${bucket.key}`,
        },
        subcategoryId: params.subcategoryId,
        subcategoryName: params.subcategoryName,
      },
    });
    if (!upstreamCatalog.ok || !Array.isArray(upstreamCatalog.json?.options)) {
      const error = upstreamCatalog.ok
        ? "Subcategory catalog response was missing generated options"
        : typeof upstreamCatalog.error === "string"
          ? upstreamCatalog.error
          : "Failed to generate subcategory catalog images";
      failures.push(`${bucket.label}: ${error}`);
      logSeed("scope_style_seed_failed", {
        error,
        instanceId: params.instanceId,
        scopeKey: bucket.key,
        subcategoryId: params.subcategoryId,
      });
      return;
    }

    const rawSeedOptions = Array.isArray(upstreamCatalog.json?.concepts)
      ? upstreamCatalog.json.concepts
      : upstreamCatalog.json.options;
    const options = rawSeedOptions
      .filter((item: any) => item && typeof item === "object")
      .map((item: any) => ({
        description: typeof item.description === "string" ? item.description : item.descriptor || null,
        imagePrompt: typeof item.imagePrompt === "string" ? item.imagePrompt : item.image_prompt || null,
        label: typeof item.label === "string" ? item.label : null,
        finishTier: item.finishTier || item.finish_tier || item.priceTier || item.price_tier || null,
        manifest: item.manifest && typeof item.manifest === "object" ? item.manifest : null,
        pricingPreflight:
          item.pricingPreflight && typeof item.pricingPreflight === "object"
            ? item.pricingPreflight
            : item.pricing_preflight && typeof item.pricing_preflight === "object"
              ? item.pricing_preflight
              : null,
        scope: bucket.label,
        scopeKey: bucket.key,
        value: typeof item.value === "string" ? item.value : null,
      }));
    const generatedOptions = upstreamCatalog.json.options.map((item: any) => ({
      ...item,
      scope: bucket.label,
      scope_key: bucket.key,
    }));
    const bucketStored = await persistGeneratedCatalogImages({
      categoryName: params.categoryName,
      generatedOptions,
      instanceId: params.instanceId,
      options,
      question: `Pick a ${bucket.label.toLowerCase()} look you like.`,
      scope: "global",
      serviceSummary: params.serviceSummary,
      source: "instance_seed",
      stepId: `scope-catalog-seed:${params.subcategoryId}:${bucket.key}`,
      subcategoryId: params.subcategoryId,
      subcategoryName: params.subcategoryName,
      supabase: params.admin,
    });
      stored += bucketStored;
      logSeed("scope_style_seed_stored", {
        instanceId: params.instanceId,
        scopeKey: bucket.key,
        stored: bucketStored,
        subcategoryId: params.subcategoryId,
      });
    }));
  }
  return { failures, skipped: false, stored };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const instanceId = typeof body?.instanceId === "string" ? body.instanceId.trim() : "";
    if (!instanceId) {
      return NextResponse.json({ error: "Missing instanceId" }, { status: 400 });
    }

    const userClient = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookies().getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, options, value }) => cookies().set(name, value, options));
            } catch {}
          },
        },
      },
    );

    const { data: authData } = await userClient.auth.getUser();
    const user = authData?.user ?? null;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: instance, error: instanceError } = await admin
      .from("instances")
      .select("id, account_id, company_summary")
      .eq("id", instanceId)
      .maybeSingle();
    if (instanceError) {
      return NextResponse.json({ error: instanceError.message || "Failed to load instance" }, { status: 500 });
    }
    if (!instance?.account_id) {
      return NextResponse.json({ error: "Instance not found" }, { status: 404 });
    }

    const { data: membership, error: membershipError } = await admin
      .from("user_accounts")
      .select("user_status")
      .eq("user_id", user.id)
      .eq("account_id", instance.account_id)
      .maybeSingle();
    if (membershipError) {
      return NextResponse.json({ error: membershipError.message || "Failed to verify permissions" }, { status: 500 });
    }
    const allowedRoles = new Set(["owner", "admin"]);
    if (!membership || !allowedRoles.has(String((membership as any).user_status || ""))) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { data: instanceSubcategories, error: subcategoriesError } = await admin
      .from("instance_subcategories")
      .select(`
        category_subcategory_id,
        categories_subcategories (
          id,
          category_id,
          subcategory,
          service_summary,
          subcategory_components,
          subcategory_scope,
          account_id,
          user_id,
          categories ( name )
        )
      `)
      .eq("instance_id", instanceId);
    if (subcategoriesError) {
      return NextResponse.json({ error: subcategoriesError.message || "Failed to load services" }, { status: 500 });
    }

    const baseUrls = resolveFormServiceBaseUrls();
    if (baseUrls.length === 0) {
      return NextResponse.json({ error: "DSPy service URL is not configured" }, { status: 500 });
    }

    const targets = new Map<string, any>();
    for (const row of Array.isArray(instanceSubcategories) ? instanceSubcategories : []) {
      const subcategory = (row as any)?.categories_subcategories;
      const id =
        typeof subcategory?.id === "string"
          ? subcategory.id
          : typeof (row as any)?.category_subcategory_id === "string"
            ? (row as any).category_subcategory_id
            : "";
      if (!id || targets.has(id)) continue;
      targets.set(id, subcategory);
    }

    const summary = {
      catalogSeededSubcategories: 0,
      catalogSkippedExisting: 0,
      catalogStoredImages: 0,
      checked: 0,
      failures: [] as Array<{ subcategoryId: string; error: string }>,
      refinementPlannerCalls: 0,
      refinementSeededSubcategories: 0,
      refinementSkippedExisting: 0,
      refinementStoredImages: 0,
      scopePersistedSubcategories: 0,
      scopeSkippedExisting: 0,
      scopeSuggestCalls: 0,
      skippedCustom: 0,
    };

    logSeed("start", {
      baseUrls,
      instanceId,
      subcategoryCount: targets.size,
    });

    for (const [subcategoryId, rawSubcategory] of Array.from(targets.entries())) {
      summary.checked += 1;
      const subcategory = rawSubcategory as any;
      if (!subcategory || !isSystemOwnedSubcategory(subcategory)) {
        logSeed("skip_custom", { instanceId, subcategoryId });
        summary.skippedCustom += 1;
        continue;
      }

      const categoryId = typeof subcategory?.category_id === "string" ? String(subcategory.category_id) : null;
      const subcategoryName = typeof subcategory?.subcategory === "string" ? String(subcategory.subcategory) : "Service";
      const categoryName =
        subcategory?.categories && typeof subcategory.categories === "object" && typeof subcategory.categories.name === "string"
          ? String(subcategory.categories.name)
          : null;
      const serviceSummary =
        typeof subcategory?.service_summary === "string" && subcategory.service_summary.trim()
          ? String(subcategory.service_summary).trim()
          : [categoryName, subcategoryName].filter(Boolean).join(": ");

      const refinementResult = await ensureRefinementLibraryForSubcategory({
        baseUrls,
        categoryId,
        categoryName,
        companySummary: (instance as any)?.company_summary ?? null,
        instanceId,
        mode: "instance_seed",
        serviceSummary,
        subcategoryId,
        subcategoryName,
        supabase: admin,
        existingSubcategoryComponents: (subcategory as any)?.subcategory_components,
        log: logSeed,
      });

      if (refinementResult.plannerCalled) {
        summary.refinementPlannerCalls += 1;
      }
      if (refinementResult.skipped) {
        summary.refinementSkippedExisting += 1;
        logSeed("refinement_skip_existing", { instanceId, subcategoryId });
      } else if (!refinementResult.ok) {
        summary.failures.push({
          error: refinementResult.error || "Refinement library seed failed",
          subcategoryId,
        });
        logSeed("refinement_seed_failed", {
          error: refinementResult.error,
          instanceId,
          subcategoryId,
        });
      } else {
        const n = refinementResult.storedImages || 0;
        summary.refinementStoredImages += n;
        if (n > 0) {
          summary.refinementSeededSubcategories += 1;
          logSeed("refinement_stored_success", {
            instanceId,
            storedRefinements: n,
            subcategoryId,
          });
        }
      }

      let finalScopeValues = Array.isArray((subcategory as any)?.subcategory_scope)
        ? (subcategory as any).subcategory_scope.filter((value: unknown) => typeof value === "string" && value.trim())
        : [];
      const { data: scopeRow, error: scopeRowError } = await admin
        .from("categories_subcategories")
        .select("subcategory_components, subcategory_scope")
        .eq("id", subcategoryId)
        .maybeSingle();
      if (scopeRowError) {
        logSeed("subcategory_scope_row_error", { error: scopeRowError.message, instanceId, subcategoryId });
      } else {
        const scopeResult = await ensureSubcategoryScopeForSubcategory({
          baseUrls,
          categoryName,
          companySummary: (instance as any)?.company_summary ?? null,
          existingSubcategoryScope: (scopeRow as any)?.subcategory_scope ?? null,
          log: logSeed,
          serviceSummary,
          subcategoryComponents: (scopeRow as any)?.subcategory_components ?? (subcategory as any)?.subcategory_components,
          subcategoryId,
          subcategoryName,
          supabase: admin,
        });
        finalScopeValues = Array.isArray(scopeResult.scopes) && scopeResult.scopes.length > 0
          ? scopeResult.scopes
          : Array.isArray((scopeRow as any)?.subcategory_scope)
            ? (scopeRow as any).subcategory_scope
            : finalScopeValues;
        if (scopeResult.skipped) {
          summary.scopeSkippedExisting += 1;
        } else if (scopeResult.plannerCalled) {
          summary.scopeSuggestCalls += 1;
        }
        if (scopeResult.ok && !scopeResult.skipped && Array.isArray(scopeResult.scopes) && scopeResult.scopes.length > 0) {
          summary.scopePersistedSubcategories += 1;
          logSeed("subcategory_scope_done", { instanceId, scopesCount: scopeResult.scopes.length, subcategoryId });
        } else if (!scopeResult.ok && scopeResult.error && scopeResult.error !== "no_components") {
          summary.failures.push({
            error: scopeResult.error || "subcategory_scope_failed",
            subcategoryId,
          });
          logSeed("subcategory_scope_failed", {
            error: scopeResult.error,
            instanceId,
            subcategoryId,
          });
        }
      }

      const catalogResult = await seedScopeCatalog({
        admin,
        baseUrls,
        categoryName,
        instanceId,
        scopeValues: finalScopeValues,
        serviceSummary,
        subcategory,
        subcategoryId,
        subcategoryName,
      });
      summary.catalogStoredImages += catalogResult.stored;
      if (catalogResult.stored > 0) summary.catalogSeededSubcategories += 1;
      if (catalogResult.skipped) summary.catalogSkippedExisting += 1;
      for (const error of catalogResult.failures) {
        summary.failures.push({ error, subcategoryId });
      }
    }

    logSeed("done", summary);
    return NextResponse.json({ ok: true, ...summary });
  } catch (error: any) {
    logSeed("fatal", {
      error: error?.message ? String(error.message) : String(error),
    });
    return NextResponse.json(
      { error: error?.message ? String(error.message) : "Failed to seed style-seed and refinement images" },
      { status: 500 },
    );
  }
}

import type { SupabaseClient } from "@supabase/supabase-js";

export const V2_SCOPE_STARTER_GENERATED_FOR = "v2_scope_starter";
export const V2_NEUTRAL_SCOPE_STARTER_GENERATED_FOR =
  "v2_neutral_scope_starter";

export type ScopeStarterRow = {
  created_at: string | null;
  id: string;
  image_url: string;
  metadata: Record<string, unknown> | null;
  model_id: string | null;
};

export type V2ScopeStarterOption = ScopeStarterRow & {
  label: string;
  variantIndex: number;
};

const compatibleSceneScopesByScope: Record<string, string[]> = {
  "full-bathroom-renovation": [
    "Shower or tub area only",
    "Vanity, cabinets & fixtures",
    "Tile & flooring",
    "Cosmetic refresh (paint, lighting, hardware)",
    "Layout or plumbing changes",
  ],
  "shower-or-tub-area-only": [
    "Tile & flooring",
    "Full bathroom renovation",
    "Layout or plumbing changes",
  ],
  "vanity-cabinets-and-fixtures": [
    "Full bathroom renovation",
    "Cosmetic refresh (paint, lighting, hardware)",
    "Layout or plumbing changes",
  ],
  "tile-and-flooring": [
    "Shower or tub area only",
    "Full bathroom renovation",
    "Layout or plumbing changes",
  ],
  "cosmetic-refresh-paint-lighting-hardware": [
    "Full bathroom renovation",
    "Vanity, cabinets & fixtures",
    "Shower or tub area only",
    "Tile & flooring",
    "Layout or plumbing changes",
  ],
  "layout-or-plumbing-changes": [
    "Full bathroom renovation",
    "Shower or tub area only",
  ],
  "full-outdoor-renovation": [
    "Patio and walkway upgrade",
    "New lawn and garden installation",
    "Driveway resurfacing and repair",
    "Hardscape color scheme refresh",
    "Outdoor lighting installation",
    "Tree and shrub pruning service",
  ],
  "patio-and-walkway-upgrade": [
    "Hardscape color scheme refresh",
    "Outdoor lighting installation",
    "Full outdoor renovation",
  ],
  "new-lawn-and-garden-installation": [
    "Tree and shrub pruning service",
    "Full outdoor renovation",
  ],
  "hardscape-color-scheme-refresh": [
    "Patio and walkway upgrade",
    "Driveway resurfacing and repair",
    "Full outdoor renovation",
  ],
  "outdoor-lighting-installation": [
    "Patio and walkway upgrade",
    "New lawn and garden installation",
    "Full outdoor renovation",
  ],
  "tree-and-shrub-pruning-service": [
    "New lawn and garden installation",
    "Full outdoor renovation",
  ],
};

export type V2ScopeExperimentStarter = ScopeStarterRow & {
  experimentKey: string;
  variantId: string;
  variantLabel: string;
};

export function v2ScopeStarterKey(scope: string): string {
  return String(scope || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "scope";
}

export function compatibleSceneScopesForScope(scope: string): string[] {
  return compatibleSceneScopesByScope[v2ScopeStarterKey(scope)] || [];
}

function variantIndex(row: ScopeStarterRow): number {
  const raw = Number(row.metadata?.starter_variant_index);
  return Number.isInteger(raw) && raw > 0 ? raw : 1;
}

function variantLabel(row: ScopeStarterRow): string {
  const raw = row.metadata?.starter_variant_label;
  return typeof raw === "string" && raw.trim()
    ? raw.trim()
    : `Concept ${variantIndex(row)}`;
}

function metadataText(
  metadata: Record<string, unknown> | null,
  key: string,
  fallback: string
): string {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stableBucket(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export async function findV2NeutralScopeStarter(params: {
  supabase: SupabaseClient<any, "public", any>;
  subcategoryId: string;
  scope: string;
  sessionId: string;
}): Promise<V2ScopeExperimentStarter | null> {
  const scopeKey = v2ScopeStarterKey(params.scope);
  const result = await params.supabase
    .from("images")
    .select("id, image_url, metadata, model_id, created_at")
    .eq("subcategory_id", params.subcategoryId)
    .is("account_id", null)
    .eq("status", "completed")
    .in("metadata->>generated_for", [
      V2_NEUTRAL_SCOPE_STARTER_GENERATED_FOR,
      V2_SCOPE_STARTER_GENERATED_FOR,
    ])
    .eq("metadata->>starter_scope_key", scopeKey)
    .eq("metadata->>starter_experiment_eligible", "true")
    .limit(100);

  if (result.error) {
    throw new Error(
      `Unable to load the neutral scope starter experiment: ${result.error.message}`
    );
  }

  const candidates = (result.data || [])
    .map((rawRow) => {
      const row = rawRow as ScopeStarterRow;
      if (!row.id || !row.image_url) return null;
      const experimentKey = metadataText(
        row.metadata,
        "starter_experiment_key",
        `${params.subcategoryId}:${scopeKey}`
      );
      const variantId = metadataText(
        row.metadata,
        "starter_variant_id",
        row.id
      );
      return {
        ...row,
        experimentKey,
        variantId,
        variantLabel: metadataText(
          row.metadata,
          "starter_variant_label",
          variantId
        ),
      } satisfies V2ScopeExperimentStarter;
    })
    .filter(
      (row): row is V2ScopeExperimentStarter => row !== null
    )
    .sort((a, b) => a.variantId.localeCompare(b.variantId));

  if (candidates.length === 0) return null;
  const experimentKey = candidates[0].experimentKey;
  const bucket = stableBucket(
    `${experimentKey}:${params.sessionId}:${params.subcategoryId}:${scopeKey}`
  );
  return candidates[bucket % candidates.length] || null;
}

export async function listV2ScopeStarters(params: {
  supabase: SupabaseClient<any, "public", any>;
  subcategoryId: string;
  scope: string;
  limit?: number;
}): Promise<V2ScopeStarterOption[]> {
  const scopeKey = v2ScopeStarterKey(params.scope);
  const result = await params.supabase
    .from("images")
    .select("id, image_url, metadata, model_id, created_at")
    .eq("subcategory_id", params.subcategoryId)
    .is("account_id", null)
    .eq("status", "completed")
    .eq("metadata->>generated_for", V2_SCOPE_STARTER_GENERATED_FOR)
    .eq("metadata->>starter_scope_key", scopeKey)
    .order("created_at", { ascending: false })
    .limit(Math.min(48, Math.max(12, (params.limit ?? 6) * 3)));

  if (result.error) {
    throw new Error(`Unable to load the scope starter catalog: ${result.error.message}`);
  }

  const byVariant = new Map<number, V2ScopeStarterOption>();
  for (const rawRow of result.data || []) {
    const row = rawRow as ScopeStarterRow;
    if (!row.id || !row.image_url) continue;
    const index = variantIndex(row);
    if (byVariant.has(index)) continue;
    byVariant.set(index, {
      ...row,
      label: variantLabel(row),
      variantIndex: index,
    });
  }

  return Array.from(byVariant.values())
    .sort((a, b) => a.variantIndex - b.variantIndex)
    .slice(0, Math.max(1, Math.min(50, params.limit ?? 6)));
}

export type V2ScopeGalleryOption = V2ScopeStarterOption & {
  /** The actual starter scope this image was generated for (not the requested filter scope). */
  sceneScope: string;
};

export async function listV2ScopeGalleryOptions(params: {
  supabase: SupabaseClient<any, "public", any>;
  subcategoryId: string;
  scope: string;
  limit?: number;
  /** When true (default for inspiration walls), never mix in other scopes. */
  strictScope?: boolean;
}): Promise<V2ScopeGalleryOption[]> {
  const limit = Math.max(1, Math.min(120, params.limit ?? 50));
  const strict = params.strictScope !== false;
  // Strict walls stay on the selected scope only. Compatible scopes are what
  // put vanity shots on a "shower or tub" inspiration page.
  const sceneScopes = strict
    ? [params.scope]
    : [params.scope, ...compatibleSceneScopesForScope(params.scope)];
  const perScopeLimit = strict
    ? limit
    : Math.max(24, Math.ceil(limit / Math.max(1, sceneScopes.length)) * 2);
  const collectionResults = await Promise.allSettled(
    sceneScopes.map((scope) =>
      listV2ScopeGalleryStarters({
        supabase: params.supabase,
        subcategoryId: params.subcategoryId,
        scope,
        limit: perScopeLimit,
      })
    )
  );

  const tagged: V2ScopeGalleryOption[] = [];
  for (let index = 0; index < sceneScopes.length; index += 1) {
    const result = collectionResults[index];
    if (result.status !== "fulfilled") continue;
    const sceneScope = sceneScopes[index];
    for (const row of result.value) {
      tagged.push({ ...row, sceneScope });
    }
  }

  if (tagged.length === 0) {
    const firstError = collectionResults.find(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    throw firstError?.reason instanceof Error
      ? firstError.reason
      : new Error("Unable to load any full-scene scope catalogs");
  }

  if (strict) {
    const seen = new Set<string>();
    return tagged.filter((row) => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    }).slice(0, limit);
  }

  // Interleave scopes so the wall doesn't dump one scope's batch first.
  const byScope = new Map<string, V2ScopeGalleryOption[]>();
  for (const row of tagged) {
    const bucket = byScope.get(row.sceneScope) || [];
    bucket.push(row);
    byScope.set(row.sceneScope, bucket);
  }
  const buckets = Array.from(byScope.values());
  const interleaved: V2ScopeGalleryOption[] = [];
  const seen = new Set<string>();
  const maxLen = Math.max(0, ...buckets.map((bucket) => bucket.length));
  for (let i = 0; i < maxLen && interleaved.length < limit; i += 1) {
    for (const bucket of buckets) {
      const row = bucket[i];
      if (!row || seen.has(row.id)) continue;
      seen.add(row.id);
      interleaved.push(row);
      if (interleaved.length >= limit) break;
    }
  }
  return interleaved;
}

/**
 * Gallery listing — keep every unique image. Unlike listV2ScopeStarters, do not
 * collapse to one row per starter_variant_index (that caps a wall at ~6–12 looks).
 */
async function listV2ScopeGalleryStarters(params: {
  supabase: SupabaseClient<any, "public", any>;
  subcategoryId: string;
  scope: string;
  limit?: number;
}): Promise<V2ScopeStarterOption[]> {
  const scopeKey = v2ScopeStarterKey(params.scope);
  const limit = Math.max(1, Math.min(120, params.limit ?? 48));
  const result = await params.supabase
    .from("images")
    .select("id, image_url, metadata, model_id, created_at")
    .eq("subcategory_id", params.subcategoryId)
    .is("account_id", null)
    .eq("status", "completed")
    .in("metadata->>generated_for", [
      V2_SCOPE_STARTER_GENERATED_FOR,
      V2_NEUTRAL_SCOPE_STARTER_GENERATED_FOR,
    ])
    .eq("metadata->>starter_scope_key", scopeKey)
    .order("created_at", { ascending: false })
    .limit(Math.min(200, limit * 2));

  if (result.error) {
    throw new Error(`Unable to load the scope gallery catalog: ${result.error.message}`);
  }

  const seen = new Set<string>();
  const rows: V2ScopeStarterOption[] = [];
  for (const rawRow of result.data || []) {
    const row = rawRow as ScopeStarterRow;
    if (!row.id || !row.image_url || seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push({
      ...row,
      label: variantLabel(row),
      variantIndex: variantIndex(row),
    });
    if (rows.length >= limit) break;
  }
  return rows;
}

export async function findV2ScopeStarter(params: {
  supabase: SupabaseClient<any, "public", any>;
  subcategoryId: string;
  scope: string;
  assetId?: string;
}): Promise<ScopeStarterRow | null> {
  const starters = await listV2ScopeStarters({
    supabase: params.supabase,
    subcategoryId: params.subcategoryId,
    scope: params.scope,
    limit: 12,
  });
  const selected = params.assetId
    ? starters.find((starter) => starter.id === params.assetId)
    : starters[0];
  return selected || null;
}

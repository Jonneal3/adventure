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
    .limit(30);

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
    .eq("status", "completed")
    .eq("metadata->>generated_for", V2_SCOPE_STARTER_GENERATED_FOR)
    .eq("metadata->>starter_scope_key", scopeKey)
    .order("created_at", { ascending: false })
    .limit(30);

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
    .slice(0, Math.max(1, Math.min(12, params.limit ?? 6)));
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

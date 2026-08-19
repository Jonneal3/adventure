import { NextRequest, NextResponse } from "next/server";

import {
  V2_SCOPE_STARTER_GENERATED_FOR,
  v2ScopeStarterKey,
} from "@/lib/adventure-v2/scope-starter-catalog";
import { V2_SERVICE_STARTER_GENERATED_FOR } from "@/lib/adventure-v2/service-starter-catalog";
import { logger } from "@/lib/server/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server-admin";

export const dynamic = "force-dynamic";

const MAX_IDS = 24;
/** Scope labels contain commas ("Vanity, cabinets & fixtures") — never split on ",". */
const SCOPE_SEPARATOR = "|";

type ImageRow = {
  id: string;
  image_url: string;
  subcategory_id: string | null;
  metadata: Record<string, unknown> | null;
};

/** Prefer the canonical v1 scope hero so selection cards match the label, not a random gallery look. */
function scopeThumbRank(row: ImageRow): number {
  const meta = row.metadata || {};
  const key = String(meta.starter_variant_key || "").toLowerCase();
  const indexRaw = Number(meta.starter_variant_index);
  const index = Number.isFinite(indexRaw) && indexRaw > 0 ? indexRaw : 999;
  if (key === "v1" || index === 1) return 0;
  return index;
}

function list(raw: string | null, max = MAX_IDS, separator = ","): string[] {
  if (!raw) return [];
  return Array.from(new Set(
    raw.split(separator).map((value) => value.trim()).filter(Boolean)
  )).slice(0, max);
}

/**
 * Thumbnails for the service and scope steps. Batched into one query per step so
 * the picker never fans out to a request per option.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  const serviceIds = list(request.nextUrl.searchParams.get("serviceIds"));
  const serviceId = (request.nextUrl.searchParams.get("serviceId") || "").trim();
  // Prefer repeated ?scope= params; fall back to pipe-delimited `scopes` (commas appear in labels).
  const scopesFromParams = request.nextUrl.searchParams.getAll("scope").map((value) => value.trim()).filter(Boolean);
  const scopes = Array.from(new Set([
    ...scopesFromParams,
    ...list(request.nextUrl.searchParams.get("scopes"), MAX_IDS, SCOPE_SEPARATOR),
  ])).slice(0, MAX_IDS);

  if (!params.instanceId || (serviceIds.length === 0 && scopes.length === 0)) {
    return NextResponse.json(
      { ok: false, error: "serviceIds or serviceId and scopes are required" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const { supabase } = createSupabaseAdminClient();
    const services: Record<string, string> = {};
    const scopeImages: Record<string, string> = {};

    if (serviceIds.length > 0) {
      const result = await supabase
        .from("images")
        .select("id, image_url, subcategory_id, metadata")
        .in("subcategory_id", serviceIds)
        .is("account_id", null)
        .eq("status", "completed")
        .eq("metadata->>generated_for", V2_SERVICE_STARTER_GENERATED_FOR)
        .order("created_at", { ascending: false })
        .limit(serviceIds.length * 4);
      if (result.error) throw new Error(result.error.message);
      for (const row of (result.data || []) as ImageRow[]) {
        const key = row.subcategory_id || "";
        if (!key || !row.image_url || services[key]) continue;
        services[key] = row.image_url;
      }
    }

    if (serviceId && scopes.length > 0) {
      const keyToScope = new Map<string, string>();
      for (const scope of scopes) keyToScope.set(v2ScopeStarterKey(scope), scope);
      // Selection cards must show finished scope heroes — never the plain "neutral"
      // before-photos used as generation anchors on the upload path.
      const result = await supabase
        .from("images")
        .select("id, image_url, subcategory_id, metadata")
        .eq("subcategory_id", serviceId)
        .is("account_id", null)
        .eq("status", "completed")
        .eq("metadata->>generated_for", V2_SCOPE_STARTER_GENERATED_FOR)
        .in("metadata->>starter_scope_key", Array.from(keyToScope.keys()))
        .order("created_at", { ascending: false })
        .limit(scopes.length * 60);
      if (result.error) throw new Error(result.error.message);

      const bestByScope = new Map<string, ImageRow>();
      for (const row of (result.data || []) as ImageRow[]) {
        const key = String(row.metadata?.starter_scope_key || "");
        const scope = keyToScope.get(key);
        if (!scope || !row.image_url) continue;
        const current = bestByScope.get(scope);
        if (!current || scopeThumbRank(row) < scopeThumbRank(current)) {
          bestByScope.set(scope, row);
        }
      }
      for (const [scope, row] of bestByScope) {
        scopeImages[scope] = row.image_url;
      }
    }

    return NextResponse.json(
      { ok: true, services, scopes: scopeImages },
      // Static catalog art, safe to hold briefly at the edge.
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (error) {
    logger.warn("[adventure-v6:step-images] lookup failed", {
      instanceId: params.instanceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Unable to load step images" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

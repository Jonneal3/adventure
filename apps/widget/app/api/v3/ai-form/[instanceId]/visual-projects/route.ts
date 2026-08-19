import { NextRequest, NextResponse } from "next/server";

import { listV2ScopeGalleryOptions } from "@/lib/adventure-v2/scope-starter-catalog";
import { findV2ServiceStarter } from "@/lib/adventure-v2/service-starter-catalog";
import { logger } from "@/lib/server/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server-admin";

export const dynamic = "force-dynamic";

function text(raw: unknown, max = 300): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

function metadataLabel(metadata: Record<string, unknown> | null, fallback: string): string {
  const value = metadata?.starter_variant_label;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function metadataPriceTier(metadata: Record<string, unknown> | null): string | null {
  const raw = metadata?.price_tier ?? metadata?.priceTier;
  return typeof raw === "string" && raw.trim() ? raw.trim() : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  const serviceId = text(request.nextUrl.searchParams.get("serviceId"), 160);
  const targetCount = Math.max(
    6,
    Math.min(120, Number(request.nextUrl.searchParams.get("limit")) || 50)
  );
  const strictScope = ["1", "true", "yes"].includes(
    String(request.nextUrl.searchParams.get("strictScope") || "").trim().toLowerCase()
  );
  const scopes = Array.from(
    new Set(
      request.nextUrl.searchParams
        .getAll("scope")
        .map((scope) => text(scope))
        .filter(Boolean)
    )
  ).slice(0, targetCount <= 12 ? 2 : 12);

  if (!params.instanceId || !serviceId) {
    return NextResponse.json(
      { ok: false, error: "serviceId is required" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const { supabase } = createSupabaseAdminClient();
    const scopedCollections = await Promise.all(
      scopes.map(async (scope) => {
        try {
          const rows = await listV2ScopeGalleryOptions({
            supabase,
            subcategoryId: serviceId,
            scope,
            limit: targetCount,
            strictScope,
          });
          // Keep each image's real scene scope so pricing can differ by work type.
          return rows.map((row) => ({ row, scope: row.sceneScope || scope }));
        } catch (error) {
          logger.warn("[adventure-v3:visual-projects] scope lookup failed", {
            instanceId: params.instanceId,
            serviceId,
            scope,
            error: error instanceof Error ? error.message : String(error),
          });
          return [];
        }
      })
    );

    const interleaved: Array<{ row: any; scope: string }> = [];
    const maxVariants = Math.max(0, ...scopedCollections.map((collection) => collection.length));
    for (let variantIndex = 0; variantIndex < maxVariants && interleaved.length < targetCount; variantIndex += 1) {
      for (const collection of scopedCollections) {
        const item = collection[variantIndex];
        if (item) interleaved.push(item);
        if (interleaved.length >= targetCount) break;
      }
    }

    if (interleaved.length === 0) {
      const fallback = await findV2ServiceStarter({ supabase, subcategoryId: serviceId });
      if (fallback) interleaved.push({ row: fallback, scope: scopes[0] || "Typical project" });
    }

    const seen = new Set<string>();
    const projects = interleaved
      .filter(({ row }) => {
        if (!row?.id || !row?.image_url || seen.has(row.id)) return false;
        seen.add(row.id);
        return true;
      })
      .slice(0, targetCount)
      .map(({ row, scope }, index) => ({
        assetId: row.id,
        imageUrl: row.image_url,
        storagePath: typeof row.metadata?.s3_path === "string" ? row.metadata.s3_path : "",
        label: "label" in row
          ? String(row.label || `Project ${index + 1}`)
          : metadataLabel(row.metadata, `Project ${index + 1}`),
        scope,
        priceTier: metadataPriceTier(row.metadata || null),
        modelId: row.model_id || null,
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      }));

    if (projects.length === 0) {
      return NextResponse.json(
        { ok: false, error: "The project catalog is temporarily unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: true, projects, source: "stored_scope_catalog", targetCount },
      {
        headers: {
          // Short browser/CDN cache — gallery payloads are read-heavy and change rarely.
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    logger.error("[adventure-v3:visual-projects] catalog failed", {
      instanceId: params.instanceId,
      serviceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Unable to load visual projects" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

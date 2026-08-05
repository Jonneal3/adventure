import { NextRequest, NextResponse } from "next/server";

import { listV2ScopeStarters } from "@/lib/adventure-v2/scope-starter-catalog";
import { findV2ServiceStarter } from "@/lib/adventure-v2/service-starter-catalog";
import { logger } from "@/lib/server/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server-admin";

export const dynamic = "force-dynamic";

function text(raw: unknown, max = 300): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

function labelFromMetadata(metadata: Record<string, unknown> | null, fallback: string): string {
  const value = metadata?.starter_variant_label;
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  const serviceId = text(request.nextUrl.searchParams.get("serviceId"), 160);
  const scope = text(request.nextUrl.searchParams.get("scope"), 300);
  if (!params.instanceId || !serviceId || !scope) {
    return NextResponse.json(
      { ok: false, error: "serviceId and scope are required" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const { supabase } = createSupabaseAdminClient();
    const scoped = await listV2ScopeStarters({
      supabase,
      subcategoryId: serviceId,
      scope,
      limit: 6,
    });
    const rows = scoped.length > 0
      ? scoped
      : await findV2ServiceStarter({ supabase, subcategoryId: serviceId }).then((room) => room ? [room] : []);
    const rooms = rows.map((room, index) => ({
      assetId: room.id,
      imageUrl: room.image_url,
      storagePath:
        typeof room.metadata?.s3_path === "string" ? room.metadata.s3_path : "",
      label: "label" in room
        ? String(room.label || `Similar room ${index + 1}`)
        : labelFromMetadata(room.metadata, `Similar room ${index + 1}`),
      modelId: room.model_id || null,
      createdAt: room.created_at ? new Date(room.created_at).getTime() : Date.now(),
    }));
    return NextResponse.json(
      { ok: true, rooms },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.warn("[adventure-v3:starting-rooms] lookup failed", {
      instanceId: params.instanceId,
      serviceId,
      scope,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Unable to load similar rooms" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

import {
  persistV2Image,
  V2_IMAGE_PERSIST_TIMEOUT_MS,
} from "@/lib/adventure-v2/server-assets";
import { logger } from "@/lib/server/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_KINDS = new Set(["scene", "person", "product"]);

export async function POST(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim() : "";
    const image = typeof body?.image === "string" ? body.image.trim() : "";
    const kind = typeof body?.kind === "string" && ALLOWED_KINDS.has(body.kind) ? body.kind : "scene";
    if (!params.instanceId || !sessionId || !image.startsWith("data:image/")) {
      return NextResponse.json(
        { ok: false, error: "instanceId, sessionId, and an image data URL are required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { supabase } = createSupabaseAdminClient({
      fetchTimeoutMs: V2_IMAGE_PERSIST_TIMEOUT_MS,
    });
    const { data: instance } = await supabase
      .from("instances")
      .select("id")
      .eq("id", params.instanceId)
      .maybeSingle();
    if (!instance) {
      return NextResponse.json(
        { ok: false, error: "Instance not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const asset = await persistV2Image({
      supabase,
      instanceId: params.instanceId,
      sessionId,
      imageRef: image,
      kind: kind as "scene" | "person" | "product",
    });
    return NextResponse.json(
      { ok: true, asset },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[adventure-v2:assets] upload failed", {
      instanceId: params.instanceId,
      error: error instanceof Error ? error.message : String(error),
    });
    const message = error instanceof Error ? error.message : "Unable to upload image";
    const status = /too large|valid image/i.test(message) ? 413 : 500;
    return NextResponse.json(
      { ok: false, error: message },
      { status, headers: { "Cache-Control": "no-store" } }
    );
  }
}

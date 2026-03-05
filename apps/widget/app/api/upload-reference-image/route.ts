import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logger } from "@/lib/server/logger";
import { isImageRefLike } from "@/lib/ai-form/utils/reference-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;

function decodeDataUrl(dataUrl: string): { contentType: string; buffer: Buffer; extension: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) return null;
  const contentType = String(match[1] || "image/png").toLowerCase();
  const base64Payload = String(match[2] || "").replace(/\s+/g, "");
  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64Payload, "base64");
  } catch {
    return null;
  }
  if (!buffer || buffer.length === 0 || buffer.length > MAX_BYTES) return null;

  const extension =
    contentType === "image/jpeg"
      ? "jpg"
      : contentType === "image/webp"
        ? "webp"
        : contentType === "image/gif"
          ? "gif"
          : contentType === "image/png"
            ? "png"
            : "png";
  return { contentType, buffer, extension };
}

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request: NextRequest) {
  let body: any = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const instanceId = typeof body?.instanceId === "string" ? body.instanceId.trim() : "";
  const image = typeof body?.image === "string" ? body.image.trim() : "";
  if (!instanceId) {
    return NextResponse.json({ ok: false, error: "instanceId is required" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }
  if (!image || !isImageRefLike(image, true)) {
    return NextResponse.json({ ok: false, error: "image is required" }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  if (!image.startsWith("data:")) {
    return NextResponse.json({ ok: true, url: image, stored: false }, { headers: { "Cache-Control": "no-store" } });
  }

  const decoded = decodeDataUrl(image);
  if (!decoded) {
    return NextResponse.json(
      { ok: false, error: "Invalid or too-large data URL image payload" },
      { status: 413, headers: { "Cache-Control": "no-store" } }
    );
  }

  const bucket = process.env.AI_FORM_REFERENCE_IMAGE_BUCKET || "reference-images";
  const supabase = getSupabaseClient();
  if (!supabase) {
    logger.warn("[upload-reference-image] missing_supabase_config", { instanceId, bucket, fallback: "data-url" });
    return NextResponse.json({ ok: true, url: image, stored: false }, { headers: { "Cache-Control": "no-store" } });
  }

  const digest = createHash("sha256").update(decoded.buffer).digest("hex").slice(0, 24);
  const objectPath = `${instanceId}/${Date.now()}-${digest}.${decoded.extension}`;
  const { error: uploadErr } = await supabase.storage.from(bucket).upload(objectPath, decoded.buffer, {
    contentType: decoded.contentType,
    upsert: false,
  });

  if (uploadErr) {
    logger.warn("[upload-reference-image] storage_upload_failed", {
      instanceId,
      bucket,
      objectPath,
      error: uploadErr.message || String(uploadErr),
      fallback: "data-url",
    });
    return NextResponse.json({ ok: true, url: image, stored: false }, { headers: { "Cache-Control": "no-store" } });
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  const publicUrl = typeof data?.publicUrl === "string" ? data.publicUrl : "";
  if (!publicUrl) {
    logger.warn("[upload-reference-image] missing_public_url", { instanceId, bucket, objectPath, fallback: "data-url" });
    return NextResponse.json({ ok: true, url: image, stored: false }, { headers: { "Cache-Control": "no-store" } });
  }

  logger.info("[upload-reference-image] stored", { instanceId, bucket, objectPath, contentType: decoded.contentType });
  return NextResponse.json({ ok: true, url: publicUrl, stored: true }, { headers: { "Cache-Control": "no-store" } });
}

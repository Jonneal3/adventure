import { randomUUID } from "node:crypto";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { StableAsset } from "@/components/adventure/v2/types";

const IMAGE_BUCKET = "images";
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const REMOTE_IMAGE_DOWNLOAD_TIMEOUT_MS = 45_000;

const persistTimeoutMs = Number(process.env.V2_IMAGE_PERSIST_TIMEOUT_MS);
export const V2_IMAGE_PERSIST_TIMEOUT_MS =
  Number.isFinite(persistTimeoutMs) && persistTimeoutMs > 0
    ? persistTimeoutMs
    : 60_000;

type DecodedImage = {
  bytes: Uint8Array;
  contentType: string;
};

function safePathSegment(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 100) || "unknown";
}

function extensionForContentType(contentType: string): string {
  const normalized = contentType.toLowerCase().split(";")[0].trim();
  if (normalized === "image/jpeg") return "jpg";
  if (normalized === "image/webp") return "webp";
  if (normalized === "image/avif") return "avif";
  if (normalized === "image/gif") return "gif";
  return "png";
}

function decodeDataUrl(dataUrl: string): DecodedImage | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
  if (!match) return null;
  const contentType = String(match[1] || "image/png").toLowerCase();
  let buffer: Buffer;
  try {
    buffer = Buffer.from(String(match[2] || "").replace(/\s+/g, ""), "base64");
  } catch {
    return null;
  }
  if (buffer.length === 0 || buffer.length > MAX_IMAGE_BYTES) return null;
  return { bytes: new Uint8Array(buffer), contentType };
}

async function downloadImage(url: string): Promise<DecodedImage> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REMOTE_IMAGE_DOWNLOAD_TIMEOUT_MS
  );
  try {
    const response = await fetch(url, { cache: "no-store", redirect: "follow", signal: controller.signal });
    if (!response.ok) throw new Error(`Image download failed (${response.status})`);
    const contentType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!contentType.startsWith("image/")) throw new Error("Remote asset is not an image");
    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_IMAGE_BYTES) {
      throw new Error("Remote image is too large");
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES) throw new Error("Remote image is empty or too large");
    return { bytes, contentType };
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("Generated image download timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function isTransientStorageError(message: string): boolean {
  return /abort|timeout|timed out|fetch failed|network/i.test(message);
}

export async function persistV2Image(params: {
  supabase: SupabaseClient<any, "public", any>;
  instanceId: string;
  sessionId: string;
  imageRef: string;
  kind: "scene" | "person" | "product" | "generated";
}): Promise<StableAsset> {
  const imageRef = String(params.imageRef || "").trim();
  const decoded = imageRef.startsWith("data:")
    ? decodeDataUrl(imageRef)
    : /^https?:\/\//i.test(imageRef)
      ? await downloadImage(imageRef)
      : null;
  if (!decoded) throw new Error("A valid image data URL or public image URL is required");

  const assetId = randomUUID();
  const extension = extensionForContentType(decoded.contentType);
  const storagePath = [
    "adventure-v2",
    safePathSegment(params.instanceId),
    safePathSegment(params.sessionId),
    `${safePathSegment(params.kind)}-${assetId}.${extension}`,
  ].join("/");

  const bucket = params.supabase.storage.from(IMAGE_BUCKET);
  const uploadOptions = {
    cacheControl: "31536000",
    contentType: decoded.contentType,
    // The path is unique to this request. Upsert makes a retry safe when the
    // first request reached storage but its response was aborted in transit.
    upsert: true,
  };
  let upload = await bucket.upload(storagePath, decoded.bytes, uploadOptions);
  if (
    upload.error &&
    isTransientStorageError(String(upload.error.message || ""))
  ) {
    upload = await bucket.upload(storagePath, decoded.bytes, uploadOptions);
  }
  if (upload.error) throw new Error(`Unable to persist image: ${upload.error.message}`);

  const publicResult = bucket.getPublicUrl(upload.data.path);
  const url = String(publicResult?.data?.publicUrl || "").trim();
  if (!url) throw new Error("Unable to resolve the stored image URL");

  return {
    assetId,
    url,
    storagePath: upload.data.path,
    contentType: decoded.contentType,
  };
}

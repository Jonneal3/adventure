import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function deprecatedResponse(instanceId: string) {
  return NextResponse.json(
    {
      ok: false,
      error: "deprecated_route",
      message:
        "This endpoint is deprecated. Use /api/generate/scene, /api/generate/scene-placement, or /api/generate/try-on instead.",
      instanceId,
    },
    {
      status: 410,
      headers: {
        "Cache-Control": "no-store",
        Deprecation: "true",
        Sunset: "Tue, 31 Mar 2026 00:00:00 GMT",
      },
    }
  );
}

export async function POST(request: NextRequest, { params }: { params: { instanceId: string } }) {
  const instanceId = String(params.instanceId || "").trim();
  if (!instanceId) return NextResponse.json({ error: "Missing instanceId" }, { status: 400 });

  logger.warn("[DEPRECATED] /api/ai-form/[instanceId]/generate-image called; use /api/generate/* instead.", {
    instanceId,
    path: request.nextUrl?.pathname,
    method: request.method,
  });
  return deprecatedResponse(instanceId);
}

export async function GET(request: NextRequest, { params }: { params: { instanceId: string } }) {
  const instanceId = String(params.instanceId || "").trim();
  if (!instanceId) return NextResponse.json({ error: "Missing instanceId" }, { status: 400 });
  logger.warn("[DEPRECATED] /api/ai-form/[instanceId]/generate-image GET called; use /api/generate/* instead.", {
    instanceId,
    path: request.nextUrl?.pathname,
    method: request.method,
  });
  return deprecatedResponse(instanceId);
}

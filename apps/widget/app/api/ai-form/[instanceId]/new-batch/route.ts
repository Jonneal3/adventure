/**
 * Deprecated route.
 *
 * `new-batch` has been replaced by `generate-steps`.
 * Keep this as a compatibility alias so older clients continue to work.
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: { instanceId: string } }) {
  const instanceId = params.instanceId;

  const url = new URL(request.url);
  url.pathname = `/api/ai-form/${instanceId}/generate-steps`;

  const res = NextResponse.redirect(url, 308);
  res.headers.set("Deprecation", "true");
  res.headers.set("Link", `<${url.toString()}>; rel="successor-version"`);
  return res;
}


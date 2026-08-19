import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function normalizeServiceUrl(raw: unknown): string {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = `https://${s.replace(/^\/+/, "")}`;
  return s.replace(/\/+$/, "");
}

function resolveDspyBases(): string[] {
  const isDev =
    process.env.NEXT_PUBLIC_AI_FORM_DEV_MODE === "true" || process.env.NODE_ENV !== "production";
  const devUrl = normalizeServiceUrl(process.env.DEV_DSPY_SERVICE_URL || "");
  const prodUrl = normalizeServiceUrl(
    process.env.PROD_DSPY_SERVICE_URL || process.env.DSPY_SERVICE_URL || ""
  );
  const urls = isDev ? [devUrl, prodUrl] : [prodUrl, devUrl];
  return Array.from(new Set(urls.filter(Boolean)));
}

type Ctx = { params: Promise<{ instanceId: string; action: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { instanceId, action } = await ctx.params;
  const id = String(instanceId || "").trim();
  const act = String(action || "").trim().toLowerCase();
  if (!id || !act) {
    return NextResponse.json({ ok: false, error: "missing_params" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const bases = resolveDspyBases();
  if (bases.length === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "dspy_unconfigured",
        message: "DSPY_SERVICE_URL / DEV_DSPY_SERVICE_URL not set",
        mockFallback: true,
      },
      { status: 503 }
    );
  }

  const payload = {
    ...body,
    instanceId: id,
    action: act,
    design: {
      ...((body.design as Record<string, unknown>) || {}),
      instanceId: id,
    },
  };

  let lastError = "upstream_failed";
  for (const base of bases) {
    try {
      const res = await fetch(`${base}/v1/api/adventure/${encodeURIComponent(id)}/${encodeURIComponent(act)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({ ok: false, error: "invalid_json" }));
      if (res.ok) {
        return NextResponse.json(data, { status: 200 });
      }
      lastError = typeof data?.message === "string" ? data.message : `status_${res.status}`;
      if (res.status < 500) {
        return NextResponse.json({ ...data, mockFallback: true }, { status: res.status });
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "fetch_failed";
    }
  }

  return NextResponse.json(
    { ok: false, error: "upstream_unreachable", message: lastError, mockFallback: true },
    { status: 503 }
  );
}

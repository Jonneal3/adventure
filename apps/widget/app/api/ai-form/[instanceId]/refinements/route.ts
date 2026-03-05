/**
 * Refinements endpoint — generates refinement questions for post-concept exploration.
 * Same payload shape as generate-steps; calls form service /form/{instanceId}/refinements.
 */

import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/server/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server-admin";
import { getServiceGrounding } from "@/lib/ai-form/context/grounding";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalizeServiceUrl(raw: string): string {
  let s = String(raw || "").trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = `https://${s.replace(/^\/+/, "")}`;
  return s.replace(/\/+$/, "");
}

function resolveFormServiceBaseUrls(): string[] {
  const isRuntimeProduction =
    process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";
  const serverDevModeFlag = String(process.env.AI_FORM_DEV_MODE || "").trim().toLowerCase();
  const clientDevModeFlag = isRuntimeProduction
    ? ""
    : String(process.env.NEXT_PUBLIC_AI_FORM_DEV_MODE || "").trim().toLowerCase();
  const forceDev = serverDevModeFlag === "true" || clientDevModeFlag === "true";
  const forceProd = serverDevModeFlag === "false" || clientDevModeFlag === "false";
  const isDevMode = forceDev || (!forceProd && !isRuntimeProduction);

  const devUrl = normalizeServiceUrl(process.env.DEV_DSPY_SERVICE_URL || "");
  const prodUrl = normalizeServiceUrl(process.env.DSPY_SERVICE_URL || process.env.PROD_DSPY_SERVICE_URL || "");

  const urls: string[] = [];
  if (isDevMode) {
    if (devUrl) urls.push(devUrl);
    if (prodUrl) urls.push(prodUrl);
  } else {
    if (prodUrl) urls.push(prodUrl);
    if (devUrl) urls.push(devUrl);
  }
  return Array.from(new Set(urls));
}

export async function POST(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  const instanceId = params.instanceId;
  const reqId = `refinements-${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const body = await request.json().catch(() => ({}));
    const sessionId = body?.sessionId || body?.session_id || "";
    const stepDataSoFar = body?.stepDataSoFar ?? body?.step_data_so_far ?? {};
    const askedStepIds = Array.isArray(body?.askedStepIds)
      ? body.askedStepIds
      : Array.isArray(body?.asked_step_ids)
        ? body.asked_step_ids
        : [];

    if (!sessionId) {
      return NextResponse.json({ ok: false, error: "sessionId is required" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const { data: instance, error: instanceError } = await admin.supabase
      .from("instances")
      .select("*")
      .eq("id", instanceId)
      .single();

    if (instanceError || !instance) {
      return NextResponse.json({ ok: false, error: "Instance not found" }, { status: 404 });
    }

    const grounding = getServiceGrounding({
      categoryName: (instance as any)?.config?.industry,
      subcategoryName: (instance as any)?.config?.service,
      industry: (instance as any)?.config?.industry || "General",
      trafficSource: "Direct",
      stepDataSoFar,
    });

    const payload = {
      session: { sessionId, instanceId },
      instanceId,
      state: {
        answers: stepDataSoFar,
        askedStepIds,
        grounding,
        context: {
          industry: (instance as any)?.config?.industry || "General",
          service: (instance as any)?.config?.service,
        },
      },
    };

    const baseUrls = resolveFormServiceBaseUrls();
    if (baseUrls.length === 0) {
      return NextResponse.json(
        { ok: false, error: "DSPY_SERVICE_URL not configured" },
        { status: 500 }
      );
    }

    let lastError: Error | null = null;
    let lastStatus: number | null = null;
    let lastBody: string | null = null;
    for (const baseUrl of baseUrls) {
      const endpoint = new URL(`/v1/api/form/${instanceId}/refinements`, baseUrl).toString();
      try {
        const resp = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json", Accept: "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store",
        });
        if (resp.ok) {
          const json = await resp.json().catch(() => ({}));
          const miniSteps = json?.miniSteps ?? [];
          logger.info("[refinements] SUCCESS", {
            reqId,
            instanceId,
            stepsCount: miniSteps.length,
            steps: miniSteps.map((s: any) => ({ id: s?.id, question: s?.question, type: s?.type })),
          });
          return NextResponse.json(json);
        }
        lastStatus = resp.status;
        lastBody = await resp.text().catch(() => null);
      } catch (e) {
        lastError = e instanceof Error ? e : new Error(String(e));
      }
    }

    const errMsg =
      lastError?.message ||
      (lastStatus != null ? `Service returned ${lastStatus}${lastBody ? `: ${lastBody.slice(0, 200)}` : ""}` : "Refinements service unreachable");
    logger.error("[refinements] ERROR", { reqId, instanceId, error: errMsg, lastStatus });
    return NextResponse.json(
      { ok: false, error: errMsg },
      { status: 502 }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    logger.error("[refinements] ERROR", { reqId, error: msg });
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}

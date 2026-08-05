import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/server/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server-admin";

export const dynamic = "force-dynamic";

function plainObject(raw: unknown): Record<string, any> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, any>) : {};
}
function escapeHtml(raw: unknown): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function price(raw: unknown): number | null {
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${Math.round(value).toLocaleString("en-US")}`;
  }
}

async function markDelivery(
  supabase: any,
  submissionId: string,
  submissionData: Record<string, any>,
  delivery: Record<string, any>
) {
  await supabase
    .from("form_submissions")
    .update({
      submission_data: {
        ...submissionData,
        emailDelivery: delivery,
      },
    })
    .eq("id", submissionId);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const submissionId = typeof body?.submissionId === "string" ? body.submissionId.trim() : "";
    const instanceId = typeof body?.instanceId === "string" ? body.instanceId.trim() : "";
    if (!submissionId || !instanceId) {
      return NextResponse.json(
        { ok: false, error: "submissionId and instanceId are required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { supabase } = createSupabaseAdminClient();
    const [submissionResult, instanceResult] = await Promise.all([
      supabase
        .from("form_submissions")
        .select("id, instance_id, email, name, submission_data")
        .eq("id", submissionId)
        .eq("instance_id", instanceId)
        .maybeSingle(),
      supabase.from("instances").select("id, name, config").eq("id", instanceId).maybeSingle(),
    ]);
    const submission = submissionResult.data as any;
    const experienceVersion = submission?.submission_data?.experienceVersion;
    if (!submission || (experienceVersion !== "v2" && experienceVersion !== "v3")) {
      return NextResponse.json(
        { ok: false, error: "Adventure submission not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }

    const submissionData = plainObject(submission.submission_data);
    if (submissionData?.emailDelivery?.status === "sent") {
      return NextResponse.json(
        { ok: true, sent: true, idempotent: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      await markDelivery(supabase, submissionId, submissionData, {
        status: "failed",
        attemptedAt: new Date().toISOString(),
        error: "RESEND_API_KEY is not configured",
      });
      return NextResponse.json(
        { ok: false, sent: false, error: "Email delivery is not configured" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const pricing = plainObject(body?.pricing);
    const totalMin = price(pricing.totalMin);
    const totalMax = price(pricing.totalMax);
    const currency = typeof pricing.currency === "string" ? pricing.currency.toUpperCase().slice(0, 3) : "USD";
    const serviceName = typeof body?.serviceName === "string" ? body.serviceName.trim().slice(0, 200) : "your project";
    const scope = typeof body?.scope === "string" ? body.scope.trim().slice(0, 300) : "";
    const canvasUrl = typeof body?.canvasUrl === "string" && /^https?:\/\//i.test(body.canvasUrl) ? body.canvasUrl : "";
    const assumptions = Array.isArray(body?.assumptions)
      ? body.assumptions.map((item: unknown) => String(item || "").trim().slice(0, 220)).filter(Boolean).slice(0, 8)
      : [];
    const businessName =
      typeof instanceResult.data?.name === "string" && instanceResult.data.name.trim()
        ? instanceResult.data.name.trim()
        : "Adventure";
    const range =
      totalMin !== null && totalMax !== null
        ? `${formatCurrency(Math.min(totalMin, totalMax), currency)}–${formatCurrency(Math.max(totalMin, totalMax), currency)}`
        : "Your personalized range is being prepared";
    const subject = `${businessName}: your ${serviceName} concept and price range`;
    const safeCanvas = canvasUrl
      ? `<p style="margin:24px 0"><img src="${escapeHtml(canvasUrl)}" alt="Your generated concept" style="display:block;width:100%;max-width:640px;border-radius:16px" /></p>`
      : "";
    const safeAssumptions = assumptions.length > 0
      ? `<div style="margin:20px 0"><div style="font-size:13px;color:#687386;margin-bottom:8px">Based on</div><ul style="margin:0;padding-left:20px">${assumptions.map((item: string) => `<li style="margin:4px 0">${escapeHtml(item)}</li>`).join("")}</ul></div>`
      : "";
    const html = `
      <div style="font-family:Inter,Arial,sans-serif;color:#172033;line-height:1.55;max-width:680px;margin:auto;padding:28px">
        <p style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#687386;margin:0 0 8px">${escapeHtml(businessName)}</p>
        <h1 style="font-size:28px;line-height:1.2;margin:0 0 12px">Your concept is ready</h1>
        <p style="margin:0 0 20px">Here is the latest direction for <strong>${escapeHtml(serviceName)}</strong>${scope ? `, focused on ${escapeHtml(scope)}` : ""}.</p>
        ${safeCanvas}
        <div style="background:#f4f6f8;border-radius:14px;padding:20px;margin:20px 0">
          <div style="font-size:13px;color:#687386">Estimated project range</div>
          <div style="font-size:25px;font-weight:700;margin-top:4px">${escapeHtml(range)}</div>
        </div>
        ${safeAssumptions}
        <p style="font-size:13px;color:#687386">This is an early planning estimate. Final pricing depends on measurements, selections, labor, and site conditions.</p>
      </div>
    `;
    const plainText = [
      `${businessName}: your concept is ready`,
      `Service: ${serviceName}`,
      scope ? `Scope: ${scope}` : "",
      `Estimated project range: ${range}`,
      ...assumptions.map((item: string) => `Based on: ${item}`),
      canvasUrl ? `View your concept: ${canvasUrl}` : "",
      "This is an early planning estimate; final pricing may vary.",
    ]
      .filter(Boolean)
      .join("\n");

    await markDelivery(supabase, submissionId, submissionData, {
      status: "sending",
      attemptedAt: new Date().toISOString(),
    });
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `adventure-${experienceVersion}-results-${submissionId}`,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Adventure <onboarding@resend.dev>",
        to: [submission.email],
        subject,
        html,
        text: plainText,
      }),
      cache: "no-store",
    });
    const resendBody = await resendResponse.json().catch(() => null);
    if (!resendResponse.ok) {
      const errorMessage =
        typeof resendBody?.message === "string" ? resendBody.message : `Resend returned ${resendResponse.status}`;
      await markDelivery(supabase, submissionId, submissionData, {
        status: "failed",
        attemptedAt: new Date().toISOString(),
        error: errorMessage,
      });
      logger.warn("[adventure-v2:results-email] delivery failed", {
        instanceId,
        submissionId,
        status: resendResponse.status,
        error: errorMessage,
      });
      return NextResponse.json(
        { ok: false, sent: false, error: errorMessage },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    await markDelivery(supabase, submissionId, submissionData, {
      status: "sent",
      sentAt: new Date().toISOString(),
      providerId: resendBody?.id ?? null,
    });
    return NextResponse.json(
      { ok: true, sent: true, idempotent: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[adventure-v2:results-email] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, sent: false, error: "Unable to send results email" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/server/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server-admin";

export const dynamic = "force-dynamic";

function plainObject(raw: unknown): Record<string, any> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as Record<string, any> : {};
}

function validEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().toLowerCase().slice(0, 320);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? value : null;
}

function validPhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const value = raw.trim().slice(0, 60);
  return value.replace(/\D/g, "").length >= 10 ? value : null;
}

function webhookUrl(config: unknown): string | null {
  const root = plainObject(config);
  const aiForm = plainObject(root.aiFormConfig ?? root.ai_form_config);
  const value = root.webhookUrl ?? root.webhook_url ?? aiForm.webhookUrl ?? aiForm.webhook_url;
  return typeof value === "string" && /^https?:\/\//i.test(value.trim()) ? value.trim() : null;
}

async function deliverConsultationWebhook(params: {
  url: string | null;
  instanceId: string;
  submissionId: string;
  email: string | null;
  name: string | null;
  phone: string;
  submissionData: Record<string, any>;
}) {
  if (!params.url) return;
  try {
    await fetch(params.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "AdventureBX-V3/1.0",
      },
      body: JSON.stringify({
        event: "consultation_requested",
        instanceId: params.instanceId,
        submissionId: params.submissionId,
        email: params.email,
        name: params.name,
        phone: params.phone,
        project: params.submissionData,
      }),
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
  } catch (error) {
    logger.warn("[adventure-v3:leads] consultation webhook failed", {
      instanceId: params.instanceId,
      submissionId: params.submissionId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const instanceId = typeof body?.instanceId === "string" ? body.instanceId.trim() : "";
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId.trim().slice(0, 200) : "";
    const email = validEmail(body?.email);
    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) || null : null;
    if (!instanceId || !sessionId || !email) {
      return NextResponse.json(
        { ok: false, error: "instanceId, sessionId, and a valid email are required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { supabase } = createSupabaseAdminClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const existingResult = await supabase
      .from("form_submissions")
      .select("id, email, submission_data")
      .eq("instance_id", instanceId)
      .eq("session_id", sessionId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);
    const existing = (existingResult.data || []).find(
      (row: any) => row?.submission_data?.experienceVersion === "v3"
    );
    if (existing) {
      return NextResponse.json(
        { ok: true, submissionId: existing.id, idempotent: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const forwarded = request.headers.get("x-forwarded-for");
    const submissionData = {
      ...plainObject(body?.submissionData),
      experienceVersion: "v3",
      experience_version: "v3",
      leadStage: "email",
      emailDelivery: { status: "idle" },
    };
    const insert = await supabase
      .from("form_submissions")
      .insert({
        instance_id: instanceId,
        email,
        name,
        phone: null,
        is_partial: false,
        submission_data: submissionData,
        user_agent: request.headers.get("user-agent"),
        ip_address: forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip"),
        referrer: request.headers.get("referer"),
        session_id: sessionId,
      })
      .select("id")
      .single();
    if (insert.error || !insert.data?.id) {
      logger.error("[adventure-v3:leads] email insert failed", {
        instanceId,
        sessionId,
        error: insert.error?.message,
      });
      return NextResponse.json(
        { ok: false, error: "Unable to save your estimate" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { ok: true, submissionId: insert.data.id, idempotent: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[adventure-v3:leads] email capture failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Unable to save your estimate" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const instanceId = typeof body?.instanceId === "string" ? body.instanceId.trim() : "";
    const submissionId = typeof body?.submissionId === "string" ? body.submissionId.trim() : "";
    const phone = validPhone(body?.phone);
    const intent = body?.intent === "consultation" ? "consultation" : "personalized_plan";
    const refinementCount = Math.max(0, Math.min(99, Math.floor(Number(body?.refinementCount) || 0)));
    if (!instanceId || !submissionId || !phone) {
      return NextResponse.json(
        { ok: false, error: "A valid saved estimate and phone number are required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { supabase } = createSupabaseAdminClient();
    const [submissionResult, instanceResult] = await Promise.all([
      supabase
        .from("form_submissions")
        .select("id, email, name, phone, submission_data")
        .eq("id", submissionId)
        .eq("instance_id", instanceId)
        .maybeSingle(),
      supabase.from("instances").select("id, config").eq("id", instanceId).maybeSingle(),
    ]);
    const submission = submissionResult.data as any;
    if (!submission || submission?.submission_data?.experienceVersion !== "v3") {
      return NextResponse.json(
        { ok: false, error: "Saved V3 estimate not found" },
        { status: 404, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (
      intent === "consultation" &&
      submission.phone &&
      submission.submission_data?.consultationRequestedAt
    ) {
      return NextResponse.json(
        { ok: true, consultationRequested: true, idempotent: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    if (
      intent === "personalized_plan" &&
      submission.phone &&
      submission.submission_data?.personalizedPlanUnlockedAt
    ) {
      return NextResponse.json(
        { ok: true, personalizedUnlocked: true, idempotent: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const submissionData = {
      ...plainObject(submission.submission_data),
      leadStage: intent === "consultation" ? "consultation" : "personalized_plan",
      ...(intent === "consultation"
        ? { consultationRequestedAt: new Date().toISOString() }
        : {
            personalizedPlanUnlockedAt: new Date().toISOString(),
            refinementCountAtPhoneGate: refinementCount,
          }),
    };
    const update = await supabase
      .from("form_submissions")
      .update({ phone, submission_data: submissionData })
      .eq("id", submissionId)
      .eq("instance_id", instanceId);
    if (update.error) {
      return NextResponse.json(
        { ok: false, error: "Unable to request a consultation" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (intent === "consultation") {
      await deliverConsultationWebhook({
        url: webhookUrl(instanceResult.data?.config),
        instanceId,
        submissionId,
        email: submission.email,
        name: submission.name,
        phone,
        submissionData,
      });
    }
    return NextResponse.json(
      {
        ok: true,
        personalizedUnlocked: intent === "personalized_plan",
        consultationRequested: intent === "consultation",
        idempotent: false,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[adventure-v3:leads] consultation capture failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Unable to request a consultation" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

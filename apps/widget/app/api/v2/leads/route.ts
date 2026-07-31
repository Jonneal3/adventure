import { NextRequest, NextResponse } from "next/server";

import { logger } from "@/lib/server/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server-admin";

export const dynamic = "force-dynamic";

function validEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase().slice(0, 320);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}
function plainObject(raw: unknown): Record<string, any> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, any>) : {};
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
      .eq("is_partial", false)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);
    if (existingResult.error) {
      logger.warn("[adventure-v2:leads] idempotency lookup failed", {
        instanceId,
        sessionId,
        error: existingResult.error.message,
      });
    }
    const existing = (existingResult.data || []).find(
      (row: any) => row?.submission_data?.experienceVersion === "v2"
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
      experienceVersion: "v2",
      experience_version: "v2",
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
      logger.error("[adventure-v2:leads] insert failed", {
        instanceId,
        sessionId,
        error: insert.error?.message,
      });
      return NextResponse.json(
        { ok: false, error: "Unable to save your results" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    logger.info("[adventure-v2:leads] saved", {
      instanceId,
      sessionId,
      submissionId: insert.data.id,
      experienceVersion: "v2",
    });
    return NextResponse.json(
      { ok: true, submissionId: insert.data.id, idempotent: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[adventure-v2:leads] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Unable to save your results" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

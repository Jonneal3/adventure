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
    const phone =
      typeof body?.phone === "string" ? body.phone.trim().slice(0, 40) || null : null;
    const partial = Boolean(body?.partial);
    if (!instanceId || !sessionId || (!email && !phone)) {
      return NextResponse.json(
        { ok: false, error: "instanceId, sessionId, and a valid email or phone are required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { supabase } = createSupabaseAdminClient();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const existingResult = await supabase
      .from("form_submissions")
      .select("id, email, phone, submission_data")
      .eq("instance_id", instanceId)
      .eq("session_id", sessionId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);

    if (existingResult.error) {
      logger.warn("[adventure-v8:leads] lookup failed", {
        instanceId,
        sessionId,
        error: existingResult.error.message,
      });
    }

    const existing = (existingResult.data || []).find(
      (row: any) => row?.submission_data?.experienceVersion === "v8"
    );

    const submissionData = {
      ...plainObject(existing?.submission_data),
      ...plainObject(body?.submissionData),
      experienceVersion: "v8",
      experience_version: "v8",
    };

    const forwarded = request.headers.get("x-forwarded-for");

    if (existing?.id) {
      const update = await supabase
        .from("form_submissions")
        .update({
          email: email || existing.email || null,
          phone: phone || existing.phone || null,
          is_partial: partial,
          submission_data: submissionData,
        })
        .eq("id", existing.id)
        .select("id")
        .single();
      if (update.error || !update.data?.id) {
        logger.error("[adventure-v8:leads] update failed", {
          instanceId,
          sessionId,
          error: update.error?.message,
        });
        return NextResponse.json(
          { ok: false, error: "Unable to save your results" },
          { status: 500, headers: { "Cache-Control": "no-store" } }
        );
      }
      return NextResponse.json(
        { ok: true, submissionId: update.data.id, idempotent: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const insert = await supabase
      .from("form_submissions")
      .insert({
        instance_id: instanceId,
          email: email || null,
          phone,
          is_partial: partial,
        submission_data: submissionData,
        user_agent: request.headers.get("user-agent"),
        ip_address: forwarded ? forwarded.split(",")[0].trim() : request.headers.get("x-real-ip"),
        referrer: request.headers.get("referer"),
        session_id: sessionId,
      })
      .select("id")
      .single();

    if (insert.error || !insert.data?.id) {
      logger.error("[adventure-v8:leads] insert failed", {
        instanceId,
        sessionId,
        error: insert.error?.message,
      });
      return NextResponse.json(
        { ok: false, error: "Unable to save your results" },
        { status: 500, headers: { "Cache-Control": "no-store" } }
      );
    }

    logger.info("[adventure-v8:leads] saved", {
      instanceId,
      sessionId,
      submissionId: insert.data.id,
    });
    return NextResponse.json(
      { ok: true, submissionId: insert.data.id, idempotent: false },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[adventure-v8:leads] failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: "Unable to save your results" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

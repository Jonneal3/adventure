import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server-admin";
import { logger } from "@/lib/server/logger";

async function parseJsonBody(request: Request) {
  const text = await request.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeEvent(input: any) {
  if (!input || typeof input !== "object") return null;
  const sessionId = input.sessionId ?? input.session_id;
  const instanceId = input.instanceId ?? input.instance_id;
  if (!sessionId || !instanceId) return null;

  const payload = input.payload ?? null;
  const source = input.source ?? null;
  const rating = input.rating ?? null;
  const vote = input.vote ?? null;
  const tags = input.tags ?? null;
  const comment = input.comment ?? null;
  const sendToDataset = input.sendToDataset ?? input.send_to_dataset ?? null;

  const hasSignal =
    source !== null ||
    rating !== null ||
    vote !== null ||
    (Array.isArray(tags) && tags.length > 0) ||
    (typeof comment === "string" && comment.trim().length > 0) ||
    sendToDataset === true ||
    (payload && typeof payload === "object" && Object.keys(payload).length > 0);
  if (!hasSignal) return null;

  return {
    session_id: String(sessionId),
    instance_id: String(instanceId),
    event_type: "step_feedback",
    step_id: input.stepId ?? input.step_id ?? null,
    model_request_id: input.modelRequestId ?? input.model_request_id ?? null,
    payload_json: {
      ...(payload && typeof payload === "object" ? payload : {}),
      source,
      rating,
      vote,
      tags,
      comment,
      send_to_dataset: sendToDataset,
    },
  };
}

export async function POST(request: Request) {
  const body = await parseJsonBody(request);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const items = Array.isArray(body) ? body : [body];
  const rows = items.map(normalizeEvent).filter(Boolean) as Record<string, any>[];
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "No valid feedback" }, { status: 422 });
  }

  const { supabase } = createSupabaseAdminClient();
  const { error } = await supabase.from("telemetry_events").insert(rows);
  if (error) {
    logger.error("[feedback] Supabase insert failed", error);
    return NextResponse.json({ ok: true, count: rows.length, dbOk: false });
  }

  return NextResponse.json({ ok: true, count: rows.length, dbOk: true });
}

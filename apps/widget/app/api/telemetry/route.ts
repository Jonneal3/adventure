import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server-admin";
import { logger } from "@/lib/server/logger";

type TelemetryRow = {
  session_id: string;
  instance_id: string;
  event_type: string;
  step_id: string | null;
  batch_id: string | null;
  model_request_id: string | null;
  payload_json: Record<string, any>;
};

// OpenTelemetry instrumentation (server-side only, lazy-loaded to avoid client bundling)
let instrumentTelemetryEvent: any = () => ({ end: () => {} });
let recordDuplicateEvent: any = () => {};
let recordEventLatency: any = () => {};

if (typeof window === 'undefined') {
  try {
    const instrumentation = require('@/lib/telemetry/instrumentation');
    instrumentTelemetryEvent = instrumentation.instrumentTelemetryEvent || instrumentTelemetryEvent;
    recordDuplicateEvent = instrumentation.recordDuplicateEvent || recordDuplicateEvent;
    recordEventLatency = instrumentation.recordEventLatency || recordEventLatency;
  } catch (e) {
    // OpenTelemetry not available, use no-ops (already set above)
  }
}

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
  const eventType = input.eventType ?? input.event_type;
  if (!sessionId || !instanceId || !eventType) return null;

  // Always include payload (even if empty object) to ensure it's never null
  const payload =
    input.payload ??
    input.payload_json ??
    input.payloadJson ??
    {};
  // Ensure payload is always an object, not null
  const payloadJson = payload && typeof payload === 'object' ? payload : {};
  
  const telemetryMeta = {
    eventType,
    stepId: input.stepId ?? input.step_id ?? null,
    batchId: input.batchId ?? input.batch_id ?? null,
    modelRequestId: input.modelRequestId ?? input.model_request_id ?? null,
    timestamp: typeof input.timestamp === "number" ? input.timestamp : Date.now(),
  };

  const enrichedPayload = {
    ...payloadJson,
    _meta: telemetryMeta,
  };
  
  return {
    session_id: String(sessionId),
    instance_id: String(instanceId),
    event_type: String(eventType),
    step_id: input.stepId ?? input.step_id ?? null,
    batch_id: input.batchId ?? input.batch_id ?? null,
    model_request_id: input.modelRequestId ?? input.model_request_id ?? null,
    payload_json: enrichedPayload,
  };
}

export async function POST(request: Request) {
  const startTime = Date.now();
  const body = await parseJsonBody(request);
  if (!body) {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const items = Array.isArray(body) ? body : [body];
  const serverContext = {
    user_agent: request.headers.get("user-agent"),
    referer: request.headers.get("referer"),
    host: request.headers.get("host"),
    vercel_id: request.headers.get("x-vercel-id"),
  };

  const rows: TelemetryRow[] = (items.map(normalizeEvent).filter(Boolean) as TelemetryRow[]).map((row) => {
    const payload = row.payload_json && typeof row.payload_json === "object" ? row.payload_json : {};
    return {
      ...row,
      payload_json: {
        ...payload,
        _server: serverContext,
      },
    };
  });
  if (rows.length === 0) {
    return NextResponse.json({ ok: false, error: "No valid events" }, { status: 422 });
  }

  // Instrument with OpenTelemetry (if available)
  try {
    rows.forEach((row) => {
      const span = instrumentTelemetryEvent({
        sessionId: row.session_id,
        instanceId: row.instance_id,
        eventType: row.event_type,
        stepId: row.step_id,
        batchId: row.batch_id,
        modelRequestId: row.model_request_id,
      }, row.payload_json);
      span.end();
    });
  } catch (e) {
    // OpenTelemetry not available or failed, continue without it
  }

  const { supabase } = createSupabaseAdminClient();
  
  // Server-side deduplication: Check for existing events in the last 10 seconds
  // Use a longer window to catch rapid duplicates, and batch check all events at once
  const now = new Date();
  const tenSecondsAgo = new Date(now.getTime() - 10000);
  
  let dbOk = true;
  let count = 0;
  let skipped = 0;
  try {
    const dedupeKeys = rows.map((row) => ({
      key: `${row.session_id}|${row.instance_id}|${row.event_type}|${row.step_id || ""}|${row.batch_id || ""}|${row.model_request_id || ""}`,
      row,
    }));

    const uniqueSessions = [...new Set(rows.map((r) => r.session_id))];
    const uniqueInstances = [...new Set(rows.map((r) => r.instance_id))];

    // Race the dedupe query against a short timeout so a slow DB doesn't block the response.
    const DEDUPE_TIMEOUT_MS = 2000;
    const dedupePromise = supabase
      .from("telemetry_events")
      .select("id, session_id, instance_id, event_type, step_id, batch_id, model_request_id, payload_json")
      .gte("created_at", tenSecondsAgo.toISOString())
      .in("session_id", uniqueSessions)
      .in("instance_id", uniqueInstances);

    const timeoutPromise = new Promise<{ data: null; error: { message: "dedupe_timeout" } }>((resolve) =>
      setTimeout(() => resolve({ data: null, error: { message: "dedupe_timeout" } }), DEDUPE_TIMEOUT_MS)
    );

    const { data: existingEvents, error: existingError } = await Promise.race([dedupePromise, timeoutPromise]) as any;

    if (existingError) {
      if (existingError.message === "dedupe_timeout") {
        // Dedupe timed out -- skip deduplication and insert all rows directly.
        const { error: insertError } = await supabase.from("telemetry_events").insert(rows);
        if (insertError) {
          logger.warn("[telemetry] Insert after dedupe timeout failed", insertError);
          dbOk = false;
        }
        count = rows.length;
        const latency = Date.now() - startTime;
        recordEventLatency(latency, "telemetry_batch_no_dedupe");
        return NextResponse.json({ ok: true, count, skipped: 0, dbOk });
      }
      logger.warn("[telemetry] Supabase dedupe query failed", existingError);
      throw existingError;
    }

    const existingByKey = new Map<string, { id: string; payload_json: any }>(
      (existingEvents || []).map((e: any) => [
        `${e.session_id}|${e.instance_id}|${e.event_type}|${e.step_id || ""}|${e.batch_id || ""}|${e.model_request_id || ""}`,
        { id: e.id, payload_json: e.payload_json },
      ])
    );

    // Track keys we're about to insert to prevent duplicates within the same batch
    const batchKeys = new Set<string>();
    const deduplicatedRows: typeof rows = [];
    const rowsToUpdate: Array<{ id: string; row: (typeof rows)[number] }> = [];

    for (const { key, row } of dedupeKeys) {
      const existing = existingByKey.get(key);
      // Skip if already exists in this batch
      if (batchKeys.has(key)) {
        recordDuplicateEvent(row.event_type);
        continue;
      }
      if (existing) {
        // If the existing event has no payload, "heal" it by updating in-place rather than skipping.
        const existingPayload = existing.payload_json;
        const hasMeaningfulPayload =
          existingPayload && typeof existingPayload === "object" && Object.keys(existingPayload).length > 0;
        if (!hasMeaningfulPayload) {
          rowsToUpdate.push({ id: existing.id, row });
        } else {
          recordDuplicateEvent(row.event_type);
        }
        continue;
      }

      // Add to batch and mark for insertion
      batchKeys.add(key);
      deduplicatedRows.push(row);
    }

    if (rowsToUpdate.length > 0) {
      const updates = rowsToUpdate.map(({ id, row }) =>
        supabase
          .from("telemetry_events")
          .update({
            step_id: row.step_id,
            batch_id: row.batch_id,
            model_request_id: row.model_request_id,
            payload_json: row.payload_json,
          })
          .eq("id", id)
      );
      const results = await Promise.all(updates);
      const anyUpdateError = results.find((r) => r.error);
      if (anyUpdateError?.error) {
        logger.error("[telemetry] Supabase update failed", anyUpdateError.error);
        dbOk = false;
      }
    }
    if (deduplicatedRows.length > 0) {
      const { error } = await supabase.from("telemetry_events").insert(deduplicatedRows);
      if (error) {
        logger.error("[telemetry] Supabase insert failed", error);
        dbOk = false;
      }
    }

    count = deduplicatedRows.length;
    skipped = rows.length - deduplicatedRows.length - rowsToUpdate.length;

    // Record latency metric
    const latency = Date.now() - startTime;
    if (deduplicatedRows.length > 0) {
      recordEventLatency(latency, "telemetry_batch");
    }
  } catch (error) {
    dbOk = false;
    logger.warn("[telemetry] DB write skipped (timeout or error)", { error });
  }

  return NextResponse.json({
    ok: true,
    count,
    skipped,
    dbOk,
  });
}

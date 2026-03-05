import type { MiniStep } from "@/types/ai-form";
import { logger } from "@/lib/server/logger";

type StreamOpts = {
  /** Used only for debug logs; never included in payload */
  reqId?: string;
  debug?: boolean;
  /** AbortSignal from Next route (optional) */
  signal?: AbortSignal;
  onMiniStep: (mini: MiniStep) => void;
};

export type DspyServiceStreamResult =
  | { ok: true; meta: Record<string, any>; miniStepCount: number; svcEndpoint: string }
  | { ok: false; error: string; details?: any; miniStepCount: number; svcEndpoint?: string };

export function resolveDspyServiceBaseUrl(raw: unknown): string {
  let serviceUrl = String(raw || "").trim();
  if (!serviceUrl) {
    throw new Error("DSPY service URL is not set (set DSPY_SERVICE_URL or PROD_DSPY_SERVICE_URL)");
  }
  // Accept bare hostnames (e.g. "sif-ai-form-service.vercel.app") by auto-prepending https://
  if (!/^https?:\/\//i.test(serviceUrl)) {
    serviceUrl = `https://${serviceUrl.replace(/^\/+/, "")}`;
  }
  return serviceUrl.replace(/\/+$/, "");
}

function parseSseFrame(frame: string): { event: string | null; dataText: string } {
  const lines = frame.split("\n");
  let event: string | null = null;
  const dataLines: string[] = [];

  for (const ln of lines) {
    const line = ln.trimEnd();
    if (!line) continue;
    if (line.startsWith(":")) continue; // comment / heartbeat
    if (line.startsWith("event:")) {
      event = line.slice("event:".length).trim();
      continue;
    }
    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
      continue;
    }
  }

  return { event, dataText: dataLines.join("\n").trim() };
}

function safeJsonParse(s: string): any | null {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

/**
 * Calls the DSPy microservice SSE endpoint and streams `mini_step` events.
 * Returns the final `meta` object (or an `error` object) once the stream completes.
 */
export async function streamDspyNewBatch(payload: any, opts: StreamOpts): Promise<DspyServiceStreamResult> {
  const { debug = false, reqId, signal, onMiniStep } = opts;

  const isDevMode = process.env.NEXT_PUBLIC_AI_FORM_DEV_MODE === "true" || process.env.NODE_ENV !== "production";
  const rawServiceUrlEnv = isDevMode
    ? process.env.DEV_DSPY_SERVICE_URL || process.env.DSPY_SERVICE_URL || process.env.PROD_DSPY_SERVICE_URL
    : process.env.DSPY_SERVICE_URL || process.env.PROD_DSPY_SERVICE_URL || process.env.DEV_DSPY_SERVICE_URL;
  const svcBase = resolveDspyServiceBaseUrl(rawServiceUrlEnv);
  // Use /api/form with stream flag in the payload and SSE accept header.
  const svcEndpoint = new URL("/api/form?stream=1", svcBase).toString();

  if (debug) {
    logger.info({
      scope: "generate-steps",
      event: "dspy_service_url_resolved",
      reqId: reqId ?? null,
      raw: typeof rawServiceUrlEnv === "string" ? rawServiceUrlEnv : null,
      normalized: svcBase,
    });
    logger.info({
      scope: "generate-steps",
      event: "dspy_service_endpoint",
      reqId: reqId ?? null,
      svcEndpoint,
    });
  }

  let miniStepCount = 0;
  let svcResp: Response;
  try {
    svcResp = await fetch(svcEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Failed to parse URL")) {
      logger.error({
        scope: "generate-steps",
        event: "dspy_fetch_url_parse_failure",
        rawEnv: typeof rawServiceUrlEnv === "string" ? rawServiceUrlEnv : null,
        normalizedServiceUrl: svcBase,
        svcEndpoint,
        reqId,
      });
    }
    return { ok: false, error: msg, details: e, miniStepCount, svcEndpoint };
  }

  if (!svcResp.ok) {
    const text = await svcResp.text().catch(() => "");
    return {
      ok: false,
      error: `DSPy service error (${svcResp.status})`,
      details: text.slice(0, 2000),
      miniStepCount,
      svcEndpoint,
    };
  }

  // If the body is missing (shouldn't happen), treat as error.
  if (!svcResp.body) {
    return { ok: false, error: "DSPy service response had no body", miniStepCount, svcEndpoint };
  }

  // Minimal SSE parser for the service stream.
  let result: any = null;
  const reader = svcResp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  const processFrame = (frame: string) => {
    const { event, dataText } = parseSseFrame(frame);
    const data = safeJsonParse(dataText);

    if (event === "mini_step" && data && typeof data === "object") {
      miniStepCount++;
      onMiniStep(data as MiniStep);
      return;
    }
    if (event === "meta" && data && typeof data === "object") {
      // IMPORTANT: Do NOT emit steps from meta.miniSteps; they were already streamed as mini_step events.
      result = data;
      return;
    }
    if (event === "error" && data && typeof data === "object") {
      result = { error: (data as any)?.message || "DSPy service error", details: data };
      return;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      if (frame.trim()) processFrame(frame);
    }
  }
  if (buf.trim()) processFrame(buf);

  if (!result) result = { ok: true };

  if (result?.error) {
    return { ok: false, error: String(result.error), details: result.details, miniStepCount, svcEndpoint };
  }

  return { ok: true, meta: result as Record<string, any>, miniStepCount, svcEndpoint };
}

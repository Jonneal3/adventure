"use client";

type TelemetryPayload = Record<string, any>;

export type TelemetryEventInput = {
  sessionId: string;
  instanceId: string;
  eventType: string;
  stepId?: string | null;
  batchId?: string | null;
  modelRequestId?: string | null;
  timestamp?: number;
  payload?: TelemetryPayload;
};

export type FeedbackEventInput = {
  sessionId: string;
  instanceId: string;
  stepId?: string | null;
  modelRequestId?: string | null;
  source?: "dev" | "user";
  rating?: number | null;
  vote?: "up" | "down" | null;
  tags?: string[] | null;
  comment?: string | null;
  sendToDataset?: boolean;
  timestamp?: number;
  payload?: TelemetryPayload;
};

const TELEMETRY_ENDPOINT = process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT || "/api/telemetry";
const FEEDBACK_ENDPOINT = process.env.NEXT_PUBLIC_FEEDBACK_ENDPOINT || "/api/feedback";

const TELEMETRY_DISABLED =
  process.env.NEXT_PUBLIC_TELEMETRY_DISABLED === "true" ||
  process.env.NEXT_PUBLIC_DISABLE_TELEMETRY === "true";

const DEFAULT_TELEMETRY_BATCH_MS = process.env.NODE_ENV === "development" ? 750 : 250;
const TELEMETRY_BATCH_MS_RAW = Number(process.env.NEXT_PUBLIC_TELEMETRY_BATCH_MS ?? DEFAULT_TELEMETRY_BATCH_MS);
const TELEMETRY_BATCH_MS = Number.isFinite(TELEMETRY_BATCH_MS_RAW) ? Math.max(0, TELEMETRY_BATCH_MS_RAW) : DEFAULT_TELEMETRY_BATCH_MS;

const DEFAULT_TELEMETRY_MAX_BATCH = 25;
const TELEMETRY_MAX_BATCH_RAW = Number(process.env.NEXT_PUBLIC_TELEMETRY_MAX_BATCH ?? DEFAULT_TELEMETRY_MAX_BATCH);
const TELEMETRY_MAX_BATCH = Number.isFinite(TELEMETRY_MAX_BATCH_RAW)
  ? Math.max(1, Math.floor(TELEMETRY_MAX_BATCH_RAW))
  : DEFAULT_TELEMETRY_MAX_BATCH;

let cachedClientContext: Record<string, any> | null = null;
function getClientContext(): Record<string, any> | null {
  if (typeof window === "undefined") return null;
  if (cachedClientContext) return cachedClientContext;
  try {
    cachedClientContext = {
      page: {
        url: window.location.href,
        path: window.location.pathname,
        search: window.location.search,
      },
      device: {
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        language: typeof navigator !== "undefined" ? (navigator.language || null) : null,
        platform: typeof navigator !== "undefined" ? ((navigator as any).platform || null) : null,
        timezone: (() => {
          try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
          } catch {
            return null;
          }
        })(),
      },
      viewport: {
        width: typeof window !== "undefined" ? window.innerWidth : null,
        height: typeof window !== "undefined" ? window.innerHeight : null,
      },
      screen: {
        width: typeof window !== "undefined" ? window.screen?.width : null,
        height: typeof window !== "undefined" ? window.screen?.height : null,
        pixel_ratio: typeof window !== "undefined" ? window.devicePixelRatio : null,
      },
      referrer: typeof document !== "undefined" ? (document.referrer || null) : null,
    };
    return cachedClientContext;
  } catch {
    return null;
  }
}

// Track sent events to prevent duplicates (in-memory + localStorage for persistence across remounts)
const sentEvents = new Set<string>();
const TELEMETRY_SENT_KEY = "ai_form_telemetry_sent";

// Load persisted sent events from localStorage on module load
if (typeof window !== "undefined") {
  try {
    const stored = window.localStorage.getItem(TELEMETRY_SENT_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Clean up old entries (older than 1 hour)
      const now = Date.now();
      const validKeys: string[] = [];
      for (const [key, timestamp] of Object.entries(parsed)) {
        if (typeof timestamp === "number" && now - timestamp < 60 * 60 * 1000) {
          sentEvents.add(key);
          validKeys.push(key);
        }
      }
      // Update localStorage with only valid keys
      if (validKeys.length !== Object.keys(parsed).length) {
        const cleaned: Record<string, number> = {};
        for (const key of validKeys) {
          cleaned[key] = parsed[key];
        }
        window.localStorage.setItem(TELEMETRY_SENT_KEY, JSON.stringify(cleaned));
      }
    }
  } catch {}
}

function markEventSent(eventKey: string): void {
  sentEvents.add(eventKey);
  
  // Also persist to localStorage (already done atomically in emitTelemetry)
  // This function is kept for backward compatibility but the atomic write happens in emitTelemetry
}

function getEventKey(input: TelemetryEventInput | FeedbackEventInput): string {
  const eventType = 'eventType' in input ? input.eventType : 'feedback';
  const stepId = 'stepId' in input ? (input.stepId || '') : '';
  const batchId = 'batchId' in input ? (input.batchId || '') : '';
  const modelRequestId = 'modelRequestId' in input ? (input.modelRequestId || '') : '';
  
  // Dedupe by session+instance+event+step+batch+modelRequestId (ignore payload differences)
  // This prevents duplicates from rapid re-renders or multiple calls with slightly different payloads
  // Only allow duplicates if they're legitimately different (different step, different batch, different model request, etc.)
  const parts = [
    input.sessionId,
    input.instanceId,
    eventType,
    stepId,
    batchId,
    modelRequestId,
  ];
  return parts.join('|');
}

function buildPayload<T extends TelemetryEventInput | FeedbackEventInput>(input: T) {
  const { payload, timestamp, ...rest } = input;
  // Always include payload object (even if empty) to ensure it's never null in the database
  const mergedPayload: TelemetryPayload = {
    ...(payload || {}),
    ...(typeof timestamp === "number" ? { timestamp } : {}),
    ...(getClientContext() ? { _client: getClientContext() } : {}),
  };
  return {
    ...rest,
    payload: mergedPayload,
    timestamp,
  };
}

async function postJson(url: string, data: unknown, keepalive?: boolean) {
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      keepalive: Boolean(keepalive),
    });
  } catch {}
}

function sendBeacon(url: string, data: unknown): boolean {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return false;
  }
  try {
    const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
    return navigator.sendBeacon(url, blob);
  } catch {
    return false;
  }
}

let telemetryQueue: any[] = [];
let telemetryFlushTimer: ReturnType<typeof setTimeout> | null = null;
let flushHooksRegistered = false;

function flushTelemetry(opts?: { beacon?: boolean }) {
  if (telemetryQueue.length === 0) return;
  const batch = telemetryQueue;
  telemetryQueue = [];
  if (telemetryFlushTimer) {
    clearTimeout(telemetryFlushTimer);
    telemetryFlushTimer = null;
  }

  const payload = batch.length === 1 ? batch[0] : batch;
  if (opts?.beacon && sendBeacon(TELEMETRY_ENDPOINT, payload)) return;
  void postJson(TELEMETRY_ENDPOINT, payload, opts?.beacon);
}

function scheduleTelemetryFlush() {
  if (TELEMETRY_BATCH_MS <= 0) return;
  if (telemetryFlushTimer) return;
  telemetryFlushTimer = setTimeout(() => flushTelemetry(), TELEMETRY_BATCH_MS);
}

function ensureFlushHooksRegistered() {
  if (flushHooksRegistered) return;
  if (typeof window === "undefined") return;
  flushHooksRegistered = true;

  // Send whatever is pending when the page is backgrounded/unloaded.
  // Use beacon so the browser attempts delivery even during navigation.
  window.addEventListener("pagehide", () => flushTelemetry({ beacon: true }));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushTelemetry({ beacon: true });
  });
}

export function emitTelemetry(input: TelemetryEventInput, opts?: { beacon?: boolean }) {
  if (TELEMETRY_DISABLED) return;
  ensureFlushHooksRegistered();

  // Prevent duplicate sends (dedupe by session+instance+event+step+batch+modelRequestId)
  const eventKey = getEventKey(input);
  
  // Check in-memory Set first (fastest)
  if (sentEvents.has(eventKey)) {
    return; // Already sent
  }
  
  // Double-check localStorage in case in-memory Set wasn't loaded yet
  // CRITICAL: Check AND mark atomically to prevent race conditions
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(TELEMETRY_SENT_KEY);
      let cache: Record<string, number> = stored ? JSON.parse(stored) : {};
      
      if (eventKey in cache) {
        const timestamp = cache[eventKey];
        // Only skip if it was sent recently (within last hour)
        if (typeof timestamp === "number" && Date.now() - timestamp < 60 * 60 * 1000) {
          sentEvents.add(eventKey); // Add to in-memory Set for future checks
          return; // Already sent
        }
      }
      
      // ATOMIC: Mark as sent IMMEDIATELY before sending (prevents race conditions)
      const now = Date.now();
      cache[eventKey] = now;
      window.localStorage.setItem(TELEMETRY_SENT_KEY, JSON.stringify(cache));
      sentEvents.add(eventKey);
    } catch {
      // If localStorage fails, still try to send (fallback to in-memory only)
      sentEvents.add(eventKey);
    }
  } else {
    // Server-side: just use in-memory Set
    sentEvents.add(eventKey);
  }
  
  // Limit in-memory cache size to prevent memory leaks
  if (sentEvents.size > 1000) {
    const firstKey = sentEvents.values().next().value as string | undefined;
    if (firstKey) sentEvents.delete(firstKey);
  }
  
  const payload = buildPayload(input);

  // In dev (and lightly in prod), batch telemetry to avoid spamming `/api/telemetry`.
  // The server endpoint accepts either a single event or an array of events.
  if (TELEMETRY_BATCH_MS > 0) {
    telemetryQueue.push(payload);
    if (telemetryQueue.length >= TELEMETRY_MAX_BATCH || opts?.beacon) {
      flushTelemetry({ beacon: Boolean(opts?.beacon) });
      return;
    }
    scheduleTelemetryFlush();
    return;
  }

  if (opts?.beacon && sendBeacon(TELEMETRY_ENDPOINT, payload)) return;
  void postJson(TELEMETRY_ENDPOINT, payload, opts?.beacon);
}

export function emitFeedback(input: FeedbackEventInput) {
  const hasMeaningfulSignal =
    input.vote != null ||
    input.rating != null ||
    (Array.isArray(input.tags) && input.tags.length > 0) ||
    (typeof input.comment === "string" && input.comment.trim().length > 0) ||
    input.sendToDataset === true ||
    (input.payload && typeof input.payload === "object" && Object.keys(input.payload).length > 0);
  if (!hasMeaningfulSignal) return;

  // Prevent duplicate sends
  const eventKey = getEventKey(input);
  if (sentEvents.has(eventKey)) {
    return; // Already sent
  }
  markEventSent(eventKey);
  
  const payload = buildPayload(input);
  void postJson(FEEDBACK_ENDPOINT, payload);
}

type Usage = {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  calls?: number | null;
};

type RateLimit = {
  present?: boolean;
  calls?: number;
  headers?: {
    retryAfterSec?: string | null;
    limitRequestsRPD?: string | null;
    limitTokensTPM?: string | null;
    remainingRequestsRPD?: string | null;
    remainingTokensTPM?: string | null;
    resetRequestsIn?: string | null;
    resetTokensIn?: string | null;
  } | null;
};

type TokenEvent = {
  ts: number;
  sessionId: string;
  mode: string;
  key?: string | null;
  modelUsed?: string | null;
  latencyMs?: number | null;
  usage: Usage;
  rateLimit?: RateLimit | null;
  sources?: {
    groqRateLimitHeaders?: any;
    liteLLMUsage?: any;
    dspyUsage?: any;
  } | null;
};

type SessionAgg = {
  firstTs: number;
  lastTs: number;
  totals: { prompt: number; completion: number; total: number };
  callsWithUsage: number;
  callsWithoutUsage: number;
  byMode: Record<string, { calls: number; totalTokens: number }>;
};

const SESSIONS = new Map<string, SessionAgg>();

function enabled(): boolean {
  return process.env.AI_FORM_TOKEN_TELEMETRY === "true" || process.env.AI_FORM_DEBUG === "true";
}

function n(v: number | null | undefined): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

export function recordTokenUsage(evt: TokenEvent) {
  if (!enabled()) return;

  const sid = String(evt.sessionId || "").trim();
  if (!sid) return;

  const now = Date.now();
  const mode = String(evt.mode || "unknown");
  const total = evt.usage?.total_tokens;
  const pt = evt.usage?.prompt_tokens;
  const ct = evt.usage?.completion_tokens;

  const agg: SessionAgg =
    SESSIONS.get(sid) ||
    {
      firstTs: now,
      lastTs: now,
      totals: { prompt: 0, completion: 0, total: 0 },
      callsWithUsage: 0,
      callsWithoutUsage: 0,
      byMode: {},
    };

  agg.lastTs = now;

  const hasUsage = typeof total === "number" || typeof pt === "number" || typeof ct === "number";
  if (hasUsage) {
    agg.callsWithUsage += 1;
    agg.totals.prompt += n(pt);
    agg.totals.completion += n(ct);
    agg.totals.total += n(total ?? (n(pt) + n(ct)));
  } else {
    agg.callsWithoutUsage += 1;
  }

  agg.byMode[mode] = agg.byMode[mode] || { calls: 0, totalTokens: 0 };
  agg.byMode[mode].calls += 1;
  agg.byMode[mode].totalTokens += hasUsage ? n(total ?? (n(pt) + n(ct))) : 0;

  SESSIONS.set(sid, agg);

  // One-line per-call log (easy to grep + sum).
  console.log("[TOKENS]", {
    sessionId: sid.slice(0, 8) + "...",
    mode,
    key: evt.key || null,
    prompt_tokens: evt.usage?.prompt_tokens ?? null,
    completion_tokens: evt.usage?.completion_tokens ?? null,
    total_tokens: evt.usage?.total_tokens ?? null,
    calls: evt.usage?.calls ?? null,
    latencyMs: evt.latencyMs ?? null,
    modelUsed: evt.modelUsed ?? null,
    rateLimit: evt.rateLimit?.headers ?? null,
    sources: evt.sources ?? null,
  });
}

export function logSessionTokenSummary(sessionId: string, label: string) {
  if (!enabled()) return;
  const sid = String(sessionId || "").trim();
  if (!sid) return;
  const agg = SESSIONS.get(sid);
  if (!agg) return;

  console.log("[TOKENS_SUMMARY]", {
    label,
    sessionId: sid.slice(0, 8) + "...",
    totals: agg.totals,
    callsWithUsage: agg.callsWithUsage,
    callsWithoutUsage: agg.callsWithoutUsage,
    byMode: agg.byMode,
    windowMs: agg.lastTs - agg.firstTs,
  });
}



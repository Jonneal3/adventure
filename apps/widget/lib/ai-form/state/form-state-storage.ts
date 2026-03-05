"use client";

export type FormStateSnapshot = Record<string, any>;

export type LeadGatePatch = {
  shownAt?: number;
  completedAt?: number;
  dismissedAt?: number;
  [key: string]: any;
};

export type LeadState = {
  leadCaptured: boolean;
  leadEmail: string | null;
  leadPhone: string | null;
  leadCapturedAt: number | null;
  leadGates: Record<string, any> | null;
};

export function formStateStorageKey(sessionId: string) {
  return `formState:${sessionId}`;
}

export function emitFormStateUpdated(sessionId: string, patch?: Record<string, any>) {
  if (!sessionId || typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("sif_form_state_updated", { detail: { sessionId, ...(patch ? { patch } : {}) } }));
  } catch {}
}

export function loadFormStateSnapshot(sessionId: string): FormStateSnapshot | null {
  if (!sessionId || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(formStateStorageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as FormStateSnapshot) : null;
  } catch {
    return null;
  }
}

export function upsertFormStateSnapshot(sessionId: string, patch: Record<string, any>) {
  if (!sessionId || typeof window === "undefined") return;
  try {
    const key = formStateStorageKey(sessionId);
    const raw = window.localStorage.getItem(key);
    const base = raw ? JSON.parse(raw) : {};
    const next: Record<string, any> = base && typeof base === "object" ? { ...(base as any) } : {};
    Object.assign(next, patch);
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {}
  emitFormStateUpdated(sessionId, patch);
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s.length ? s : null;
}

export function loadLeadState(sessionId: string): LeadState {
  const snap = loadFormStateSnapshot(sessionId);
  const leadCaptured = (snap as any)?.leadCaptured === true;
  const leadEmail = normalizeOptionalString((snap as any)?.leadEmail);
  const leadPhone = normalizeOptionalString((snap as any)?.leadPhone);
  const leadCapturedAtRaw = (snap as any)?.leadCapturedAt;
  const leadCapturedAt = Number.isFinite(leadCapturedAtRaw) ? Math.max(0, Number(leadCapturedAtRaw)) : null;
  const leadGatesRaw = (snap as any)?.leadGates;
  const leadGates =
    leadGatesRaw && typeof leadGatesRaw === "object" && !Array.isArray(leadGatesRaw)
      ? (leadGatesRaw as Record<string, any>)
      : null;
  return { leadCaptured, leadEmail, leadPhone, leadCapturedAt, leadGates };
}

export function upsertLeadState(
  sessionId: string,
  patch: { leadCaptured?: boolean; leadEmail?: string | null; leadPhone?: string | null; leadCapturedAt?: number | null }
) {
  if (!sessionId || typeof window === "undefined") return;
  try {
    const key = formStateStorageKey(sessionId);
    const raw = window.localStorage.getItem(key);
    const base = raw ? JSON.parse(raw) : {};
    const next: Record<string, any> = base && typeof base === "object" ? { ...(base as any) } : {};
    if (typeof patch.leadCaptured === "boolean") next.leadCaptured = patch.leadCaptured;
    if ("leadEmail" in patch) next.leadEmail = patch.leadEmail ?? null;
    if ("leadPhone" in patch) next.leadPhone = patch.leadPhone ?? null;
    if ("leadCapturedAt" in patch) next.leadCapturedAt = patch.leadCapturedAt ?? null;
    if (typeof patch.leadCaptured === "boolean" && patch.leadCaptured && !("leadCapturedAt" in patch)) {
      next.leadCapturedAt = Date.now();
    }
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {}
  emitFormStateUpdated(sessionId, patch as any);
}

export function upsertLeadGate(sessionId: string, gateContext: string, patch: LeadGatePatch) {
  if (!sessionId || typeof window === "undefined") return;
  if (!gateContext) return;
  let leadGates: Record<string, any> | null = null;
  try {
    const key = formStateStorageKey(sessionId);
    const raw = window.localStorage.getItem(key);
    const base = raw ? JSON.parse(raw) : {};
    const next: Record<string, any> = base && typeof base === "object" ? { ...(base as any) } : {};
    const existing = next.leadGates && typeof next.leadGates === "object" ? { ...(next.leadGates as any) } : {};
    const current = existing[gateContext] && typeof existing[gateContext] === "object" ? { ...existing[gateContext] } : {};
    existing[gateContext] = { ...current, ...patch };
    next.leadGates = existing;
    leadGates = next.leadGates;
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {}
  emitFormStateUpdated(sessionId, leadGates ? { leadGates } : undefined);
}


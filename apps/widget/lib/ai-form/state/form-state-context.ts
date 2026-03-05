"use client";

export type FormStateContext = {
  serviceSummary: string | null;
  businessContext: string | null;
};

import { formStateStorageKey as storageKey } from "./form-state-storage";

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s.length > 0 ? s : null;
}

export function loadFormStateContext(sessionId: string | null | undefined): FormStateContext {
  if (!sessionId || typeof window === "undefined") return { serviceSummary: null, businessContext: null };
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    if (!raw) return { serviceSummary: null, businessContext: null };
    const parsed = JSON.parse(raw);
    return {
      serviceSummary: normalizeOptionalString((parsed as any)?.serviceSummary),
      businessContext: normalizeOptionalString((parsed as any)?.businessContext),
    };
  } catch {
    return { serviceSummary: null, businessContext: null };
  }
}

export function upsertFormStateContext(sessionId: string, patch: Partial<FormStateContext>): void {
  if (!sessionId || typeof window === "undefined") return;
  try {
    const key = storageKey(sessionId);
    const raw = window.localStorage.getItem(key);
    const base = raw ? JSON.parse(raw) : {};
    const next: Record<string, any> = base && typeof base === "object" ? { ...(base as any) } : {};
    if ("serviceSummary" in patch) next.serviceSummary = patch.serviceSummary ?? null;
    if ("businessContext" in patch) next.businessContext = patch.businessContext ?? null;
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {}
}

"use client";

export type FormPlanSnapshot = Record<string, any>;

function storageKey(sessionId: string) {
  return `formPlan:${sessionId}`;
}

export function loadRawFormPlan(sessionId: string): FormPlanSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as FormPlanSnapshot;
  } catch {
    return null;
  }
}

export function saveFormPlan(sessionId: string, plan: unknown): void {
  if (typeof window === "undefined") return;
  try {
    if (!plan || typeof plan !== "object") {
      window.localStorage.removeItem(storageKey(sessionId));
      return;
    }
    window.localStorage.setItem(storageKey(sessionId), JSON.stringify(plan));
  } catch {}
}

export function clearFormPlan(sessionId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(storageKey(sessionId));
  } catch {}
}


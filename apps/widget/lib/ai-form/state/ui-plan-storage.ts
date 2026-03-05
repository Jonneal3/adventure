"use client";

export type UIPlanPlacement = {
  id: string;
  type: string;
  role?: string | null;
  position?: "after" | "before" | "start" | "end" | null;
  anchor_step_id?: string | null;
  deterministic?: boolean | null;
};

export type UIPlan = {
  v: 1;
  placements: UIPlanPlacement[];
};

function storageKey(sessionId: string) {
  return `uiPlan:${sessionId}`;
}

export function loadUIPlan(sessionId: string): UIPlan | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if ((parsed as any).v !== 1) return null;
    if (!Array.isArray((parsed as any).placements)) return null;
    return parsed as UIPlan;
  } catch {
    return null;
  }
}

export function saveUIPlan(sessionId: string, plan: UIPlan | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!plan || plan.v !== 1 || !Array.isArray(plan.placements) || plan.placements.length === 0) {
      window.localStorage.removeItem(storageKey(sessionId));
      return;
    }
    window.localStorage.setItem(storageKey(sessionId), JSON.stringify(plan));
  } catch {}
}


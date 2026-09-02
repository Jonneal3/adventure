"use client";

import type { V8RailQuestion, V8State } from "./types";

const SNAPSHOT_VERSION = 4;

export type V8SessionContext = {
  serviceId: string | null;
  serviceLabel: string;
  industry?: string | null;
  summary?: string | null;
  vertical?: string | null;
  scopes: string[];
  scopeLabel: string;
  mode: "spatial" | "component";
  budget: number;
  layoutId: string | null;
  styleId: string | null;
  photoUrl: string | null;
  designUrl: string | null;
};

export type V8SessionSnapshot = {
  version: number;
  state: V8State;
  layoutThumbs: Record<string, string>;
  styleThumbs: Record<string, string>;
  context: V8SessionContext | null;
};

function snapshotKey(instanceId: string): string {
  return `adventure:v8:snapshot:${instanceId}`;
}

function sessionKey(instanceId: string): string {
  return `adventure:v8:session:${instanceId}`;
}

function makeSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `v8-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreateV8SessionId(instanceId: string): string {
  if (typeof window === "undefined") return makeSessionId();
  try {
    const existing = window.localStorage.getItem(sessionKey(instanceId));
    if (existing) return existing;
    const created = makeSessionId();
    window.localStorage.setItem(sessionKey(instanceId), created);
    return created;
  } catch {
    return makeSessionId();
  }
}

function inferRailQuestion(
  _state: Partial<V8State> & { railQuestion?: V8RailQuestion },
  _mode?: "spatial" | "component" | null
): V8RailQuestion {
  return "refine";
}

function persistableLooks(looks: V8State["looks"]): V8State["looks"] {
  return (looks || []).map((look) => {
    const url = String(look.url || "");
    if (url.startsWith("data:") && url.length > 350_000) {
      return { ...look, url: "" };
    }
    return look;
  }).filter((look) => Boolean(look.url));
}

export function loadV8Snapshot(instanceId: string): V8SessionSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(snapshotKey(instanceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as V8SessionSnapshot;
    if (!parsed || parsed.version !== SNAPSHOT_VERSION || !parsed.state?.sessionId) return null;
    return {
      ...parsed,
      state: {
        ...parsed.state,
        generating: false,
        generatingLabel: "",
        railQuestion: inferRailQuestion(parsed.state, parsed.context?.mode),
        moodId: parsed.state.moodId ?? null,
        activeRevisionIndex: parsed.state.photoPathChosen === false || (parsed.state.looks || []).length === 0
          ? -1
          : Number.isInteger(parsed.state.activeRevisionIndex)
            ? Math.min(Math.max(0, parsed.state.activeRevisionIndex), parsed.state.looks.length - 1)
            : Math.max(
                0,
                parsed.state.looks.findIndex((look) => look.id === parsed.state.selectedDesignId)
              ),
        pendingBudgetDelta: Number(parsed.state.pendingBudgetDelta || 0),
        pricingParts: Array.isArray(parsed.state.pricingParts) ? parsed.state.pricingParts : [],
      },
      layoutThumbs: parsed.layoutThumbs || {},
      styleThumbs: parsed.styleThumbs || {},
      context: parsed.context || null,
    };
  } catch {
    return null;
  }
}

export function saveV8Snapshot(instanceId: string, snapshot: Omit<V8SessionSnapshot, "version">): void {
  if (typeof window === "undefined") return;
  try {
    const state: V8State = {
      ...snapshot.state,
      generating: false,
      generatingLabel: "",
      looks: persistableLooks(snapshot.state.looks),
    };
    window.localStorage.setItem(
      snapshotKey(instanceId),
      JSON.stringify({
        version: SNAPSHOT_VERSION,
        state,
        layoutThumbs: snapshot.layoutThumbs || {},
        styleThumbs: snapshot.styleThumbs || {},
        context: snapshot.context || null,
      } satisfies V8SessionSnapshot)
    );
    if (state.sessionId) {
      window.localStorage.setItem(sessionKey(instanceId), state.sessionId);
    }
  } catch {
    // Quota or private mode — keep going in memory.
  }
}

export function clearV8Snapshot(instanceId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(snapshotKey(instanceId));
    window.localStorage.removeItem(sessionKey(instanceId));
  } catch {
    // ignore
  }
}

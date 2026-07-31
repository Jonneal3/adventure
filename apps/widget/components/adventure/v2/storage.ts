"use client";

import type { AdventureV2Snapshot } from "./types";

const SNAPSHOT_VERSION = 2;

function snapshotKey(instanceId: string): string {
  return `adventure:v2:snapshot:${instanceId}`;
}

function sessionKey(instanceId: string): string {
  return `adventure:v2:session:${instanceId}`;
}

function makeSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `v2-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreateV2SessionId(instanceId: string): string {
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

export function loadV2Snapshot(instanceId: string): AdventureV2Snapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(snapshotKey(instanceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdventureV2Snapshot;
    if (!parsed || parsed.version !== SNAPSHOT_VERSION || typeof parsed.sessionId !== "string") return null;
    const legacyStage = (parsed as unknown as { stage?: string }).stage;
    return {
      ...parsed,
      stage: legacyStage === "starter" ? "inputs" : parsed.stage,
    };
  } catch {
    return null;
  }
}

export function saveV2Snapshot(instanceId: string, snapshot: AdventureV2Snapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(snapshotKey(instanceId), JSON.stringify({ ...snapshot, version: SNAPSHOT_VERSION }));
  } catch {}
}

export function clearV2Snapshot(instanceId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(snapshotKey(instanceId));
    window.localStorage.removeItem(sessionKey(instanceId));
  } catch {}
}

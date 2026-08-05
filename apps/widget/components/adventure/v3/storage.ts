"use client";

import type { AdventureV3Snapshot } from "./types";

const SNAPSHOT_VERSION = 3;

function snapshotKey(instanceId: string): string {
  return `adventure:v3:snapshot:${instanceId}`;
}

function sessionKey(instanceId: string): string {
  return `adventure:v3:session:${instanceId}`;
}

function makeSessionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `v3-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreateV3SessionId(instanceId: string): string {
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

export function loadV3Snapshot(instanceId: string): AdventureV3Snapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(snapshotKey(instanceId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdventureV3Snapshot;
    if (!parsed || parsed.version !== SNAPSHOT_VERSION || typeof parsed.sessionId !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveV3Snapshot(instanceId: string, snapshot: AdventureV3Snapshot): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      snapshotKey(instanceId),
      JSON.stringify({ ...snapshot, version: SNAPSHOT_VERSION })
    );
  } catch {}
}

export function clearV3Snapshot(instanceId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(snapshotKey(instanceId));
    window.localStorage.removeItem(sessionKey(instanceId));
  } catch {}
}

"use client";

import type { VisualPricingSnapshot } from "./visual-pricing-types";

const STORAGE_SCHEMA = 3;
export type VisualPricingStorageNamespace = "v3" | "v4" | "v5";

function snapshotKey(instanceId: string, namespace: VisualPricingStorageNamespace): string {
  return `adventure:${namespace}:visual-pricing:${instanceId}`;
}

function sessionKey(instanceId: string, namespace: VisualPricingStorageNamespace): string {
  return `adventure:${namespace}:visual-pricing-session:${instanceId}`;
}

function makeSessionId(namespace: VisualPricingStorageNamespace): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${namespace}-visual-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function getOrCreateVisualPricingSession(
  instanceId: string,
  namespace: VisualPricingStorageNamespace = "v3"
): string {
  if (typeof window === "undefined") return makeSessionId(namespace);
  try {
    const existing = window.localStorage.getItem(sessionKey(instanceId, namespace));
    if (existing) return existing;
    const created = makeSessionId(namespace);
    window.localStorage.setItem(sessionKey(instanceId, namespace), created);
    return created;
  } catch {
    return makeSessionId(namespace);
  }
}

export function loadVisualPricingSnapshot(
  instanceId: string,
  namespace: VisualPricingStorageNamespace = "v3"
): VisualPricingSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(snapshotKey(instanceId, namespace));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VisualPricingSnapshot & { storageSchema?: number };
    if (
      !parsed ||
      parsed.version !== 3 ||
      parsed.experiment !== "visual_pricing_two_stage" ||
      parsed.storageSchema !== STORAGE_SCHEMA ||
      typeof parsed.sessionId !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveVisualPricingSnapshot(
  instanceId: string,
  snapshot: VisualPricingSnapshot,
  namespace: VisualPricingStorageNamespace = "v3"
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      snapshotKey(instanceId, namespace),
      JSON.stringify({ ...snapshot, version: 3, storageSchema: STORAGE_SCHEMA })
    );
  } catch {}
}

export function clearVisualPricingSnapshot(
  instanceId: string,
  namespace: VisualPricingStorageNamespace = "v3"
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(snapshotKey(instanceId, namespace));
    window.localStorage.removeItem(sessionKey(instanceId, namespace));
  } catch {}
}

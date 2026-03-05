"use client";

// Module-level session manager to persist across component remounts
// This prevents duplicate session IDs when React strict mode causes double mounting

const SESSION_CACHE_KEY = "ai_form_session_cache";
const SESSION_STARTED_KEY = "ai_form_session_started";
const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

interface SessionCache {
  [instanceId: string]: {
    sessionId: string;
    timestamp: number;
  };
}

interface SessionStartedCache {
  [key: string]: number; // key is `${instanceId}|${sessionId}`, value is timestamp
}

function getSessionCache(): SessionCache {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.sessionStorage.getItem(SESSION_CACHE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch {}
  return {};
}

function setSessionCache(cache: SessionCache): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(cache));
  } catch {}
}

function getSessionStartedCache(): SessionStartedCache {
  if (typeof window === "undefined") return {};
  try {
    const stored = window.sessionStorage.getItem(SESSION_STARTED_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Clean up old entries (older than 1 hour)
      const now = Date.now();
      const cleaned: SessionStartedCache = {};
      for (const [key, rawTimestamp] of Object.entries(parsed as Record<string, unknown>)) {
        const timestamp =
          typeof rawTimestamp === "number"
            ? rawTimestamp
            : Number(rawTimestamp);
        if (!Number.isFinite(timestamp)) continue;
        if (now - timestamp < 60 * 60 * 1000) {
          cleaned[key] = timestamp;
        }
      }
      if (Object.keys(cleaned).length !== Object.keys(parsed).length) {
        setSessionStartedCache(cleaned);
      }
      return cleaned;
    }
  } catch {}
  return {};
}

function setSessionStartedCache(cache: SessionStartedCache): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_STARTED_KEY, JSON.stringify(cache));
  } catch {}
}

export type CachedSessionInfo = {
  sessionId: string;
  timestamp: number;
  ageMs: number;
  ttlMs: number;
  valid: boolean;
};

export function peekCachedSession(instanceId: string): CachedSessionInfo | null {
  const cache = getSessionCache();
  const existing = cache[instanceId];
  if (!existing || typeof existing !== "object") return null;
  const sessionId = typeof existing.sessionId === "string" ? existing.sessionId : null;
  const timestampRaw = (existing as any).timestamp;
  const timestamp = Number.isFinite(timestampRaw) ? Number(timestampRaw) : NaN;
  if (!sessionId || !Number.isFinite(timestamp)) return null;
  const now = Date.now();
  const ageMs = Math.max(0, now - timestamp);
  return {
    sessionId,
    timestamp,
    ageMs,
    ttlMs: SESSION_TTL_MS,
    valid: ageMs < SESSION_TTL_MS,
  };
}

// Module-level lock to prevent race conditions in session ID generation
let sessionIdLock: { [instanceId: string]: boolean } = {};

export function getOrCreateSessionId(instanceId: string, isFresh: boolean = false): string {
  // Prevent concurrent calls for the same instance
  if (sessionIdLock[instanceId]) {
    // Wait a bit and retry (shouldn't happen often, but handle race condition)
    const cache = getSessionCache();
    const existing = cache[instanceId];
    if (existing) {
      return existing.sessionId; // Return existing if available
    }
  }
  
  sessionIdLock[instanceId] = true;
  
  try {
    const cache = getSessionCache();
    const now = Date.now();

    // If fresh, always generate new
    if (isFresh) {
      const newSessionId = `sess_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
      cache[instanceId] = { sessionId: newSessionId, timestamp: now };
      setSessionCache(cache);
      return newSessionId;
    }

    // Check if we have a valid cached session
    const existing = cache[instanceId];
    if (existing && now - existing.timestamp < SESSION_TTL_MS) {
      return existing.sessionId;
    }

    // Generate new session
    const newSessionId = `sess_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    cache[instanceId] = { sessionId: newSessionId, timestamp: now };
    setSessionCache(cache);
    return newSessionId;
  } finally {
    // Release lock after a short delay to prevent rapid re-locking
    setTimeout(() => {
      delete sessionIdLock[instanceId];
    }, 100);
  }
}

export function hasSessionStarted(instanceId: string, sessionId: string): boolean {
  const cache = getSessionStartedCache();
  const key = `${instanceId}|${sessionId}`;
  return key in cache;
}

export function markSessionStarted(instanceId: string, sessionId: string): void {
  const cache = getSessionStartedCache();
  const key = `${instanceId}|${sessionId}`;
  cache[key] = Date.now();
  setSessionStartedCache(cache);
}

export function clearSession(instanceId: string): void {
  const cache = getSessionCache();
  delete cache[instanceId];
  setSessionCache(cache);
  
  // Also clear session_started tracking for this instance
  const startedCache = getSessionStartedCache();
  const keysToDelete = Object.keys(startedCache).filter(k => k.startsWith(`${instanceId}|`));
  for (const key of keysToDelete) {
    delete startedCache[key];
  }
  setSessionStartedCache(startedCache);
}

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export type AccountSubscriptionRoute =
  | 'active'
  | 'new'
  | 'locked'
  | 'renew'
  | 'payment-failed'
  | 'partner-pending';

export type AccountSubscriptionStatus = {
  account: any | null;
  checkedAt: number;
  ownerUserId: string | null;
  reason: string | null;
  route: AccountSubscriptionRoute;
  subscription: any | null;
  userRole: string | null;
};

type CacheEntry = { expiresAt: number; status: AccountSubscriptionStatus };

const DEFAULT_TTL_MS = 30_000;
const statusCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<AccountSubscriptionStatus>>();

function makeCacheKey(userId: string, accountId: string) {
  return `${userId}:${accountId}`;
}

function getCachedStatus(cacheKey: string) {
  const entry = statusCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    statusCache.delete(cacheKey);
    return null;
  }
  return entry.status;
}

export function clearAllAccountSubscriptionCache() {
  statusCache.clear();
  inflight.clear();
}

export function clearAccountSubscriptionCache(userId: string, accountId: string) {
  const cacheKey = makeCacheKey(userId, accountId);
  statusCache.delete(cacheKey);
  inflight.delete(cacheKey);
}

export function setAccountSubscriptionStatusCache(
  userId: string,
  accountId: string,
  status: AccountSubscriptionStatus,
  ttlMs: number = DEFAULT_TTL_MS,
) {
  const cacheKey = makeCacheKey(userId, accountId);
  statusCache.set(cacheKey, { expiresAt: Date.now() + ttlMs, status });
}

export function useAccountSubscription(
  accountId: string | null,
  options?: { enabled?: boolean; force?: boolean; ttlMs?: number },
) {
  const enabled = options?.enabled ?? true;
  const force = options?.force ?? false;
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const { session } = useAuth();

  const cacheKey = useMemo(() => {
    if (!session?.user?.id || !accountId) return null;
    return makeCacheKey(session.user.id, accountId);
  }, [session?.user?.id, accountId]);

  const [status, setStatus] = useState<AccountSubscriptionStatus | null>(() => {
    if (!cacheKey || force) return null;
    return getCachedStatus(cacheKey);
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastKeyRef = useRef<string | null>(null);

  const fetchStatus = useCallback(
    async (opts?: { force?: boolean }) => {
      if (!enabled || !cacheKey || !accountId || !session?.user?.id) {
        setLoading(false);
        setError(null);
        setStatus(null);
        return null;
      }

      const cached = opts?.force ? null : getCachedStatus(cacheKey);
      if (cached) {
        setStatus(cached);
        setLoading(false);
        setError(null);
        return cached;
      }

      const existing = inflight.get(cacheKey);
      if (existing) {
        setLoading(true);
        try {
          const result = await existing;
          setStatus(result);
          setError(null);
          return result;
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to check subscription';
          setError(message);
          return null;
        } finally {
          setLoading(false);
        }
      }

      const controller = new AbortController();
      const promise = (async () => {
        const response = await fetch('/api/accounts/subscription-status', {
          body: JSON.stringify({ accountId }),
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          method: 'POST',
          signal: controller.signal,
        });

        if (response.status === 401) {
          throw new Error('Unauthorized');
        }
        if (response.status === 403) {
          throw new Error('Access denied');
        }
        if (!response.ok) {
          throw new Error('Failed to check subscription');
        }

        const data = await response.json();
        const route = data?.route as AccountSubscriptionRoute | null;
        if (!route) {
          throw new Error('Invalid subscription status response');
        }

        const next: AccountSubscriptionStatus = {
          account: data?.account ?? null,
          checkedAt: Date.now(),
          ownerUserId: data?.ownerUserId ?? null,
          reason: data?.reason ?? null,
          route,
          subscription: data?.subscription ?? null,
          userRole: data?.userRole ?? null,
        };

        statusCache.set(cacheKey, { expiresAt: Date.now() + ttlMs, status: next });
        return next;
      })();

      inflight.set(cacheKey, promise);
      setLoading(true);
      setError(null);

      try {
        const result = await promise;
        setStatus(result);
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to check subscription';
        setError(message);
        return null;
      } finally {
        inflight.delete(cacheKey);
        setLoading(false);
        controller.abort();
      }
    },
    [enabled, cacheKey, accountId, session?.access_token, session?.user?.id, ttlMs],
  );

  useEffect(() => {
    if (!enabled) return;
    if (!cacheKey) return;

    // If we switched accounts, hydrate from cache immediately.
    if (lastKeyRef.current !== cacheKey) {
      lastKeyRef.current = cacheKey;
      setError(null);
      if (force) {
        setStatus(null);
      } else {
        setStatus(getCachedStatus(cacheKey));
        setLoading(false);
      }
    }

    fetchStatus({ force });
  }, [enabled, cacheKey, fetchStatus, force]);

  const route = status?.route ?? null;
  const userRole = status?.userRole ?? null;

  return {
    error,
    hasActiveSubscription: route === 'active',
    isOwner: userRole === 'owner',
    loading,
    reason: status?.reason ?? null,
    refetch: () => fetchStatus({ force: true }),
    route,
    status,
    subscription: status?.subscription ?? null,
    userRole,
  };
}

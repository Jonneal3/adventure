type CacheEntry = { expiresAt: number; users: any[] };

const DEFAULT_TTL_MS = 30_000;
const usersCache = new Map<string, CacheEntry>();
const usersInflight = new Map<string, Promise<any[]>>();

export function getCachedAccountUsers(accountId: string) {
  const entry = usersCache.get(accountId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    usersCache.delete(accountId);
    return null;
  }
  return entry.users;
}

export function clearAccountUsersCache(accountId?: string) {
  if (!accountId) {
    usersCache.clear();
    usersInflight.clear();
    return;
  }
  usersCache.delete(accountId);
  usersInflight.delete(accountId);
}

export async function fetchAccountUsersCached(
  accountId: string,
  options?: { force?: boolean; ttlMs?: number },
) {
  const force = options?.force ?? false;
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;

  const cached = force ? null : getCachedAccountUsers(accountId);
  if (cached) return cached;

  const existing = usersInflight.get(accountId);
  if (existing) return existing;

  const promise = (async () => {
    const response = await fetch('/api/accounts/users', {
      body: JSON.stringify({ accountId }),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((data as any)?.error || 'Failed to load users');
    }

    const users = Array.isArray((data as any)?.users) ? (data as any).users : [];
    usersCache.set(accountId, { expiresAt: Date.now() + ttlMs, users });
    return users;
  })();

  usersInflight.set(accountId, promise);
  try {
    return await promise;
  } finally {
    usersInflight.delete(accountId);
  }
}

export function primeAccountUsers(accountId: string) {
  void fetchAccountUsersCached(accountId).catch(() => null);
}


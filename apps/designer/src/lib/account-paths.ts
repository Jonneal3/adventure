const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidV4(value: string | null | undefined): boolean {
  if (!value) return false;
  return UUID_V4_RE.test(value);
}

/**
 * Controls when we should eagerly fetch "account-scoped" data (e.g. userAccounts)
 * based on the current route.
 *
 * Goal: keep public pages fast (no account bootstrap) while still bootstrapping
 * for account routes like `/:accountId/...` and `/accounts`.
 */
export function pathNeedsAccountData(pathname: string | null | undefined): boolean {
  const path = pathname || '';
  if (!path.startsWith('/')) return false;

  if (path === '/accounts' || path.startsWith('/accounts/')) return true;

  const firstSegment = path.split('/')[1] || '';
  return isUuidV4(firstSegment);
}


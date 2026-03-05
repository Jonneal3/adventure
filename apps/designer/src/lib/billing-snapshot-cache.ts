import type { Plan, UserSubscription } from '@/types/plans';

export type BillingSnapshot = {
  autoPurchaseAmount: number;
  autoPurchaseEnabled: boolean;
  currentPlan: Plan | null;
  plans: Plan[];
  subscription: UserSubscription | null;
};

type CacheEntry = { expiresAt: number; snapshot: BillingSnapshot };

const DEFAULT_TTL_MS = 30_000;
const billingCache = new Map<string, CacheEntry>();
const billingInflight = new Map<string, Promise<BillingSnapshot>>();

export function makeBillingSnapshotCacheKey(userId: string, accountId: string) {
  return `${userId}:${accountId}`;
}

export function getCachedBillingSnapshot(cacheKey: string) {
  const entry = billingCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    billingCache.delete(cacheKey);
    return null;
  }
  return entry.snapshot;
}

export function clearBillingSnapshotCache(cacheKey?: string) {
  if (!cacheKey) {
    billingCache.clear();
    billingInflight.clear();
    return;
  }
  billingCache.delete(cacheKey);
  billingInflight.delete(cacheKey);
}

function deriveAutoPurchase(subscription: UserSubscription | null) {
  if (!subscription) {
    return { autoPurchaseAmount: 40, autoPurchaseEnabled: true };
  }

  const subAny = subscription as any;
  const autoPurchaseEnabled = subAny.auto_purchase_enabled !== false;

  let autoPurchaseAmount = subAny.auto_purchase_amount || 40;
  if (
    typeof autoPurchaseAmount === 'number' &&
    autoPurchaseAmount >= 1000 &&
    autoPurchaseAmount % 100 === 0
  ) {
    autoPurchaseAmount = Math.round(autoPurchaseAmount / 100);
  }

  return { autoPurchaseAmount, autoPurchaseEnabled };
}

export async function fetchBillingSnapshotCached(
  userId: string,
  accountId: string,
  options?: { background?: boolean; force?: boolean; ttlMs?: number },
) {
  const force = options?.force ?? false;
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const cacheKey = makeBillingSnapshotCacheKey(userId, accountId);

  const cached = force ? null : getCachedBillingSnapshot(cacheKey);
  if (cached) return cached;

  const existing = billingInflight.get(cacheKey);
  if (existing) return existing;

  const promise = (async (): Promise<BillingSnapshot> => {
    const subscriptionResponse = await fetch(
      `/api/user-subscriptions/account?accountId=${accountId}`,
      { headers: { 'Content-Type': 'application/json' } },
    );

    let subscription: UserSubscription | null = null;
    if (subscriptionResponse.ok) {
      const json = await subscriptionResponse.json().catch(() => ({}));
      subscription = (json as any)?.subscription ?? null;
    }

    const plansResponse = await fetch('/api/stripe/plans');
    const plans = (plansResponse.ok ? await plansResponse.json().catch(() => []) : []) as Plan[];
    const safePlans = Array.isArray(plans) ? plans : [];

    const planId = subscription?.plan_id ?? null;
    const currentPlan =
      planId ? (safePlans.find((p: any) => p.plan_id === planId) as Plan | undefined) ?? null : null;

    const { autoPurchaseAmount, autoPurchaseEnabled } = deriveAutoPurchase(subscription);

    return {
      autoPurchaseAmount,
      autoPurchaseEnabled,
      currentPlan,
      plans: safePlans,
      subscription,
    };
  })();

  billingInflight.set(cacheKey, promise);
  try {
    const snapshot = await promise;
    billingCache.set(cacheKey, { expiresAt: Date.now() + ttlMs, snapshot });
    return snapshot;
  } finally {
    billingInflight.delete(cacheKey);
  }
}

export function primeBillingSnapshot(userId: string, accountId: string) {
  void fetchBillingSnapshotCached(userId, accountId).catch(() => null);
}


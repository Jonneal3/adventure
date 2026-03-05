import { useEffect, useMemo, useState } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { useAccountSubscription } from '@/hooks/use-account-subscription';

interface AccountPlan {
  plan_id: string;
  name: string;
  onboarding_type: 'self_serve' | 'one_on_one' | 'concierge' | 'partner';
  isPartner: boolean;
}

function toOnboardingType(value: unknown): AccountPlan['onboarding_type'] {
  if (value === 'self_serve' || value === 'one_on_one' || value === 'concierge' || value === 'partner') {
    return value;
  }
  return 'partner';
}

const planCache = new Map<string, AccountPlan>();
const inflight = new Map<string, Promise<AccountPlan>>();

async function fetchPlan(planId: string): Promise<AccountPlan> {
  const cached = planCache.get(planId);
  if (cached) return cached;

  const existing = inflight.get(planId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const planResponse = await fetch(`/api/plans/${planId}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (!planResponse.ok) {
        throw new Error('Failed to fetch plan details');
      }

      const planData = await planResponse.json();
      const onboardingType = toOnboardingType(planData?.onboarding_type);
      const isPartner = onboardingType === 'partner';

      const next: AccountPlan = {
        plan_id: String(planData?.plan_id ?? planId),
        name: String(planData?.name ?? 'Unknown'),
        onboarding_type: onboardingType,
        isPartner,
      };

      planCache.set(planId, next);
      return next;
    } catch {
      // Conservative fallback: treat unknown plans as partner plans
      // to avoid exposing restricted UI in error states.
      const fallback: AccountPlan = {
        plan_id: planId,
        name: 'Unknown',
        onboarding_type: 'partner',
        isPartner: true,
      };
      return fallback;
    } finally {
      inflight.delete(planId);
    }
  })();

  inflight.set(planId, promise);
  return promise;
}

export function useAccountPlan() {
  const [plan, setPlan] = useState<AccountPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { currentAccount } = useAccount();

  const accountId = currentAccount?.id ?? null;
  const { subscription, loading: subscriptionLoading, error: subscriptionError } = useAccountSubscription(
    accountId,
    { enabled: !!accountId },
  );

  const planId = useMemo(() => {
    const raw = subscription?.plan_id;
    if (!raw) return null;
    return String(raw);
  }, [subscription?.plan_id]);

  useEffect(() => {
    if (!accountId) {
      setPlan(null);
      setLoading(false);
      setError(null);
      return;
    }

    if (subscriptionLoading) {
      setLoading(true);
      setError(null);
      return;
    }

    if (subscriptionError) {
      setPlan(null);
      setLoading(false);
      setError(subscriptionError);
      return;
    }

    if (!planId) {
      setPlan(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchPlan(planId)
      .then((next) => {
        if (cancelled) return;
        setPlan(next);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setPlan(null);
        setError(err instanceof Error ? err.message : 'Failed to fetch account plan');
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accountId, planId, subscriptionError, subscriptionLoading]);

  return {
    plan,
    loading,
    error,
    isPartner: plan?.isPartner || false
  };
}

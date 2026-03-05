import { useState, useEffect } from "react";
import { useSupabaseClientWithAuth } from "@/hooks/useSupabaseClientWithAuth";
import { UserSubscription } from "@mage/types";
import { useStripeMode } from "./use-stripe-mode";
import { useAuth } from "@/contexts/AuthContext";
import { useAccount } from "@/contexts/AccountContext";

export function useSubscription(userId?: string) {
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const supabase = useSupabaseClientWithAuth();
  const { mode } = useStripeMode();
  const { session } = useAuth();
  const { currentAccount } = useAccount();
  const accountId = currentAccount?.id ?? null;

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function fetchSubscription() {
      try {
        setLoading(true);
        setError(null);

        if (!session?.access_token || !accountId) {
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        // Fetch subscription using API route
        const response = await fetch(`/api/user-subscriptions/credits?accountId=${accountId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          if (mounted) {
            setError('Failed to fetch subscription');
            setLoading(false);
          }
          return;
        }

        const { subscription: userSubscription, status } = await response.json();

        if (mounted) {
          setSubscription(userSubscription);
          setNeedsOnboarding(!userSubscription || status === 'inactive');
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to fetch subscription");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchSubscription();

    return () => {
      mounted = false;
    };
  }, [userId, session?.access_token, accountId]);



  // REMOVED: Automatic redirect to onboarding
  // Let individual pages handle subscription checks and redirects as needed

  return {
    subscription,
    loading,
    error,
    needsOnboarding,
    isInTrial: subscription?.status === "trialing",
    trialEndDate: subscription?.end_date ? new Date(subscription.end_date) : null,
    daysLeftInTrial: subscription?.end_date 
      ? Math.ceil((new Date(subscription.end_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      : 0,
  };
} 

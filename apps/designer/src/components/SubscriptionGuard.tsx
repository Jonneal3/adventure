"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSupabaseClientWithAuth } from '@/hooks/useSupabaseClientWithAuth';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { Button } from '@/components/ui/button';
import { FullPageLoader } from '@/components/ui/full-page-loader';

interface SubscriptionGuardProps {
  children: React.ReactNode;
}

export default function SubscriptionGuard({ children }: SubscriptionGuardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasValidSubscription, setHasValidSubscription] = useState(false);
  const router = useRouter();
  const { session } = useAuth();
  const { currentAccount } = useAccount();
  const supabase = useSupabaseClientWithAuth();
  const accountId = currentAccount?.id ?? null;
  const accessToken = session?.access_token ?? null;

  useEffect(() => {
    async function checkSubscription() {
      if (!supabase) return;

      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          router.push('/auth');
          return;
        }

        // Check if we have a current account
        if (!accountId) {
          router.push('/accounts');
          return;
        }

        // Use API route instead of direct database query
        const response = await fetch(`/api/user-subscriptions/credits?accountId=${accountId}`, {
          headers: {
            ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          setHasValidSubscription(false);
          setIsLoading(false);
          return;
        }

        const { status } = await response.json();
        const isValid = status === 'active' || status === 'trialing';

        setHasValidSubscription(isValid);
      } catch (error) {
        setHasValidSubscription(false);
      } finally {
        setIsLoading(false);
      }
    }

    if (supabase) {
      checkSubscription();
    }
  }, [router, supabase, accountId, accessToken]);

  if (isLoading) {
    return <FullPageLoader height="screen" />;
  }

  if (!hasValidSubscription) {
    return (
      <div className="min-h-screen bg-white dark:bg-black flex items-center justify-center px-4">
        <div className="text-center space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Subscription Required
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              You need an active subscription to access this feature.
            </p>
          </div>
          <Button 
            onClick={() => {
              router.push('/accounts');
            }}
            className="bg-gray-900 dark:bg-white text-white dark:text-gray-900"
          >
            Choose a Plan
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
} 

"use client";

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountSubscription } from '@/hooks/use-account-subscription';
import { FullPageLoader } from '@/components/ui/full-page-loader';

export default function AccountDefaultPage() {
  const params = useParams();
  const accountId = params?.accountId as string | undefined;
  const router = useRouter();
  const { isLoading, session } = useAuth();

  const subscriptionEnabled = !!accountId && !!session?.user && !isLoading;
  const { error, loading, route } = useAccountSubscription(accountId ?? null, {
    enabled: subscriptionEnabled,
    force: true,
  });

  useEffect(() => {
    if (isLoading) return;

    if (!session) {
      router.replace('/auth');
      return;
    }

    if (!accountId) {
      router.replace('/accounts');
      return;
    }

    if (loading) return;

    if (error) {
      if (error === 'Unauthorized') {
        router.replace('/auth');
        return;
      }
      router.replace('/accounts');
      return;
    }

    if (!route) {
      router.replace('/accounts');
      return;
    }

    if (route === 'active') {
      router.replace(`/${accountId}/designer-instances`);
      return;
    }

    router.replace(`/${accountId}/subscription/${route}`);
  }, [accountId, error, isLoading, loading, route, router, session]);

  return (
    <FullPageLoader height="content" />
  );
} 

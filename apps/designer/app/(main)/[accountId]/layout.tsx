'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { useAccountSubscription } from '@/hooks/use-account-subscription';
import { FullPageLoader } from '@/components/ui/full-page-loader';
import { primeAccountUsers } from '@/lib/account-users-cache';
import { primeBillingSnapshot } from '@/lib/billing-snapshot-cache';

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '';
  const { isLoading, session } = useAuth();
  const { accountsLoaded, currentAccount, setCurrentAccount, userAccounts } = useAccount();

  // Extract accountId from the URL
  const pathSegments = pathname.split('/').filter(Boolean);
  const accountId = pathSegments[0] || null;
  const isAccountBootstrapRoute = pathSegments.length === 1;

  const shouldCheckSubscription = !!accountId && !isAccountBootstrapRoute;
  const {
    error: subscriptionError,
    loading: subscriptionLoading,
    route: subscriptionRoute,
  } = useAccountSubscription(shouldCheckSubscription ? accountId : null, { enabled: shouldCheckSubscription });

  const bootstrapRef = useRef<string | null>(null);
  useEffect(() => {
    if (!session?.user?.id || !accountId) return;
    const key = `${session.user.id}:${accountId}`;
    if (bootstrapRef.current === key) return;

    const routes = [
      `/${accountId}/accounts`,
      `/${accountId}/billing`,
      `/${accountId}/users`,
      `/${accountId}/designer-instances`,
    ];
    for (const href of routes) {
      router.prefetch(href);
    }

    // Warm caches so tab-to-tab navigation feels instant.
    void fetch('/api/stripe/plans').catch(() => null);
    void fetch(`/api/user-subscriptions/credits?accountId=${accountId}`).catch(() => null);
    primeAccountUsers(accountId);
    primeBillingSnapshot(session.user.id, accountId);

    bootstrapRef.current = key;
  }, [accountId, router, session?.user?.id]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!session) {
      router.push('/auth');
      return;
    }

    if (!accountId) {
      router.push('/accounts');
      return;
    }

    if (!currentAccount && accountsLoaded && userAccounts && accountId) {
      const match = userAccounts.find((ua: any) => ua.account_id === accountId);
      if (match && match.accounts) {
        setCurrentAccount(match.accounts);
      } else {
        router.push('/accounts');
      }
    }
  }, [isLoading, session, accountId, router, currentAccount, accountsLoaded, userAccounts, setCurrentAccount]);

  // Check if we're already on a subscription-related page to avoid redirect loops
  const isSubscriptionPage = pathname?.includes('/subscription/');
  const isBillingPage = pathname?.includes('/billing');
  const isAccountsPage = pathname?.includes('/accounts');
  // Do not block the new-instance flow or instance editor with subscription loading
  const isDesignerNewPage = pathname?.includes('/designer-instances/new');
  const isDesignerInstancePage = pathname?.includes('/designer-instances/instance/');
  
  // Don't show subscription-related loading for excluded pages
  const shouldShowSubscriptionLoading = !isSubscriptionPage && !isBillingPage && !isAccountsPage && !isDesignerNewPage && !isDesignerInstancePage;

  useEffect(() => {
    if (!accountId || !shouldCheckSubscription) return;
    if (subscriptionLoading) return;

    if (subscriptionError) {
      if (subscriptionError === 'Unauthorized') {
        router.replace('/auth');
        return;
      }
      if (subscriptionError === 'Access denied') {
        router.replace('/accounts');
        return;
      }
      return;
    }

    if (!subscriptionRoute) return;
    if (subscriptionRoute === 'active') {
      if (isSubscriptionPage) {
        router.replace(`/${accountId}/designer-instances`);
      }
      return;
    }

    const target = `/${accountId}/subscription/${subscriptionRoute}`;
    if (pathname !== target) {
      router.replace(target);
    }
  }, [
    accountId,
    pathname,
    router,
    shouldCheckSubscription,
    subscriptionError,
    subscriptionLoading,
    subscriptionRoute,
    isSubscriptionPage,
  ]);

  // Let child pages decide whether to block on account context; only block for subscription checks.
  if (
    !isLoading &&
    session &&
    shouldShowSubscriptionLoading &&
    shouldCheckSubscription &&
    (subscriptionLoading || (!subscriptionRoute && !subscriptionError))
  ) {
    return <FullPageLoader height="content" />;
  }

  if (isLoading) return <FullPageLoader height="content" />;
  if (!session) return null;

  return (
    <div className="flex flex-col min-h-screen max-h-screen overflow-hidden bg-transparent relative">
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

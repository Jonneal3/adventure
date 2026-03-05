"use client";

import { useEffect, useState, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, Check, Plus, ArrowLeft } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/PageHeader';
import { FullPageLoader } from '@/components/ui/full-page-loader';
import { clearAllAccountSubscriptionCache, setAccountSubscriptionStatusCache } from '@/hooks/use-account-subscription';
import { Spinner } from '@/components/ui/spinner';
import { primeAccountUsers } from '@/lib/account-users-cache';
import { primeBillingSnapshot } from '@/lib/billing-snapshot-cache';

function getInitials(name: string | null | undefined) {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'A';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || '';
  const last = (parts.length > 1 ? parts[parts.length - 1]?.[0] : '') || '';
  return (first + last).toUpperCase();
}

function getRelationshipStatusLabel(status: string | null | undefined) {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'accepted') return 'Active';
  if (normalized === 'invited') return 'Invited';
  return status || '';
}

function AccountsPageContent() {
  const [accountName, setAccountName] = useState('');
  const [accountSlug, setAccountSlug] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [redirectPath, setRedirectPath] = useState<string | null>(null);
  const [acceptingInviteId, setAcceptingInviteId] = useState<string | null>(null);
  const [selectingAccountId, setSelectingAccountId] = useState<string | null>(null);
  const [showCreateAccountForm, setShowCreateAccountForm] = useState(false);
  // Remove categories state, loading, and selectedAccountId

  // Use userAccounts from AccountContext for global, up-to-date state
  const { accountsLoaded, currentAccount, refreshAccounts, setCurrentAccount, userAccounts } = useAccount();
  
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoading, session } = useAuth();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !session) {
      setRedirectPath('/auth');
    }
  }, [session, isLoading]);

  useEffect(() => {
    if (redirectPath) {
      router.push(redirectPath);
    }
  }, [redirectPath, router]);

  // Handle payment success/cancel from Stripe
  useEffect(() => {
    const paymentStatus = searchParams.get('payment');
    const isPartner = searchParams.get('partner') === 'true';
    
    if (paymentStatus === 'success') {
      clearAllAccountSubscriptionCache();
      if (isPartner) {
        toast({
          description: 'Your partner plan has been activated! Our team will contact you soon for onboarding.',
          duration: 5000,
          title: 'Partner Plan Activated',
        });
      } else {
        toast({
          description: 'Your subscription has been activated successfully!',
          duration: 5000,
          title: 'Payment Successful',
        });
      }
      // Clean up URL parameters
      router.replace('/accounts');
    } else if (paymentStatus === 'cancelled') {
      clearAllAccountSubscriptionCache();
      toast({
        description: 'Your payment was cancelled. You can try again anytime.',
        duration: 5000,
        title: 'Payment Cancelled',
        variant: 'destructive',
      });
      // Clean up URL parameters
      router.replace('/accounts');
    }
  }, [searchParams, router, toast]);

  // Accounts are bootstrapped in `AccountProvider` for `/accounts` and account routes.

  // Auto-generate slug from account name
  useEffect(() => {
    if (accountName) {
      const slug = accountName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
      setAccountSlug(slug);
    }
  }, [accountName]);

  const createAccount = async () => {
    if (!session?.user) {
      toast({
        description: "You must be logged in to create an account",
        title: "Error",
        variant: "destructive",
      });
      return;
    }

    if (!accountName.trim()) {
      toast({
        description: "Account name is required",
        title: "Error",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/accounts/create-with-owner', {
        body: JSON.stringify({
          description: description.trim() || null,
          name: accountName.trim(),
          slug: accountSlug,
          user_id: session.user.id,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.code === '23505' || (result.error && result.error.message && result.error.message.includes('duplicate key value'))) {
          toast({
            description: "An account with this slug already exists. Please choose a different slug.",
            title: "Duplicate Slug",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
        throw result.error || 'Failed to create account';
      }

      toast({
        description: "Account created successfully!",
        title: "Success",
      });
      setAccountName('');
      setAccountSlug('');
      setDescription('');

      // Immediately update the context with the new account
      await refreshAccounts();

      setShowCreateAccountForm(false); // Return to selection view after creation
    } catch (error) {
      let errorMsg = '';
      if (error instanceof Error) {
        errorMsg = error.message;
      } else if (typeof error === 'object') {
        errorMsg = JSON.stringify(error);
      } else {
        errorMsg = String(error);
      }
      toast({
        description: errorMsg,
        title: "Error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Remove fetchCategoriesForAccount and all references to it

  const selectAccount = async (accountId: string) => {
    if (selectingAccountId) return;
    // Find the userAccount row
    const userAccount = userAccounts.find(acc => acc.account_id === accountId);
    if (userAccount && userAccount.accounts) {
      const account = userAccount.accounts;
      setSelectingAccountId(accountId);
      // Set the current account in context
      setCurrentAccount({
        created_at: account.created_at ?? '',
        description: account.description ?? '',
        id: account.id,
        name: account.name,
        slug: account.slug,
        updated_at: account.updated_at ?? '',
      });

      // Prefetch common account routes so the first tab click feels instant.
      const prefetchRoutes = [
        `/${accountId}/designer-instances`,
        `/${accountId}/accounts`,
        `/${accountId}/billing`,
        `/${accountId}/users`,
      ];
      for (const href of prefetchRoutes) {
        router.prefetch(href);
      }

      // Warm key data caches in the background for SPA-like navigation.
      void fetch('/api/stripe/plans').catch(() => null);
      void fetch(`/api/user-subscriptions/credits?accountId=${accountId}`).catch(() => null);
      primeAccountUsers(accountId);
      if (session?.user?.id) {
        primeBillingSnapshot(session.user.id, accountId);
      }

      // Navigate directly to the correct destination (avoid an extra hop through `/${accountId}`).
      try {
        const res = await fetch('/api/accounts/subscription-status', {
          body: JSON.stringify({ accountId }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        });

        if (res.status === 401) {
          router.push('/auth');
          return;
        }
        if (res.status === 403) {
          router.push('/accounts');
          return;
        }

        const data = await res.json().catch(() => ({}));
        const route = (data as any)?.route as string | null;

        if (session?.user?.id && route) {
          setAccountSubscriptionStatusCache(
            session.user.id,
            accountId,
            {
              account: (data as any)?.account ?? null,
              checkedAt: Date.now(),
              ownerUserId: (data as any)?.ownerUserId ?? null,
              reason: (data as any)?.reason ?? null,
              route: route as any,
              subscription: (data as any)?.subscription ?? null,
              userRole: (data as any)?.userRole ?? null,
            },
          );
        }

        if (route === 'active') {
          router.push(`/${accountId}/designer-instances`);
          return;
        }
        if (route) {
          router.push(`/${accountId}/subscription/${route}`);
          return;
        }
      } catch {}

      router.push(`/${accountId}`);
    } else {}
  };

  // Derive hasAccounts from context - show all user accounts, not just accepted ones
  const hasAccounts = userAccounts && userAccounts.length > 0;

  if (isLoading || (session?.user && !accountsLoaded)) {
    return <FullPageLoader height="content" title="Loading…" />;
  }

  // Show redirect state
  if (redirectPath) {
    return <FullPageLoader height="content" title="Redirecting…" />;
  }

  // If user already has accounts, show account selection
  if (hasAccounts && !showCreateAccountForm) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-transparent">
        <div className="container mx-auto max-w-5xl px-4 py-8">
          <div className="mx-auto w-full max-w-2xl">
            <PageHeader
              title="Accounts"
              description="Select an account to continue."
              className="mb-6"
              actions={
                <Button
                  type="button"
                  onClick={() => setShowCreateAccountForm(true)}
                  className="h-8 rounded-full px-3"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">New</span>
                </Button>
              }
            />

            <div className="max-h-[60vh] overflow-y-auto pr-1">
              <div className="space-y-2">
                {userAccounts.map((userAccount: any) => {
                  const account = userAccount.accounts;
                  const relationshipStatus = (userAccount.status || '').toLowerCase();
                  const roleLabel = userAccount.user_status ? String(userAccount.user_status) : null;
                  const statusLabel = getRelationshipStatusLabel(userAccount.status);
                  const isAccepted = relationshipStatus === 'accepted';
                  const isInvited = relationshipStatus === 'invited';
                  const isCurrent = userAccount.account_id === currentAccount?.id;
                  const isSelecting = selectingAccountId === userAccount.account_id;
                  const isAnySelecting = selectingAccountId !== null;
                  const Wrapper: any = isAccepted ? 'button' : 'div';

                  return (
                    <Wrapper
                      key={userAccount.account_id}
                      type={isAccepted ? 'button' : undefined}
                      disabled={isAccepted ? isAnySelecting : undefined}
                      onClick={isAccepted && !isAnySelecting ? () => selectAccount(userAccount.account_id) : undefined}
                      className={cn(
                        'w-full rounded-xl border border-border/60 bg-card/60 px-4 py-3 text-left shadow-sm backdrop-blur transition-all duration-200',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        isAccepted ? 'cursor-pointer hover:border-primary/40 hover:bg-accent/50 hover:shadow-md' : 'cursor-default opacity-80',
                        isCurrent ? 'border-primary/40' : null,
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          <AvatarFallback className="bg-muted text-xs text-muted-foreground">
                            {getInitials(account?.name)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium text-foreground">
                                {account?.name || 'Unknown Account'}
                              </div>
                              {account?.description ? (
                                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                                  {account.description}
                                </div>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-2">
                              {statusLabel ? (
                                <span
                                  className={cn(
                                    'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
                                    statusLabel === 'Active'
                                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-900/20 dark:text-emerald-200'
                                      : 'border-border bg-background text-muted-foreground',
                                  )}
                                >
                                  {statusLabel}
                                </span>
                              ) : null}
                              {isSelecting ? <Spinner className="h-4 w-4 text-muted-foreground" /> : null}
                              {!isSelecting && isCurrent ? <Check className="h-4 w-4 text-primary" /> : null}
                            </div>
                          </div>

                          {(roleLabel || isInvited) ? (
                            <div className="mt-2 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                {roleLabel ? <span className="capitalize">{roleLabel}</span> : null}
                              </div>

                              {isInvited ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-full"
                                  disabled={acceptingInviteId === userAccount.account_id}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (!session) {
                                      toast({ description: 'You must be logged in to accept an invitation', title: 'Error', variant: 'destructive' });
                                      return;
                                    }
                                    setAcceptingInviteId(userAccount.account_id);
                                    try {
                                      const res = await fetch('/api/accounts/accept-invite', {
                                        body: JSON.stringify({ accountId: userAccount.account_id }),
                                        headers: {
                                          'Authorization': `Bearer ${session.access_token}`,
                                          'Content-Type': 'application/json',
                                        },
                                        method: 'POST',
                                      });
                                      if (res.status === 400) {
                                        toast({ description: 'This account is already accepted.', title: 'Already accepted', variant: 'default' });
                                        await refreshAccounts();
                                      } else if (!res.ok) {
                                        throw new Error('Failed to accept invite');
                                      } else {
                                        toast({ description: `You have joined ${account?.name}`, title: 'Invitation accepted' });
                                        await refreshAccounts();
                                      }
                                    } catch {
                                      toast({ description: 'Could not accept invitation', title: 'Error', variant: 'destructive' });
                                    } finally {
                                      setAcceptingInviteId(null);
                                    }
                                  }}
                                >
                                  {acceptingInviteId === userAccount.account_id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    'Accept'
                                  )}
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </Wrapper>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-transparent">
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <div className="mx-auto w-full max-w-md">
          <PageHeader
            title={hasAccounts ? "Create account" : "Create your account"}
            description={hasAccounts ? "Add a new account to your workspace." : "Set up your first account to get started."}
            className="mb-6"
            actions={
              hasAccounts ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full px-3"
                  onClick={() => setShowCreateAccountForm(false)}
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Back</span>
                </Button>
              ) : null
            }
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Account details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accountName">Account name</Label>
                <Input
                  id="accountName"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Enter account name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="accountSlug">Account slug</Label>
                <Input
                  id="accountSlug"
                  value={accountSlug}
                  onChange={(e) => setAccountSlug(e.target.value)}
                  placeholder="account-slug"
                />
                <p className="text-xs text-muted-foreground">
                  This will be used in your account URL.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Brief description of your account"
                />
              </div>
            </CardContent>
            <CardFooter className="flex-col">
              <Button
                onClick={createAccount}
                disabled={loading || !accountName.trim()}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account…
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create account
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AccountsPage() {
  return (
    <Suspense fallback={
      <FullPageLoader height="content" title="Loading…" />
    }>
      <AccountsPageContent />
    </Suspense>
  );
} 

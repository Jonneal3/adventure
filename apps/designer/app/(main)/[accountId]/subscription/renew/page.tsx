"use client";

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountSubscription } from '@/hooks/use-account-subscription';
import { useToast } from '@/hooks/use-toast';
import StripeTable from '@/components/stripe/StripeTable';
import { FullPageLoader } from '@/components/ui/full-page-loader';
import { CreditCard, AlertTriangle } from 'lucide-react';

export default function RenewPage() {
  const { session } = useAuth();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  
  const accountId = params?.accountId as string;

  const {
    status,
    loading: subscriptionLoading,
    error: subscriptionError,
    isOwner,
    route,
  } = useAccountSubscription(accountId ?? null, {
    enabled: !!session?.user && !!accountId,
    force: true,
  });

  useEffect(() => {
    if (!session?.user || !accountId) {
      router.push('/auth');
      return;
    }
  }, [session?.user, accountId, router]);

  useEffect(() => {
    if (!session?.user || !accountId) return;
    if (subscriptionLoading) return;

    if (subscriptionError) {
      toast({
        title: 'Error',
        description: 'Failed to load subscription details.',
        variant: 'destructive',
      });
      router.push('/accounts');
      return;
    }

    if (!isOwner) {
      toast({
        title: 'Access Denied',
        description: 'Only account owners can manage billing and subscriptions.',
        variant: 'destructive',
      });
      router.push('/accounts');
      return;
    }

    if (route === 'active') {
      router.push(`/${accountId}/designer-instances`);
    }
  }, [
    accountId,
    isOwner,
    route,
    router,
    session?.user,
    subscriptionError,
    subscriptionLoading,
    toast,
  ]);

  if (subscriptionLoading || !status?.account) {
    return <FullPageLoader title="Loading subscription…" />;
  }

  if (!session?.user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="container mx-auto px-4 py-10">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <AlertTriangle className="h-12 w-12 text-orange-500 mr-4" />
              <CreditCard className="h-12 w-12 text-primary" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-3">Renew your subscription</h1>
            <p className="text-sm sm:text-base text-muted-foreground mb-2">
              Your subscription for <strong>{status.account?.name}</strong> has expired
            </p>
            <p className="text-muted-foreground">
              Choose a plan to continue using Adventure with your team
            </p>
          </div>

          {/* Subscription Status */}
          {status.subscription && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 mb-8">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mr-2" />
                <div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                    Subscription Status: {status.subscription?.status}
                  </h3>
                  {status.subscription?.end_date && (
                    <p className="text-sm text-amber-700 dark:text-amber-300">
                      Expired on: {new Date(status.subscription.end_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Stripe Pricing Table */}
          <div className="rounded-2xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur">
            <StripeTable 
              user={session.user}
            />
          </div>

          {/* Info Section */}
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              Need help? Contact our support team at{' '}
              <a href="mailto:support@adventure.app" className="text-primary hover:underline">
                support@adventure.app
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
} 

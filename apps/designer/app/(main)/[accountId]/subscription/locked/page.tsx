'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountSubscription } from '@/hooks/use-account-subscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FullPageLoader } from '@/components/ui/full-page-loader';
import { Lock, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function BillingLockedPage() {
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  
  const { session } = useAuth();
  const router = useRouter();
  const params = useParams();
  const accountId = params?.accountId as string;
  const { toast } = useToast();

  useEffect(() => {
    if (!session?.user || !accountId) {
      router.push('/auth');
      return;
    }
  }, [session?.user, accountId, router]);

  const { status, loading: subscriptionLoading, error: subscriptionError } = useAccountSubscription(
    accountId ?? null,
    { enabled: !!session?.user && !!accountId },
  );

  useEffect(() => {
    if (!session?.user || !accountId) return;
    if (subscriptionLoading) return;

    if (subscriptionError) {
      toast({
        title: 'Error',
        description: 'Failed to load account details.',
        variant: 'destructive',
      });
      router.push('/accounts');
    }
  }, [accountId, router, session?.user, subscriptionError, subscriptionLoading, toast]);

  useEffect(() => {
    if (!session?.user || !accountId) return;
    if (!status?.ownerUserId) return;
    if (ownerEmail) return;

    let cancelled = false;
    (async () => {
      try {
        const userResponse = await fetch(`/api/users/${status.ownerUserId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        });
        if (!userResponse.ok) return;
        const { user } = await userResponse.json();
        if (!cancelled) {
          setOwnerEmail(user?.email ?? null);
        }
      } catch {}
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, ownerEmail, session?.access_token, session?.user, status?.ownerUserId]);

  if (subscriptionLoading || !status?.account) {
    return <FullPageLoader title="Loading account…" />;
  }

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
            <Lock className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle className="text-xl">Account Locked</CardTitle>
          <CardDescription>
            This account requires an active subscription to access
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              The account <strong>{status.account?.name}</strong> does not have an active subscription.
            </p>
            <p className="text-sm text-muted-foreground">
              If you recently started a Partner plan, access will be enabled once an internal team member approves it.
            </p>
            <p className="text-sm text-muted-foreground">
              Only the account owner can manage billing and subscriptions.
            </p>
          </div>

          {ownerEmail && (
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">
                <strong>Contact the account owner:</strong>
              </p>
              <p className="text-sm font-medium">{ownerEmail}</p>
            </div>
          )}

          <div className="flex flex-col space-y-2">
            <Button
              onClick={() => router.push('/accounts')}
              variant="outline"
              className="w-full"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to My Accounts
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 

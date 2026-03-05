'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountSubscription } from '@/hooks/use-account-subscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FullPageLoader } from '@/components/ui/full-page-loader';
import { Info, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PartnerPendingPage() {
  const { session } = useAuth();
  const router = useRouter();
  const params = useParams();
  const accountId = params?.accountId as string;
  const { toast } = useToast();

  const { status, loading: subscriptionLoading, error: subscriptionError } = useAccountSubscription(
    accountId ?? null,
    { enabled: !!session?.user && !!accountId },
  );

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
        description: 'Failed to load account details.',
        variant: 'destructive',
      });
      router.push('/accounts');
    }
  }, [accountId, router, session?.user, subscriptionError, subscriptionLoading, toast]);

  if (subscriptionLoading || !status?.account) {
    return <FullPageLoader title="Loading account…" />;
  }

  return (
    <div className="h-screen bg-transparent flex items-center justify-center p-4 overflow-hidden">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Info className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Partner Plan Review Pending</CardTitle>
          <CardDescription>
            Thanks for starting a Partner plan. An internal team member will review and enable access shortly.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Account: <strong>{status.account?.name}</strong>
            </p>
            <p className="text-sm text-muted-foreground">
              We’ll email the account owner once your Partner plan is approved.
            </p>
          </div>

          <div className="flex flex-col space-y-2">
            <Button onClick={() => router.push('/accounts')} variant="outline" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to My Accounts
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

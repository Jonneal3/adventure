"use client";

import { useEffect, useState } from 'react';
import { useCredits } from '@/contexts/CreditContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditLogsTable } from './CreditLogsTable';

interface Subscription {
  id: string;
  status: string;
  ai_credits_balance: number;
  stripe_customer_id?: string;
  additional_credit_price?: number;
}

interface CreditsTabProps {
  subscription: Subscription | null;
  loading: boolean;
  hasActiveSubscription: boolean;
  hasStripeCustomer: boolean;
  accountId: string;
  canPurchase?: boolean;
  autoPurchaseEnabled: boolean;
  autoPurchaseAmount: number;
  onPurchaseCredits: (amount: number) => Promise<void>;
  onManageBilling: () => Promise<void>;

  onAutoPurchaseToggle: (enabled: boolean) => Promise<void>;
  onAutoPurchaseAmountChange: (amount: number) => Promise<void>;
}

export function CreditsTab({
  subscription,
  loading,
  hasActiveSubscription,
  hasStripeCustomer,
  accountId,
  canPurchase = true,
  autoPurchaseEnabled,
  autoPurchaseAmount,
  onPurchaseCredits,
  onManageBilling,

  onAutoPurchaseToggle,
  onAutoPurchaseAmountChange
}: CreditsTabProps) {
  const { credits } = useCredits();
  const [creditAmount, setCreditAmount] = useState(20);
  const [view, setView] = useState<'credits' | 'logs'>('credits');

  // Keep the manual selector aligned with the current auto-purchase amount
  useEffect(() => {
    if (typeof autoPurchaseAmount === 'number' && !Number.isNaN(autoPurchaseAmount)) {
      setCreditAmount(autoPurchaseAmount);
    }
  }, [autoPurchaseAmount]);

  const calculateCreditsFromAmount = (amount: number) => {
    if (!subscription?.additional_credit_price) return 0;
    return Math.floor(amount / subscription.additional_credit_price);
  };

  const handlePurchaseCredits = async () => {
    await onPurchaseCredits(creditAmount);
  };

  const handleCreditAmountChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value) || 0;
    setCreditAmount(value);
    if (autoPurchaseEnabled && Number.isFinite(value) && value > 0) {
      onAutoPurchaseAmountChange(value);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-xl">Credits</CardTitle>
              <CardDescription>Buy credits and manage auto-reload settings</CardDescription>
            </div>
            <div className="inline-flex rounded-md border border-border overflow-hidden">
              <Button
                type="button"
                size="sm"
                variant={view === 'credits' ? 'default' : 'ghost'}
                onClick={() => setView('credits')}
                className="rounded-none"
              >
                Credits
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === 'logs' ? 'default' : 'ghost'}
                onClick={() => setView('logs')}
                className="rounded-none"
              >
                Logs
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          {view === 'logs' ? (
            <div className="mt-2">
              <CreditLogsTable accountId={accountId} />
            </div>
          ) : (
            <>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-lg border p-4 text-center">
              <div className="text-4xl font-bold text-primary">
                {typeof credits === 'number' ? credits : (subscription?.ai_credits_balance || 0)}
              </div>
              <p className="text-muted-foreground text-sm">Current balance</p>
            </div>

            {hasActiveSubscription && hasStripeCustomer && canPurchase && (
              <div className="rounded-lg border p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">Auto-reload when low</div>
                  <div className="text-sm text-muted-foreground">Automatically add credits</div>
                </div>
                <Switch
                  checked={autoPurchaseEnabled}
                  onCheckedChange={(v) => onAutoPurchaseToggle(Boolean(v))}
                  disabled={loading}
                />
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="credit-amount">Purchase amount</Label>
              <p className="text-xs text-muted-foreground">
                ${subscription?.additional_credit_price ? subscription.additional_credit_price.toFixed(2) : 'N/A'} per credit
              </p>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">$</span>
              <Input
                id="credit-amount"
                type="number"
                value={creditAmount}
                onChange={handleCreditAmountChange}
                min="20"
                step="5"
                placeholder="Amount"
                className="text-center pl-8 h-11"
              />
            </div>
            <div className="flex gap-2">
              {[20, 40, 100].map((amt) => (
                <Button
                  key={amt}
                  type="button"
                  size="sm"
                  variant={creditAmount === amt ? 'default' : 'outline'}
                  onClick={() => {
                    setCreditAmount(amt);
                    if (autoPurchaseEnabled) {
                      onAutoPurchaseAmountChange(amt);
                    }
                  }}
                >
                  ${amt}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {calculateCreditsFromAmount(creditAmount)} credits
            </p>
            <p className="text-xs text-muted-foreground">
              {autoPurchaseEnabled
                ? `Auto-reload amount is set to $${creditAmount} based on your selection here.`
                : 'Enable auto-reload above to use this selected amount automatically.'}
            </p>
            <Button
              onClick={handlePurchaseCredits}
              disabled={!canPurchase || loading || creditAmount < 20}
              className="w-full h-11"
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Processing payment...
                </div>
              ) : (
                `Buy $${creditAmount}`
              )}
            </Button>
            {hasStripeCustomer && (
              <p className="text-xs text-muted-foreground text-center">✓ Card on file</p>
            )}
          </div>

          {!hasStripeCustomer && canPurchase && (
            <div className="rounded-lg border p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">No payment method</p>
              <Button onClick={onManageBilling} variant="outline" size="sm">
                Add card
              </Button>
            </div>
          )}
          {!canPurchase && (
            <p className="text-xs text-muted-foreground text-center">Only account owners can manage billing and purchase credits.</p>
          )}
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
} 
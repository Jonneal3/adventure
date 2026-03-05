"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Settings, X, ArrowUp, AlertCircle, Check, Zap, Crown, Shield } from 'lucide-react';
import { SuccessErrorMessages } from './SuccessErrorMessages';

interface Plan {
  plan_id: string;
  name: string;
  monthly_price_cents: number;
  ai_credits_included: number;
  is_pricing_custom: boolean;
}

interface Subscription {
  id: string;
  status: string;
  stripe_customer_id?: string;
  end_date?: string;
  plan_id?: string;
}

interface BillingTabProps {
  subscription: Subscription | null;
  plans: Plan[];
  currentPlan: Plan | null;
  loading: boolean;
  showSuccessMessage: boolean;
  showErrorMessage: boolean;
  successMessage: string;
  errorMessage: string;
  hasActiveSubscription: boolean;
  hasStripeCustomer: boolean;
  isInTrial: boolean;
  daysLeftInTrial: number;
  trialEndDate: Date | null;
  upgradeModalOpen: boolean;
  selectedPlan: Plan | null;
  onUpgradeClick: (plan: Plan) => void;
  onNewSubscription: (plan: Plan) => Promise<void>;
  onCancelPlan: () => Promise<void>;
  onManageBilling: () => Promise<void>;

  onConfirmUpgrade: () => Promise<void>;
  setUpgradeModalOpen: (open: boolean) => void;
}

export function BillingTab({
  subscription,
  plans,
  currentPlan,
  loading,
  showSuccessMessage,
  showErrorMessage,
  successMessage,
  errorMessage,
  hasActiveSubscription,
  hasStripeCustomer,
  isInTrial,
  daysLeftInTrial,
  trialEndDate,
  upgradeModalOpen,
  selectedPlan,
  onUpgradeClick,
  onNewSubscription,
  onCancelPlan,
  onManageBilling,

  onConfirmUpgrade,
  setUpgradeModalOpen
}: BillingTabProps) {
  // Only show self-serve plans (exclude custom/partner plans)
  const visiblePlans = plans.filter((p) => !p.is_pricing_custom);

  return (
    <div className="space-y-8 max-w-6xl">
      <SuccessErrorMessages
        showSuccessMessage={showSuccessMessage}
        showErrorMessage={showErrorMessage}
        successMessage={successMessage}
        errorMessage={errorMessage}
      />

      <div className="grid gap-8">
        {/* Available Plans - full width */}
        <div>
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-xl">Change Your Plan</CardTitle>
                  <CardDescription>
                    {hasActiveSubscription 
                      ? "Upgrade for more features or downgrade to save money" 
                      : "Choose the plan that's right for you"}
                  </CardDescription>
                </div>
                {hasStripeCustomer && (
                  <div className="flex items-center gap-2">
                    <Button onClick={onManageBilling} disabled={loading} variant="outline" className="h-9">
                      Manage Billing
                    </Button>
                    {hasActiveSubscription && (
                      <Button onClick={onCancelPlan} disabled={loading} variant="destructive" className="h-9">
                        Cancel
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0 space-y-4">
              {visiblePlans.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground border rounded-md">
                  No self‑serve plans are available here. For partner or custom plans, please contact sales or your partner representative.
                </div>
              ) : (
                <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {visiblePlans.map((plan) => {
                    const isCurrentPlan = currentPlan?.plan_id === plan.plan_id;
                    const isUpgrade = currentPlan && plan.monthly_price_cents > (currentPlan.monthly_price_cents || 0);

                    return (
                      <div 
                        key={plan.plan_id} 
                        className={`relative p-6 border rounded-xl transition-all shadow-sm ${
                          isCurrentPlan 
                            ? 'border-primary/50 bg-primary/5 pt-10' 
                            : 'border-border hover:border-primary/30 hover:shadow-md'
                        }`}
                      >
                        {/* Popular Badge */}
                        {plan.name === 'Pro' && !isCurrentPlan && (
                          <div className="absolute top-3 right-3">
                            <Badge variant="secondary">Popular</Badge>
                          </div>
                        )}
                        {/* Status Badge */}
                        {isCurrentPlan && (
                          <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                            <Badge className="bg-primary text-primary-foreground">
                              {isInTrial ? 'Current Plan (Trial)' : 'Current Plan'}
                            </Badge>
                          </div>
                        )}
                        
                        <div className="space-y-5">
                          {/* Plan Name & Price */}
                          <div className="text-center">
                            <h3 className="text-lg font-semibold flex items-center justify-center gap-2">
                              {plan.name}
                              {plan.name === 'Pro' && <Zap className="h-4 w-4 text-primary" />}
                            </h3>
                            <div className="text-3xl font-bold mt-1">
                              {plan.monthly_price_cents === 0 
                                ? 'Free' 
                                : `$${(plan.monthly_price_cents / 100).toLocaleString()}`}
                            </div>
                            {plan.monthly_price_cents > 0 && (
                              <div className="text-sm text-muted-foreground">per month</div>
                            )}
                          </div>
                          
                          {/* Credits */}
                          <div className="text-center text-sm text-muted-foreground">
                            {plan.ai_credits_included === 999999 
                              ? 'Unlimited credits'
                              : `${plan.ai_credits_included.toLocaleString()} credits/month`}
                          </div>
                          {/* Feature list */}
                          <ul className="space-y-2 text-sm">
                            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Priority processing</li>
                            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Higher quality outputs</li>
                            <li className="flex items-center gap-2"><Check className="h-4 w-4 text-primary" /> Email support</li>
                          </ul>
                          
                          {/* Primary plan action */}
                          {isCurrentPlan ? (
                            <Button variant="outline" className="w-full h-9" disabled>
                              Current Plan
                            </Button>
                          ) : hasActiveSubscription ? (
                            <Button className="w-full h-9" onClick={() => onUpgradeClick(plan)} disabled={loading} variant={isUpgrade ? "default" : "outline"}>
                              {isUpgrade ? 'Upgrade' : 'Downgrade'}
                            </Button>
                          ) : (
                            <Button className="w-full h-9" onClick={() => onNewSubscription(plan)} disabled={loading}>
                              Get Started
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Upgrade Confirmation Modal */}
      <Dialog open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <ArrowUp className="h-6 w-6 text-primary" />
              Confirm Plan Change
            </DialogTitle>
            <DialogDescription>
              Review your plan change details below
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {selectedPlan && currentPlan && (
              <>
                {/* Plan Comparison */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-muted/30 rounded-lg border">
                    <div className="text-sm font-medium text-muted-foreground mb-1">Current Plan</div>
                    <div className="text-xl font-bold">{currentPlan.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      ${(currentPlan.monthly_price_cents / 100).toLocaleString()}/month
                    </div>
                  </div>
                  <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <div className="text-sm font-medium text-muted-foreground mb-1">New Plan</div>
                    <div className="text-xl font-bold text-primary">{selectedPlan.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      ${(selectedPlan.monthly_price_cents / 100).toLocaleString()}/month
                    </div>
                  </div>
                </div>
                
                {/* Plan Details */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-4 bg-background border rounded-lg">
                    <div>
                      <div className="font-semibold">Monthly Price</div>
                      <div className="text-sm text-muted-foreground">New billing amount</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        ${(selectedPlan.monthly_price_cents / 100).toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">per month</div>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-4 bg-background border rounded-lg">
                    <div>
                      <div className="font-semibold">Credits Included</div>
                      <div className="text-sm text-muted-foreground">Monthly credit allowance</div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">
                        {selectedPlan.ai_credits_included === 999999 
                          ? 'Unlimited' 
                          : selectedPlan.ai_credits_included.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">credits</div>
                    </div>
                  </div>
                </div>
                
                {/* Trial Notice */}
                {isInTrial && (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-blue-900 mb-1">Trial Continues</div>
                        <div className="text-sm text-blue-800 leading-relaxed">
                          Your trial will continue until <strong>{trialEndDate?.toLocaleDateString()}</strong>.
                          The new plan will take effect after your trial ends.
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => setUpgradeModalOpen(false)}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirmUpgrade}
              disabled={loading}
              className="flex-1 min-w-[140px]"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Upgrading...
                </>
              ) : (
                "Confirm Upgrade"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 
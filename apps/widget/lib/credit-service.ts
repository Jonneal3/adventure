import { createClient } from '@supabase/supabase-js';
import Stripe from 'stripe';
import { getStripeModeFromEnv, getStripeSecretKey } from '@/lib/stripe/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export class CreditService {
  /**
   * Ensure the account has enough credits, attempting an auto top-up if enabled.
   */
  async ensureCredits(accountId: string, requiredCredits: number): Promise<{
    hasEnough: boolean;
    currentBalance: number;
    shortfall: number;
    toppedUp: boolean;
    topUpAmount?: number;
  }> {
    try {
      // Fetch latest subscription with auto-purchase settings
      const { data: subscription, error } = await supabase
        .from('user_subscriptions')
        .select('subscription_id, ai_credits_balance, auto_purchase_enabled, auto_purchase_amount')
        .eq('account_id', accountId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Ensure credits failed (fetch error):', error);
        return {
          hasEnough: false,
          currentBalance: 0,
          shortfall: Math.max(1, requiredCredits || 1),
          toppedUp: false,
        };
      }

      if (!subscription) {
        console.warn('Ensure credits failed: No active or trialing subscription found for account', accountId);
        return {
          hasEnough: false,
          currentBalance: 0,
          shortfall: Math.max(1, requiredCredits || 1),
          toppedUp: false,
        };
      }

      const currentBalanceRaw = Number(subscription.ai_credits_balance ?? 0);
      const currentBalance = Number.isFinite(currentBalanceRaw) ? currentBalanceRaw : 0;
      const isDepleted = currentBalance <= 0;
      const currentlyEnough = !isDepleted && requiredCredits > 0 && currentBalance >= requiredCredits;

      if (currentlyEnough) {
        return {
          hasEnough: true,
          currentBalance,
          shortfall: 0,
          toppedUp: false,
        };
      }

      // Attempt auto top-up if enabled
      const autoEnabled = Boolean(subscription.auto_purchase_enabled);
      const topUpAmountRaw = Number(subscription.auto_purchase_amount ?? 0);
      // Treat auto_purchase_amount as dollars (e.g., 40 => $40.00)
      const topUpAmount = Number.isFinite(topUpAmountRaw) ? topUpAmountRaw : 0;

      if (autoEnabled && topUpAmount > 0) {
        // Create and confirm an off-session PaymentIntent for top-up amount
        // Note: We assume amount represents a currency amount, not credits.
        const mode = getStripeModeFromEnv();
        const secretKey = getStripeSecretKey(mode);
        // If Stripe key is not configured, skip auto top-up gracefully
        if (!secretKey) {
          return {
            hasEnough: false,
            currentBalance,
            shortfall: Math.max(1, requiredCredits - Math.max(0, currentBalance)),
            toppedUp: false,
          };
        }
        const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });

        // Fetch additional fields needed (customer, pricing) atomically
        const { data: fullSub, error: fullErr } = await supabase
          .from('user_subscriptions')
          .select('subscription_id, ai_credits_balance, stripe_customer_id, additional_credit_price')
          .eq('subscription_id', subscription.subscription_id)
          .maybeSingle();

        if (fullErr || !fullSub || !fullSub.stripe_customer_id) {
          return {
            hasEnough: false,
            currentBalance,
            shortfall: Math.max(1, requiredCredits - Math.max(0, currentBalance)),
            toppedUp: false,
          };
        }

        const additionalCreditPrice = Number(fullSub.additional_credit_price ?? 0.3);
        const creditsToAdd = Math.floor(topUpAmount / additionalCreditPrice);

        // Retrieve default payment method for the customer
        let defaultPaymentMethodId: string | undefined;
        try {
          const customer: any = await stripe.customers.retrieve(fullSub.stripe_customer_id as string);
          defaultPaymentMethodId = customer?.invoice_settings?.default_payment_method as string | undefined;
          if (!defaultPaymentMethodId) {
            // Fallback: first attached card PM
            const pmList = await stripe.paymentMethods.list({ customer: fullSub.stripe_customer_id as string, type: 'card', limit: 1 });
            defaultPaymentMethodId = pmList?.data?.[0]?.id;
          }
        } catch (e) {
          // If we cannot retrieve a PM, skip auto top-up gracefully
          defaultPaymentMethodId = undefined;
        }

        if (!defaultPaymentMethodId) {
          return {
            hasEnough: false,
            currentBalance,
            shortfall: Math.max(1, requiredCredits - Math.max(0, currentBalance)),
            toppedUp: false,
          };
        }

        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(topUpAmount * 100),
          currency: 'usd',
          customer: fullSub.stripe_customer_id,
          payment_method: defaultPaymentMethodId,
          confirm: true,
          off_session: true,
          metadata: {
            type: 'auto_credit_purchase',
            subscriptionId: fullSub.subscription_id,
            amount: String(topUpAmount),
            creditsToAdd: String(creditsToAdd),
            currentCredits: String(currentBalance),
            newTotalCredits: String(currentBalance + creditsToAdd),
            additionalCreditPrice: String(additionalCreditPrice),
            autoPurchase: 'true',
          },
        });

        if (paymentIntent.status !== 'succeeded') {
          return {
            hasEnough: false,
            currentBalance,
            shortfall: Math.max(1, requiredCredits - Math.max(0, currentBalance)),
            toppedUp: false,
          };
        }

        // On success, immediately update balance
        const newBalance = currentBalance + creditsToAdd;
        const { error: updateError } = await supabase
          .from('user_subscriptions')
          .update({
            ai_credits_balance: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq('subscription_id', subscription.subscription_id);

        if (updateError) {
          return {
            hasEnough: false,
            currentBalance,
            shortfall: Math.max(1, requiredCredits - Math.max(0, currentBalance)),
            toppedUp: false,
          };
        }

        // Log credit top-up transaction
        await supabase
          .from('account_credit_transactions')
          .insert({
            account_id: accountId,
            instance_id: null,
            type: 'credit_reload',
            credit_amount: creditsToAdd, // positive for reloads
            reload_type: 'auto',
            reload_attempt_status: 'succeeded',
            reload_attempt_description: null,
            description: 'Auto top-up via Stripe',
            metadata: {
              payment_intent_id: paymentIntent.id,
              amount: topUpAmount,
              additional_credit_price: additionalCreditPrice,
            },
          });

        const hasEnoughAfterTopUp = newBalance > 0 && requiredCredits > 0 && newBalance >= requiredCredits;
        return {
          hasEnough: hasEnoughAfterTopUp,
          currentBalance: newBalance,
          shortfall: hasEnoughAfterTopUp ? 0 : Math.max(1, requiredCredits - newBalance),
          toppedUp: true,
          topUpAmount,
        };
      }

      // Auto top-up not enabled or invalid amount
      return {
        hasEnough: false,
        currentBalance,
        shortfall: Math.max(1, requiredCredits - Math.max(0, currentBalance)),
        toppedUp: false,
      };
    } catch (err) {
      console.error('Error ensuring credits:', err);
      return {
        hasEnough: false,
        currentBalance: 0,
        shortfall: Math.max(1, requiredCredits || 1),
        toppedUp: false,
      };
    }
  }
  /**
   * Check if account has enough credits
   */
  async checkCredits(accountId: string, requiredCredits: number): Promise<{
    hasEnough: boolean;
    currentBalance: number;
    shortfall: number;
  }> {
    try {
      // Get the account's active subscription
      const { data: subscription, error } = await supabase
        .from('user_subscriptions')
        .select('ai_credits_balance')
        .eq('account_id', accountId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Credit check failed (fetch error):', error);
        return {
          hasEnough: false,
          currentBalance: 0,
          shortfall: requiredCredits,
        };
      }

      if (!subscription) {
        // No active subscription means no credits available
        return {
          hasEnough: false,
          currentBalance: 0,
          shortfall: Math.max(1, requiredCredits),
        };
      }

      // Normalize and strictly guard against depleted or negative balances
      const rawBalance = Number(subscription.ai_credits_balance ?? 0);
      const currentBalance = Number.isFinite(rawBalance) ? rawBalance : 0;

      // Never allow operations to proceed when balance is depleted (≤ 0)
      const isDepleted = currentBalance <= 0;

      // If depleted, hasEnough must be false regardless of requiredCredits (even if 0)
      // Otherwise, require currentBalance to cover requiredCredits (> 0)
      const hasEnough = !isDepleted && requiredCredits > 0 && currentBalance >= requiredCredits;

      // Compute a meaningful shortfall
      // - If depleted, require at least 1 credit to proceed
      // - Else, standard difference
      const computedShortfall = isDepleted
        ? Math.max(1, requiredCredits > 0 ? requiredCredits - Math.max(0, currentBalance) : 1)
        : Math.max(0, requiredCredits - currentBalance);
      const shortfall = hasEnough ? 0 : computedShortfall;

      return {
        hasEnough,
        currentBalance,
        shortfall,
      };
    } catch (error) {
      console.error('Error checking credits:', error);
      return {
        hasEnough: false,
        currentBalance: 0,
        shortfall: requiredCredits,
      };
    }
  }

  /**
   * Deduct credits from account's balance
   */
  async deductCredits(
    accountId: string,
    creditsToDeduct: number,
    operation: string,
    instanceId?: string,
    transactionType: 'image_gen' | 'email_lead' | 'phone_lead' | 'credit_reload' = 'image_gen',
    metadata?: Record<string, unknown>
  ): Promise<{
    success: boolean;
    newBalance: number;
  }> {
    try {
      // Check current balance first
      const creditCheck = await this.checkCredits(accountId, creditsToDeduct);
      
      if (!creditCheck.hasEnough) {
        console.log('Insufficient credits:', {
          accountId,
          required: creditsToDeduct,
          current: creditCheck.currentBalance,
          shortfall: creditCheck.shortfall,
        });
        return {
          success: false,
          newBalance: creditCheck.currentBalance,
        };
      }

      // Get the subscription to update
      // For leads we allow negative balances even if subscription is not active/trialing.
      // Fetch the most recent subscription for the account regardless of status.
      const { data: subscription, error: fetchError } = await supabase
        .from('user_subscriptions')
        .select('subscription_id, ai_credits_balance')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Failed to fetch subscription for credit deduction (fetch error):', fetchError);
        return {
          success: false,
          newBalance: creditCheck.currentBalance,
        };
      }

      if (!subscription) {
        console.error('Failed to fetch subscription for credit deduction: No subscription found for account', accountId);
        return {
          success: false,
          newBalance: 0,
        };
      }

      // Calculate new balance (never go below 0)
      const currentBalance = subscription.ai_credits_balance || 0;
      const newBalance = Math.max(0, currentBalance - creditsToDeduct);

      // Update the subscription
      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          ai_credits_balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq('subscription_id', subscription.subscription_id);

      if (updateError) {
        console.error('Failed to update credits:', updateError);
        return {
          success: false,
          newBalance: currentBalance,
        };
      }

      // Log credit usage transaction
      await supabase
        .from('account_credit_transactions')
        .insert({
          account_id: accountId,
          instance_id: instanceId ?? null,
          type: transactionType,
          credit_amount: -Math.abs(creditsToDeduct), // negative for usage
          reload_type: null,
          reload_attempt_status: null,
          reload_attempt_description: null,
          description: operation,
          metadata: metadata ?? null,
        });

      console.log('Credits deducted successfully:', {
        accountId,
        operation,
        creditsDeducted: creditsToDeduct,
        oldBalance: currentBalance,
        newBalance,
      });

      return {
        success: true,
        newBalance,
      };
    } catch (error) {
      console.error('Error deducting credits:', error);
      return {
        success: false,
        newBalance: 0,
      };
    }
  }

  /**
   * Deduct credits allowing the balance to go below zero. Intended for lead billing.
   */
  async deductCreditsAllowNegative(
    accountId: string,
    creditsToDeduct: number,
    operation: string,
    instanceId: string | null,
    transactionType: 'email_lead' | 'phone_lead',
    metadata?: Record<string, unknown>
  ): Promise<{ success: boolean; newBalance: number; }>{
    try {
      const { data: subscription, error: fetchError } = await supabase
        .from('user_subscriptions')
        .select('subscription_id, ai_credits_balance')
        .eq('account_id', accountId)
        .in('status', ['active', 'trialing'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Failed to fetch subscription for lead deduction (fetch error):', fetchError);
        return { success: false, newBalance: 0 };
      }

      if (!subscription) {
        console.error('Failed to fetch subscription for lead deduction: No active/trialing subscription found for account', accountId);
        return { success: false, newBalance: 0 };
      }

      const currentBalance = subscription.ai_credits_balance || 0;
      const newBalance = currentBalance - Math.abs(creditsToDeduct);

      const { error: updateError } = await supabase
        .from('user_subscriptions')
        .update({
          ai_credits_balance: newBalance,
          updated_at: new Date().toISOString(),
        })
        .eq('subscription_id', subscription.subscription_id);

      if (updateError) {
        console.error('Failed to update credits for lead deduction:', updateError);
        return { success: false, newBalance: currentBalance };
      }

      await supabase
        .from('account_credit_transactions')
        .insert({
          account_id: accountId,
          instance_id: instanceId,
          type: transactionType,
          credit_amount: -Math.abs(creditsToDeduct),
          reload_type: null,
          reload_attempt_status: null,
          reload_attempt_description: null,
          description: operation,
          metadata: metadata ?? null,
        });

      return { success: true, newBalance };
    } catch (error) {
      console.error('Error in deductCreditsAllowNegative:', error);
      return { success: false, newBalance: 0 };
    }
  }
} 
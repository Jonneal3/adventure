import { createClient } from "@supabase/supabase-js";
import { getStripeSecretKey, getStripeWebhookSecret, StripeMode } from "./config";
import { Database } from "@/supabase/types";
import Stripe from "stripe";

export class WebhookHandlers {
  public supabase: any;

  constructor() {
    // Use service role client for webhook processing
    this.supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Handle successful subscription from Stripe webhook
   */
  async handleSuccessfulSubscription(
    stripeSubscriptionId: string,
    accountId: string,
    planId: string,
    mode: StripeMode,
    userId: string | null
  ): Promise<void> {
    try {
      // Get Stripe subscription details
      const stripe = new Stripe(getStripeSecretKey(mode), {
        apiVersion: "2023-10-16",
      });
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);

      // Get plan details
      const { data: plan, error: planError } = await this.supabase
        .from("plans")
        .select("*")
        .eq("plan_id", planId)
        .single();
      if (!plan) {
        throw new Error(`Plan ${planId} not found`);
      }

      // Calculate dates
      const startDate = new Date(subscription.current_period_start * 1000).toISOString();
      const endDate = new Date(subscription.current_period_end * 1000).toISOString();
      const trialEnd = subscription.trial_end 
        ? new Date(subscription.trial_end * 1000).toISOString()
        : null;

      // Check if there's already an active/trialing subscription for this account
      const { data: existingSubscription, error: checkError } = await this.supabase
        .from("user_subscriptions")
        .select("subscription_id, status")
        .eq("account_id", accountId)
        .in("status", ["active", "trialing"])
        .maybeSingle();

      if (checkError) {
        throw checkError;
      }

      const subscriptionData = {
        account_id: accountId,
        plan_id: planId,
        stripe_subscription_id: stripeSubscriptionId,
        stripe_customer_id: subscription.customer as string,
        status: subscription.trial_end ? "trialing" : "active",
        start_date: startDate,
        end_date: endDate,
        trial_end: trialEnd,
        monthly_price_cents: plan.monthly_price_cents,
        auto_purchase_enabled: true, // Default to enabled
        auto_purchase_amount: 40, // Default to $40 (stored in dollars)
        additional_credit_price: plan.additional_credit_price, // Copy from plan
        updated_at: new Date().toISOString(),
        user_id: userId || null, // Store userId if available
        partner_approval: (plan.onboarding_type === 'partner' || (plan.name && plan.name.toLowerCase() === 'partner')) ? 'pending' : 'approved',
      };

      let result;

      if (existingSubscription) {
        const { data: updateResult, error: updateError } = await this.supabase
          .from("user_subscriptions")
          .update(subscriptionData)
          .eq("subscription_id", existingSubscription.subscription_id)
          .select()
          .single();

        if (updateError) {
          throw updateError;
        }

        result = updateResult;
      } else {
        // Don't add credits during subscription creation
        // Credits will be added when invoice.payment_succeeded webhook is received
        const insertData = {
          ...subscriptionData,
          ai_credits_balance: 0,
        };

        const { data: insertResult, error: insertError } = await this.supabase
          .from("user_subscriptions")
          .insert(insertData)
          .select()
          .single();

        if (insertError) {
          throw insertError;
        }

        result = insertResult;
      }
    } catch (error) {
      throw error; // Re-throw to ensure webhook knows about failure
    }
  }

  /**
   * Handle successful credit purchase from Stripe webhook
   */
  async handleSuccessfulCreditPurchase(
    accountId: string,
    packId: string,
    creditsAmount: number
  ): Promise<void> {
    try {
      // Add credits to account's most recent active/trialing subscription
      const { data: subscriptions } = await this.supabase
        .from("user_subscriptions")
        .select("subscription_id, ai_credits_balance")
        .eq("account_id", accountId)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1);

      const currentSubscription = subscriptions?.[0];
      const newBalance = (currentSubscription?.ai_credits_balance || 0) + creditsAmount;

      if (currentSubscription) {
        await this.supabase
          .from("user_subscriptions")
          .update({
            ai_credits_balance: newBalance,
          })
          .eq("subscription_id", currentSubscription.subscription_id);
      }
    } catch (error) {}
  }

  /**
   * Handle subscription cancellation
   */
  async handleSubscriptionCancellation(accountId: string): Promise<void> {
    try {
      await this.supabase
        .from("user_subscriptions")
        .update({
          status: "canceled",
          end_date: new Date().toISOString(),
        })
        .eq("account_id", accountId)
        .in('status', ['active', 'trialing']);
    } catch (error) {}
  }

  /**
   * Handle trial end
   */
  async handleTrialEnd(accountId: string): Promise<void> {
    try {
      await this.supabase
        .from("user_subscriptions")
        .update({
          status: "past_due", // or "canceled" depending on your business logic
          end_date: new Date().toISOString(),
        })
        .eq("account_id", accountId)
        .in('status', ['active', 'trialing']);
    } catch (error) {}
  }

  /**
   * Handle subscription renewal (add credits)
   */
  async handleSubscriptionRenewal(accountId: string): Promise<void> {
    try {
      // Get account's most recent active/trialing subscription
      const { data: subscriptions } = await this.supabase
        .from("user_subscriptions")
        .select("subscription_id, plan_id, ai_credits_balance")
        .eq("account_id", accountId)
        .in("status", ["active", "trialing"])
        .order("created_at", { ascending: false })
        .limit(1);

      const subscription = subscriptions?.[0];

      if (!subscription) {
        return;
      }

      // Get plan details to add credits
      const { data: plan } = await this.supabase
        .from("plans")
        .select("ai_credits_included")
        .eq("plan_id", subscription.plan_id)
        .single();

      if (!plan) {
        return;
      }

      // Add monthly credits
      const newBalance = subscription.ai_credits_balance + plan.ai_credits_included;

      await this.supabase
        .from("user_subscriptions")
        .update({
          ai_credits_balance: newBalance,
        })
        .eq("subscription_id", subscription.subscription_id);
    } catch (error) {}
  }

  /**
   * Extract user ID from Stripe customer or subscription
   */
  // Change return type to return both accountId and userId
  async extractAccountAndUserIdFromStripeEvent(event: Stripe.Event): Promise<{ accountId: string | null, userId: string | null }> {
    try {
      let customerId: string | null = null;
      let accountId: string | null = null;
      let userId: string | null = null;

      if (event.type === 'customer.subscription.created' || 
          event.type === 'customer.subscription.updated' ||
          event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object as Stripe.Subscription;
        customerId = subscription.customer as string;
        accountId = subscription.metadata?.accountId || null;
        userId = subscription.metadata?.userId || null;
        if (!accountId || !userId) {
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2023-10-16' });
          const sessions = await stripe.checkout.sessions.list({
            customer: customerId,
            limit: 1,
          });
          if (sessions.data.length > 0) {
            accountId = accountId || sessions.data[0].metadata?.accountId || null;
            userId = userId || sessions.data[0].metadata?.userId || null;
          }
        }
      } else if (event.type === 'customer.created' || 
                 event.type === 'customer.updated') {
        const customer = event.data.object as Stripe.Customer;
        customerId = customer.id;
        accountId = customer.metadata?.accountId || null;
        userId = customer.metadata?.userId || null;
      } else if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        accountId = session.metadata?.accountId || null;
        userId = session.metadata?.userId || null;
        customerId = session.customer as string;
      }

      if (accountId && userId) {
        return { accountId, userId };
      }

      if (customerId) {
        const { data: existingSubscription } = await this.supabase
          .from("user_subscriptions")
          .select("account_id, user_id")
          .eq("stripe_customer_id", customerId)
          .single();
        if (existingSubscription) {
          return { accountId: existingSubscription.account_id, userId: existingSubscription.user_id };
        }
      }

      return { accountId: null, userId: null };
    } catch (error) {
      return { accountId: null, userId: null };
    }
  }
} 
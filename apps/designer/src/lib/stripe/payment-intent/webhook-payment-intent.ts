import Stripe from "stripe";
import { ManualCreditPurchaseService } from "../credit-reloads/manual-credit-purchase";
import { createServerClient } from "@supabase/ssr";

export async function handlePaymentIntentSucceeded(
  event: Stripe.Event,
  stripe: Stripe
): Promise<void> {
  const paymentIntent = event.data.object as Stripe.PaymentIntent;
  const type = paymentIntent.metadata?.type;

  // Handle manual credit purchases
  if (type === 'manual_credit_purchase') {
    const service = new ManualCreditPurchaseService();
    await service.processSuccessfulPayment(paymentIntent);
  }
  
  // Handle auto credit purchases
  if (type === 'auto_credit_purchase') {
    await processAutoCreditPurchase(paymentIntent);
  }
}

/**
 * Process successful auto credit purchase from webhook
 */
async function processAutoCreditPurchase(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  try {
    const metadata = paymentIntent.metadata;

    // Validate required metadata
    if (metadata.type !== 'auto_credit_purchase') {
      return;
    }

    const subscriptionId = metadata.subscriptionId;
    const newTotalCredits = parseInt(metadata.newTotalCredits || "0");
    const creditsToAdd = parseInt(metadata.creditsToAdd || "0");
    const currentCredits = parseInt(metadata.currentCredits || "0");

    if (!subscriptionId || newTotalCredits <= 0) {
      return;
    }

    // Use service role client for webhook operations to bypass RLS
    const serviceClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return undefined; // No cookies needed for service role
          },
        },
      }
    );

    // Update the subscription with new credit balance
    const { data: updateResult, error: updateError } = await serviceClient
      .from("user_subscriptions")
      .update({
        ai_credits_balance: newTotalCredits,
        updated_at: new Date().toISOString()
      })
      .eq("subscription_id", subscriptionId)
      .select("subscription_id, ai_credits_balance, updated_at");

    if (updateError) {
      return;
    }

    // Dedup: if we've already inserted a transaction for this PaymentIntent, skip
    const accountId = metadata.accountId;
    try {
      if (accountId && creditsToAdd > 0) {
        const { data: existing } = await serviceClient
          .from('account_credit_transactions')
          .select('id')
          .eq('account_id', accountId)
          .eq('type', 'credit_reload')
          .contains('metadata', { payment_intent_id: paymentIntent.id } as any)
          .limit(1);

        if (!existing || existing.length === 0) {
          await serviceClient
            .from("account_credit_transactions")
            .insert({
              account_id: accountId,
              type: "credit_reload",
              credit_amount: creditsToAdd,
              description: "Auto credit reload",
              reload_type: "auto",
              reload_attempt_status: "succeeded",
              reload_attempt_description: null,
              instance_id: null,
              metadata: {
                payment_intent_id: paymentIntent.id,
                amount_usd: Number(metadata.amount || 0),
                credits_added: creditsToAdd,
                current_credits_before: currentCredits,
                new_total_credits: newTotalCredits
              } as any
            });
        }
      }
    } catch (_) {}
  } catch (error) {}
} 
import Stripe from "stripe";
import { WebhookHandlers } from "../webhook-handlers";

export async function handleInvoicePaymentFailed(
  event: Stripe.Event,
  stripe: Stripe
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  const subscription = invoice.subscription as string;

  const webhookHandlers = new WebhookHandlers();

  if (subscription) {
    try {
      // Get user subscription details
      const { data: userSubscription, error: subError } = await webhookHandlers.supabase
        .from('user_subscriptions')
        .select('user_id, account_id, status, stripe_customer_id, stripe_subscription_id')
        .eq('stripe_subscription_id', subscription)
        .single();

      if (subError) {
        return;
      }

      if (!userSubscription?.user_id) {
        return;
      }

      // Update subscription status to past_due
      const { error: updateError } = await webhookHandlers.supabase
        .from('user_subscriptions')
        .update({
          status: 'past_due',
          updated_at: new Date().toISOString()
        })
        .eq('stripe_subscription_id', subscription);

      if (updateError) {
        return;
      }

      // Log the payment failure for tracking
      await webhookHandlers.supabase
        .from('payment_failures')
        .insert({
          user_id: userSubscription.user_id,
          stripe_invoice_id: invoice.id,
          stripe_subscription_id: subscription,
          amount_due: invoice.amount_due,
          attempt_count: invoice.attempt_count,
          next_payment_attempt: invoice.next_payment_attempt ? new Date(invoice.next_payment_attempt * 1000).toISOString() : null,
          failure_reason: 'Payment failed',
          created_at: new Date().toISOString()
        })
        .then(() => {})
        .catch((error: any) => {});
    } catch (error) {}
  }
} 
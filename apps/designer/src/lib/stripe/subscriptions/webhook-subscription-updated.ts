import Stripe from "stripe";
import { WebhookHandlers } from "../webhook-handlers";

export async function handleSubscriptionUpdated(
  event: Stripe.Event,
  stripe: Stripe
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  const webhookHandlers = new WebhookHandlers();

  const { accountId, userId } = await webhookHandlers.extractAccountAndUserIdFromStripeEvent(event);

  if (!accountId) {
    console.error('[customer.subscription.updated] No accountId found, cannot process subscription update');
    return;
  }

  try {
    // Handle different subscription status changes
    switch (subscription.status) {
      case 'active':
      case 'trialing':
        // First, update the status directly using stripe_subscription_id
        const { error: statusUpdateError } = await webhookHandlers.supabase
          .from("user_subscriptions")
          .update({
            status: subscription.status,
            updated_at: new Date().toISOString()
          })
          .eq("stripe_subscription_id", subscription.id);

        if (statusUpdateError) {
          console.error('[customer.subscription.updated] Error updating subscription status:', statusUpdateError);
        }

        // Get plan ID from existing subscription
        const { data: existingSubscription, error: subError } = await webhookHandlers.supabase
          .from("user_subscriptions")
          .select("plan_id")
          .eq("user_id", userId)
          .single();

        if (subError) {
          console.error('[customer.subscription.updated] Error fetching existing subscription:', subError);
        } else if (existingSubscription) {
          await webhookHandlers.handleSuccessfulSubscription(
            subscription.id,
            accountId,
            existingSubscription.plan_id,
            subscription.livemode ? "live" : "test",
            userId
          );
        }
        break;
        
      case 'past_due':
        const { error: pastDueError } = await webhookHandlers.supabase
          .from("user_subscriptions")
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString()
          })
          .eq("stripe_subscription_id", subscription.id);

        if (pastDueError) {
          console.error('[customer.subscription.updated] Error updating to past_due:', pastDueError);
        }
        break;
        
      case 'canceled':
        const { error: canceledError } = await webhookHandlers.supabase
          .from("user_subscriptions")
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString()
          })
          .eq("stripe_subscription_id", subscription.id);

        if (canceledError) {
          console.error('[customer.subscription.updated] Error updating to canceled:', canceledError);
        }
        break;
        
      case 'unpaid':
        const { error: unpaidError } = await webhookHandlers.supabase
          .from("user_subscriptions")
          .update({
            status: 'unpaid',
            updated_at: new Date().toISOString()
          })
          .eq("stripe_subscription_id", subscription.id);

        if (unpaidError) {
          console.error('[customer.subscription.updated] Error updating to unpaid:', unpaidError);
        }
        break;
        
      default:
        break;
    }
  } catch (error) {
    console.error('[customer.subscription.updated] Unexpected error:', error);
    console.error('[customer.subscription.updated] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
  }
} 
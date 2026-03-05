import Stripe from "stripe";
import { WebhookHandlers } from "../webhook-handlers";

export async function handleSubscriptionDeleted(
  event: Stripe.Event,
  stripe: Stripe
): Promise<void> {
  const subscription = event.data.object as Stripe.Subscription;

  const webhookHandlers = new WebhookHandlers();

  const { accountId } = await webhookHandlers.extractAccountAndUserIdFromStripeEvent(event);

  if (accountId) {
    await webhookHandlers.handleSubscriptionCancellation(accountId);
  }
} 
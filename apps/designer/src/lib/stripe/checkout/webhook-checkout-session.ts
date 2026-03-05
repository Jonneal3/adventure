import Stripe from "stripe";
import { type StripeMode } from "../config";
import { WebhookHandlers } from "../webhook-handlers";

export async function handleCheckoutSessionCompleted(
  event: Stripe.Event,
  stripe: Stripe
): Promise<void> {
  const session = event.data.object as Stripe.Checkout.Session;
  const accountId = session.metadata?.accountId;
  const userId = session.metadata?.userId;
  const sessionMode = session.metadata?.mode as StripeMode;

  const webhookHandlers = new WebhookHandlers();

  if (session.mode === "subscription") {
    // Handle subscription checkout
    const planId = session.metadata?.planId;
    const planName = session.metadata?.planName;

    if (accountId && userId && planId && planName && sessionMode && session.subscription) {
      // For subscription checkouts, we don't add credits immediately
      // Credits will be added when the first invoice.payment_succeeded event comes
      await webhookHandlers.handleSuccessfulSubscription(
        session.subscription as string,
        accountId,
        planId,
        sessionMode,
        userId
      );
    }
  } else if (session.mode === "payment") {
    // Handle credit purchase checkout
    const packId = session.metadata?.packId;
    const creditsAmount = parseInt(session.metadata?.creditsAmount || "0");

    if (accountId && packId && creditsAmount) {
      await webhookHandlers.handleSuccessfulCreditPurchase(
        accountId,
        packId,
        creditsAmount
      );
    }
  }
} 
import Stripe from "stripe";
import { ManualCreditPurchaseService } from "../credit-reloads/manual-credit-purchase";

/**
 * Handle charge.succeeded by resolving the PaymentIntent and delegating
 * to existing handlers for manual/auto credit purchases. This is a safety net
 * in case Stripe delivers charge.succeeded before payment_intent.succeeded
 * or if only charge events are enabled on the endpoint.
 */
export async function handleChargeSucceeded(
  event: Stripe.Event,
  stripe: Stripe
): Promise<void> {
  const charge = event.data.object as Stripe.Charge;

  try {
    const paymentIntentId = typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;

    if (!paymentIntentId) {
      return;
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    const metadata = paymentIntent.metadata || {} as Record<string, string>;

    const type = metadata.type;
    if (type === 'manual_credit_purchase') {
      const service = new ManualCreditPurchaseService();
      await service.processSuccessfulPayment(paymentIntent);
      return;
    }

    if (type === 'auto_credit_purchase') {
      // Reuse the same service path as payment_intent.succeeded would
      const service = new ManualCreditPurchaseService();
      await service.processSuccessfulPayment(paymentIntent);
      return;
    }
  } catch (_) {
    // swallow errors to avoid webhook failure; payment_intent.succeeded
    // handler will likely run as well and perform the update.
  }
}




import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripeSecretKey, getStripeWebhookSecret } from "@/lib/stripe/config";
import { handleCheckoutSessionCompleted } from "@/lib/stripe";
import { handleSubscriptionCreated } from "@/lib/stripe/subscriptions/webhook-subscription-created";
import { handleSubscriptionUpdated } from "@/lib/stripe/subscriptions/webhook-subscription-updated";
import { handleSubscriptionDeleted } from "@/lib/stripe/subscriptions/webhook-subscription-deleted";
import { handleInvoicePaymentSucceeded } from "@/lib/stripe/invoices/webhook-invoice-payment";
import { handleInvoicePaymentFailed } from "@/lib/stripe/invoices/webhook-invoice-payment-failed";
import { handleInvoicePaymentActionRequired } from "@/lib/stripe/invoices/webhook-invoice-payment-action-required";
import { handlePaymentIntentSucceeded } from "@/lib/stripe/payment-intent/webhook-payment-intent";
import { handleChargeSucceeded } from "@/lib/stripe";

// Force dynamic rendering for webhook routes
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const preferredRegion = 'home';

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      console.error('[STRIPE WEBHOOK] Missing stripe-signature header');
      return NextResponse.json(
        { error: "Missing stripe-signature header" },
        { status: 400 }
      );
    }

    let event: Stripe.Event | undefined;
    // Try test secret first, then live secret. This avoids 400s if STRIPE_MODE
    // differs from the actual source event mode.
    try {
      const testSecret = process.env.STRIPE_TEST_WEBHOOK_SECRET;
      const liveSecret = process.env.STRIPE_WEBHOOK_SECRET;

      const testStripe = testSecret ? new Stripe(getStripeSecretKey("test"), { apiVersion: "2023-10-16" }) : null;
      const liveStripe = liveSecret ? new Stripe(getStripeSecretKey("live"), { apiVersion: "2023-10-16" }) : null;

      if (testStripe && testSecret) {
        try {
          event = testStripe.webhooks.constructEvent(body, signature!, testSecret);
        } catch {
          // fall through to live
        }
      }

      if (!event && liveStripe && liveSecret) {
        event = liveStripe.webhooks.constructEvent(body, signature!, liveSecret);
      }

      if (!event) {
        console.error('[STRIPE WEBHOOK] Signature verification failed for both test and live');
        return NextResponse.json(
          { error: "Webhook signature verification failed" },
          { status: 400 }
        );
      }
    } catch (err) {
      console.error('[STRIPE WEBHOOK] Error during signature verification:', err);
      return NextResponse.json(
        { error: "Webhook signature verification failed" },
        { status: 400 }
      );
    }

    // Initialize a Stripe client aligned to the event mode
    const isLive = !!(event!.livemode);
    const runtimeStripe = new Stripe(getStripeSecretKey(isLive ? "live" : "test"), {
      apiVersion: "2023-10-16",
    });

    // Handle the event using library functions
    switch (event!.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event, runtimeStripe);
        break;
        
      case "customer.subscription.created":
        await handleSubscriptionCreated(event, runtimeStripe);
        break;
        
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event, runtimeStripe);
        break;
        
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event, runtimeStripe);
        break;
        
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event, runtimeStripe);
        break;
        
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event, runtimeStripe);
        break;
        
      case "invoice.payment_action_required":
        await handleInvoicePaymentActionRequired(event, runtimeStripe);
        break;
        
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event, runtimeStripe);
        break;
      case "charge.succeeded":
        await handleChargeSucceeded(event, runtimeStripe);
        break;
        
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    const errorObj = error as Error;
    console.error('[STRIPE WEBHOOK] Error processing webhook:', errorObj);
    console.error('[STRIPE WEBHOOK] Error stack:', errorObj.stack);
    return NextResponse.json(
      { error: "Error processing webhook" },
      { status: 500 }
    );
  }
} 
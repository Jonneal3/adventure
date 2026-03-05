import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeModeFromEnv, getStripeSecretKey, getStripeWebhookSecret } from '@/lib/stripe/config';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const mode = getStripeModeFromEnv();
    const stripe = new Stripe(getStripeSecretKey(mode), { apiVersion: '2023-10-16' });

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');
    const webhookSecret = getStripeWebhookSecret(mode);

    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
        // For now, credit updates happen inline on auto-purchase. If we later
        // move to webhook-driven balance updates, handle it here.
        break;
      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json({ error: 'Error processing webhook' }, { status: 500 });
  }
}



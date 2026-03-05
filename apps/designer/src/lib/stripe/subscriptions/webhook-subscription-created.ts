import Stripe from "stripe";
import { WebhookHandlers } from "../webhook-handlers";

export async function handleSubscriptionCreated(
  event: Stripe.Event,
  stripe: Stripe
): Promise<void> {
  // Note: Subscription creation is handled by checkout.session.completed webhook
  // This webhook is kept for logging purposes but doesn't create database records
  // to prevent duplicate processing
} 
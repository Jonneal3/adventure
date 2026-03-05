import Stripe from "stripe";
import { WebhookHandlers } from "../webhook-handlers";

export async function handleInvoicePaymentSucceeded(
  event: Stripe.Event,
  stripe: Stripe
): Promise<void> {
  const invoice = event.data.object as Stripe.Invoice;
  
  // Extract subscription ID - can be string, expanded Subscription object, or null
  // If null, this is a standalone invoice (not subscription-related) - skip it
  // Also check parent.subscription_details.subscription as fallback (not in Stripe types but exists in API)
  const invoiceAny = invoice as any;
  
  let subscriptionId: string | null = null;
  
  // Try direct subscription field first
  if (typeof invoice.subscription === 'string') {
    subscriptionId = invoice.subscription;
  } else if (invoice.subscription && typeof invoice.subscription === 'object') {
    subscriptionId = (invoice.subscription as Stripe.Subscription).id;
  }
  
  // Fallback 1: check parent.subscription_details.subscription
  if (!subscriptionId && invoiceAny.parent?.subscription_details?.subscription) {
    if (typeof invoiceAny.parent.subscription_details.subscription === 'string') {
      subscriptionId = invoiceAny.parent.subscription_details.subscription;
    }
  }
  
  // Fallback 2: check invoice lines for subscription_item_details
  if (!subscriptionId && invoice.lines?.data && invoice.lines.data.length > 0) {
    const firstLine = invoice.lines.data[0] as any;
    if (firstLine.parent?.subscription_item_details?.subscription) {
      if (typeof firstLine.parent.subscription_item_details.subscription === 'string') {
        subscriptionId = firstLine.parent.subscription_item_details.subscription;
      }
    }
  }
  
  // Fallback 3: retrieve invoice from Stripe API with expand parameters
  if (!subscriptionId) {
    try {
      const expandedInvoice = await stripe.invoices.retrieve(invoice.id, {
        expand: ['subscription', 'lines.data.subscription_item']
      });
      
      if (typeof expandedInvoice.subscription === 'string') {
        subscriptionId = expandedInvoice.subscription;
      } else if (expandedInvoice.subscription && typeof expandedInvoice.subscription === 'object') {
        subscriptionId = (expandedInvoice.subscription as Stripe.Subscription).id;
      }
    } catch (apiError) {
      console.error('[invoice.payment_succeeded] Error retrieving invoice from API:', apiError);
    }
  }

  // Check if this is a subscription invoice
  // If invoice.subscription is null, this is a standalone invoice (not subscription-related)
  if (!subscriptionId) {
    return;
  }

  const webhookHandlers = new WebhookHandlers();

  try {
    // Find the subscription directly using the subscription ID from the invoice
    const { data: userSubscription, error: subError } = await webhookHandlers.supabase
      .from('user_subscriptions')
      .select('user_id, account_id, status, trial_end, stripe_subscription_id')
      .eq('stripe_subscription_id', subscriptionId)
      .single();

    if (subError) {
      console.error('[invoice.payment_succeeded] Error fetching user subscription:', subError);
      return;
    }

    if (!userSubscription) {
      console.error('[invoice.payment_succeeded] No subscription found for stripe_subscription_id:', subscriptionId);
      return;
    }

    if (!userSubscription.account_id) {
      console.error('[invoice.payment_succeeded] User subscription found but missing account_id:', {
        subscription_id: subscriptionId,
        user_id: userSubscription.user_id
      });
      return;
    }
    
    // Update subscription status to active (payment succeeded)
    const { error: updateError } = await webhookHandlers.supabase
      .from('user_subscriptions')
      .update({
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('stripe_subscription_id', subscriptionId);

    if (updateError) {
      console.error('[invoice.payment_succeeded] Error updating subscription status:', updateError);
      return;
    }

    // Only add credits for actual paid invoices (not $0 trial invoices)
    if (invoice.amount_paid > 0) {
      await webhookHandlers.handleSubscriptionRenewal(userSubscription.account_id);
    }
  } catch (error) {
    console.error('[invoice.payment_succeeded] Unexpected error in handleInvoicePaymentSucceeded:', error);
    console.error('[invoice.payment_succeeded] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
  }
} 
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SubscriptionService } from '@/lib/stripe';
import { type StripeMode, getStripeSecretKey } from "@/lib/stripe/config";
import Stripe from "stripe";

export async function POST(request: Request) {
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookies().get(name)?.value;
          },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { mode = "test", accountId } = await request.json() as { 
      mode?: StripeMode;
      accountId?: string;
    };

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    // Verify the user is the owner for this account
    const { data: userAccount, error: userAccountError } = await supabase
      .from('user_accounts')
      .select('user_status')
      .eq('user_id', user.id)
      .eq('account_id', accountId)
      .single();

    if (userAccountError || !userAccount) {
      return NextResponse.json(
        { error: "Access denied to this account" },
        { status: 403 }
      );
    }
    if (userAccount.user_status !== 'owner') {
      return NextResponse.json(
        { error: "Only account owners can manage billing" },
        { status: 403 }
      );
    }

    // Get the account's subscription to find Stripe customer ID
    const { data: subscription, error: subscriptionError } = await supabase
      .from("user_subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("account_id", accountId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (subscriptionError) {
      return NextResponse.json(
        { error: "Error fetching subscription data" },
        { status: 500 }
      );
    }

    // Validate Stripe configuration
    const stripeKey = getStripeSecretKey(mode);
    if (!stripeKey) {
      return NextResponse.json(
        { error: "Stripe not configured" },
        { status: 500 }
      );
    }

    // Create Stripe instance
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    let customerId = subscription?.stripe_customer_id;

    // If we have a customer ID, verify it exists in Stripe
    if (customerId) {
      try {
        await stripe.customers.retrieve(customerId);
      } catch (error: any) {
        if (error.code === 'resource_missing') {
          // Clear the invalid customer ID from our database
          await supabase
            .from("user_subscriptions")
            .update({ stripe_customer_id: null })
            .eq("account_id", accountId)
            .in('status', ['active', 'trialing']);
          customerId = null;
        } else {
          throw error;
        }
      }
    }

    // If no customer ID but we have a subscription ID, try to get customer from subscription
    if (!customerId && subscription?.stripe_subscription_id) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
        customerId = stripeSubscription.customer as string;

        // Update our database with the found customer ID
        await supabase
          .from("user_subscriptions")
          .update({ stripe_customer_id: customerId })
          .eq("account_id", accountId)
          .in('status', ['active', 'trialing']);
      } catch (error) {}
    }

    // If still no customer ID, try to find customer by user email
    if (!customerId) {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser?.email) {
        const customers = await stripe.customers.list({
          email: authUser.email,
          limit: 1
        });
        
        if (customers.data.length > 0) {
          customerId = customers.data[0].id;

          // Update our database with the found customer ID
          await supabase
            .from("user_subscriptions")
            .update({ stripe_customer_id: customerId })
            .eq("account_id", accountId)
            .in('status', ['active', 'trialing']);
        }
      }
      } catch (error) {}
    }

    if (!customerId) {
      return NextResponse.json(
        { error: "No billing information found. Please complete your subscription setup first." },
        { status: 404 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/get-credits`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: "Error creating customer portal session. Please try again or contact support." },
      { status: 500 }
    );
  }
} 
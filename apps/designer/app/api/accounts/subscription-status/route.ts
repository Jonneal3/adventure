import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

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

    const { accountId } = await request.json();

    if (!accountId) {
      return NextResponse.json(
        { error: "Account ID is required" },
        { status: 400 }
      );
    }

    // Get account details and user role
    const { data: accountUsers, error: accountError } = await supabase
      .from('user_accounts')
      .select(`
        user_id,
        user_status,
        accounts (
          id,
          name,
          slug,
          description,
          created_at,
          updated_at
        )
      `)
      .eq('account_id', accountId);

    if (accountError) {
      return NextResponse.json(
        { error: "Failed to fetch account details" },
        { status: 500 }
      );
    }

    const myUserAccount = accountUsers?.find(ua => ua.user_id === user.id);
    const ownerUserId = accountUsers?.find(ua => ua.user_status === 'owner')?.user_id ?? null;
    
    if (!myUserAccount) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Fetch the most recent subscription for this account (any status)
    const { data: subscriptions, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('account_id', accountId)
      .order('start_date', { ascending: false })
      .limit(1);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch subscription details" },
        { status: 500 }
      );
    }

    // Use the most recent subscription by start_date
    const mostRecent = subscriptions && subscriptions.length > 0 ? subscriptions[0] : null;

    // Determine routing based on subscription status and user role
    let route = null;
    let reason = null;

    if (!mostRecent) {
      // No active or trialing subscription - new user
      if (myUserAccount.user_status === 'owner') {
        route = 'new';
        reason = 'no_subscription_history';
      } else {
        route = 'locked';
        reason = 'account_locked_no_subscription';
      }
    } else {
      // Active or trialing subscription found
      if (mostRecent.status === 'active' || mostRecent.status === 'trialing') {
        // Gate partner plan until approved
        if (mostRecent.partner_approval && mostRecent.partner_approval === 'pending') {
          route = 'partner-pending';
          reason = 'partner_approval_pending';
        } else {
        // Active subscription - allow access
        route = 'active';
        reason = 'subscription_active';
        }
      } else if (mostRecent.status === 'past_due' || mostRecent.status === 'unpaid') {
        // Payment failed recently
        if (myUserAccount.user_status === 'owner') {
          route = 'payment-failed';
          reason = 'payment_failed';
        } else {
          route = 'locked';
          reason = 'account_locked_payment_failed';
        }
      } else if (mostRecent.status === 'canceled') {
        // Previously cancelled
        if (myUserAccount.user_status === 'owner') {
          route = 'renew';
          reason = 'subscription_cancelled';
        } else {
          route = 'locked';
          reason = 'account_locked_cancelled';
        }
      } else {
        // Other statuses (incomplete, etc.)
        if (myUserAccount.user_status === 'owner') {
          route = 'new';
          reason = 'incomplete_subscription';
        } else {
          route = 'locked';
          reason = 'account_locked_incomplete';
        }
      }
    }

    return NextResponse.json({
      route,
      reason,
      userRole: myUserAccount.user_status,
      ownerUserId,
      account: myUserAccount.accounts,
      subscription: mostRecent || null
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 

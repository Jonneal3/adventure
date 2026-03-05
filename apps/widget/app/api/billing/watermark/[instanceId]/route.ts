import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

type SubscriptionStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'inactive' | string | null;

export async function GET(
  _request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing server config' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1) Resolve account for instance
    const { data: instance, error: instErr } = await supabase
      .from('instances')
      .select('id, account_id')
      .eq('id', params.instanceId)
      .single();

    if (instErr || !instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const accountId = (instance as any).account_id as string | null;
    if (!accountId) {
      // No account → treat as unpaid, show watermark
      return NextResponse.json({ showWatermark: true, reason: 'no_account' });
    }

    // 2) Pull most recent subscription status for this account
    // Order by updated_at to get the most recently updated subscription (more accurate than created_at)
    const { data: sub, error: subErr } = await supabase
      .from('user_subscriptions')
      .select('status, trial_end, monthly_price_cents, stripe_subscription_id')
      .eq('account_id', accountId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr) {
      // On failure, fail-open to showing watermark (safer default)
      return NextResponse.json({ showWatermark: true, reason: 'query_error' });
    }

    // If no subscription found, show watermark
    if (!sub) {
      return NextResponse.json({ showWatermark: true, reason: 'no_subscription', status: null });
    }

    const status = (sub.status as SubscriptionStatus) ?? null;
    // Case-insensitive comparison for status
    const statusLower = status?.toLowerCase() ?? '';
    const isTrial = statusLower === 'trialing';
    const isActive = statusLower === 'active';

    // Check if subscription is paying:
    // - Has a Stripe subscription ID (indicates it's connected to Stripe and likely paying)
    // - OR has monthly_price_cents > 0 (indicates a paid plan)
    const hasStripeSubscription = Boolean(sub.stripe_subscription_id);
    const hasPrice = (sub.monthly_price_cents ?? 0) > 0;
    const isPaying = hasStripeSubscription || hasPrice;

    // Hide watermark ONLY when subscription is ACTIVE AND paying
    // Show watermark for all other cases: no subscription, trial, canceled, past_due, inactive, not paying, etc.
    const showWatermark = !(isActive && isPaying);

    return NextResponse.json({ 
      showWatermark, 
      status: status || 'unknown',
      monthly_price_cents: sub.monthly_price_cents,
      has_stripe_subscription: hasStripeSubscription,
      is_paying: isPaying,
      reason: isActive && isPaying ? 'active_paying' : isActive ? 'active_not_paying' : isTrial ? 'trial' : 'not_active'
    });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



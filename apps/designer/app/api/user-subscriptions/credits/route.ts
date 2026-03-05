import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookies().getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookies().set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get accountId from query string or header
    const url = new URL(request.url);
    const accountId = url.searchParams.get('accountId') || request.headers.get('x-account-id');
    if (!accountId) {
      return NextResponse.json({ error: "Account ID is required" }, { status: 400 });
    }

    // Get the account's active subscription using RLS
    const { data: activeSubscriptions, error: activeError } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('account_id', accountId)
      .in('status', ['active', 'trialing'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (activeError) {
      return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 });
    }

    let subscription = activeSubscriptions?.[0];

    // If no active subscription, try to get the most recent one
    if (!subscription) {
      const { data: recentSubscriptions, error: recentError } = await supabase
        .from('user_subscriptions')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (recentError) {
        return NextResponse.json({ error: "Failed to fetch subscription" }, { status: 500 });
      }

      subscription = recentSubscriptions?.[0];
    }

    return NextResponse.json({
      success: true,
      subscription: subscription || null,
      credits: subscription?.ai_credits_balance || 0,
      status: subscription?.status || 'inactive',
      endDate: subscription?.end_date || null
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 
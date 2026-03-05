import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export type SubscriptionStatus = 'active' | 'trialing' | 'canceled' | 'incomplete' | null;

// Cache auth results for 5 seconds to prevent rapid re-fetches
const AUTH_CACHE_TTL = 5000;
let authCache: {
  data: { session: any; subscription: SubscriptionStatus } | null;
  timestamp: number;
} = {
  data: null,
  timestamp: 0,
};

export async function getSessionAndSubscription() {
  // Force dynamic behavior to prevent static generation
  const cookieStore = await cookies();
  
  const now = Date.now();

  // Return cached data if available and not expired
  if (authCache.data && now - authCache.timestamp < AUTH_CACHE_TTL) {
    return authCache.data;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
      },
    }
  );
  
  try {
    // Get user (more secure than getSession)
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      return { session: null, subscription: null };
    }

    if (!user) {
      return { session: null, subscription: null };
    }

    // Get subscription status
    const { data: subscription, error: subError } = await supabase
      .from('user_subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError) {
      return { session: { user }, subscription: null };
    }

    const result = { 
      session: { user }, 
      subscription: subscription?.status as SubscriptionStatus ?? null 
    };

    // Cache the result
    authCache = {
      data: result,
      timestamp: now,
    };

    return result;
  } catch (error) {
    return { session: null, subscription: null };
  }
} 
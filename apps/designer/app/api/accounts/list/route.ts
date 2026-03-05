// RLS SQL policies for Supabase:
//
// -- user_accounts: only allow SELECT where user_id = auth.uid()
// ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users can select their own user_accounts" ON user_accounts
//   FOR SELECT USING (user_id = auth.uid());
//
// -- accounts: only allow SELECT where a related user_account exists with user_id = auth.uid()
// ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users can select accounts they have access to" ON accounts
//   FOR SELECT USING (EXISTS (
//     SELECT 1 FROM user_accounts ua WHERE ua.account_id = id AND ua.user_id = auth.uid()
//   ));
//
// -- user_subscriptions: only allow SELECT where user_id = auth.uid()
// ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
// CREATE POLICY "Users can select their own subscriptions" ON user_subscriptions
//   FOR SELECT USING (user_id = auth.uid());

import { NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { randomUUID } from 'crypto';
import { NextRequest } from 'next/server';

function extractAccessToken(request: Request): string | null {
  // Try Authorization header first
  const authHeader = request.headers.get('authorization');
  if (authHeader) return authHeader.replace('Bearer ', '');
  // Try cookies (Next.js API routes: 'sb-access-token' or 'supabase-auth-token')
  const cookie = request.headers.get('cookie');
  if (cookie) {
    const match = cookie.match(/sb-access-token=([^;]+)/) || cookie.match(/supabase-auth-token=([^;]+)/);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

// Example Supabase queries:
// 1. Select the logged-in user's user_accounts
//    const { data: userAccounts } = await supabase
//      .from('user_accounts')
//      .select('*')
//      .eq('user_id', user.id);
//
// 2. Select accounts only if the user has access through user_accounts
//    const { data: accounts } = await supabase
//      .from('accounts')
//      .select('*')
//      .in('id', userAccounts.map(ua => ua.account_id));
//
// 3. Select the logged-in user's user_subscriptions
//    const { data: subscriptions } = await supabase
//      .from('user_subscriptions')
//      .select('*')
//      .eq('user_id', user.id);

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const requestId = randomUUID();
  // All logging removed for production cleanliness
  try {
    // Create authenticated client using Supabase SSR
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
    
    // Get authenticated user (this will fail if no valid session)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Query user_accounts with RLS (no manual filtering needed!)
    const { data: userAccounts, error } = await supabase
      .from('user_accounts')
      .select(`
        account_id,
        user_status,
        status,
        accounts (
          id,
          name,
          slug,
          description
        )
      `);

    if (error) {
      return NextResponse.json({ error: "Failed to check user accounts" }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      userAccounts: userAccounts || [],
      hasAccounts: userAccounts && userAccounts.length > 0
    }, { headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' } });
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
} 
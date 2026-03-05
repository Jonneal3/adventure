import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export async function POST(req: NextRequest) {
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
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { accountId } = await req.json();
    if (!accountId) {
      return new Response(JSON.stringify({ error: 'Missing accountId' }), { status: 400 });
    }

    // Get the current user's user_account row for this account
    const { data: myUserAccount, error: myUserError } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('account_id', accountId)
      .single();
    if (myUserError || !myUserAccount) {
      return new Response(JSON.stringify({ error: 'Not a member of this account' }), { status: 403 });
    }

    // If owner or admin, return all users for the account
    if (myUserAccount.user_status === 'owner' || myUserAccount.user_status === 'admin') {
      const { data: allUsers, error: allUsersError } = await supabase
        .from('user_accounts')
        .select('*')
        .eq('account_id', accountId);
      if (allUsersError) {
        return new Response(JSON.stringify({ error: 'Failed to fetch users' }), { status: 500 });
      }
      return new Response(JSON.stringify({ users: allUsers }), { status: 200 });
    }

    // Otherwise, only return the current user's own user_account row
    return new Response(JSON.stringify({ users: [myUserAccount] }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
} 
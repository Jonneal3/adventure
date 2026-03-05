import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { Database } from '@/types/database';

// Create admin client with service role key to bypass RLS
const supabaseAdmin = createClient<Database>(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LIST_TTL_MS = 15_000;
const USER_TTL_MS = 5 * 60_000;

type ListEntry = { expiresAt: number; users: any[] };
type UserEntry = { expiresAt: number; email: string; user_metadata: any };

const listCache = new Map<string, ListEntry>();
const listInflight = new Map<string, Promise<any[]>>();
const userCache = new Map<string, UserEntry>();
const userInflight = new Map<string, Promise<UserEntry>>();

async function getUserDetails(userId: string): Promise<UserEntry> {
  const cached = userCache.get(userId);
  if (cached && Date.now() < cached.expiresAt) return cached;

  const existing = userInflight.get(userId);
  if (existing) return existing;

  const promise = (async () => {
    try {
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
      const next: UserEntry = {
        email: userError ? 'Unknown' : userData.user?.email || 'Unknown',
        expiresAt: Date.now() + USER_TTL_MS,
        user_metadata: userError ? {} : userData.user?.user_metadata || {},
      };
      userCache.set(userId, next);
      return next;
    } finally {
      userInflight.delete(userId);
    }
  })();

  userInflight.set(userId, promise);
  return promise;
}

export async function POST(request: NextRequest) {
  try {
    const { accountId } = await request.json();
    
    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    // Create server client with cookies for auth check
    const cookieStore = cookies();
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

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const listKey = `${user.id}:${accountId}`;
    const cachedList = listCache.get(listKey);
    if (cachedList && Date.now() < cachedList.expiresAt) {
      return NextResponse.json({ users: cachedList.users });
    }

    const inflight = listInflight.get(listKey);
    if (inflight) {
      const users = await inflight;
      return NextResponse.json({ users });
    }

    // Ensure requester is a member of the account (any role) before returning membership list
    const { data: myUserAccount, error: myUserAccountError } = await supabase
      .from('user_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('account_id', accountId)
      .single();

    if (myUserAccountError || !myUserAccount) {
      return NextResponse.json({ error: 'Access denied to this account' }, { status: 403 });
    }

    const promise = (async () => {
      // Use admin client to bypass RLS and fetch all user_accounts for this account
      const { data: userAccounts, error: userAccountsError } = await supabaseAdmin
        .from('user_accounts')
        .select(`
          id,
          user_id,
          user_status,
          created_at,
          updated_at,
          account_id
        `)
        .eq('account_id', accountId);

      if (userAccountsError) {
        throw new Error('Failed to fetch users');
      }

      const usersWithDetails = await Promise.all(
        (userAccounts || []).map(async (userAccount: any) => {
          const detail = await getUserDetails(userAccount.user_id);
          return {
            ...userAccount,
            email: detail.email,
            user_metadata: detail.user_metadata,
          };
        })
      );

      listCache.set(listKey, { expiresAt: Date.now() + LIST_TTL_MS, users: usersWithDetails });
      return usersWithDetails;
    })();

    listInflight.set(listKey, promise);
    try {
      const users = await promise;
      return NextResponse.json({ users });
    } finally {
      listInflight.delete(listKey);
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 

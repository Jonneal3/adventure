import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookies().getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookies().set(name, value, options)
              )
            } catch {}
          },
        },
      }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const accountId = url.searchParams.get('accountId');
    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    // Use service role client to read ledger with an explicit membership check
    const supabaseSr = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify the authenticated user is a member of this account
    const { data: membership, error: membershipError } = await supabaseSr
      .from('user_accounts')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('account_id', accountId)
      .maybeSingle();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Fetch transactions for this account
    const { data, error } = await (supabaseSr as any)
      .from('account_credit_transactions')
      .select('*')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
    }

    const transactions = ((data || []) as any[]).map((row: any) => ({
      id: row.id,
      account_id: row.account_id,
      user_id: null as string | null,
      instance_id: row.instance_id,
      // credit_reload adds credits; other types consume credits
      delta_credits: row.type === 'credit_reload' ? row.credit_amount : -Math.abs(row.credit_amount),
      balance_after: null as number | null,
      type: row.type,
      description: row.description,
      created_at: row.created_at,
    }));

    return NextResponse.json({ success: true, transactions });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



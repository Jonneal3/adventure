import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export async function POST(req: NextRequest) {
  try {
    const { accountId } = await req.json();
    if (!accountId) {
      return NextResponse.json({ error: 'Missing accountId' }, { status: 400 });
    }

    // Extract access token from headers
    const accessToken = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the user_account row
    const { data: userAccount, error: userAccountError } = await supabase
      .from('user_accounts')
      .select('id, status, user_id, account_id')
      .eq('user_id', user.id)
      .eq('account_id', accountId)
      .single();
    if (userAccountError || !userAccount) {
      return NextResponse.json({ error: 'Not invited to this account' }, { status: 403 });
    }
    if (userAccount.status !== 'invited') {
      return NextResponse.json({ error: 'Account is not in invited status' }, { status: 400 });
    }

    // Update status to 'accepted'
    const { error: updateError } = await supabase
      .from('user_accounts')
      .update({ status: 'accepted' })
      .eq('id', userAccount.id);
    if (updateError) {
      return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
    }

    // Fetch the row again after update
    const { data: updatedUserAccount, error: fetchAfterError } = await supabase
      .from('user_accounts')
      .select('id, status, user_id, account_id')
      .eq('id', userAccount.id)
      .single();

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
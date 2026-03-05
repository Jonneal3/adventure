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

export async function POST(request: NextRequest) {
  try {
    const { userAccountId, accountId, newRole } = await request.json();
    
    if (!accountId || !userAccountId || !newRole) {
      return NextResponse.json(
        { error: 'accountId, userAccountId, and newRole are required' },
        { status: 400 }
      );
    }

    if (newRole === 'owner') {
      return NextResponse.json(
        { error: 'Cannot change user role to owner' },
        { status: 400 }
      );
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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if current user is the owner
    const { data: currentUserAccount, error: userAccountError } = await supabaseAdmin
      .from('user_accounts')
      .select('user_status')
      .eq('user_id', user.id)
      .eq('account_id', accountId)
      .single();

    if (userAccountError || !currentUserAccount) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    if (currentUserAccount.user_status !== 'owner') {
      return NextResponse.json(
        { error: 'Only owners can edit user roles' },
        { status: 403 }
      );
    }

    // Get the target user account
    const { data: targetUserAccount, error: targetUserAccountError } = await supabaseAdmin
      .from('user_accounts')
      .select('id, user_status, user_id')
      .eq('id', userAccountId)
      .eq('account_id', accountId)
      .single();

    if (targetUserAccountError || !targetUserAccount) {
      return NextResponse.json(
        { error: 'User account not found' },
        { status: 404 }
      );
    }

    // Prevent editing the owner
    if (targetUserAccount.user_status === 'owner') {
      return NextResponse.json(
        { error: 'Cannot edit the account owner' },
        { status: 400 }
      );
    }

    // Update the user role
    const { error: updateError } = await supabaseAdmin
      .from('user_accounts')
      .update({ user_status: newRole })
      .eq('id', userAccountId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update user role' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User role updated to ${newRole}`
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
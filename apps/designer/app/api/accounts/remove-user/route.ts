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
    const { userAccountId, accountId, userId } = await request.json();
    
    // Support both scenarios: removing another user (admin) or self-removal
    if (!accountId || (!userAccountId && !userId)) {
      return NextResponse.json(
        { error: 'accountId and either userAccountId or userId are required' },
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

    // Check if user has permission to remove users or is removing themselves
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

    const isSelfRemoval = userId && userId === user.id;
    
    // For self-removal, user cannot be an owner
    if (isSelfRemoval && currentUserAccount.user_status === 'owner') {
      return NextResponse.json(
        { error: 'Account owners cannot remove themselves. Transfer ownership first.' },
        { status: 403 }
      );
    }
    
    // For removing others, user must be owner or admin
    if (!isSelfRemoval && !(currentUserAccount.user_status === 'owner' || currentUserAccount.user_status === 'admin')) {
      return NextResponse.json(
        { error: 'Only owners and admins can remove other users' },
        { status: 403 }
      );
    }

    let targetUserAccount;
    let deleteQuery;

    if (isSelfRemoval) {
      // For self-removal, find the user's own user_account record
      const { data: selfUserAccount, error: selfUserAccountError } = await supabaseAdmin
        .from('user_accounts')
        .select('id, user_status, user_id')
        .eq('user_id', user.id)
        .eq('account_id', accountId)
        .single();

      if (selfUserAccountError || !selfUserAccount) {
        return NextResponse.json(
          { error: 'User account not found' },
          { status: 404 }
        );
      }

      targetUserAccount = selfUserAccount;
      deleteQuery = supabaseAdmin
        .from('user_accounts')
        .delete()
        .eq('id', selfUserAccount.id);
    } else {
      // For removing others, use the provided userAccountId
      const { data: otherUserAccount, error: otherUserAccountError } = await supabaseAdmin
        .from('user_accounts')
        .select('id, user_status, user_id')
        .eq('id', userAccountId)
        .eq('account_id', accountId)
        .single();

      if (otherUserAccountError || !otherUserAccount) {
        return NextResponse.json(
          { error: 'User account not found' },
          { status: 404 }
        );
      }

      // Prevent removing the owner
      if (otherUserAccount.user_status === 'owner') {
        return NextResponse.json(
          { error: 'Cannot remove the account owner' },
          { status: 400 }
        );
      }

      targetUserAccount = otherUserAccount;
      deleteQuery = supabaseAdmin
        .from('user_accounts')
        .delete()
        .eq('id', userAccountId);
    }

    // Execute the deletion
    const { error: deleteError } = await deleteQuery;

    if (deleteError) {
      return NextResponse.json(
        { error: 'Failed to remove user from account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User has been removed from the account`
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
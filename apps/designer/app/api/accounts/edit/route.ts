import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const { accountId, name, slug, description } = await request.json();
    
    if (!accountId || !name || !slug) {
      return NextResponse.json(
        { error: 'Account ID, name, and slug are required' },
        { status: 400 }
      );
    }

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

    // Check if user is the owner of this account
    const { data: userAccount, error: userAccountError } = await supabase
      .from('user_accounts')
      .select('user_status')
      .eq('user_id', user.id)
      .eq('account_id', accountId)
      .single();

    if (userAccountError || !userAccount) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }

    // Only owners can edit accounts
    if (userAccount.user_status !== 'owner') {
      return NextResponse.json(
        { error: 'Only account owners can edit accounts' },
        { status: 403 }
      );
    }

    // Check if slug is already taken by another account
    const { data: existingAccount, error: checkError } = await supabase
      .from('accounts')
      .select('id')
      .eq('slug', slug)
      .neq('id', accountId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      return NextResponse.json(
        { error: 'Failed to check slug availability' },
        { status: 500 }
      );
    }

    if (existingAccount) {
      return NextResponse.json(
        { error: 'An account with this slug already exists' },
        { status: 400 }
      );
    }

    // Update the account
    const { error: updateError } = await supabase
      .from('accounts')
      .update({
        name: name.trim(),
        slug: slug.trim(),
        description: description?.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq('id', accountId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update account' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Account updated successfully'
    });

  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
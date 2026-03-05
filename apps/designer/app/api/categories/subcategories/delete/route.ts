import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: cookies() }
    );

    // Check authentication
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { subcategoryId, accountId } = body;

    if (!subcategoryId || !accountId) {
      return NextResponse.json({ error: 'SubcategoryId and accountId are required' }, { status: 400 });
    }

    // Check if user has access to this account
    const { data: userAccount, error: userAccountError } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('account_id', accountId)
      .eq('user_id', session.user.id)
      .single();

    if (userAccountError || !userAccount) {
      return NextResponse.json({ error: 'Access denied to this account' }, { status: 403 });
    }

    // Verify the subcategory exists and belongs to this account
    const { data: subcategory, error: subcategoryError } = await supabase
      .from('categories_subcategories')
      .select('id, subcategory, account_id')
      .eq('id', subcategoryId)
      .eq('account_id', accountId)
      .single();

    if (subcategoryError || !subcategory) {
      return NextResponse.json({ error: 'Subcategory not found or access denied' }, { status: 404 });
    }

    // Delete the subcategory
    const { error: deleteError } = await supabase
      .from('categories_subcategories')
      .delete()
      .eq('id', subcategoryId)
      .eq('account_id', accountId);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete subcategory' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Subcategory deleted successfully'
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
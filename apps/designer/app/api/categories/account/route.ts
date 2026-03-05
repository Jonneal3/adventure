import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
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

    // Get accountId from query params
    const url = new URL(request.url);
    const accountId = url.searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
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

    // Fetch all categories for this account (including pending ones)
    const { data: categories, error: categoriesError } = await supabase
      .from('categories')
      .select(`
        id,
        name,
        description,
        status,
        created_at,
        updated_at,
        categories_subcategories (
          id,
          subcategory,
          description,
          status,
          created_at,
          updated_at
        )
      `)
      .eq('account_id', accountId)
      .order('name');

    if (categoriesError) {
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }

    // Group categories by status
    const activeCategories = categories?.filter(cat => cat.status === 'active') || [];
    const pendingCategories = categories?.filter(cat => cat.status === 'pending_approval') || [];
    const rejectedCategories = categories?.filter(cat => cat.status === 'rejected') || [];

    return NextResponse.json({
      success: true,
      categories: {
        active: activeCategories,
        pending: pendingCategories,
        rejected: rejectedCategories
      },
      counts: {
        active: activeCategories.length,
        pending: pendingCategories.length,
        rejected: rejectedCategories.length,
        total: categories?.length || 0
      }
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
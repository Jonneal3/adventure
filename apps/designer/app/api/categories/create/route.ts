import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export async function POST(request: NextRequest) {
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
    const { name, description, accountId } = body;

    if (!name || !description || !accountId) {
      return NextResponse.json({ error: 'Name, description, and accountId are required' }, { status: 400 });
    }

    const { data: userAccount, error: userAccountError } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('account_id', accountId)
      .eq('user_id', session.user.id)
      .single();

    if (userAccountError || !userAccount) {
      return NextResponse.json({ error: 'Access denied to this account' }, { status: 403 });
    }

    // Check if category with this name already exists for this account
    const { data: existingCategory, error: checkError } = await supabase
      .from('categories')
      .select('id')
      .eq('name', name)
      .eq('account_id', accountId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      return NextResponse.json({ error: 'Error checking existing category' }, { status: 500 });
    }

    if (existingCategory) {
      return NextResponse.json({ error: 'A category with this name already exists for this account' }, { status: 409 });
    }

    // Create the category with pending_approval status
    const { data: category, error: createError } = await supabase
      .from('categories')
      .insert({
        name,
        description: description,
        user_id: session.user.id,
        account_id: accountId,
        status: 'pending_approval'
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      category,
      message: 'Category created successfully and is pending approval'
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
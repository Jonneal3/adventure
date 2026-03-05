import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { generateServiceSummary } from '@/lib/ai/serviceSummary';

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
    const { subcategory, description, categoryId, accountId } = body;

    if (!subcategory || !description || !categoryId || !accountId) {
      return NextResponse.json({ error: 'Subcategory, description, categoryId, and accountId are required' }, { status: 400 });
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

    // Verify the category exists and belongs to this account
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('id', categoryId)
      .eq('account_id', accountId)
      .single();

    if (categoryError || !category) {
      return NextResponse.json({ error: 'Category not found or access denied' }, { status: 404 });
    }

    // Check if subcategory with this name already exists for this category
    const { data: existingSubcategory, error: checkError } = await supabase
      .from('categories_subcategories')
      .select('id')
      .eq('subcategory', subcategory)
      .eq('category_id', categoryId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
      return NextResponse.json({ error: 'Error checking existing subcategory' }, { status: 500 });
    }

    if (existingSubcategory) {
      return NextResponse.json({ error: 'A subcategory with this name already exists for this category' }, { status: 409 });
    }

    // Create the subcategory with pending_approval status
    let serviceSummary: string | null = null;
    try {
      serviceSummary = await generateServiceSummary({
        serviceName: subcategory,
        categoryName: category.name,
        instanceType: "service",
      });
    } catch {
      serviceSummary = null;
    }

    const { data: newSubcategory, error: createError } = await supabase
      .from('categories_subcategories')
      .insert({
        subcategory,
        description: description,
        category_id: categoryId,
        user_id: session.user.id,
        account_id: accountId,
        status: 'pending_approval',
        service_summary: serviceSummary,
      })
      .select()
      .single();

    if (createError) {
      return NextResponse.json({ error: 'Failed to create subcategory' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      subcategory: newSubcategory,
      message: 'Subcategory created successfully and is pending approval'
    });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
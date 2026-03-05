import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

export async function GET(req: NextRequest, { params }: { params: { accountId: string } }) {
  const accountId = params.accountId;
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Fetch global categories (account_id IS NULL, status = 'active')
  const { data: globalCategories, error: globalError } = await supabase
    .from('categories')
    .select(`
      id,
      name,
      description,
      status,
      account_id,
      user_id,
      categories_subcategories (
        id,
        subcategory,
        description,
        status,
        account_id,
        user_id
      )
    `)
    .eq('status', 'active')
    .is('account_id', null)
    .order('name');

  // Fetch account-specific categories (account_id = [accountId])
  const { data: accountCategories, error: accountError } = await supabase
    .from('categories')
    .select(`
      id,
      name,
      description,
      status,
      account_id,
      user_id,
      categories_subcategories (
        id,
        subcategory,
        description,
        status,
        account_id,
        user_id
      )
    `)
    .eq('account_id', accountId)
    .order('name');

  if (globalError || accountError) {
    return NextResponse.json({ error: globalError?.message || accountError?.message }, { status: 500 });
  }

  // Filter subcategories for global categories: only global and active
  function filterGlobalSubcategories(cat: any) {
    return {
      ...cat,
      categories_subcategories: Array.isArray(cat.categories_subcategories)
        ? cat.categories_subcategories.filter(
            (sub: any) => sub.account_id === null && sub.status === 'active'
          )
        : [],
    };
  }

  // For account categories, include all subcategories with account_id = [accountId] (any status)
  function filterAccountSubcategories(cat: any) {
    return {
      ...cat,
      categories_subcategories: Array.isArray(cat.categories_subcategories)
        ? cat.categories_subcategories.filter(
            (sub: any) => sub.account_id === accountId
          )
        : [],
    };
  }

  const filteredGlobal = (globalCategories || []).map(filterGlobalSubcategories);
  const filteredAccount = (accountCategories || []).map(filterAccountSubcategories);

  // Merge and deduplicate by id
  const allCategories = [...filteredGlobal, ...filteredAccount].reduce((acc, cat) => {
    if (!acc.some((c: any) => c.id === cat.id)) acc.push(cat);
    return acc;
  }, [] as any[]);

  return NextResponse.json({ categories: allCategories });
} 
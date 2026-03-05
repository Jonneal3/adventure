import { NextResponse, NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export async function GET(request: NextRequest) {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: cookies() }
  );

  // Get accountId from query params if provided
  const url = new URL(request.url);
  const accountId = url.searchParams.get('accountId');

  // Check session/auth status
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();

  let query = supabase
    .from('categories')
    .select(`
      id,
      name,
      description,
      status,
      account_id,
      categories_subcategories (
        id,
        subcategory,
        description,
        status
      )
    `)
    .order('name');

  if (accountId) {
    // Fetch categories that are active OR belong to this account
    const orCondition = `status.eq.active,account_id.eq.${accountId}`;
    query = query.or(orCondition);
  } else {
    query = query.eq('status', 'active');
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter subcategories based on the rule:
  // Show if: (status = 'active' AND account_id = NULL) OR (account_id = current account)
  const filtered = (data || []).map(cat => {
    const subcats = Array.isArray((cat as any).categories_subcategories)
      ? (cat as any).categories_subcategories.filter((sub: any) => {
          const isActiveGlobal = sub.status === 'active' && sub.account_id === null;
          const isAccountCustom = sub.account_id === accountId;
          return isActiveGlobal || isAccountCustom;
        })
      : [];
    return {
      ...cat,
      categories_subcategories: subcats,
    };
  });

  return NextResponse.json({ categories: filtered });
} 
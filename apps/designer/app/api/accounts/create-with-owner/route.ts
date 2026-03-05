import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookies().getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookies().set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const { name, slug, description } = await req.json();
    if (!name || !slug) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }

    // 1. Create the account
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .insert([{ name, slug, description }])
      .select()
      .single();

    if (accountError) {
      return new Response(JSON.stringify({ error: accountError }), { status: 400 });
    }

    // 2. Create the user_accounts row (owner)
    const userAccountData = { user_id: user.id, account_id: account.id, user_status: 'owner', status: 'accepted' };

    const { error: userAccountError } = await supabase
      .from('user_accounts')
      .insert([userAccountData]);

    if (userAccountError) {
      return new Response(JSON.stringify({ error: userAccountError }), { status: 400 });
    }

    // 3. Pre-populate account with default categories and subcategories
    try {
      // Create a default "General Services" category for the account
      const { data: defaultCategory, error: categoryError } = await supabase
        .from('categories')
        .insert({
          name: 'General Services',
          description: 'Default services for your account',
          user_id: user.id,
          account_id: account.id,
          status: 'active'
        })
        .select()
        .single();

      if (categoryError) {} else {
        // Create some default subcategories
        const defaultSubcategories = [
          {
            category_id: defaultCategory.id,
            subcategory: 'Product Photography',
            description: 'Professional product photography services',
            user_id: user.id,
            account_id: account.id,
            status: 'active'
          },
          {
            category_id: defaultCategory.id,
            subcategory: 'Portrait Photography',
            description: 'Professional portrait photography services',
            user_id: user.id,
            account_id: account.id,
            status: 'active'
          },
          {
            category_id: defaultCategory.id,
            subcategory: 'Event Photography',
            description: 'Event and celebration photography services',
            user_id: user.id,
            account_id: account.id,
            status: 'active'
          }
        ];

        const { data: createdSubcategories, error: subcategoryError } = await supabase
          .from('categories_subcategories')
          .insert(defaultSubcategories)
          .select();

        if (subcategoryError) {} else {}
      }
    } catch (error) {}

    return new Response(JSON.stringify({ 
      account,
      requiresBilling: true,
      redirectTo: `/${account.id}/billing`
    }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), { status: 500 });
  }
} 
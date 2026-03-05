import { createServerClient } from '@supabase/ssr';
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { accountName, accountSlug, description } = await request.json();

    if (!accountName?.trim()) {
      return NextResponse.json(
        { error: "Account name is required" },
        { status: 400 }
      );
    }

    // Create the account using RLS
    const { data: account, error: accountError } = await supabase
      .from('accounts')
      .insert({
        name: accountName,
        slug: accountSlug,
        description: description || `Account for ${accountName}`
      })
      .select()
      .single();

    if (accountError) {
      return NextResponse.json(
        { error: `Account creation failed: ${accountError.message}` },
        { status: 500 }
      );
    }

    // Create the user_accounts relationship using RLS
    const { error: userAccountError } = await supabase
      .from('user_accounts')
      .insert({
        user_id: user.id,
        account_id: account.id,
        user_status: 'owner',
        status: 'accepted'
      });

    if (userAccountError) {
      // Try to clean up the account if user_accounts creation failed
      await supabase.from('accounts').delete().eq('id', account.id);

      return NextResponse.json(
        { error: `User account relationship creation failed: ${userAccountError.message}` },
        { status: 500 }
      );
    }

    // Pre-populate account with default categories and subcategories
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

    return NextResponse.json({
      success: true,
      account: account,
      message: "Account created successfully"
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
} 
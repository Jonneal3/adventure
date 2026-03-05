import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data, error } = await supabase
      .from('categories')
      .select(`
        id,
        name,
        description,
        status,
        categories_subcategories (
          id,
          subcategory,
          slug,
          description,
          status,
          instance_type,
          demo_theme_key,
          demo_template_config
        )
      `)
      .eq('status', 'active')
      .order('name');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const filtered = (data || []).map((cat: any) => ({
      ...cat,
      categories_subcategories: Array.isArray(cat.categories_subcategories)
        ? cat.categories_subcategories.filter((sub: any) => sub.status === 'active')
        : [],
    }));

    return NextResponse.json({ categories: filtered });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



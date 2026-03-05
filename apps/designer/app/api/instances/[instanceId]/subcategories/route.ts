import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function createSupabaseClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookies().getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookies().set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  try {
    const instanceId = params.instanceId;
    
    if (!instanceId) {
      return NextResponse.json({ error: 'Instance ID is required' }, { status: 400 });
    }

    const supabase = createSupabaseClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user has access to this instance
    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .select('account_id')
      .eq('id', instanceId)
      .single();

    if (instanceError || !instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    // Check if user has access to this account
    const { data: accountUser, error: accountError } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('account_id', instance.account_id)
      .eq('user_id', user.id)
      .single();

    if (accountError || !accountUser) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get subcategories for this instance
    const { data: subcategories, error } = await supabase
      .from('instance_subcategories')
      .select(`
        category_subcategory_id,
        categories_subcategories (
          id,
          subcategory,
          categories ( name )
        )
      `)
      .eq('instance_id', instanceId);

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch subcategories' }, { status: 500 });
    }

    // Transform the data to match the expected format
    const transformedSubcategories = subcategories
      .map((item: any) => {
        const subcategoryData = Array.isArray(item.categories_subcategories) 
          ? item.categories_subcategories[0] 
          : item.categories_subcategories;
        
        return {
          id: item.category_subcategory_id,
          subcategory: subcategoryData?.subcategory || '',
          category_name: subcategoryData?.categories?.name || null,
        };
      })
      .filter(item => item.subcategory); // Filter out any items without subcategory

    return NextResponse.json({ subcategories: transformedSubcategories });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
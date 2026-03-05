import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function createSupabaseClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role key to bypass RLS
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get('instanceId');
    const search = searchParams.get('search') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const subcategoryId = searchParams.get('subcategoryId');

    if (!instanceId) {
      return NextResponse.json({ error: 'Instance ID is required' }, { status: 400 });
    }

    const supabase = createSupabaseClient();

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get instance to find account_id
    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .select('account_id')
      .eq('id', instanceId)
      .single();

    if (instanceError || !instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    // Get images for this account and subcategory, plus global sample images
    let query = supabase
      .from('images')
      .select(`
        id,
        image_url,
        prompt_id,
        metadata,
        created_at,
        subcategory_id,
        status,
        account_id,
        model_id
      `);

    // Apply account filter first (show images from this account or global sample images)
    query = query.or(`account_id.eq.${instance.account_id},account_id.is.null`);

    // Filter by subcategory if specified
    if (subcategoryId) {
      query = query.eq('subcategory_id', subcategoryId);
    }

    // Apply ordering and limit
    query = query.order('created_at', { ascending: false }).limit(limit);

    // Add search filter if provided
    if (search) {
      query = query.ilike('prompt_id', `%${search}%`);
    }

    const { data: availableImages, error } = await query;

    if (error) {
      console.error('Database query error:', error);
      return NextResponse.json({ error: `Failed to fetch available images: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ images: availableImages });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
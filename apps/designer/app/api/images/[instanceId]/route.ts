import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { instanceId: string } }
) {
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
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '12');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .select('id, user_id')
      .eq('id', params.instanceId)
      .single();
    if (instanceError || !instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }
    if (instance.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }
    const { data: images, error: imagesError, count } = await supabase
      .from('images')
      .select('*', { count: 'exact' })
      .eq('instance_id', params.instanceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);
    if (imagesError) {
      return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 });
    }
    const hasMore = count ? offset + limit < count : false;
    return NextResponse.json({
      success: true,
      images: images || [],
      hasMore,
      total: count || 0
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
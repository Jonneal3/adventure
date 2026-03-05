import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { compactDesignConfigToV2 } from '@/lib/design-config-v2';

export const dynamic = 'force-dynamic';

function getBearerTokenFromHeaders(headers: Headers) {
  const authHeader = headers.get('authorization') || headers.get('Authorization');
  if (!authHeader) return undefined;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() || '';
  if (!token || token === 'undefined' || token === 'null') return undefined;
  return token;
}

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
              cookiesToSet.forEach(({ name, options, value }) =>
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

    let user = null as any;
    const { data: userData, error: userError } = await supabase.auth.getUser();
    user = userData?.user ?? null;
    if (userError || !user) {
      if (userError) {}
      // Fallback: try Authorization header bearer token (useful in some production setups)
      const token = getBearerTokenFromHeaders(request.headers);
      if (token) {
        const res = await supabase.auth.getUser(token);
        user = res.data.user;
      }
      if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    // Use admin client to fetch instance, then verify membership before returning
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: instance, error: instanceError } = await supabaseAdmin
      .from('instances')
      .select(`
        *,
        instance_subcategories (
          category_subcategory_id,
          categories_subcategories (
            id,
            subcategory,
            description,
            categories (
              name,
              description
            )
          )
        )
      `)
      .eq('id', params.instanceId)
      .single();

    if (instanceError || !instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    // Verify the requester is a member of the instance's account via RLS on user_accounts
    const accountId = instance.account_id as string | null;
    if (!accountId) {
      return NextResponse.json({ error: 'Instance missing account_id' }, { status: 404 });
    }

    const { data: membership } = await supabaseAdmin
      .from('user_accounts')
      .select('id')
      .eq('user_id', user.id)
      .eq('account_id', accountId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (instance?.config && typeof instance.config === 'object' && !Array.isArray(instance.config)) {
      (instance as any).config = compactDesignConfigToV2(instance.config, { fillDefaults: true }) as any;
    }

    return NextResponse.json({ instance });
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
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
              cookiesToSet.forEach(({ name, options, value }) =>
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

    // Check authentication
    let user = null as any;
    const { data: userData, error: userError } = await supabase.auth.getUser();
    user = userData?.user ?? null;
    if (userError || !user) {
      const token = getBearerTokenFromHeaders(request.headers);
      if (token) {
        const res = await supabase.auth.getUser(token);
        user = res.data.user;
      }
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const updates = await request.json();
    const instanceId = params.instanceId;

    if (!updates || Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'Updates are required' },
        { status: 400 }
      );
    }

    // Track modifications in the DB even if clients don’t set timestamps.
    (updates as any).updated_at = new Date().toISOString();

    // If config is provided, compact to V2 defaults and apply a stable key order.
    // Any legacy keys must not be stored in `instances.config`.
    // Note: config is stored as JSONB in Postgres, which may normalize key order on storage.
    if (updates?.config && typeof updates.config === 'object' && !Array.isArray(updates.config)) {
      updates.config = compactDesignConfigToV2(updates.config, { fillDefaults: true }) as any;
    }

    // Check if is_public is being updated
    if ('is_public' in updates) {}

    // Fetch instance via admin client and verify membership before allowing update
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: instance } = await supabaseAdmin
      .from('instances')
      .select('id, account_id, is_public, config')
      .eq('id', instanceId)
      .single();

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const accountId2 = instance.account_id as string | null;
    if (!accountId2) {
      return NextResponse.json({ error: 'Instance missing account_id' }, { status: 404 });
    }

    const { data: membership } = await supabaseAdmin
      .from('user_accounts')
      .select('id, user_status')
      .eq('user_id', user.id)
      .eq('account_id', accountId2)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Enforce role: only owner/admin can update
    const allowedRoles = new Set(['owner', 'admin']);
    if (!allowedRoles.has((membership as any).user_status)) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    if (updates?.config && typeof updates.config === 'object' && !Array.isArray(updates.config)) {
      const previousConfig =
        instance.config && typeof instance.config === 'object' && !Array.isArray(instance.config)
          ? (instance.config as Record<string, unknown>)
          : {};

      const previousV2 = compactDesignConfigToV2(previousConfig, { fillDefaults: true });
      if (JSON.stringify(previousV2) === JSON.stringify(updates.config)) {
        delete (updates as any).config;
      } else {
        try {
          const { error: historyError } = await supabaseAdmin
            .from('instance_config_versions')
            .insert({
              instance_id: instanceId,
              next_config: updates.config as any,
              previous_config: previousConfig as any,
              user_id: user.id,
            } as any);
          if (historyError) {
            console.warn('[instance update] failed to write config version history', historyError);
          }
        } catch (e) {
          console.warn('[instance update] failed to write config version history', e);
        }
      }
    }

    // Now update the instance - RLS will ensure the user can only update instances they have access to
    const { data, error } = await supabaseAdmin
      .from('instances')
      .update(updates)
      .eq('id', instanceId)
      .select();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // If this was a config update, verify it worked
    if (updates.config && Object.keys(updates).length === 1) {}

    // If is_public was updated, verify it worked
    if ('is_public' in updates) {}

    const nextRow = data?.[0] as any;
    if (nextRow?.config && typeof nextRow.config === 'object' && !Array.isArray(nextRow.config)) {
      nextRow.config = compactDesignConfigToV2(nextRow.config, { fillDefaults: true }) as any;
    }

    return NextResponse.json({ 
      data: nextRow,
      rowsUpdated: data?.length || 0,
      success: true, 
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 

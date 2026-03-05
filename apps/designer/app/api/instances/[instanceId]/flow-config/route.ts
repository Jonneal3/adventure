import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import { compactDesignConfigToV2 } from '@/lib/design-config-v2';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (!authHeader) return undefined;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim() || '';
  if (!token || token === 'undefined' || token === 'null') return undefined;
  return token;
}

function isRetryableNetworkError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const anyErr = error as any;
  const name = String(anyErr?.name || '');
  const message = String(anyErr?.message || '');
  const causeCode = String(anyErr?.cause?.code || '');
  return (
    name === 'TypeError' ||
    message.toLowerCase().includes('fetch failed') ||
    causeCode === 'UND_ERR_CONNECT_TIMEOUT' ||
    causeCode === 'UND_ERR_SOCKET' ||
    causeCode === 'UND_ERR_HEADERS_TIMEOUT' ||
    causeCode === 'UND_ERR_BODY_TIMEOUT'
  );
}

async function withRetry<T>(fn: () => PromiseLike<T>, opts: { attempts: number; baseDelayMs: number }) {
  let lastError: unknown = null;
  for (let i = 0; i < opts.attempts; i += 1) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      if (!isRetryableNetworkError(e) || i === opts.attempts - 1) break;
      const delay = opts.baseDelayMs * Math.pow(2, i);
      await sleep(delay);
    }
  }
  throw lastError;
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
    const token = getBearerToken(request);

    let user: { id: string } | null = null;
    let authError: unknown = null;
    try {
      const res = await withRetry(
        () => (token ? supabase.auth.getUser(token) : supabase.auth.getUser()),
        { attempts: 3, baseDelayMs: 150 },
      );
      user = res?.data?.user ?? null;
    } catch (e) {
      authError = e;
    }

    if (!user) {
      if (isRetryableNetworkError(authError)) {
        return NextResponse.json({ error: 'Auth temporarily unavailable' }, { status: 503 });
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { flow_config } = await request.json();
    const instanceId = params.instanceId;

    if (!flow_config) {
      return NextResponse.json(
        { error: 'flow_config is required' },
        { status: 400 }
      );
    }

    // `instances.flow_config` is deprecated/removed. Persist the full payload under
    // `instances.config.form_config` and mirror enablement to `instances.config.form_status_enabled`.
    const formStatusEnabled = (flow_config as any)?.enabled === true;
    const nextFormConfig =
      flow_config && typeof flow_config === 'object' && !Array.isArray(flow_config)
        ? ({ ...(flow_config as Record<string, unknown>) } as Record<string, unknown>)
        : {};
    // Avoid conflicting sources of truth: enablement lives in `config.form_status_enabled`.
    delete (nextFormConfig as any).enabled;

    // Fetch instance via admin client and verify membership before allowing update
    const supabaseAdmin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: instance, error: instanceError } = await withRetry(
      () =>
        supabaseAdmin
          .from('instances')
          .select('id, account_id, name, config')
          .eq('id', instanceId)
          .single(),
      { attempts: 3, baseDelayMs: 150 },
    );

    if (instanceError) {
      return NextResponse.json(
        { error: instanceError.message || 'Failed to load instance' },
        { status: 500 },
      );
    }

    if (!instance) {
      return NextResponse.json(
        { error: 'Instance not found' },
        { status: 404 }
      );
    }

    const accountId = instance.account_id as string | null;
    if (!accountId) {
      return NextResponse.json(
        { error: 'Instance missing account_id' },
        { status: 404 }
      );
    }

    const { data: membership, error: membershipError } = await withRetry(
      () =>
        supabaseAdmin
          .from('user_accounts')
          .select('id, user_status')
          .eq('user_id', user.id)
          .eq('account_id', accountId)
          .maybeSingle(),
      { attempts: 3, baseDelayMs: 150 },
    );

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message || 'Failed to verify permissions' },
        { status: 500 },
      );
    }

    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Enforce role: only owner/admin can update flow_config
    const allowedRoles = new Set(['owner', 'admin']);
    if (!allowedRoles.has((membership as any).user_status)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    const previousConfig =
      instance?.config && typeof instance.config === 'object' && !Array.isArray(instance.config)
        ? (instance.config as Record<string, unknown>)
        : {};

    const nextConfig = compactDesignConfigToV2(
      { ...previousConfig, form_status_enabled: formStatusEnabled, form_config: nextFormConfig },
      { fillDefaults: true },
    ) as any;

    const { data, error } = await withRetry(
      () =>
        supabaseAdmin
          .from('instances')
          .update({ config: nextConfig, updated_at: new Date().toISOString() as any })
          .eq('id', instanceId)
          .select('config'),
      { attempts: 3, baseDelayMs: 150 },
    );

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      data,
      rowsUpdated: data?.length || 0,
      success: true,
      deprecated: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    const isProd = process.env.NODE_ENV === 'production';
    return NextResponse.json(
      { error: isProd ? 'Internal server error' : message },
      { status: 500 }
    );
  }
}

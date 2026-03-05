import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/server/logger';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  const timestamp = new Date().toISOString();
  
  try {
    const instanceId = params.instanceId;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Missing environment variables' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'X-Cache-Bust': Date.now().toString()
        }
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });

    // Check if instance exists
    const { data: instanceExists, error: existsError } = await supabase
      .from('instances')
      .select('id, is_public')
      .eq('id', instanceId)
      .maybeSingle();

    if (existsError) {
      logger.error('Error checking instance:', existsError);
    } else if (!instanceExists) {
      return NextResponse.json({
        error: 'Instance not found',
        instanceId: instanceId,
        details: 'Instance does not exist in database'
      }, { status: 404 });
    }

    // Fetch instance data
    const { data: instance, error: instanceError } = await supabase
      .from('instances')
      .select('*')
      .eq('id', instanceId)
      .single();

    if (instanceError) {
      return NextResponse.json({
        error: 'Instance not found',
        instanceId: instanceId,
        errorCode: instanceError.code,
        errorMessage: instanceError.message,
        details: 'This could be due to RLS policy blocking access (is_public = false) or instance does not exist'
      }, { status: 404 });
    }

    const responseTimestamp = new Date().toISOString();
    
    const responseData = {
      success: true,
      instance: instance,
      fetchedAt: responseTimestamp,
      requestTimestamp: timestamp
    };
    
    const response = NextResponse.json(responseData);

    // Cache control
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
    response.headers.set('Last-Modified', new Date().toUTCString());
    response.headers.set('ETag', `"${Date.now()}"`);

    return response;

  } catch (error) {
    logger.error('AI Form API: Unexpected error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      instanceId: params.instanceId,
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

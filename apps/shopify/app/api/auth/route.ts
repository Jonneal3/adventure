import { NextRequest, NextResponse } from 'next/server';
import { buildAuthUrl } from '@/lib/shopify';
import { generateState } from '@/lib/crypto';
import { getSupabaseServiceClient } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  try {
  const { searchParams } = new URL(req.url);
  const shop = searchParams.get('shop');
    
    if (!shop) {
      return NextResponse.json(
        { 
          error: 'Missing shop parameter',
          message: 'Please provide a shop parameter (e.g., ?shop=your-store.myshopify.com)'
        }, 
        { status: 400 }
      );
    }

    if (!shop.endsWith('.myshopify.com')) {
      return NextResponse.json(
        { 
          error: 'Invalid shop domain',
          message: 'Shop domain must end with .myshopify.com (e.g., your-store.myshopify.com)'
        }, 
        { status: 400 }
      );
  }

  const state = generateState();
  
  // Store state in database as fallback (cookies can fail in cross-site redirects)
  // Note: Table may not exist yet - this is optional, cookies are primary
  try {
    const supabase = getSupabaseServiceClient();
    const { error: dbError } = await (supabase as any)
      .from('oauth_states')
      .insert({
        state,
        shop,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      });
    
    if (dbError) {
      console.error('[auth GET] failed_to_store_state_in_db', { shop, error: dbError });
      // Continue anyway - cookie is primary method
    } else {
      console.log('[auth GET] state_stored_in_db', { shop, stateLength: state.length });
    }
  } catch (e: any) {
    console.error('[auth GET] state_storage_error', { shop, error: e?.message });
    // Continue anyway - cookie is primary method
  }
  
  // Also set cookie (primary method, database is fallback)
  // For cross-site redirects (our app → Shopify → back to our app), we MUST use:
  // - SameSite=None (allows cross-site cookie sending)
  // - Secure=true (required when SameSite=None)
  const sameSiteEnv = (process.env.SHOPIFY_OAUTH_SAMESITE || 'none').toLowerCase();
  const sameSite = (['lax', 'strict', 'none'].includes(sameSiteEnv) ? sameSiteEnv : 'none') as 'lax' | 'strict' | 'none';
  const secure = (process.env.SHOPIFY_OAUTH_SECURE || 'true').toLowerCase() !== 'false';
  
  const url = buildAuthUrl(shop, state);
  
  // Create redirect response FIRST
  const response = NextResponse.redirect(url, { status: 302 });
  
  // Set cookie on the redirect response itself
  response.cookies.set('shopify_oauth_state', state, {
    httpOnly: true,
    secure: secure,
    sameSite: sameSite,
    path: '/',
    maxAge: 600, // 10 minutes
  });
  
  // Ensure headers allow the redirect to break out of iframe
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  
  console.log('[auth GET] oauth_initiated', { 
    shop, 
    sameSite, 
    secure, 
    cookieSet: true,
    dbFallbackSet: true,
  });
  
  return response;
  } catch (e: any) {
    const message = e?.message || 'Failed to initiate authentication. Please try again.';
    console.error('[auth GET] error:', message, e);
    return NextResponse.json(
      { 
        error: message,
        details: 'If this problem persists, please contact support.'
      }, 
      { status: 500 }
    );
  }
}


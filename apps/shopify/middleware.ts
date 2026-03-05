import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabaseServer';
import { buildAuthUrl } from '@/lib/shopify';
import { generateState } from '@/lib/crypto';

/**
 * Middleware to handle immediate OAuth redirect for uninstalled stores
 * This ensures NO page loads before OAuth redirect (Shopify requirement)
 */
export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();
  const shop = url.searchParams.get('shop');
  const host = url.searchParams.get('host');
  
  // Check on root path (/) or /auth when shop param is present
  // This is the entry point when Shopify redirects after "Install app"
  // Shopify may send to either / or /auth
  const isEntryPoint = url.pathname === '/' || url.pathname === '/auth';
  
  if (isEntryPoint && shop && shop.endsWith('.myshopify.com')) {
    try {
      // Server-side check: Is store installed?
      const supabase = getSupabaseServiceClient();
      const { data, error } = await supabase
        .from('shopify_stores')
        .select('id')
        .eq('store_domain', shop)
        .maybeSingle();
      
      if (error) {
        console.error('[middleware] database error:', error);
        // On error, allow through (better to show app than fail silently)
        return NextResponse.next();
      }
      
      // Store NOT installed - IMMEDIATELY redirect to OAuth (Shopify requirement)
      // This happens BEFORE any page loads, ensuring compliance
      // We do the OAuth setup here directly to avoid double redirect (which breaks cookies)
      if (!data) {
        // Generate OAuth state
        const state = generateState();
        
        // Store state in database (fallback for when cookies fail)
        // Note: Table may not exist yet - this is optional, cookies are primary
        try {
          const { error: dbError } = await (supabase as any)
            .from('oauth_states')
            .insert({
              state,
              shop,
              created_at: new Date().toISOString(),
              expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
            });
          
          if (dbError) {
            console.error('[middleware] failed_to_store_state_in_db', { shop, error: dbError });
            // Not a fatal error - cookies are primary method
          }
        } catch (e: any) {
          console.error('[middleware] state_storage_error', { shop, error: e?.message });
          // Not a fatal error - cookies are primary method
        }
        
        // Build OAuth URL directly (avoiding double redirect)
        const oauthUrl = buildAuthUrl(shop, state);
        
        // Create redirect response
        const response = NextResponse.redirect(oauthUrl, { status: 302 });
        
        // Set cookie on redirect response (for initial install, this is the only redirect)
        // For cross-site redirects, we MUST use SameSite=None and Secure=true
        const sameSiteEnv = (process.env.SHOPIFY_OAUTH_SAMESITE || 'none').toLowerCase();
        const sameSite = (['lax', 'strict', 'none'].includes(sameSiteEnv) ? sameSiteEnv : 'none') as 'lax' | 'strict' | 'none';
        const secure = (process.env.SHOPIFY_OAUTH_SECURE || 'true').toLowerCase() !== 'false';
        
        response.cookies.set('shopify_oauth_state', state, {
          httpOnly: true,
          secure: secure, // Must be true for SameSite=None
          sameSite: sameSite, // Must be 'none' for cross-site redirects
          path: '/',
          maxAge: 600, // 10 minutes
        });
        
        // Ensure headers allow the redirect to break out of iframe
        response.headers.set('X-Frame-Options', 'DENY');
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
        
        console.log('[middleware] store_not_installed, redirecting_to_oauth', { 
          shop, 
          sameSite, 
          secure,
          cookieSet: true,
          dbFallbackSet: true,
        });
        
        return response;
      }
      
      // Store is installed - allow request to proceed
      console.log('[middleware] store_installed, allowing_request', { shop });
      return NextResponse.next();
    } catch (e: any) {
      console.error('[middleware] error checking install status:', e);
      // On error, allow through to avoid redirect loops
      return NextResponse.next();
    }
  }
  
  // Not root path or no shop param - allow through
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (they handle their own logic)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};


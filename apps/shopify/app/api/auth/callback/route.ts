import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyShopifyCallbackHmac } from '@/lib/crypto';
import { exchangeAccessToken, fetchShopDetails, registerUninstallWebhook } from '@/lib/shopify';
import { getSupabaseServiceClient } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const params = url.searchParams;

  const shop = params.get('shop');
  const code = params.get('code');
  const state = params.get('state');
  const host = params.get('host');

  if (!shop || !code || !state) {
    return NextResponse.json({ error: 'Missing required params' }, { status: 400 });
  }

  // Check state: Try cookie first, then database fallback
  const stateCookie = cookies().get('shopify_oauth_state')?.value;
  let stateValid = false;
  let stateSource = 'none';
  
  // Method 1: Check cookie
  if (stateCookie && stateCookie === state) {
    stateValid = true;
    stateSource = 'cookie';
    console.log('[shopify_auth_callback] state_verified_from_cookie', { shop });
  } else {
    // Method 2: Check database (fallback for when cookies fail)
    // Note: Table may not exist yet - this is optional, cookies are primary
    try {
      const supabase = getSupabaseServiceClient();
      const { data: stateRecord, error: dbError } = await (supabase as any)
        .from('oauth_states')
        .select('state, shop, expires_at')
        .eq('state', state)
        .eq('shop', shop)
        .gt('expires_at', new Date().toISOString()) // Not expired
        .maybeSingle();
      
      if (dbError) {
        console.error('[shopify_auth_callback] state_db_check_error', { shop, error: dbError });
        // Not a fatal error - table might not exist yet
      } else if (stateRecord) {
        stateValid = true;
        stateSource = 'database';
        console.log('[shopify_auth_callback] state_verified_from_database', { shop });
        
        // Clean up the state record (one-time use)
        await (supabase as any).from('oauth_states').delete().eq('state', state);
      }
    } catch (e: any) {
      console.error('[shopify_auth_callback] state_db_check_exception', { shop, error: e?.message });
      // Not a fatal error - table might not exist yet
    }
  }
  
  // Log detailed state check for debugging
  console.log('[shopify_auth_callback] state_check', {
    shop,
    hasStateCookie: Boolean(stateCookie),
    stateCookieMatches: stateCookie === state,
    stateFromShopifyLength: state?.length || 0,
    stateValid,
    stateSource,
  });
  
  if (!stateValid) {
    console.warn('[shopify_auth_callback] state_mismatch', { 
      shop, 
      hasStateCookie: Boolean(stateCookie),
      stateCookiePreview: stateCookie ? `${stateCookie.substring(0, 10)}...` : 'missing',
      stateFromShopifyPreview: state ? `${state.substring(0, 10)}...` : 'missing',
    });
    return NextResponse.json({ 
      error: 'Invalid OAuth state',
      message: 'The OAuth state parameter does not match. This may happen if cookies are disabled or if the OAuth flow was interrupted. Please try installing the app again.'
    }, { status: 400 });
  }

  // Verify HMAC
  try {
    // Log environment check before verification
    const hasSecret = !!process.env.SHOPIFY_API_SECRET;
    const secretLength = process.env.SHOPIFY_API_SECRET?.length || 0;
    const apiKeyPreview = process.env.SHOPIFY_API_KEY 
      ? `${process.env.SHOPIFY_API_KEY.substring(0, 8)}...${process.env.SHOPIFY_API_KEY.substring(process.env.SHOPIFY_API_KEY.length - 4)}`
      : 'NOT SET';
    const expectedApiKey = '6e550b92f0cbfdf4cf543c83818f20fe';
    const apiKeyMatches = process.env.SHOPIFY_API_KEY === expectedApiKey;

    console.log('[shopify_auth_callback] hmac_check_start', {
      shop,
      hasSecret,
      secretLength,
      apiKeyPreview,
      apiKeyMatches,
      expectedApiKey,
    });

  if (!verifyShopifyCallbackHmac(params)) {
      console.error('[shopify_auth_callback] invalid_hmac', { 
        shop,
        hasSecret,
        secretLength,
        apiKeyPreview,
        apiKeyMatches,
        expectedApiKey,
        actualApiKey: process.env.SHOPIFY_API_KEY || 'NOT SET',
        message: apiKeyMatches 
          ? 'API key matches but HMAC failed - check that SHOPIFY_API_SECRET matches the secret from Partners Dashboard'
          : 'API key mismatch - update SHOPIFY_API_KEY to match the new app',
      });
      return NextResponse.json({ 
        error: 'Invalid HMAC',
        message: apiKeyMatches
          ? 'Security verification failed. Please ensure your API secret is correctly configured for the new app. Check that SHOPIFY_API_SECRET matches the Client secret from your Partners Dashboard.'
          : 'Configuration error. Please update SHOPIFY_API_KEY to match your new app (6e550b92f0cbfdf4cf543c83818f20fe).'
      }, { status: 400 });
    }
    
    console.log('[shopify_auth_callback] hmac_verified', { shop });
  } catch (e: any) {
    console.error('[shopify_auth_callback] hmac_verification_error', { 
      shop, 
      error: e?.message,
      hasSecret: !!process.env.SHOPIFY_API_SECRET,
      stack: e?.stack,
    });
    return NextResponse.json({ 
      error: 'HMAC verification error',
      message: 'Configuration error. Please check that SHOPIFY_API_SECRET is set correctly.'
    }, { status: 500 });
  }

  try {
    console.log('[shopify_auth_callback] exchanging_token_start', { shop });
    const { access_token } = await exchangeAccessToken(shop, code);
    console.log('[shopify_auth_callback] exchanging_token_success', { shop });

    console.log('[shopify_auth_callback] fetch_shop_start', { shop });
    const shopDetails = await fetchShopDetails(shop, access_token);
    console.log('[shopify_auth_callback] fetch_shop_success', { shop, shopId: String(shopDetails.id) });

    // Upsert to Supabase
    const supabase = getSupabaseServiceClient();
    console.log('[shopify_auth_callback] upsert_store_start', { shop, shopId: String(shopDetails.id) });
    const { error } = await supabase
      .from('shopify_stores')
      .upsert({
        store_domain: shop,
        shop_id: String(shopDetails.id),
        shop_name: shopDetails.name ?? null,
        shop_owner_email: shopDetails.email ?? null,
        access_token,
      }, { onConflict: 'store_domain' });
    if (error) throw error;
    console.log('[shopify_auth_callback] upsert_store_success', { shop, shopId: String(shopDetails.id) });

    // Register webhook (best-effort)
    try {
      console.log('[shopify_auth_callback] register_webhook_start', { shop });
      await registerUninstallWebhook(shop, access_token);
      console.log('[shopify_auth_callback] register_webhook_success', { shop });
    } catch (e) {
      console.warn('[shopify_auth_callback] register_webhook_failed', { shop, message: (e as any)?.message });
    }

    // Redirect immediately to the app with shop and host parameters
    // This ensures merchants are redirected to the embedded app UI after OAuth grant
    const qp = new URLSearchParams();
    qp.set('shop', shop);
    if (host) qp.set('host', host);
    const redirectUrl = `${process.env.SHOPIFY_APP_URL}/?${qp.toString()}`;
    console.log('[shopify_auth_callback] redirect_success', { shop, redirectUrl });
    
    // Use 302 redirect to ensure immediate redirect to grant screen
    return NextResponse.redirect(redirectUrl, { status: 302 });
  } catch (e: any) {
    const safeMessage = e?.message ? String(e.message).slice(0, 200) : 'Authentication failed. Please try installing the app again.';
    console.error('[shopify_auth_callback] error', { shop, message: safeMessage, error: e });
    
    // Provide clear, informative error messages
    let userFriendlyMessage = safeMessage;
    if (safeMessage.includes('Token exchange failed')) {
      userFriendlyMessage = 'Failed to authenticate with Shopify. Please try installing the app again.';
    } else if (safeMessage.includes('Invalid HMAC')) {
      userFriendlyMessage = 'Security verification failed. Please try installing the app again.';
    } else if (safeMessage.includes('Invalid OAuth state')) {
      userFriendlyMessage = 'Session expired. Please try installing the app again.';
    }
    
    // Prefer redirect back to app with an error indicator for better UX in embedded flows
    try {
      const qp = new URLSearchParams();
      if (shop) qp.set('shop', shop);
      if (host) qp.set('host', host!);
      qp.set('error', 'shopify_auth_failed');
      qp.set('error_message', encodeURIComponent(userFriendlyMessage));
      const redirectUrl = `${process.env.SHOPIFY_APP_URL}/?${qp.toString()}`;
      return NextResponse.redirect(redirectUrl, { status: 302 });
    } catch {
      return NextResponse.json(
        { 
          error: userFriendlyMessage,
          details: 'If this problem persists, please contact support or try reinstalling the app.'
        }, 
        { status: 500 }
      );
    }
  }
}


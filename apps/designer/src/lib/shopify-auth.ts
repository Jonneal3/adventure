import { getShopify } from './shopify';
import { NextRequest } from 'next/server';
import { getShopifyStore, getAccountForShopifyStore } from './shopify';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

/**
 * Verify Shopify session token from App Bridge
 * This validates that the request is coming from Shopify with a valid session
 */
export async function verifyShopifyRequest(request: NextRequest): Promise<{ 
  valid: boolean;
  shop?: string;
  sessionToken?: string;
  error?: string;
}> {
  try {
    const sessionToken = request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!sessionToken) {
      return { valid: false, error: 'No session token provided' };
    }

    // Decode and verify the App Bridge session token to extract the shop
    const shopify = getShopify();
    let shopFromToken: string | undefined;
    try {
      // decodeSessionToken throws if invalid/expired
      const payload: any = (shopify as any).utils?.decodeSessionToken
        ? (shopify as any).utils.decodeSessionToken(sessionToken)
        : null;
      const issuer: string | undefined = payload?.iss || payload?.dest; // e.g. https://{shop}.myshopify.com
      if (issuer) {
        const host = issuer.replace(/^https?:\/\//, '');
        // Ensure we return bare domain without protocol
        shopFromToken = host;
      }
    } catch (err) {
      return { valid: false, error: 'Invalid or expired session token' };
    }

    return { valid: true, sessionToken, shop: shopFromToken };
  } catch (error) {
    console.error('Shopify auth verification error:', error);
    return { valid: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Get shop domain from request (query param or header)
 */
export function getShopFromRequest(request: NextRequest): string | null {
  const url = new URL(request.url);
  const shop = url.searchParams.get('shop') || request.headers.get('x-shopify-shop-domain');
  return shop ? shop.replace('.myshopify.com', '').replace(/^https?:\/\//, '') : null;
}

/**
 * Authenticate user from Shopify session and link to Supabase if needed
 */
export async function authenticateShopifyUser(
  request: NextRequest,
  shopDomain: string
): Promise<{
  user: any;
  account: any;
  shopifyStore: any;
} | null> {
  try {
    // Verify Shopify session
    const verification = await verifyShopifyRequest(request);
    if (!verification.valid) {
      return null;
    }

    // Normalize shop domain
    const effectiveShop = (verification.shop || shopDomain || '').replace(/^https?:\/\//, '');
    if (!effectiveShop) {
      return null;
    }
    const normalizedDomain = effectiveShop.includes('.myshopify.com') 
      ? effectiveShop 
      : `${effectiveShop}.myshopify.com`;

    // Get Shopify store from database
    const shopifyStore = (await getShopifyStore(normalizedDomain)) as any;
    if (!shopifyStore) {
      return null;
    }

    // Get account linked to this store
    const account = await getAccountForShopifyStore((shopifyStore as any).id);
    
    if (!account) {
      // No account linked yet - user needs to link one
      return {
        user: null,
        account: null,
        shopifyStore,
      };
    }

    // Get Supabase user - try to find by shop owner email
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value;
          },
        },
      }
    );

    // Try to get user from session (if they're already logged in)
    const { data: { user } } = await supabase.auth.getUser();
    
    return {
      user,
      account,
      shopifyStore,
    };
  } catch (error) {
    console.error('Shopify authentication error:', error);
    return null;
  }
}

/**
 * Create Supabase session for Shopify user (if email matches)
 * Note: This is a helper - actual authentication should prompt for password
 */
export async function findSupabaseUserByEmail(
  shopOwnerEmail: string
): Promise<any | null> {
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Check if user exists with this email
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  
  if (error) {
    console.error('Error listing users:', error);
    return null;
  }

  const user = users.find(u => u.email === shopOwnerEmail);
  return user || null;
}


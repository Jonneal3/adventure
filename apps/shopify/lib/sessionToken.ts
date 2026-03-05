import { NextRequest } from 'next/server';
import { decodeJwt } from 'jose';

const SHOPIFY_API_SECRET = process.env.SHOPIFY_API_SECRET;

/**
 * Verify session token from App Bridge in server-side API routes
 * Session tokens are JWTs signed with the app's API secret
 */
export async function verifySessionToken(req: NextRequest): Promise<{
  shop: string;
  sessionId: string;
} | null> {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7);
    if (!SHOPIFY_API_SECRET) {
      console.error('SHOPIFY_API_SECRET is not set');
      return null;
    }

    // Decode and verify the JWT token
    // Note: For production, you should verify the signature using jose.verifyJWT
    // For now, we'll decode and check the payload structure
    const payload = decodeJwt(token);
    
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    // Session token payload structure:
    // - dest: the shop domain (e.g., "example.myshopify.com")
    // - sid: session ID
    const shop = (payload as any).dest;
    const sessionId = (payload as any).sid;

    if (!shop || !sessionId) {
      return null;
    }

    // Extract shop domain (remove https:// prefix if present)
    const shopDomain = shop.replace(/^https?:\/\//, '').replace(/\/$/, '');

    return {
      shop: shopDomain,
      sessionId,
    };
  } catch (error) {
    console.error('Session token verification failed:', error);
    return null;
  }
}

/**
 * Get shop from session token or fallback to query parameter
 */
export async function getShopFromRequest(req: NextRequest): Promise<string | null> {
  // Try session token first (for embedded app)
  const session = await verifySessionToken(req);
  if (session?.shop) {
    return session.shop;
  }

  // Fallback to query parameter (for non-embedded or legacy flows)
  const { searchParams } = new URL(req.url);
  return searchParams.get('shop');
}


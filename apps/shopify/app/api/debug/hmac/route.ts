import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint to check HMAC configuration
 * WARNING: Remove this in production or secure it properly
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const testHmac = searchParams.get('hmac');
  const testShop = searchParams.get('shop');

  const hasApiKey = !!process.env.SHOPIFY_API_KEY;
  const hasApiSecret = !!process.env.SHOPIFY_API_SECRET;
  const apiKeyPreview = process.env.SHOPIFY_API_KEY 
    ? `${process.env.SHOPIFY_API_KEY.substring(0, 8)}...${process.env.SHOPIFY_API_KEY.substring(process.env.SHOPIFY_API_KEY.length - 4)}`
    : 'NOT SET';
  const secretLength = process.env.SHOPIFY_API_SECRET?.length || 0;

  // Expected client ID from config
  const expectedClientId = '6e550b92f0cbfdf4cf543c83818f20fe';
  const apiKeyMatches = process.env.SHOPIFY_API_KEY === expectedClientId;

  return NextResponse.json({
    environment: {
      hasApiKey,
      hasApiSecret,
      apiKeyPreview,
      secretLength,
      apiKeyMatches,
      expectedClientId,
      actualApiKey: process.env.SHOPIFY_API_KEY || 'NOT SET',
    },
    test: {
      hasTestHmac: !!testHmac,
      hasTestShop: !!testShop,
    },
    message: apiKeyMatches 
      ? 'API Key matches expected value. If HMAC still fails, check that SHOPIFY_API_SECRET matches the secret from Partners Dashboard.'
      : `API Key mismatch! Expected: ${expectedClientId}, Got: ${process.env.SHOPIFY_API_KEY || 'NOT SET'}. Update SHOPIFY_API_KEY environment variable.`,
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}


import { NextRequest, NextResponse } from 'next/server';

/**
 * Debug endpoint to check recent errors and environment status
 * WARNING: Remove this in production or secure it properly
 */
export async function GET(req: NextRequest) {
  const hasApiKey = !!process.env.SHOPIFY_API_KEY;
  const hasApiSecret = !!process.env.SHOPIFY_API_SECRET;
  const apiKeyPreview = process.env.SHOPIFY_API_KEY 
    ? `${process.env.SHOPIFY_API_KEY.substring(0, 8)}...${process.env.SHOPIFY_API_KEY.substring(process.env.SHOPIFY_API_KEY.length - 4)}`
    : 'NOT SET';
  const secretLength = process.env.SHOPIFY_API_SECRET?.length || 0;

  // Expected client ID from config
  const expectedClientId = '6e550b92f0cbfdf4cf543c83818f20fe';
  const apiKeyMatches = process.env.SHOPIFY_API_KEY === expectedClientId;
  const actualApiKey = process.env.SHOPIFY_API_KEY || 'NOT SET';

  // Check if NEXT_PUBLIC_SHOPIFY_API_KEY matches
  const publicApiKeyMatches = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY === expectedClientId;
  const hasPublicApiKey = !!process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;

  return NextResponse.json({
    status: apiKeyMatches && hasApiSecret && publicApiKeyMatches ? 'OK' : 'CONFIGURATION_ERROR',
    environment: {
      hasApiKey,
      hasApiSecret,
      hasPublicApiKey,
      apiKeyPreview,
      secretLength,
      apiKeyMatches,
      publicApiKeyMatches,
      expectedClientId,
      actualApiKey,
      actualPublicApiKey: process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || 'NOT SET',
    },
    issues: [
      !hasApiKey && 'SHOPIFY_API_KEY is not set',
      !hasApiSecret && 'SHOPIFY_API_SECRET is not set',
      !hasPublicApiKey && 'NEXT_PUBLIC_SHOPIFY_API_KEY is not set',
      !apiKeyMatches && `SHOPIFY_API_KEY mismatch. Expected: ${expectedClientId}, Got: ${actualApiKey}`,
      !publicApiKeyMatches && `NEXT_PUBLIC_SHOPIFY_API_KEY mismatch. Expected: ${expectedClientId}, Got: ${process.env.NEXT_PUBLIC_SHOPIFY_API_KEY || 'NOT SET'}`,
      secretLength === 0 && 'SHOPIFY_API_SECRET is empty',
      secretLength > 0 && secretLength < 20 && 'SHOPIFY_API_SECRET seems too short (should be 32+ characters)',
    ].filter(Boolean),
    message: apiKeyMatches && hasApiSecret && publicApiKeyMatches
      ? '✅ All environment variables are correctly configured!'
      : '❌ Environment variables need to be updated. See issues above.',
    fixSteps: !apiKeyMatches || !hasApiSecret || !publicApiKeyMatches ? [
      '1. Go to Vercel → Your Project → Settings → Environment Variables',
      '2. Update SHOPIFY_API_KEY to: 6e550b92f0cbfdf4cf543c83818f20fe',
      '3. Update SHOPIFY_API_SECRET to: (get from Partners Dashboard)',
      '4. Update NEXT_PUBLIC_SHOPIFY_API_KEY to: 6e550b92f0cbfdf4cf543c83818f20fe',
      '5. Redeploy after updating',
    ] : [],
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}


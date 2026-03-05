// HMAC verification functions require Node.js crypto (only used in API routes)
// Use lazy require to avoid Edge Runtime issues (middleware imports this file)
let nodeCrypto: typeof import('crypto') | null = null;
function getNodeCrypto() {
  if (!nodeCrypto) {
    // Lazy load - only when actually needed (in Node.js runtime)
    nodeCrypto = require('crypto');
  }
  return nodeCrypto;
}

// generateState: Works in both Node.js and Edge Runtime
// Uses Web Crypto API which is available in both environments
export function generateState(length = 32): string {
  // Use Web Crypto API (available in both Node.js and Edge Runtime)
  const array = new Uint8Array(length);
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  } else if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    // Fallback for environments where globalThis isn't available
    (crypto as any).getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  } else {
    throw new Error('Crypto API not available');
  }
}

export function verifyShopifyCallbackHmac(urlSearchParams: URLSearchParams): boolean {
  const secret = process.env.SHOPIFY_API_SECRET as string;
  if (!secret) {
    console.error('[HMAC] SHOPIFY_API_SECRET is missing');
    throw new Error('SHOPIFY_API_SECRET missing');
  }

  const hmac = urlSearchParams.get('hmac');
  if (!hmac) {
    console.warn('[HMAC] No HMAC parameter found in callback');
    return false;
  }

  // Build the message string for HMAC verification
  // Shopify expects: sorted key=value pairs (excluding hmac and signature), URL-encoded
  // Note: URLSearchParams already decodes values, so we need to re-encode them for HMAC
  const message = Array.from(urlSearchParams.entries())
    .filter(([key]) => key !== 'hmac' && key !== 'signature')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => {
      // Values from URLSearchParams are already decoded, so encode them
      // Handle null/undefined values
      const value = v || '';
      return `${k}=${encodeURIComponent(value)}`;
    })
    .join('&');

  const crypto = getNodeCrypto();
  const computed = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  // Use timing-safe comparison
  const isValid = crypto.timingSafeEqual(
    Buffer.from(computed, 'utf-8'), 
    Buffer.from(hmac, 'utf-8')
  );

  if (!isValid) {
    console.warn('[HMAC] Verification failed', {
      hasSecret: !!secret,
      secretLength: secret.length,
      messageLength: message.length,
      computedLength: computed.length,
      receivedLength: hmac.length,
      // Don't log actual values for security
    });
  }

  return isValid;
}

export async function verifyShopifyWebhookHmac(rawBody: string, hmacHeader: string | null): Promise<boolean> {
  if (!hmacHeader) return false;
  const secret = process.env.SHOPIFY_API_SECRET as string;
  if (!secret) throw new Error('SHOPIFY_API_SECRET missing');
  const crypto = getNodeCrypto();
  const computed = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
  try {
    return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(hmacHeader));
  } catch {
    return false;
  }
}

import createApp from '@shopify/app-bridge';
import { getSessionToken as getAppBridgeSessionToken } from '@shopify/app-bridge/utilities';

let appBridgeInstance: ReturnType<typeof createApp> | null = null;

export function getAppBridge() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (appBridgeInstance) {
    return appBridgeInstance;
  }

  // Note: This should be the same as SHOPIFY_API_KEY but exposed to the client
  // For security, only the API key (not secret) should be in NEXT_PUBLIC_ variables
  const apiKey = process.env.NEXT_PUBLIC_SHOPIFY_API_KEY;
  if (!apiKey) {
    console.warn('NEXT_PUBLIC_SHOPIFY_API_KEY is not set. App Bridge will not work properly.');
    return null;
  }

  // Get shop and host from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const shop = urlParams.get('shop');
  const host = urlParams.get('host');

  if (!shop || !host) {
    console.warn('Missing shop or host parameters for App Bridge');
    return null;
  }

  appBridgeInstance = createApp({
    apiKey,
    host,
    forceRedirect: true,
  });

  return appBridgeInstance;
}

export async function getSessionToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const app = getAppBridge();
  if (!app) {
    return null;
  }

  try {
    const token = await getAppBridgeSessionToken(app);
    return token;
  } catch (error) {
    console.error('Failed to get session token:', error);
    return null;
  }
}


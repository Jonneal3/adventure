"use client";

type AppBridgeApp = any;

// Cache App Bridge instances per host to avoid stale context between stores/tabs
const appBridgeInstances: Record<string, AppBridgeApp> = {};

export async function getAppBridge(shop: string, host?: string): Promise<AppBridgeApp> {
  if (typeof window === 'undefined') {
    throw new Error('getAppBridge must be called in the browser');
  }

  // Derive host from URL if not provided
  if (!host) {
    const params = new URLSearchParams(window.location.search);
    host = params.get('host') || undefined;
  }

  const cacheKey = host || 'default';
  if (appBridgeInstances[cacheKey]) return appBridgeInstances[cacheKey];

  const createApp = (await import('@shopify/app-bridge')).default as any;
  const apiKey =
    process.env.NEXT_PUBLIC_SHOPIFY_CLIENT_ID ||
    process.env.NEXT_PUBLIC_SHOPIFY_API_KEY ||
    process.env.SHOPIFY_CLIENT_ID ||
    '';

  if (!apiKey || !host) {
    console.error('App Bridge init missing config', { hasApiKey: !!apiKey, hasHost: !!host });
    throw new Error('Missing App Bridge apiKey/host');
  }

  const app = createApp({
    apiKey,
    host,
    forceRedirect: true,
  });
  appBridgeInstances[cacheKey] = app;
  return app;
}

export async function getShopifySessionToken(app: AppBridgeApp): Promise<string> {
  const { getSessionToken } = await import('@shopify/app-bridge/utilities');
  return await getSessionToken(app);
}

export async function fetchShopifyApi(input: string, init: RequestInit & { shop?: string; host?: string } = {}) {
  const url = new URL(input, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  const shop = init.shop || url.searchParams.get('shop') || '';
  const host = init.host || url.searchParams.get('host') || undefined;
  if (!url.searchParams.get('shop') && shop) url.searchParams.set('shop', shop);
  if (!url.searchParams.get('host') && host) url.searchParams.set('host', host);

  const app = await getAppBridge(shop, host);
  const token = await getShopifySessionToken(app);

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');

  return fetch(url.toString(), { ...init, headers });
}



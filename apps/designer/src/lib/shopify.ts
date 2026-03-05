import '@shopify/shopify-api/adapters/node';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Lazy-initialize Shopify API client to avoid requiring envs at build time
let shopifyInstance: ReturnType<typeof shopifyApi> | null = null;
export function getShopify() {
  if (shopifyInstance) return shopifyInstance;

  const apiKey = process.env.SHOPIFY_CLIENT_ID;
  const apiSecretKey = process.env.SHOPIFY_CLIENT_SECRET;
  const hostName = process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, '')
    || process.env.NEXT_PUBLIC_SITE_URL?.replace(/https?:\/\//, '')
    || 'adventure.app';

  if (!apiKey || !apiSecretKey) {
    throw new Error('Missing SHOPIFY_CLIENT_ID or SHOPIFY_CLIENT_SECRET');
  }

  shopifyInstance = shopifyApi({
    apiKey,
    apiSecretKey,
    scopes: process.env.SHOPIFY_SCOPES?.split(',') || ['read_products'],
    hostName,
    apiVersion: LATEST_API_VERSION,
    isEmbeddedApp: true,
  });
  return shopifyInstance;
}

// Get Shopify store info from database
export async function getShopifyStore(storeDomain: string) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await (supabase as any)
    .from('shopify_stores')
    .select('*')
    .eq('store_domain', storeDomain)
    .single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
  return data;
}

// Get Shopify store by ID
export async function getShopifyStoreById(storeId: string) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await (supabase as any)
    .from('shopify_stores')
    .select('*')
    .eq('id', storeId)
    .single();

  if (error) throw error;
  return data;
}

// Create or update Shopify store in database
export async function upsertShopifyStore(data: {
  store_domain: string;
  shop_id: string;
  shop_name?: string;
  shop_owner_email?: string;
  access_token: string;
}) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: store, error } = await (supabase as any)
    .from('shopify_stores')
    .upsert(
      {
        ...data,
        installed_at: new Date().toISOString(),
      },
      {
        onConflict: 'store_domain',
      }
    )
    .select()
    .single();

  if (error) throw error;
  return store;
}

// Get account linked to a Shopify store
export async function getAccountForShopifyStore(shopifyStoreId: string) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await (supabase as any)
    .from('accounts_shopify')
    .select(`
      account_id,
      accounts (
        id,
        name,
        slug,
        description,
        created_at,
        updated_at
      )
    `)
    .eq('shopify_store_id', shopifyStoreId)
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  return (data as any)?.accounts || null;
}

// Link account to Shopify store
export async function linkAccountToShopifyStore(accountId: string, shopifyStoreId: string) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await (supabase as any)
    .from('accounts_shopify')
    .upsert(
      {
        account_id: accountId,
        shopify_store_id: shopifyStoreId,
        is_active: true,
      },
      {
        onConflict: 'account_id,shopify_store_id',
      }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Unlink account from Shopify store
export async function unlinkAccountFromShopifyStore(accountId: string, shopifyStoreId: string) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await (supabase as any)
    .from('accounts_shopify')
    .update({ is_active: false })
    .eq('account_id', accountId)
    .eq('shopify_store_id', shopifyStoreId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Get Shopify stores linked to an account
export async function getShopifyStoresForAccount(accountId: string) {
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await (supabase as any)
    .from('accounts_shopify')
    .select('shopify_stores(*)')
    .eq('account_id', accountId)
    .eq('is_active', true);

  if (error) throw error;
  return data?.map((item: any) => item.shopify_stores) || [];
}

// Create Shopify GraphQL client from stored access token
// Use this when you need to make Shopify API calls from your app
export async function getShopifyGraphQLClient(storeDomain: string) {
  const normalizedDomain = storeDomain.includes('.myshopify.com')
    ? storeDomain
    : `${storeDomain}.myshopify.com`;

  // Get store from database (includes access_token)
  const shopifyStore = await getShopifyStore(normalizedDomain);
  if (!shopifyStore || !shopifyStore.access_token) {
    throw new Error(`Shopify store not found or missing access token: ${normalizedDomain}`);
  }

  // Create a session object from stored credentials
  // The Shopify SDK needs a Session object to create a client
  const session = {
    id: `offline_${shopifyStore.store_domain}`,
    shop: normalizedDomain,
    state: 'offline',
    isOnline: false,
    accessToken: shopifyStore.access_token,
    scope: process.env.SHOPIFY_SCOPES || 'read_products,write_products',
  };

  // Create and return GraphQL client
  const shopify = getShopify();
  return new shopify.clients.Graphql({ session: session as any });
}

// Create Shopify REST client from stored access token
// Use this for REST API calls (alternative to GraphQL)
export async function getShopifyRESTClient(storeDomain: string) {
  const normalizedDomain = storeDomain.includes('.myshopify.com')
    ? storeDomain
    : `${storeDomain}.myshopify.com`;

  // Get store from database (includes access_token)
  const shopifyStore = await getShopifyStore(normalizedDomain);
  if (!shopifyStore || !shopifyStore.access_token) {
    throw new Error(`Shopify store not found or missing access token: ${normalizedDomain}`);
  }

  // Create a session object from stored credentials
  const session = {
    id: `offline_${shopifyStore.store_domain}`,
    shop: normalizedDomain,
    state: 'offline',
    isOnline: false,
    accessToken: shopifyStore.access_token,
    scope: process.env.SHOPIFY_SCOPES || 'read_products,write_products',
  };

  // Create and return REST client
  const shopify = getShopify();
  return new shopify.clients.Rest({ session: session as any });
}

// Helper to check if store has valid credentials
export async function hasValidShopifyCredentials(storeDomain: string): Promise<boolean> {
  try {
    const normalizedDomain = storeDomain.includes('.myshopify.com')
      ? storeDomain
      : `${storeDomain}.myshopify.com`;

    const shopifyStore = await getShopifyStore(normalizedDomain);
    if (!shopifyStore || !shopifyStore.access_token) {
      return false;
    }

    // Optionally test the token by making a lightweight API call
    // For now, just check if token exists
    return !!shopifyStore.access_token;
  } catch (error) {
    console.error('Error checking Shopify credentials:', error);
    return false;
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/server/logger';

export const dynamic = 'force-dynamic';

function normalizeHost(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const trimmed = input.trim();
    const withoutProtocol = trimmed.replace(/^https?:\/\//i, '');
    const host = withoutProtocol.split('/')[0].toLowerCase();
    return host;
  } catch {
    return input.toLowerCase();
  }
}

function normalizeImageUrl(input: string): string | null {
  if (typeof input !== 'string' || input.length === 0) return null;
  let url = input.trim();
  if (url.startsWith('//')) url = `https:${url}`;
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}${u.search}`;
  } catch {
    // Fallback: ensure protocol; retain query if present
    let out = url.split('#')[0];
    if (out.startsWith('//')) out = `https:${out}`;
    if (!/^https?:\/\//i.test(out)) out = `https://${out}`;
    return out;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  try {
    const startedAt = Date.now();
    const url = new URL(request.url);
    const shopParam = url.searchParams.get('shop');
    const productId = url.searchParams.get('product_id');
    const limitParam = url.searchParams.get('limit');
    let limit = Number.parseInt(limitParam || '', 10);
    if (!Number.isFinite(limit) || limit <= 0) limit = 12;
    if (limit > 24) limit = 24; // server-side cap
    logger.info('🟦 [SIF IMG] Incoming', {
      instanceId: params.instanceId,
      shopParam,
      productId,
      path: url.pathname
    });
    if (!shopParam || !productId) {
      logger.warn('🟥 [SIF IMG] Missing params', { hasShop: !!shopParam, hasProductId: !!productId });
      return NextResponse.json({ error: 'Missing shop or product_id' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) {
      logger.error('🟥 [SIF IMG] Server config missing', { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey });
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1) Resolve instance → account
    const { data: instance, error: instErr } = await supabase
      .from('instances')
      .select('id, account_id')
      .eq('id', params.instanceId)
      .single();
    if (instErr || !instance) {
      logger.warn('🟥 [SIF IMG] Instance not found', { instanceId: params.instanceId, error: instErr?.message });
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }
    const accountId = (instance as any).account_id as string | null;
    if (!accountId) {
      logger.warn('🟥 [SIF IMG] Missing account_id on instance', { instanceId: params.instanceId });
      return NextResponse.json({ error: 'Instance missing account_id' }, { status: 404 });
    }
    logger.info('🟦 [SIF IMG] Resolved instance', { instanceId: params.instanceId, accountId });

    // 2) Find Shopify credentials for this account.
    // Try common schemas/columns defensively.
    const shopHost = normalizeHost(shopParam);
    logger.info('🟦 [SIF IMG] Normalized shop', { shopParam, shopHost });
    let storeRow: any = null;
    // Preferred: join via accounts_shopify -> shopify_stores by account_id, then match domain
    try {
      const { data: accShops, error: accErr } = await (supabase as any)
        .from('accounts_shopify')
        .select('shopify_stores(*)')
        .eq('account_id', accountId);
      if (!accErr && Array.isArray(accShops) && accShops.length) {
        const candidates = accShops
          .map((r: any) => r?.shopify_stores)
          .filter(Boolean);
        const match = candidates.find((row: any) => normalizeHost(row?.store_domain) === shopHost)
          || candidates.find((row: any) => normalizeHost((row as any)?.shop_domain) === shopHost)
          || candidates[0];
        if (match) {
          logger.info('🟦 [SIF IMG] accounts_shopify join → shopify_stores match', { count: candidates.length });
          storeRow = match;
        }
      }
    } catch (_) {}
    // Direct query against canonical table by domain (schema does not include account_id)
    try {
      const { data: byDomain, error: byDomainErr } = await (supabase as any)
        .from('shopify_stores' as any)
        .select('*')
        .or(`store_domain.eq.${shopHost},shop_domain.eq.${shopHost},domain.eq.${shopHost},shop.eq.${shopHost}`)
        .limit(1)
        .maybeSingle?.() ?? {};
      if (byDomain && !byDomainErr) {
        logger.info('🟦 [SIF IMG] shopify_stores domain match');
        storeRow = byDomain;
      }
    } catch (_) {}
    // No env-based fallbacks: only use canonical table `shopify_stores`.

    // Gather token candidates - prioritize storefront tokens, then admin tokens
    const storefrontTokenColumns = [
      'storefront_token',
      'storefront_access_token',
      'public_storefront_token',
      'storefront_public_token',
      'storefront_api_token'
    ];
    const adminTokenColumns = [
      'token',
      'access_token'
    ];
    let storefrontToken: string | null = null;
    let adminToken: string | null = null;
    let tokenSourceCol: string | null = null;
    if (storeRow) {
      // First, try to find a storefront token
      for (const col of storefrontTokenColumns) {
        const val = storeRow?.[col];
        if (typeof val === 'string' && val.trim().length > 0) {
          storefrontToken = val;
          tokenSourceCol = col;
          break;
        }
      }
      // If no storefront token, look for admin token
      if (!storefrontToken) {
        for (const col of adminTokenColumns) {
          const val = storeRow?.[col];
          if (typeof val === 'string' && val.trim().length > 0) {
            adminToken = val;
            tokenSourceCol = col;
            break;
          }
        }
      }
    }
    // Use admin token as fallback if no storefront token
    if (!storefrontToken && adminToken) {
      storefrontToken = adminToken;
    }

    if (!storeRow || !storefrontToken) {
      logger.warn('🟥 [SIF IMG] No store/token', { hasStoreRow: !!storeRow, hasToken: !!storefrontToken });
      return NextResponse.json({ error: 'Storefront token not found for account/shop' }, { status: 404 });
    }
    const maskToken = (t: string | null) => (typeof t === 'string' && t.length >= 8) ? `${t.slice(0,4)}...${t.slice(-4)}` : (t || null);
    logger.info('🟦 [SIF IMG] Store row resolved', {
      shopHost,
      hasToken: !!storefrontToken,
      hasAdminToken: !!adminToken,
      tokenSourceCol,
      tokenPreview: maskToken(storefrontToken),
      adminTokenPreview: maskToken(adminToken),
      productId,
      matchedFields: Object.keys(storeRow || {}).filter(k => /domain|shop/i.test(k)).reduce((acc: any, k) => (acc[k] = storeRow[k], acc), {})
    });

    // Prefer Admin API if the token is clearly an Admin OAuth token
    const looksAdminToken = adminToken && ((adminToken || '').startsWith('shpat_') || tokenSourceCol === 'access_token' || tokenSourceCol === 'token');
    const shopDomain = shopHost!;
    if (looksAdminToken && adminToken) {
      try {
        const tokenPrefix = (adminToken || '').substring(0, 5);
        const tokenStartsWith = (adminToken || '').substring(0, 6);
        logger.info('🟦 [SIF IMG] Using Admin API (detected admin token)', { 
          tokenSourceCol, 
          tokenPrefix,
          tokenStartsWith,
          tokenLength: adminToken?.length,
          shopDomain,
          productId,
          isShpat: (adminToken || '').startsWith('shpat_'),
          isShpca: (adminToken || '').startsWith('shpca_'),
          isShpcf: (adminToken || '').startsWith('shpcf_')
        });
        
        // Try 2024-10 first, then fallback to latest stable if needed
        let adminRes = await fetch(`https://${shopDomain}/admin/api/2024-10/products/${encodeURIComponent(productId!)}.json`, {
          headers: {
            'X-Shopify-Access-Token': adminToken as string,
            'Content-Type': 'application/json'
          }
        });
        
        // If 401 and token doesn't look like standard admin token, try latest API version
        if (!adminRes.ok && adminRes.status === 401 && !(adminToken || '').startsWith('shpat_') && !(adminToken || '').startsWith('shpca_')) {
          logger.info('🟨 [SIF IMG] Trying latest API version due to 401 with non-standard token prefix');
          adminRes = await fetch(`https://${shopDomain}/admin/api/2025-01/products/${encodeURIComponent(productId!)}.json`, {
            headers: {
              'X-Shopify-Access-Token': adminToken as string,
              'Content-Type': 'application/json'
            }
          });
        }
        if (!adminRes.ok) {
          const adminText = await adminRes.text().catch(() => '');
          const adminJson = await adminRes.json().catch(() => null);
          logger.warn('🟥 [SIF IMG] Admin API failed', { 
            status: adminRes.status, 
            statusText: adminRes.statusText,
            bodySnippet: adminText?.slice(0, 200),
            fullError: adminJson || adminText,
            url: `https://${shopDomain}/admin/api/2024-10/products/${encodeURIComponent(productId!)}.json`,
            productId,
            shopDomain,
            tokenPrefix,
            tokenSourceCol,
            adminTokenPreview: maskToken(adminToken),
            headers: Object.fromEntries(adminRes.headers.entries())
          });
          // Don't fall through to Storefront API if we only have admin token
          if (!storefrontToken || storefrontToken === adminToken) {
            return NextResponse.json({ 
              error: 'Admin API failed and no storefront token available', 
              status: adminRes.status,
              details: adminJson || adminText?.slice(0, 500),
              tokenPrefix,
              diagnostic: {
                shopDomain,
                productId,
                tokenSource: tokenSourceCol,
                tokenLength: adminToken?.length
              }
            }, { status: adminRes.status });
          }
        } else {
          const adminJson = await adminRes.json().catch(() => null);
          const productImages = (((adminJson as any)?.product?.images) || [])
            .map((img: any) => img?.src || img?.url || null)
            .filter((u: any) => typeof u === "string" && u.length > 0)
            .map((u: string) => normalizeImageUrl(u))
            .filter((u: string | null): u is string => !!u);
          const productMeta = {
            title: (adminJson as any)?.product?.title || null,
            description: (adminJson as any)?.product?.body_html || null,
            priceMin: (() => {
              try {
                const variants = ((adminJson as any)?.product?.variants) || [];
                const prices = variants.map((v: any) => parseFloat(v?.price)).filter((n: any) => Number.isFinite(n));
                if (prices.length === 0) return null;
                return prices.reduce((a: number, b: number) => Math.min(a, b), prices[0]).toString();
              } catch { return null; }
            })(),
            priceMax: (() => {
              try {
                const variants = ((adminJson as any)?.product?.variants) || [];
                const prices = variants.map((v: any) => parseFloat(v?.price)).filter((n: any) => Number.isFinite(n));
                if (prices.length === 0) return null;
                return prices.reduce((a: number, b: number) => Math.max(a, b), prices[0]).toString();
              } catch { return null; }
            })(),
            currency: null as string | null
          };
          // Also fetch explicit images endpoint to ensure we capture all
          let endpointImages: string[] = [];
          try {
            const imagesRes = await fetch(`https://${shopDomain}/admin/api/2024-10/products/${encodeURIComponent(productId!)}/images.json`, {
              headers: {
                'X-Shopify-Access-Token': adminToken as string,
                'Content-Type': 'application/json'
              }
            });
            if (imagesRes.ok) {
              const imagesJson = await imagesRes.json().catch(() => null);
              endpointImages = (((imagesJson as any)?.images) || [])
                .map((img: any) => img?.src || img?.url || null)
                .filter((u: any) => typeof u === "string" && u.length > 0)
                .map((u: string) => normalizeImageUrl(u))
                .filter((u: string | null): u is string => !!u);
            } else {
              const t = await imagesRes.text().catch(() => '');
              logger.warn('🟨 [SIF IMG] Admin images endpoint failed', { status: imagesRes.status, bodySnippet: t?.slice(0, 200) });
            }
          } catch (e: any) {
            logger.warn('🟨 [SIF IMG] Admin images endpoint exception', { message: e?.message });
          }
          const combined = Array.from(new Set([...(productImages || []), ...(endpointImages || [])]));
          const dedup = combined.slice(0, limit);
          logger.info('🟩 [SIF IMG] Admin API success', { imagesCount: dedup.length, rawProductCount: productImages.length, rawEndpointCount: endpointImages.length, firstImages: dedup.slice(0, 3), ms: Date.now() - startedAt });
          return NextResponse.json({ images: dedup, product: productMeta });
        }
      } catch (e: any) {
        logger.warn('🟥 [SIF IMG] Admin API exception', { message: e?.message });
        // Don't fall through to Storefront API if we only have admin token
        if (!storefrontToken || storefrontToken === adminToken) {
          return NextResponse.json({ error: 'Admin API failed and no storefront token available', details: (e as any)?.message }, { status: 500 });
        }
      }
      // If admin path failed but we have a storefront token, continue to Storefront API
    }

    // 3) Fetch product images via Storefront API (only if we have a storefront token)
    if (!storefrontToken || storefrontToken === adminToken) {
      return NextResponse.json({ error: 'No storefront access token available. Admin token cannot be used with Storefront API.' }, { status: 401 });
    }
    const gid = `gid://shopify/Product/${productId}`;
    const query = `
      query ProductImages($id: ID!) {
        product(id: $id) {
          title
          description
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
          images(first: 24) { edges { node { url altText } } }
        }
      }
    `;
    logger.info('🟦 [SIF IMG] Fetching Shopify', { shopDomain, gid });
    const res = await fetch(`https://${shopDomain}/api/2024-10/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": storefrontToken
      },
      body: JSON.stringify({ query, variables: { id: gid } })
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      logger.warn('🟥 [SIF IMG] Shopify fetch failed', { status: res.status, bodySnippet: text?.slice(0, 200) });
      // Optional Admin API fallback if the token appears to be an Admin token or explicitly allowed
      const allowAdminFallback = (process.env.SIF_SHOPIFY_ALLOW_ADMIN_FALLBACK === 'true');
      const looksAdminToken = (storefrontToken || '').startsWith('shpat_') || tokenSourceCol === 'access_token' || tokenSourceCol === 'token';
      if (allowAdminFallback && (res.status === 401 || res.status === 403) && looksAdminToken) {
        try {
          logger.info('🟨 [SIF IMG] Trying Admin API fallback');
          const adminRes = await fetch(`https://${shopDomain}/admin/api/2024-10/products/${encodeURIComponent(productId!)}.json`, {
            headers: {
              'X-Shopify-Access-Token': storefrontToken as string,
              'Content-Type': 'application/json'
            }
          });
          if (!adminRes.ok) {
            const adminText = await adminRes.text().catch(() => '');
            logger.warn('🟥 [SIF IMG] Admin fallback failed', { status: adminRes.status, bodySnippet: adminText?.slice(0, 200) });
            return NextResponse.json({ error: 'Shopify fetch failed', status: res.status, body: text }, { status: 502 });
          }
          const adminJson = await adminRes.json().catch(() => null);
          const restRaw = (((adminJson as any)?.product?.images) || [])
            .map((img: any) => img?.src || img?.url || null)
            .filter((u: any) => typeof u === "string" && u.length > 0)
            .map((u: string) => normalizeImageUrl(u))
            .filter((u: string | null): u is string => !!u);
          const dedup = Array.from(new Set(restRaw)).slice(0, limit);
          logger.info('🟩 [SIF IMG] Admin fallback success', { imagesCount: dedup.length, rawCount: restRaw.length, limit, firstImages: dedup.slice(0, 3), ms: Date.now() - startedAt });
          return NextResponse.json({ images: dedup });
        } catch (e: any) {
          logger.warn('🟥 [SIF IMG] Admin fallback exception', { message: e?.message });
          return NextResponse.json({ error: 'Shopify fetch failed', status: res.status, body: text }, { status: 502 });
        }
      }
      return NextResponse.json({ error: 'Shopify fetch failed', status: res.status, body: text }, { status: 502 });
    }
    const json = await res.json().catch(() => null);
    const rawUrls = (((json as any)?.data?.product?.images?.edges) || [])
      .map((e: any) => e?.node?.url || null)
      .filter((u: any) => typeof u === "string" && u.length > 0)
      .map((u: string) => normalizeImageUrl(u))
      .filter((u: string | null): u is string => !!u);
    const dedup = Array.from(new Set(rawUrls)).slice(0, limit);
    const p = (json as any)?.data?.product;
    const productMeta = p ? {
      title: p?.title || null,
      description: p?.description || null,
      priceMin: p?.priceRangeV2?.minVariantPrice?.amount || null,
      priceMax: p?.priceRangeV2?.maxVariantPrice?.amount || null,
      currency: p?.priceRangeV2?.minVariantPrice?.currencyCode || p?.priceRangeV2?.maxVariantPrice?.currencyCode || null
    } : null;
    logger.info('🟩 [SIF IMG] Success', { imagesCount: dedup.length, rawCount: rawUrls.length, limit, firstImages: dedup.slice(0, 3), ms: Date.now() - startedAt });

    return NextResponse.json({ images: dedup, product: productMeta });
  } catch (e) {
    logger.error('🟥 [SIF IMG] Unhandled error', { message: (e as any)?.message });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface ShopifyProductContext {
  shop?: string;
  productId?: string;
  productGid?: string;
  productHandle?: string;
  productTitle?: string;
  productDescription?: string;
  productPriceMin?: string;
  productPriceMax?: string;
  productCurrency?: string;
  images?: string[];
  // True if we detect likely Shopify embed via params or postMessage
  isShopify?: boolean;
}

const ShopifyContext = React.createContext<ShopifyProductContext | null>(null);

const WIDGET_ORIGINS = new Set(
  [
    process.env.NEXT_PUBLIC_WIDGET_ORIGIN,
    // Current branding
    "https://widget.adventure.app",
    "https://adventure.app",
  ].filter((x): x is string => typeof x === "string" && x.length > 0)
);

function parseSearchParams(): ShopifyProductContext {
  if (typeof window === "undefined") return {};
  const sp = new URLSearchParams(window.location.search);
  // Parse optional images param for standalone testing: supports JSON array or comma-separated URLs
  const rawImages = sp.get("images") || sp.get("sif_images") || undefined;
  // Explicit Shopify flag
  const shopifyFlagRaw = sp.get("sif_shopify");
  const shopifyFlag = typeof shopifyFlagRaw === "string"
    ? ["1", "true", "yes", "on"].includes(shopifyFlagRaw.toLowerCase())
    : false;
  let parsedImages: string[] | undefined = undefined;
  if (rawImages) {
    try {
      // 1) Try base64(JSON.stringify(string[]))
      try {
        const b64 = typeof atob === "function" ? atob(rawImages) : rawImages;
        const arr = JSON.parse(b64);
        if (Array.isArray(arr)) {
          parsedImages = arr.filter((x) => typeof x === "string" && x.length > 0);
        }
      } catch {
        // 2) Fallback: direct JSON array or CSV
        const decoded = rawImages;
        if (decoded.trim().startsWith("[") || decoded.includes('","')) {
          const arr = JSON.parse(decoded);
          if (Array.isArray(arr)) {
            parsedImages = arr.filter((x) => typeof x === "string" && x.length > 0);
          }
        } else {
          parsedImages = decoded.split(",").map(s => s.trim()).filter(Boolean);
        }
      }
    } catch {
      // ignore parse errors
    }
  }
  const ctx: ShopifyProductContext = {
    shop: sp.get("shop") || undefined,
    productId: sp.get("product_id") || undefined,
    productGid: sp.get("product_gid") || undefined,
    productHandle: sp.get("product_handle") || undefined,
    productTitle: sp.get("product_title") || undefined,
    images: parsedImages
  };
  if (shopifyFlag || ctx.shop || ctx.productId || ctx.productGid || ctx.productHandle || ctx.productTitle || (parsedImages && parsedImages.length)) {
    ctx.isShopify = true;
  }
  return ctx;
}

function isAllowedMessageOrigin(origin: string, expectedShop?: string | undefined): boolean {
  try {
    // Always allow our own widget origin
    if (WIDGET_ORIGINS.has(origin)) return true;
    // Allow localhost for dev
    if (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1") || origin.startsWith("https://127.0.0.1")) {
      return true;
    }
    // Allow Shopify storefronts (*.myshopify.com) or custom domain matching `shop` param
    const url = new URL(origin);
    const host = url.hostname.toLowerCase();
    if (host.endsWith(".myshopify.com")) return true;
    if (expectedShop) {
      const expected = expectedShop.toLowerCase().replace(/^https?:\/\//, "");
      if (host === expected || host.endsWith("." + expected)) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function ShopifyProvider({ children }: { children: React.ReactNode }) {
  const [context, setContext] = useState<ShopifyProductContext>(() => parseSearchParams());
  const sentServerLogRef = useRef(false);
  const fetchedForProductRef = useRef<string | null>(null);
  const shouldServerLog = useMemo(() => {
    if (typeof window === "undefined") return false;
    const sp = new URLSearchParams(window.location.search);
    return sp.get("sif_debug_server") === "true" || sp.get("sif_log") === "true" || sp.get("debug_server") === "true";
  }, []);

  const postServerDebug = useCallback(async (payload: any) => {
    try {
      await fetch("/api/debug/shopify-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } catch {}
  }, []);

  const updateImages = useCallback((urls: unknown) => {
    const toUrl = (x: any): string | null => {
      if (x && typeof x === "object" && "src" in x) return String(x.src);
      if (x && typeof x === "object" && "url" in x) return String(x.url);
      if (typeof x === "string") return x;
      return null;
    };
    const normalize = (u: string): string | null => {
      if (!u) return null;
      let s = u.trim();
      if (s.startsWith("//")) s = `https:${s}`;
      try {
        const parsed = new URL(s);
        return `${parsed.origin}${parsed.pathname}${parsed.search}`;
      } catch {
        let out = s.split("#")[0];
        if (out.startsWith("//")) out = `https:${out}`;
        if (!/^https?:\/\//i.test(out)) out = `https://${out}`;
        return out;
      }
    };
    const incoming = Array.isArray(urls) ? urls.map(toUrl).filter(Boolean) as string[] : [];
    const normalized = incoming.map(normalize).filter((x): x is string => Boolean(x));
    if (normalized.length > 0) {
      setContext((prev) => {
        const existing = Array.isArray(prev.images) ? prev.images.map(normalize).filter((x): x is string => !!x) : [];
        const dedup = Array.from(new Set([...existing, ...normalized]));
        return { ...prev, images: dedup, isShopify: prev.isShopify ?? true };
      });
    }
  }, []);

  // If images are not provided via URL/postMessage, fetch via our server which looks up the store token from DB
  useEffect(() => {
    const shop = context?.shop;
    const productId = context?.productId;
    const hasImages = (context?.images?.length || 0) > 0;
    if (!shop || !productId || hasImages) return;
    // Derive instanceId from URL path: /widget/{instanceId}[...]
    let instanceId: string | null = null;
    try {
      const parts = window.location.pathname.split('/').filter(Boolean);
      const idx = parts.indexOf('widget');
      if (idx >= 0 && parts[idx + 1]) instanceId = parts[idx + 1];
    } catch {}
    if (!instanceId) return;
    const key = `${shop}:${productId}:${instanceId}`;
    if (fetchedForProductRef.current === key) return;
    fetchedForProductRef.current = key;

    const controller = new AbortController();
    const fetchImages = async () => {
      try {
        const res = await fetch(`/api/images/shopify/${encodeURIComponent(instanceId)}?shop=${encodeURIComponent(shop!)}&product_id=${encodeURIComponent(productId!)}`, { signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        const urls = Array.isArray(data?.images) ? data.images.map((u: any) => (typeof u === 'string' && u.startsWith('//') ? `https:${u}` : u)).filter((u: any) => typeof u === 'string') : [];
        if (urls.length > 0) {
          updateImages(urls);
          // Persist product metadata if present
          if (data?.product) {
            setContext((prev) => ({
              ...prev,
              productTitle: prev.productTitle || data.product.title || prev.productTitle,
              productDescription: data.product.description || prev.productDescription,
              productPriceMin: data.product.priceMin || prev.productPriceMin,
              productPriceMax: data.product.priceMax || prev.productPriceMax,
              productCurrency: data.product.currency || prev.productCurrency,
              isShopify: prev.isShopify ?? true
            }));
          }
          if (shouldServerLog) {
            postServerDebug({
              event: "STORE_BACKEND_FETCH",
              source: "widget",
              shop,
              productId,
              images: urls.slice(0, 5)
            });
          }
        }
      } catch (_) {
        // ignore errors
      }
    };
    fetchImages();
    return () => controller.abort();
  }, [context?.shop, context?.productId, context?.images, shouldServerLog, postServerDebug, updateImages]);

  // Listen for postMessage with product context/images from Shopify wrapper
  useEffect(() => {
    // Log initial URL-derived context for debugging
    try {
      if (context && context.isShopify) {
        // eslint-disable-next-line no-console
        console.log('[SIF] Shopify URL context detected:', context);
        if (shouldServerLog && !sentServerLogRef.current) {
          sentServerLogRef.current = true;
          postServerDebug({
            event: "URL_CONTEXT",
            source: "widget",
            ...context
          });
        }
      }
    } catch {}

    const onMessage = (e: MessageEvent) => {
      try {
        const data = (e as any).data;
        if (!data || typeof data !== "object") return;
        if (data.type !== "SIF_PRODUCT_CONTEXT") return;
        const fromParent = (() => {
          try { return e.source === window.parent; } catch { return false; }
        })();
        const allowed = isAllowedMessageOrigin(e.origin, context.shop) || fromParent;
        if (!allowed) {
          try { console.warn('[SIF] PostMessage blocked by origin check:', { origin: e.origin, expectedShop: context.shop }); } catch {}
          return;
        }

        // eslint-disable-next-line no-console
        try { console.log('[SIF] Received Shopify product postMessage:', { origin: e.origin, data }); } catch {}

        const next: ShopifyProductContext = {
          shop: data.shop || context.shop,
          productId: data.productId || context.productId,
          productGid: data.productGid || context.productGid,
          productHandle: data.productHandle || context.productHandle,
          productTitle: data.productTitle || context.productTitle,
          images: undefined,
          isShopify: true
        };

        setContext((prev) => ({ ...prev, ...next }));
        if (data.images) {
          updateImages(data.images);
        }

        if (shouldServerLog) {
          postServerDebug({
            event: "POSTMESSAGE",
            source: "widget",
            origin: e.origin,
            shop: next.shop,
            productId: next.productId,
            productGid: next.productGid,
            productHandle: next.productHandle,
            productTitle: next.productTitle,
            images: Array.isArray(data.images)
              ? data.images.map((x: any) => (x && typeof x === "object" && "src" in x ? String(x.src) : String(x))).filter(Boolean)
              : []
          });
        }
      } catch {
        // ignore
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [context.shop, context.productHandle, context.productId, context.productGid, context.productTitle, updateImages]);

  // Re-parse params if URL changes (rare inside iframe)
  useEffect(() => {
    const initial = parseSearchParams();
    if (initial.isShopify) {
      setContext((prev) => ({ ...initial, images: prev.images || initial.images, isShopify: true }));
    }
  }, []);

  const value = useMemo(() => context, [context]);

  return <ShopifyContext.Provider value={value}>{children}</ShopifyContext.Provider>;
}

export function useShopifyContext(): ShopifyProductContext | null {
  return React.useContext(ShopifyContext);
}



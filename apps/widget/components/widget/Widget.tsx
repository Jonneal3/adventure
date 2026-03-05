"use client";

import React, { useState, useEffect, useRef } from "react";
import { DesignSettings, defaultDesignSettings, loadGoogleFont, getBackgroundColor } from "../../types";
import { Spinner } from "../ui/spinner";
import { AutoDemoOverlay } from "./demo/AutoDemoOverlay";
import { cn } from "../../lib/utils";
import { BrandHeader } from "./BrandHeader";
import { MainWidgetSection } from "./MainWidgetSection";
import { Toaster } from "../ui/toaster";
import { useShopifyContext } from "@/hooks/use-shopify-context";
import { withWidgetDesignDefaults } from "@/lib/widget-design-defaults";
import { applyThemeStyles, extractFormTheme } from "@/lib/ai-form/design/theme";

interface InstanceData {
  id: string;
  submission_limit_enabled: boolean;
  max_submissions_per_session: number;
  current_submissions: number;
  last_submission_at: string | null;
  config?: DesignSettings;
  webhook_url?: string | null;
  account_id?: string | null;
  name?: string;
  [key: string]: any;
}

interface WidgetProps {
  instanceId: string;
  controlsOnly?: boolean;
  designConfig?: DesignSettings;
  className?: string;
  fullPage?: boolean;
  deployment?: boolean;
  containerWidth?: number;
  containerHeight?: number;
  instanceData?: InstanceData;
  showDemoOverlay?: boolean;
}

// Add this at the top of the file, after imports
const IFRAME_MESSAGE_TYPE = 'MAGE_WIDGET_EXIT_INTENT';

export const Widget = React.memo(({ 
  instanceId, 
  designConfig, 
  className, 
  fullPage = false, 
  deployment = false,
  containerWidth: providedContainerWidth,
  instanceData: providedInstanceData,
  showDemoOverlay = true
}: WidgetProps) => {
  // State
  const [config, setConfig] = useState<DesignSettings>(() => {
    const raw = {
      ...((providedInstanceData?.config || {}) as any),
      ...((designConfig || {}) as any),
    } as DesignSettings;
    return withWidgetDesignDefaults(raw, providedInstanceData?.name);
  });
  const [configLoaded, setConfigLoaded] = useState(true);
  const [containerWidth, setContainerWidth] = useState(1024);
  const [viewportWidth, setViewportWidth] = useState(1024);
  const [showDemo, setShowDemo] = useState(false);
  const [instanceData, setInstanceData] = useState<InstanceData | null>(providedInstanceData || null);
  const [isIframe, setIsIframe] = useState(false);
  const [showWatermark, setShowWatermark] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const shopifyContext = useShopifyContext();
  

  const componentId = React.useMemo(() => `widget-${instanceId}`, [instanceId]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Enable in-widget debug panel via URL param ?sif_debug=true
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const sp = new URLSearchParams(window.location.search);
      const enabled = sp.get('sif_debug') === 'true' || sp.get('debug') === 'true';
      setShowDebugPanel(enabled);
    } catch {}
  }, []);

  // Fetch watermark visibility based on subscription status
  useEffect(() => {
    let cancelled = false;
    const fetchWatermark = async () => {
      try {
        if (!instanceId) return;
        const res = await fetch(`/api/billing/watermark/${encodeURIComponent(instanceId)}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setShowWatermark(Boolean(data?.showWatermark));
        }
      } catch {
        // default hidden on fetch errors
      }
    };
    fetchWatermark();
    return () => { cancelled = true; };
  }, [instanceId]);

  useEffect(() => {
    if (providedContainerWidth) {
      setContainerWidth(providedContainerWidth);
    } else if (containerRef.current) {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const width = entry.contentRect.width;
          setContainerWidth(width);
        }
      });

      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, [providedContainerWidth]);

  // Track viewport width for responsive snapping
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      setViewportWidth(width);
    };

    // Set initial viewport width
    handleResize();
    
    // Listen for viewport changes
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Simple config setup - no duplicate loading
  useEffect(() => {
    if (providedInstanceData) setInstanceData(providedInstanceData);
    const raw = {
      ...((providedInstanceData?.config || {}) as any),
      ...((designConfig || {}) as any),
    } as DesignSettings;
    const finalConfig = withWidgetDesignDefaults(raw, providedInstanceData?.name);
    setConfig(finalConfig);
    setConfigLoaded(true);
  }, [providedInstanceData, designConfig]);

  // Load Google Fonts when config changes
  useEffect(() => {
    if (!configLoaded) return;

    const fontsToLoad = [
      config.font_family, // base
      config.brand_name_font_family,
      config.prompt_font_family,
      config.prompt_input_font_family,
      config.suggestion_font_family,
      config.uploader_font_family,
      config.gallery_font_family,
      config.overlay_font_family,
      config.title_font_family,
      config.cta_font_family
    ].filter(Boolean);

    // Map some popular families to safe weight sets to avoid 400s
    const weightMap: Record<string, string> = {
      "Bebas Neue": "400", // Bebas Neue only has 400 weight in many subsets
      "Oswald": "300,400,500,600,700",
      "Roboto": "300,400,500,700",
      "Montserrat": "300,400,500,600,700",
      "Poppins": "300,400,500,600,700",
      "Inter": "300,400,500,600,700"
    };

    fontsToLoad.forEach(fontFamily => {
      if (fontFamily && fontFamily !== 'inherit' && fontFamily !== 'sans-serif' && fontFamily !== 'serif') {
        const weights = weightMap[fontFamily] || "300,400,500,600,700";
        loadGoogleFont(fontFamily, weights);
      }
    });
  }, [config, configLoaded]);

  // Auto-trigger demo overlay if enabled and not dismissed (only when allowed)
  useEffect(() => {
    if (showDemoOverlay && config.demo_enabled && configLoaded && !showDemo) {
      let demoDismissed = false;
      try {
        // Session-scoped dismissal: show again on a new browser session
        demoDismissed = instanceId ? sessionStorage.getItem(`demo_dismissed_${instanceId}`) === 'true' : false;
        // Clean up any legacy persistent flag that could block auto-show
        if (instanceId && localStorage.getItem(`demo_dismissed_${instanceId}`)) {
          try { localStorage.removeItem(`demo_dismissed_${instanceId}`); } catch {}
        }
      } catch {
        // Storage may be blocked in some third-party/iframe contexts; treat as not dismissed
        demoDismissed = false;
      }
      if (demoDismissed) return;
      const timer = setTimeout(() => {
        setShowDemo(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showDemoOverlay, config.demo_enabled, configLoaded, showDemo, instanceId]);

  // Manual preview trigger (bypasses localStorage dismissal)
  useEffect(() => {
    const handler = () => setShowDemo(true);
    window.addEventListener('preview-demo-overlay', handler as any, { passive: true } as any);
    return () => window.removeEventListener('preview-demo-overlay', handler as any);
  }, []);

  const handleDemoDismiss = () => {
    setShowDemo(false);
    
    // Store dismissal for this browser session only
    if (instanceId) {
      try { sessionStorage.setItem(`demo_dismissed_${instanceId}`, 'true'); } catch {}
    }
  };

  // Detect if we're in an iframe
  useEffect(() => {
    try {
      const isInIframe = window.self !== window.top;
      setIsIframe(isInIframe);

      if (isInIframe) {
        // Send a message to parent to register this iframe
        window.parent.postMessage({
          type: IFRAME_MESSAGE_TYPE,
          action: 'register',
          instanceId
        }, '*');
      }
    } catch {
      // If we can't access window.top, we're in an iframe
      setIsIframe(true);
    }
  }, [instanceId]);

  // Loading state
  if (!configLoaded) {
    const bg = config?.background_color || defaultDesignSettings.background_color || "#ffffff";
    return (
      <div className="flex items-center justify-center h-full w-full" style={{ backgroundColor: bg }}>
        <div style={{ color: config?.primary_color || "#111827" }}>
          <Spinner className="w-8 h-8" />
        </div>
      </div>
    );
  }

  // Calculate container padding based on config
  const containerPadding = {
    paddingTop: `${config.container_padding_top || config.container_padding || 24}px`,
    paddingRight: `${config.container_padding_right || config.container_padding || 24}px`,
    paddingBottom: `${config.container_padding_bottom || config.container_padding || 24}px`,
    paddingLeft: `${config.container_padding_left || config.container_padding || 24}px`,
  };

  const isFullBleed = Boolean(fullPage || deployment);

  const style = {
    ...applyThemeStyles(extractFormTheme(config)),
    backgroundColor: getBackgroundColor(config.background_color || "#ffffff", config.background_opacity),
    backgroundImage: (() => {
      const layers: string[] = [];
      const gradient = (config.background_gradient || "").trim();
      if (gradient) layers.push(gradient);
      const img = (config.background_image || "").trim();
      if (img) layers.push(img.includes("url(") ? img : `url(${img})`);
      return layers.length > 0 ? layers.join(", ") : undefined;
    })(),
    backgroundSize: config.background_image ? "cover" : undefined,
    backgroundPosition: config.background_image ? "center" : undefined,
    backgroundRepeat: config.background_image ? "no-repeat" : undefined,
    height: "100%",
    width: "100%",
    maxWidth: isFullBleed
      ? "100%"
      : config.full_width_layout
        ? "100%"
        : config.content_max_width
          ? `${Number(config.content_max_width)}px`
          : config.max_width
            ? `${config.max_width}px`
            : "100vw",
    maxHeight: config.max_height ? `${config.max_height}px` : "100%",
    fontFamily: config.font_family || 'inherit',
    fontSize: config.base_font_size ? `${config.base_font_size}px` : undefined,
    borderRadius: isFullBleed
      ? 0
      : typeof config.border_radius === "number"
        ? `${config.border_radius}px`
        : undefined,
    overflow:
      !isFullBleed && typeof config.border_radius === "number" && config.border_radius > 0
        ? ("hidden" as const)
        : undefined,
    boxShadow: isFullBleed
      ? "none"
      : (() => {
          const s = config.shadow_style || "none";
          switch (s) {
            case "none":
              return "none";
            case "subtle":
              return "0 1px 2px rgba(0,0,0,0.06), 0 10px 24px rgba(0,0,0,0.06)";
            case "large":
              return "0 24px 70px rgba(0,0,0,0.18)";
            case "glow":
              return "0 0 0 1px rgba(0,0,0,0.06), 0 20px 60px rgba(0,0,0,0.18)";
            case "medium":
            default:
              return "0 16px 44px rgba(0,0,0,0.14)";
          }
        })(),
    transition: "background-color 180ms ease, background-image 220ms ease",
    marginLeft: isFullBleed ? undefined : config.full_width_layout ? undefined : "auto",
    marginRight: isFullBleed ? undefined : config.full_width_layout ? undefined : "auto",
    ...containerPadding
  };

  return (
    <div 
      ref={containerRef}
      id={componentId}
      className={cn(
        "relative w-full h-full flex flex-col",
        className
      )}
      style={style}
    >
      {/* Demo Overlay */}
      {showDemo && (
        <AutoDemoOverlay
          onDismiss={handleDemoDismiss}
          config={config}
        />
      )}





      {/* Brand Header - Fixed at top */}
      <BrandHeader config={config} containerWidth={viewportWidth <= 768 ? 768 : containerWidth} hideInMobile={false} />

      {/* Main Widget Section - Takes remaining space */}
      <div className="flex-1 min-h-0 overflow-visible">
        <MainWidgetSection
          config={config}
          instanceId={instanceId}
          containerWidth={viewportWidth <= 768 ? 768 : containerWidth}
          fullPage={fullPage}
          deployment={deployment}
          instanceData={instanceData}
          isIframe={isIframe}
        />
      </div>
      
      {/* Toast Notifications */}
      <Toaster />

      {/* Debug Panel - toggle via ?sif_debug=true */}
      {showDebugPanel && (
        <div
          className="absolute z-50"
          style={{
            left: 12,
            bottom: 12,
            maxWidth: '48%',
            background: 'rgba(17,24,39,0.9)',
            color: '#f8fafc',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '10px 12px',
            fontSize: 12,
            lineHeight: 1.4,
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
            backdropFilter: 'saturate(140%) blur(2px)',
            pointerEvents: 'auto',
            overflow: 'hidden'
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6 }}>
            SIF Debug — Shopify Context
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 6 }}>
            <div style={{ opacity: 0.8 }}>isShopify</div>
            <div>{shopifyContext?.isShopify ? 'true' : 'false'}</div>
            <div style={{ opacity: 0.8 }}>shop</div>
            <div>{shopifyContext?.shop || '-'}</div>
            <div style={{ opacity: 0.8 }}>productId</div>
            <div>{shopifyContext?.productId || '-'}</div>
            <div style={{ opacity: 0.8 }}>productGid</div>
            <div style={{ wordBreak: 'break-all' }}>{shopifyContext?.productGid || '-'}</div>
            <div style={{ opacity: 0.8 }}>handle</div>
            <div>{shopifyContext?.productHandle || '-'}</div>
            <div style={{ opacity: 0.8 }}>title</div>
            <div>{shopifyContext?.productTitle || '-'}</div>
            <div style={{ opacity: 0.8 }}>images</div>
            <div>
              {(shopifyContext?.images?.length ?? 0)} found
              {shopifyContext?.images && shopifyContext.images.length > 0 && (
                <div style={{ marginTop: 6, maxHeight: 100, overflowY: 'auto' }}>
                  {shopifyContext.images.slice(0, 5).map((u, i) => (
                    <div key={i} style={{ opacity: 0.9, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                      {i + 1}. {u}
                    </div>
                  ))}
                  {shopifyContext.images.length > 5 && (
                    <div style={{ opacity: 0.7 }}>… +{shopifyContext.images.length - 5} more</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Watermark - show only if unpaid/trial status */}
      {showWatermark && (
        <div 
          className="absolute z-50"
          style={{
            right: 12,
            top: 12,
            bottom: 'auto',
            background: 'rgba(17,24,39,0.92)', // slate-900 with slight transparency
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 12,
            padding: '6px 12px',
            fontSize: 13,
            color: '#ffffff',
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)',
            backdropFilter: 'saturate(140%) blur(2px)'
          }}
        >
          <a
            href="https://adventure.app"
            target="_blank"
            rel="noopener noreferrer"
            style={{ 
              color: '#ffffff', 
              textDecoration: 'none', 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 8,
              fontWeight: 600,
              letterSpacing: 0.1
            }}
            aria-label="Made by Adventure"
          >
            <span style={{ 
              display: 'inline-block', 
              width: 8, height: 8, 
              borderRadius: 9999, 
              background: '#60a5fa', // blue-400 accent dot
              boxShadow: '0 0 0 3px rgba(96,165,250,0.25)'
            }} />
            <span style={{ opacity: 0.9, fontWeight: 500 }}>Made by</span>
            <span style={{ fontWeight: 800 }}>Adventure</span>
          </a>
        </div>
      )}
    </div>
  );
});

Widget.displayName = "Widget";

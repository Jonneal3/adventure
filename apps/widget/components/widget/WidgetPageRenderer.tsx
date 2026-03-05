"use client";

import { Widget } from "./Widget";
import { defaultDesignSettings, DesignSettings } from "../../types/design";
import { useDemoTheme } from "./demo/DemoThemeContext";
import { getPresetByKey, themeForSlugOrName, applyThemeToConfig } from "@/lib/demo-themes";
import { useState, useEffect, useRef, useMemo } from "react";
import { ShopifyProvider } from "@/hooks/use-shopify-context";
import { withWidgetDesignDefaults } from "@/lib/widget-design-defaults";

interface Props {
  instanceId?: string;
  demoType?: "prospect" | "industry";
  demoSlug?: string;
  initialInstanceData?: any;
  initialDesignConfig?: DesignSettings;
  initialRawInstanceConfig?: DesignSettings;
}

function InnerRenderer({
  instanceId,
  demoType,
  demoSlug,
  initialInstanceData,
  initialDesignConfig,
  initialRawInstanceConfig,
}: Props) {
  const [designConfig, setDesignConfig] = useState<DesignSettings | null>(
    initialDesignConfig ? withWidgetDesignDefaults(initialDesignConfig, initialInstanceData?.name) : null
  );
  const [instanceData, setInstanceData] = useState<any>(initialInstanceData || null);
  const [isLoading, setIsLoading] = useState(!(initialInstanceData && initialDesignConfig));
  const [error, setError] = useState<string | null>(null);
  const [rawInstanceConfig, setRawInstanceConfig] = useState<DesignSettings | null>(initialRawInstanceConfig || null);
  const { themeKey, setThemeKey } = useDemoTheme();

  const hasLoadedRef = useRef(Boolean(initialInstanceData && initialDesignConfig));
  const isLoadingRef = useRef(false);
  const currentInstanceIdRef = useRef<string | null>(instanceId || null);

  const searchParams = useMemo(() => {
    if (typeof window !== "undefined") {
      return new URLSearchParams(window.location.search);
    }
    return new URLSearchParams();
  }, []);

  const forceDemo = searchParams.get("demo") === "true";
  const resetDemo = searchParams.get("reset-demo") === "true";
  const isDemoRoute = Boolean(demoType && demoSlug);

  // Live config updates from parent (designer) via postMessage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const inIframe = Boolean(window.parent && window.parent !== window);
    if (!inIframe) return;

    const onMessage = (e: MessageEvent) => {
      if (e.source !== window.parent) return;
      const { data } = e as any;
      if (data && data.type === "UPDATE_CONFIG" && data.config) {
        try {
          const nextConfig = data.config as DesignSettings;
          const filled = withWidgetDesignDefaults(nextConfig, instanceData?.name);
          setDesignConfig(filled);
          try {
            window.parent?.postMessage({ type: "UPDATE_CONFIG_ACK" }, "*");
          } catch {}
        } catch {}
      }
    };
    try {
      window.parent?.postMessage({ type: "WIDGET_READY" }, "*");
    } catch {}
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [instanceData]);

  useEffect(() => {
    if (currentInstanceIdRef.current !== (instanceId || null)) {
      hasLoadedRef.current = false;
      isLoadingRef.current = false;
      currentInstanceIdRef.current = instanceId || null;
    }
  }, [instanceId]);

  useEffect(() => {
    if (resetDemo && instanceId && typeof window !== "undefined") {
      try { localStorage.removeItem(`demo_dismissed_${instanceId}`); } catch {}
      try { sessionStorage.removeItem(`demo_dismissed_${instanceId}`); } catch {}
    }
  }, [resetDemo, instanceId]);

  useEffect(() => {
    if (hasLoadedRef.current || isLoadingRef.current) {
      return;
    }

    const loadInstanceData = async () => {
      isLoadingRef.current = true;

      try {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);

        let url = "";

        if (demoType && demoSlug && instanceId) {
          url = `/api/instance/${instanceId}/demo/${demoType}/${demoSlug}?t=${timestamp}&r=${randomId}`;
        } else if (instanceId) {
          url = `/api/instance/${instanceId}?t=${timestamp}&r=${randomId}`;
        } else {
          throw new Error("No instanceId or demo params provided");
        }

        const response = await fetch(url, {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache"
          }
        });

        if (!response.ok) {
          throw new Error("Failed to load widget");
        }

        const data = await response.json();

        // If we're on a demo route but the instance does NOT have demo enabled,
        // fall back to the regular instance config, then apply demo overrides locally
        if (isDemoRoute && instanceId && !(data.instance?.config?.demo_enabled === true)) {
          const rawCfg: DesignSettings = (data.instance?.config || {}) as any;
          const baseCfg: any = withWidgetDesignDefaults(rawCfg as any, data.instance?.name);

          const demoCfg: any =
            (data.instance?.active_demo?.subcategory?.demo_template_config) ||
            (data.instance?.active_demo?.prospect?.demo_template_config) ||
            null;
          const storedThemeKey =
            demoCfg && demoCfg.theme_key ? String(demoCfg.theme_key).toLowerCase() : null;
          if (storedThemeKey && !themeKey) setThemeKey(storedThemeKey);

          const effectiveKey = themeKey || storedThemeKey;
          const subcatName = data.instance?.active_demo?.subcategory?.subcategory || null;
          const prospectName = data.instance?.active_demo?.prospect?.company_name || null;
          const brandName = (demoCfg && demoCfg.brand_name) || prospectName || subcatName || data.instance?.name || "Demo";
          const titleText = (demoCfg && demoCfg.title_text) || subcatName || prospectName || "Demo";

          // Force demo branding header/title/logo even if the base instance isn't flagged as demo-enabled.
          let finalCfg: any = {
            ...baseCfg,
            demo_enabled: true,
            header_enabled: true,
            brand_name_enabled: true,
            title_enabled: true,
            brand_name: brandName,
            title_text: titleText,
          };

          const tplLogo = demoCfg && demoCfg.logo_url ? String(demoCfg.logo_url) : "";
          const prospectLogo = data.instance?.active_demo?.prospect?.logo_url ? String(data.instance.active_demo.prospect.logo_url) : "";
          const logo = tplLogo || prospectLogo || (finalCfg.logo_url || "");
          if (logo) {
            finalCfg.logo_url = logo;
            finalCfg.logo_enabled = true;
          }

          if (effectiveKey) {
            const preset = getPresetByKey(effectiveKey);
            // Avoid wiping out demo branding AND instance config colors
            const safePreset = { ...(preset as any) };
            delete (safePreset as any).logo_url;
            delete (safePreset as any).brand_name;
            delete (safePreset as any).title_text;
            // Preserve instance colors if they exist
            if (finalCfg.primary_color) delete (safePreset as any).primary_color;
            if (finalCfg.secondary_color) delete (safePreset as any).secondary_color;
            if (finalCfg.background_color) delete (safePreset as any).background_color;
            finalCfg = { ...(safePreset as any), ...(finalCfg as any) };
          } else {
            const themed = themeForSlugOrName(subcatName || prospectName || demoSlug || "");
            finalCfg = applyThemeToConfig(themed as any, finalCfg as any) as any;
          }

          // Enforce left-right layout for demo renders
          finalCfg.layout_mode = 'left-right';
          finalCfg.mobile_layout_mode = finalCfg.mobile_layout_mode || 'mobile-optimized';

          finalCfg = withWidgetDesignDefaults(finalCfg, data.instance?.name);
          setRawInstanceConfig(rawCfg as any);
          setDesignConfig(finalCfg);
          setInstanceData(data.instance);
          hasLoadedRef.current = true;
          setIsLoading(false);
          isLoadingRef.current = false;
          return;
        }

        const rawCfg: DesignSettings = (data.instance?.config || {}) as any;
        let mergedConfig: DesignSettings = rawCfg as any;

        if (forceDemo) mergedConfig.demo_enabled = true;

        // Apply demo overrides only on demo routes (never on normal instance route)
        if (isDemoRoute) {
          // If API provided active_demo with a stored theme key, prefer it and apply locally
          const demoCfg: any = (data.instance?.active_demo?.subcategory?.demo_template_config) || (data.instance?.active_demo?.prospect?.demo_template_config) || null;
          const storedThemeKey = demoCfg && demoCfg.theme_key ? String(demoCfg.theme_key).toLowerCase() : null;
          // Initialize context theme to stored key if not already set
          if (storedThemeKey && !themeKey) {
            setThemeKey(storedThemeKey);
          }
          const effectiveKey = themeKey || storedThemeKey;
          if (effectiveKey) {
            // When an explicit theme is selected, use it as defaults but preserve instance config
            const preset = getPresetByKey(effectiveKey);
            mergedConfig = { ...(preset as any), ...(mergedConfig as any) } as any;
          } else {
            // No explicit theme selected – infer accents from slug/company
            const themed = themeForSlugOrName(
              data.instance?.active_demo?.subcategory?.subcategory || data.instance?.active_demo?.prospect?.company_name || ''
            );
            mergedConfig = applyThemeToConfig(themed as any, mergedConfig as any) as any;
          }

          // Enforce left-right layout for demo renders
          mergedConfig.layout_mode = 'left-right';
          mergedConfig.mobile_layout_mode = mergedConfig.mobile_layout_mode || 'mobile-optimized';
        }
        const filled = withWidgetDesignDefaults(mergedConfig, data.instance?.name);
        setRawInstanceConfig(rawCfg as any);
        setDesignConfig(filled);
        setInstanceData(data.instance);
        hasLoadedRef.current = true;
      } catch (err) {
        console.error("🔍 Error loading widget:", err);
        setError("Failed to load widget");
        setDesignConfig(withWidgetDesignDefaults(defaultDesignSettings));
        hasLoadedRef.current = true;
      } finally {
        setIsLoading(false);
        isLoadingRef.current = false;
      }
    };

    loadInstanceData();
  }, [instanceId, demoType, demoSlug, forceDemo]);

  // Re-apply theme instantly when themeKey changes using the original instance config (demo route only)
	  useEffect(() => {
	    if (!instanceData) return;
	    if (!isDemoRoute) return;
	    const demoCfg: any = (instanceData?.active_demo?.subcategory?.demo_template_config) || (instanceData?.active_demo?.prospect?.demo_template_config) || null;
	    const effectiveKey = themeKey || (demoCfg && demoCfg.theme_key ? String(demoCfg.theme_key).toLowerCase() : null);
	    // Start from default + raw instance config from API, then re-apply demo header/title/logo and theme
	    let cfg: any = withWidgetDesignDefaults((rawInstanceConfig as any) || {}, instanceData?.name);
    // Force demo header/title/logo from demo config each time
    const subcatName = instanceData?.active_demo?.subcategory?.subcategory || null;
    const prospectName = instanceData?.active_demo?.prospect?.company_name || null;
    const brandName = (demoCfg && demoCfg.brand_name) || prospectName || subcatName || 'Demo';
    const titleText = (demoCfg && demoCfg.title_text) || subcatName || prospectName || 'Demo';
    cfg.header_enabled = true;
    cfg.brand_name_enabled = true;
    cfg.title_enabled = true;
    cfg.brand_name = brandName;
    cfg.title_text = titleText;
    const tplLogo = (demoCfg && demoCfg.logo_url) ? String(demoCfg.logo_url) : '';
    const prospectLogo = instanceData?.active_demo?.prospect?.logo_url ? String(instanceData.active_demo.prospect.logo_url) : '';
    const logo = tplLogo || prospectLogo || (cfg.logo_url || '');
    if (logo) {
      cfg.logo_url = logo;
      cfg.logo_enabled = true;
    }
    if (effectiveKey) {
      const preset = getPresetByKey(effectiveKey);
      // Sanitize preset to avoid wiping branding/logo AND instance colors
      const safePreset = { ...(preset as any) };
      delete (safePreset as any).logo_url;
      delete (safePreset as any).brand_name;
      delete (safePreset as any).title_text;
      // Preserve instance colors if they exist in the raw config
      const rawCfg = rawInstanceConfig as any;
      if (rawCfg?.primary_color) delete (safePreset as any).primary_color;
      if (rawCfg?.secondary_color) delete (safePreset as any).secondary_color;
      if (rawCfg?.background_color) delete (safePreset as any).background_color;
      // Preset comes first, then current config wins
      cfg = { ...(safePreset as any), ...(cfg as any) };
      // Enforce left-right layout for demo renders
      (cfg as any).layout_mode = 'left-right';
      (cfg as any).mobile_layout_mode = (cfg as any).mobile_layout_mode || 'mobile-optimized';
	    } else {
	      const themed = themeForSlugOrName(
	        instanceData?.active_demo?.subcategory?.subcategory || instanceData?.active_demo?.prospect?.company_name || ''
	      );
	      cfg = applyThemeToConfig(themed as any, cfg as any);
      // Enforce left-right layout for demo renders
      (cfg as any).layout_mode = 'left-right';
      (cfg as any).mobile_layout_mode = (cfg as any).mobile_layout_mode || 'mobile-optimized';
	    }
	    setDesignConfig(withWidgetDesignDefaults(cfg, instanceData?.name));
	  }, [themeKey, instanceData, rawInstanceConfig, isDemoRoute]);

  if (isLoading) {
    const bg = designConfig?.background_color || defaultDesignSettings.background_color || "#ffffff";
    const spinnerColor = designConfig?.primary_color || "#111827";
    return (
      <div
        className="fixed inset-0 w-screen h-screen flex items-center justify-center"
        style={{ backgroundColor: bg }}
      >
        <div
          className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: spinnerColor, borderTopColor: "transparent" }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 w-screen h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Widget Not Found</h1>
          <p className="text-gray-600 mb-4">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="fixed inset-0 w-screen h-screen overflow-hidden">
      <ShopifyProvider>
        <Widget 
          key={`theme-${themeKey || (instanceData?.active_demo?.subcategory?.demo_template_config?.theme_key || instanceData?.active_demo?.prospect?.demo_template_config?.theme_key || 'default')}`}
          instanceId={instanceId || ""}
          controlsOnly={false}
          designConfig={designConfig || undefined}
          // Allow URL flags to control full-bleed/embed behavior.
          // This ensures `content_max_width` / `full_width_layout` can be tested without code changes.
          fullPage={(() => {
            const v = searchParams.get("fullPage");
            return v == null ? true : v === "true";
          })()}
          deployment={(() => {
            const v = searchParams.get("deployment");
            return v == null ? true : v === "true";
          })()}
          showDemoOverlay={isDemoRoute || Boolean(designConfig?.demo_enabled)}
          instanceData={instanceData}
        />
      </ShopifyProvider>
    </main>
  );
}

export function WidgetPageRenderer(props: Props) {
  return <InnerRenderer {...props} />;
}

"use client";

// Form Theme Provider

import React, { createContext, useContext, useEffect } from 'react';
import { DesignSettings } from '@/types/design';
import { loadGoogleFont } from '@/types/design';
import { FormTheme, applyThemeStyles, extractFormTheme } from '@/lib/ai-form/design/theme';

interface FormThemeContextValue {
  theme: FormTheme;
  config: DesignSettings;
}

const FormThemeContext = createContext<FormThemeContextValue | null>(null);

interface FormThemeProviderProps {
  config: DesignSettings;
  children: React.ReactNode;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = String(hex || "").replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const h = String(hex || "").replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length !== 6) return null;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return null;
  return { r, g, b };
}

function rgbToHslCss({ r, g, b }: { r: number; g: number; b: number }): string {
  // Convert RGB [0..255] -> HSL (CSS var format expects: "H S% L%")
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = ((gn - bn) / d) % 6;
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      default:
        h = (rn - gn) / d + 4;
        break;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  const sPct = Math.round(s * 100);
  const lPct = Math.round(l * 100);
  return `${h} ${sPct}% ${lPct}%`;
}

function relativeLuminance({ r, g, b }: { r: number; g: number; b: number }): number {
  // WCAG relative luminance (sRGB)
  const toLin = (v: number) => {
    const x = v / 255;
    return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  const R = toLin(r);
  const G = toLin(g);
  const B = toLin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function pickForegroundHslForBg(rgb: { r: number; g: number; b: number }): string {
  // Keep it simple and consistent with existing tokens.
  // If bg is light → dark text, else → white text.
  return relativeLuminance(rgb) > 0.55 ? "0 0% 9%" : "0 0% 98%";
}

function withAlphaIfHex(color: string | undefined, alpha: number): string | undefined {
  if (!color) return undefined;
  const c = color.trim();
  if (!c) return undefined;
  if (c === "transparent") return c;
  // Only apply alpha to hex colors; leave gradients/rgb/hsl alone.
  if (c.startsWith("#")) return hexToRgba(c, alpha);
  return c;
}

export function FormThemeProvider({ config, children }: FormThemeProviderProps) {
  const theme: FormTheme = extractFormTheme(config);

  // Ensure any configured Google fonts are actually loaded.
  // Without this, setting `fontFamily` from config/theme can silently fall back to system fonts.
  useEffect(() => {
    const fontsToLoad = [
      config.font_family,
      config.brand_name_font_family,
      config.prompt_font_family,
      config.prompt_input_font_family,
      config.suggestion_font_family,
      config.uploader_font_family,
      config.gallery_font_family,
      config.overlay_font_family,
      config.title_font_family,
      config.cta_font_family,
      theme.fontFamily,
    ].filter(Boolean) as string[];

    const weightMap: Record<string, string> = {
      "Bebas Neue": "400",
      "Oswald": "300,400,500,600,700",
      "Roboto": "300,400,500,700",
      "Montserrat": "300,400,500,600,700",
      "Poppins": "300,400,500,600,700",
      "Inter": "300,400,500,600,700",
    };

    for (const fontFamily of fontsToLoad) {
      const ff = String(fontFamily || "").trim();
      if (!ff) continue;
      if (ff === "inherit" || ff === "sans-serif" || ff === "serif") continue;
      const weights = weightMap[ff] || "300,400,500,600,700";
      loadGoogleFont(ff, weights);
    }
  }, [config, theme.fontFamily]);

  const surfaceColor =
    (config.prompt_background_color && config.prompt_background_color !== "transparent"
      ? config.prompt_background_color
      : theme.backgroundColor) || "#ffffff";

  const surfaceBorderColor =
    config.prompt_border_color ||
    (theme.primaryColor ? hexToRgba(theme.primaryColor, 0.18) : "rgba(0,0,0,0.10)");

  const bgFromColor = withAlphaIfHex(config.background_color || theme.backgroundColor, config.background_opacity ?? 1);
  const gradient = (config.background_gradient || "").trim();
  const bgImageUrl = (config.background_image || "").trim();

  const backgroundImage =
    gradient
      ? gradient
      : bgImageUrl
        ? `url(${bgImageUrl})`
        : undefined;

  const primaryRgb = theme.primaryColor?.startsWith("#") ? hexToRgb(theme.primaryColor) : null;
  const secondaryRgb = theme.secondaryColor?.startsWith("#") ? hexToRgb(theme.secondaryColor) : null;
  const primaryHsl = primaryRgb ? rgbToHslCss(primaryRgb) : null;
  const secondaryHsl = secondaryRgb ? rgbToHslCss(secondaryRgb) : null;
  const primaryFgHsl = primaryRgb ? pickForegroundHslForBg(primaryRgb) : null;
  const secondaryFgHsl = secondaryRgb ? pickForegroundHslForBg(secondaryRgb) : null;

  return (
    <FormThemeContext.Provider value={{ theme, config }}>
      <div
        style={{
          ...applyThemeStyles(theme),
          // Also override Shadcn/Tailwind semantic tokens so `bg-primary`, etc.
          // automatically match the instance theme in the question area.
          ...(primaryHsl
            ? {
                ["--primary" as any]: primaryHsl,
                ["--primary-foreground" as any]: primaryFgHsl || "0 0% 98%",
                ["--ring" as any]: primaryHsl,
              }
            : {}),
          ...(secondaryHsl
            ? {
                ["--secondary" as any]: secondaryHsl,
                ["--secondary-foreground" as any]: secondaryFgHsl || "0 0% 20%",
              }
            : {}),
          ["--form-surface-color" as any]: surfaceColor,
          ["--form-surface-border-color" as any]: surfaceBorderColor,
          fontFamily: theme.fontFamily,
          color: theme.textColor,
          backgroundColor: bgFromColor || theme.backgroundColor,
          backgroundImage,
          backgroundSize: backgroundImage ? "cover" : undefined,
          backgroundPosition: backgroundImage ? "center" : undefined,
          backgroundRepeat: backgroundImage ? "no-repeat" : undefined,
          height: "100%",
          minHeight: "100dvh",
        }}
      >
        {children}
      </div>
    </FormThemeContext.Provider>
  );
}

export function useFormTheme(): FormThemeContextValue {
  const context = useContext(FormThemeContext);
  if (!context) {
    throw new Error('useFormTheme must be used within FormThemeProvider');
  }
  return context;
}

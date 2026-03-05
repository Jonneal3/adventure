// Theme utilities for AI Form components

import { DesignSettings } from '@/types/design';

export interface FormTheme {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  borderRadius: number;
  backgroundColor: string;
  textColor: string;
  buttonStyle: {
    backgroundColor: string;
    textColor: string;
    hoverBackgroundColor: string;
    borderRadius: number;
  };
}

function normalizeColor(raw?: string): string {
  return String(raw || "").trim().toLowerCase();
}

function isDefaultBlack(raw?: string): boolean {
  const v = normalizeColor(raw);
  return v === "#000" || v === "#000000" || v === "black";
}

function isDefaultWhite(raw?: string): boolean {
  const v = normalizeColor(raw);
  return v === "#fff" || v === "#ffffff" || v === "white";
}

export function extractFormTheme(config: DesignSettings): FormTheme {
  // Brand source of truth (especially for /adventure):
  // use the config's primary/secondary swatches whenever present.
  // Fall back to submit button colors only if swatches are missing.
  const primaryColor =
    config.primary_color ||
    ((config as any).accent_color as string | undefined) ||
    config.submit_button_background_color ||
    '#3b82f6';
  const secondaryColor =
    config.secondary_color ||
    config.submit_button_hover_background_color ||
    '#2563eb';

  return {
    primaryColor,
    secondaryColor,
    fontFamily: config.font_family || config.prompt_font_family || 'Inter, sans-serif',
    borderRadius: config.border_radius || config.prompt_border_radius || 12,
    backgroundColor: config.background_color || '#ffffff',
    textColor: config.prompt_text_color || config.brand_name_color || '#374151',
    buttonStyle: {
      // CTA colors used by most buttons.
      backgroundColor: primaryColor,
      textColor: config.submit_button_text_color || '#ffffff',
      hoverBackgroundColor: secondaryColor,
      borderRadius: config.border_radius || config.prompt_border_radius || 12
    }
  };
}

export function applyThemeStyles(theme: FormTheme): React.CSSProperties {
  return {
    '--form-primary-color': theme.primaryColor,
    '--form-secondary-color': theme.secondaryColor,
    '--form-font-family': theme.fontFamily,
    '--form-border-radius': `${theme.borderRadius}px`,
    '--form-background-color': theme.backgroundColor,
    '--form-text-color': theme.textColor,
    '--form-button-bg': theme.buttonStyle.backgroundColor,
    '--form-button-text': theme.buttonStyle.textColor,
    '--form-button-hover-bg': theme.buttonStyle.hoverBackgroundColor,
    '--form-button-radius': `${theme.buttonStyle.borderRadius}px`
  } as React.CSSProperties;
}


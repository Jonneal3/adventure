"use client";

import React from "react";
import { DesignSettings } from "../../../types";
import { cn } from "../../../lib/utils";

interface PromptInputProps {
  config: DesignSettings;
  value: string;
  onChange: (val: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  heightScaleFactor?: number;
  effectiveScale?: number;
  rows?: number;
  className?: string;
  style?: React.CSSProperties;
  extraRightPaddingPx?: number; // space to reserve for an in-field button
  styleOverrides?: React.CSSProperties; // optional overrides (e.g., MobileLayout border)
  useOverlayFonts?: boolean; // when true, use overlay font family/size instead of prompt input
}

export function PromptInput({
  config,
  value,
  onChange,
  onSubmit,
  disabled = false,
  heightScaleFactor = 1,
  effectiveScale: providedEffectiveScale,
  rows = 1,
  className = "",
  style = {},
  extraRightPaddingPx = 0,
  styleOverrides = {},
  useOverlayFonts = false
}: PromptInputProps) {
  // Keep scaling deterministic (driven by layout/config), not viewport heuristics.
  const effectiveScale = typeof providedEffectiveScale === "number" ? providedEffectiveScale : heightScaleFactor;
  
  const placeholderColor = config.prompt_input_placeholder_color || config.prompt_placeholder_color || "#9ca3af";
  const textColor = config.prompt_input_text_color || config.prompt_text_color || "#374151";
  // Prefer prompt_input typography when provided; fall back to prompt typography.
  const fontFamily = useOverlayFonts
    ? (config.overlay_font_family || config.prompt_font_family || "inherit")
    : (config.prompt_input_font_family || config.prompt_font_family || "inherit");
  const fontSizePx = useOverlayFonts
    ? (config.overlay_font_size || config.prompt_font_size || 16)
    : (config.prompt_input_font_size || config.prompt_font_size || 16);
  // Responsive padding that scales proportionally with effective scale
  const basePadding = Math.min(Math.max(6, 8 * effectiveScale), 20);
  const paddingRight = basePadding + extraRightPaddingPx;
  // ChatGPT-like composer: outer wrapper owns background/border/shadow.
  // Keep the textarea itself visually borderless.
  const backgroundColor = "transparent";
  const borderRadius = 0;
  
  // Responsive font size that scales proportionally with effective scale
  const responsiveFontSize = Math.min(Math.max(10, fontSizePx * effectiveScale), 24);
  const isSingleLine = rows <= 1;
  const lineHeight = isSingleLine ? 1.25 : 1.5;
  const paddingY = isSingleLine ? Math.max(6, Math.round(basePadding * 0.75)) : basePadding;

  const placeholderStyle: React.CSSProperties = {
    "--placeholder-color": placeholderColor,
  } as React.CSSProperties;

  // Single-line input: looks cleaner and centers text/placeholder reliably.
  if (isSingleLine) {
    return (
      <input
        data-tour="prompt-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (!disabled && value.trim()) onSubmit();
          }
        }}
        placeholder="Type a prompt..."
        className={cn(
          "bg-transparent outline-none w-full placeholder-color",
          "placeholder:text-[var(--placeholder-color)]",
          className
        )}
        style={{
          ...placeholderStyle,
          fontFamily,
          fontSize: `${responsiveFontSize}px`,
          lineHeight,
          padding: `${paddingY}px ${basePadding}px`,
          paddingRight: `${paddingRight}px`,
          boxSizing: "border-box",
          backgroundColor,
          border: "none",
          borderRadius: `${borderRadius}px`,
          color: textColor,
          width: "100%",
          minWidth: 0,
          maxWidth: "100%",
          ...style,
          ...styleOverrides,
        }}
        disabled={disabled}
      />
    );
  }

  return (
    <textarea
      data-tour="prompt-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          if (!disabled && value.trim()) {
            onSubmit();
          }
        }
      }}
      placeholder="Type a prompt..."
      rows={rows}
      className={cn(
        "bg-transparent resize-none outline-none w-full placeholder-color overflow-auto",
        "leading-relaxed",
        "placeholder:text-[var(--placeholder-color)]",
        className
      )}
      style={{
        ...placeholderStyle,
        fontFamily,
        fontSize: `${responsiveFontSize}px`,
        lineHeight,
        padding: `${paddingY}px ${basePadding}px`,
        paddingRight: `${paddingRight}px`,
        boxSizing: "border-box",
        backgroundColor,
        border: "none",
        borderRadius: `${borderRadius}px`,
        color: textColor,
        width: "100%",
        minWidth: 0,
        maxWidth: "100%",
        ...style,
        ...styleOverrides,
      }}
      disabled={disabled}
    />
  );
}

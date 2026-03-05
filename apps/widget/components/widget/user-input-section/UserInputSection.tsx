"use client";

import React, { useState, useEffect } from "react";
import { Button } from "../../ui/button";
import { Input } from "../../ui/input";
import { Textarea } from "../../ui/textarea";
import { PromptInput } from "./PromptInput";
import { DesignSettings, getEffectivePadding, hexToRgba } from "../../../types/design";
import { Suggestion } from "../../../lib/suggestions";
import { ImageUpload } from "./ImageUpload.Widget";
import { RefreshCw, ArrowUp, ArrowUpRight } from "lucide-react";
import { Spinner } from "../../ui/spinner";
import { cn } from "../../../lib/utils";

interface UserInputSectionProps {
  config: DesignSettings;
  prompt: string;
  setPrompt: (prompt: string) => void;
  isLoading: boolean;
  suggestions: Suggestion[];
  referenceImages: string[];
  onPromptSubmit: (prompt: string) => void;
  onSuggestionClick: (suggestion: Suggestion) => void;
  onImageUpload: (imageData: string | null) => void;
  onImageRemove: (index: number) => void;
  onRefreshSuggestions: () => void;
  variant?: 'mobile' | 'desktop';
  heightScaleFactor?: number;
  containerWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  isSubmissionLimitReached?: boolean;
  submissionCount?: number;
  maxSubmissions?: number;
  disableSuggestionsScroll?: boolean;
}

export function UserInputSection({
  config,
  prompt,
  setPrompt,
  isLoading,
  suggestions,
  referenceImages,
  onPromptSubmit,
  onSuggestionClick,
  onImageUpload,
  onImageRemove,
  onRefreshSuggestions,
  variant = 'desktop',
  heightScaleFactor = 1,
  containerWidth = 1024,
  className = '',
  style = {},
  isSubmissionLimitReached = false,
  submissionCount = 0,
  maxSubmissions = 5,
  disableSuggestionsScroll = false
}: UserInputSectionProps) {
  
  const isMobile = variant === 'mobile';
  // Keep scaling deterministic (driven by layout/config), not viewport heuristics.
  const effectiveScale = heightScaleFactor;

  const cappedSubmissionCount =
    typeof submissionCount === "number" && typeof maxSubmissions === "number" && maxSubmissions > 0
      ? Math.min(Math.max(0, submissionCount), maxSubmissions)
      : submissionCount;
  
  // Responsive submit button sizes that scale proportionally
  const baseSubmitButtonSize = 36;
  const submitButtonSizeMobile = Math.round(Math.min(44, Math.max(28, baseSubmitButtonSize * effectiveScale)));
  const submitButtonSizeDesktop = Math.round(Math.min(48, Math.max(32, (baseSubmitButtonSize + 4) * effectiveScale)));
  




  // Responsive container styles that scale proportionally
  const basePadding = variant === "desktop" ? 16 : 8;
  const responsivePadding = variant === "desktop" 
    ? {
        top: Math.min(Math.max(8, basePadding * effectiveScale), 20),
        right: Math.min(Math.max(12, basePadding * Math.min(containerWidth / 1200, 1.2) * effectiveScale), 28),
        bottom: Math.min(Math.max(8, basePadding * effectiveScale), 20),
        left: Math.min(Math.max(12, basePadding * Math.min(containerWidth / 1200, 1.2) * effectiveScale), 28)
      }
    : {
        top: Math.min(Math.max(4, (basePadding / 2) * effectiveScale), 10),
        right: Math.min(Math.max(6, (basePadding / 2) * Math.min(containerWidth / 768, 1.2) * effectiveScale), 14),
        bottom: Math.min(Math.max(4, (basePadding / 2) * effectiveScale), 10),
        left: Math.min(Math.max(6, (basePadding / 2) * Math.min(containerWidth / 768, 1.2) * effectiveScale), 14)
      };

  const containerStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: `${responsivePadding.top}px ${responsivePadding.right}px ${responsivePadding.bottom}px ${responsivePadding.left}px`,
    backgroundColor: 'transparent',
    borderRadius: `${config.prompt_border_radius || 12}px`,
    fontFamily: config.prompt_font_family || 'inherit',
    fontSize: config.prompt_font_size ? `${Math.min(Math.max(10, config.prompt_font_size * effectiveScale), 24)}px` : undefined,
    height: '100%',
    minHeight: '100%', // Fill the full height
    maxHeight: '100%',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box' as const,
    overflow: 'visible', // Allow content to be fully visible
    ...style
  };

  // Visually keep it light: show at most 3 suggestions.
  const suggestionCount = Math.max(
    0,
    Math.min(3, typeof config.suggestions_count === "number" ? config.suggestions_count : 3)
  );
  const showSuggestions = (config.suggestions_enabled ?? true) && suggestions.length > 0;

  const primary = config.primary_color || "#3b82f6";
  const secondary = config.secondary_color || "#ffffff";

  // Form-off widget: keep the composer as a fully-rounded "pill" for a minimal look.
  const composerRadius = 9999;
  const composerBorderWidthRaw = config.prompt_input_border_style === "none" ? 0 : (config.prompt_input_border_width ?? 1);
  const composerBorderWidth = Math.min(Math.max(0, composerBorderWidthRaw * effectiveScale), 2);
  const composerBorderColor =
    config.prompt_input_border_color ||
    config.prompt_border_color ||
    hexToRgba(primary, 0.18) ||
    "rgba(0,0,0,0.10)";
  const composerBg =
    config.prompt_input_background_color ||
    (config.background_color ? hexToRgba(config.background_color, 0.72) : "") ||
    "rgba(255,255,255,0.72)";
  // Keep the composer surface simple: mostly border + subtle lift only.
  const composerShadow = (() => {
    const s = config.shadow_style || "subtle";
    switch (s) {
      case "none":
        return "none";
      case "large":
        return "0 16px 48px rgba(0,0,0,0.14)";
      case "glow":
        return `0 0 0 1px rgba(0,0,0,0.06), 0 14px 40px rgba(0,0,0,0.12)`;
      case "medium":
      case "subtle":
      default:
        return "0 1px 1px rgba(0,0,0,0.04), 0 8px 18px rgba(0,0,0,0.08)";
    }
  })();

  const controlSizeMobile = Math.round(Math.min(42, Math.max(32, 36 * effectiveScale)));
  const controlSizeDesktop = Math.round(Math.min(46, Math.max(34, 38 * effectiveScale)));
  const promptPaddingYMobile = Math.round(Math.min(10, Math.max(6, 7 * effectiveScale)));
  const promptPaddingYDesktop = Math.round(Math.min(10, Math.max(6, 7 * effectiveScale)));
  const promptPaddingX = Math.round(Math.min(16, Math.max(10, 12 * effectiveScale)));



  // Mobile version
  if (isMobile) {
    return (
      <div className={`relative flex flex-col overflow-visible ${className}`} style={containerStyles}>
        <div className="flex-1 min-h-0 flex flex-col overflow-visible">
          {/* Mobile Composer (ChatGPT-like) */}
          <div className="flex-1 overflow-visible flex flex-col">
            <div
              className={cn(
                "relative w-full transition-shadow",
                "focus-within:ring-2 focus-within:ring-[var(--composer-ring)] focus-within:ring-offset-0"
              )}
              style={{
                background: composerBg,
                borderRadius: `${composerRadius}px`,
                border: composerBorderWidth > 0 ? `${composerBorderWidth}px solid ${composerBorderColor}` : "none",
                boxShadow: composerShadow,
                padding: `${Math.min(Math.max(6, 7 * effectiveScale), 10)}px`,
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                ["--composer-ring" as any]: hexToRgba(primary, 0.28) || "rgba(59,130,246,0.28)",
              }}
            >
              <div className="flex items-center gap-2 w-full min-w-0">
                {config.uploader_enabled && (
                  <div data-tour="upload-area" className="flex-shrink-0">
                    <ImageUpload
                      onImageUpload={onImageUpload}
                      onImageRemove={onImageRemove}
                      currentImages={referenceImages}
                      maxImages={config.uploader_max_images ?? 1}
                      variant="chatgpt"
                      customStyles={{
                        button: {
                          width: controlSizeMobile,
                          height: controlSizeMobile,
                          borderRadius: 9999,
                          border: `1px solid ${hexToRgba("#000000", 0.08)}`,
                          backgroundColor: hexToRgba(primary, 0.08) || "rgba(59,130,246,0.08)",
                          boxShadow: "none",
                        },
                      }}
                      textSettings={{
                        secondaryText: config.uploader_secondary_text,
                        textColor: config.uploader_text_color,
                        fontFamily: config.uploader_font_family,
                        fontSize: config.uploader_font_size,
                      }}
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <PromptInput
                    config={config}
                    value={prompt}
                    onChange={(val: string) => setPrompt(val)}
                    onSubmit={() => onPromptSubmit(prompt)}
                    disabled={isLoading}
                    effectiveScale={effectiveScale}
                    rows={1}
                    extraRightPaddingPx={0}
                    className="w-full"
                    style={{ width: "100%", minWidth: 0 }}
                    styleOverrides={{
                      height: `${controlSizeMobile}px`,
                      minHeight: `${controlSizeMobile}px`,
                      maxHeight: `${controlSizeMobile}px`,
                      // Single-line <input>: keep padding-y at 0 for perfect centering.
                      padding: `0px ${promptPaddingX}px`,
                      paddingRight: `${promptPaddingX}px`,
                    }}
                  />
                </div>

                <button
                  data-tour="submit-button"
                  onClick={() => onPromptSubmit(prompt)}
                  disabled={isLoading || !prompt.trim() || isSubmissionLimitReached}
                  className="flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 flex-shrink-0"
                  style={{
                    backgroundColor: isSubmissionLimitReached ? "#dc2626" : (config.submit_button_background_color || "#3b82f6"),
                    color: config.submit_button_text_color || "#ffffff",
                    width: `${controlSizeMobile}px`,
                    height: `${controlSizeMobile}px`,
                    borderRadius: 9999,
                    border: "none",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                  }}
                  title={
                    isSubmissionLimitReached && typeof maxSubmissions === "number" && maxSubmissions > 0
                      ? `Limit reached: ${cappedSubmissionCount}/${maxSubmissions} submissions`
                      : isSubmissionLimitReached
                      ? "Limit reached"
                      : undefined
                  }
                  aria-label="Generate"
                  onMouseEnter={(e) => {
                    if (!isSubmissionLimitReached) {
                      e.currentTarget.style.backgroundColor = config.submit_button_hover_background_color || "#2563eb";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isSubmissionLimitReached ? "#dc2626" : (config.submit_button_background_color || "#3b82f6");
                  }}
                >
                  {isLoading ? (
                    <Spinner className={`w-[${Math.round(controlSizeMobile / 2)}px] h-[${Math.round(controlSizeMobile / 2)}px]`} />
                  ) : (
                    <ArrowUp strokeWidth={2.25} style={{ width: `${controlSizeMobile / 2.75}px`, height: `${controlSizeMobile / 2.75}px` }} />
                  )}
                </button>
              </div>

            </div>
          </div>
          
          {/* Submission Counter - Mobile */}
          {maxSubmissions > 0 && (
            <div className="absolute top-2 right-2 z-10">
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs ${
                isSubmissionLimitReached 
                  ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                  : 'bg-gray-100 text-gray-600 border border-gray-200'
              }`}>
                <div className={`w-1 h-1 rounded-full ${
                  isSubmissionLimitReached ? 'bg-amber-500' : 'bg-gray-400'
                }`}></div>
                <span>
                  {cappedSubmissionCount}/{maxSubmissions}
                </span>
                {isSubmissionLimitReached && (
                  <button 
                    onClick={() => window.location.reload()}
                    className="ml-1 text-amber-600 hover:text-amber-800 underline text-xs"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          )}
          
          {/* Mobile Suggestions */}
          {showSuggestions && (
            <div className="flex flex-wrap gap-2 px-1 mt-3">
              <button
                onClick={onRefreshSuggestions}
                className="flex items-center gap-2 transition-all duration-200 flex-shrink-0"
                disabled={isLoading}
                title="Refresh suggestions"
                style={{
                  backgroundColor: config.suggestion_background_color || 'rgba(255,255,255,0.70)',
                  border: `1px solid ${config.suggestion_border_color || hexToRgba("#000000", 0.10)}`,
                  color: config.suggestion_text_color || '#374151',
                  padding: `${Math.min(Math.max(6, 8 * effectiveScale), 12)}px ${Math.min(Math.max(10, 12 * effectiveScale), 16)}px`,
                  borderRadius: `${Math.min((config.suggestion_border_radius || 9999) * effectiveScale, 9999)}px`,
                  minHeight: `${Math.min(Math.max(28, 32 * effectiveScale), 40)}px`
                }}
              >
                <RefreshCw style={{ 
                  width: `${Math.min(Math.max(10, 12 * effectiveScale), 16)}px`, 
                  height: `${Math.min(Math.max(10, 12 * effectiveScale), 16)}px` 
                }} className="transition-colors" />
                <span className="text-sm" style={{ fontSize: `${Math.min(Math.max(10, (config.suggestion_font_size || 12) * effectiveScale), 14)}px` }}>
                  Refresh
                </span>
              </button>
              
              {suggestions.slice(0, suggestionCount || 3).map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => onSuggestionClick(suggestion)}
                  disabled={isLoading}
                  className="flex items-center gap-1 font-medium flex-shrink-0 max-w-[calc(50%-0.375rem)]"
                  title={suggestion.prompt}
                  style={{
                    backgroundColor: config.suggestion_background_color || 'rgba(255,255,255,0.70)',
                    border: `1px solid ${config.suggestion_border_color || hexToRgba("#000000", 0.10)}`,
                    color: config.suggestion_text_color || '#374151',
                    padding: `${Math.min(Math.max(6, 8 * effectiveScale), 12)}px ${Math.min(Math.max(10, 12 * effectiveScale), 16)}px`,
                    borderRadius: `${Math.min((config.suggestion_border_radius || 9999) * effectiveScale, 9999)}px`,
                    fontSize: `${Math.min(Math.max(10, (config.suggestion_font_size || 12) * effectiveScale), 14)}px`,
                    minHeight: `${Math.min(Math.max(28, 32 * effectiveScale), 40)}px`,
                    boxShadow: "none",
                  }}
                >
                  <span className="truncate">{suggestion.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Desktop version
  return (
    <div className={`relative flex flex-col h-full ${className}`} style={containerStyles}>
      <div className="flex flex-col min-h-0 overflow-visible h-full">
        {/* Desktop Composer (ChatGPT-like) */}
        <div className="flex-shrink-0 flex flex-col mt-2 overflow-visible">
          <div className="w-full">
            <div
              className={cn(
                "relative w-full transition-shadow",
                "focus-within:ring-2 focus-within:ring-[var(--composer-ring)] focus-within:ring-offset-0"
              )}
              style={{
                background: composerBg,
                borderRadius: `${composerRadius}px`,
                border: composerBorderWidth > 0 ? `${composerBorderWidth}px solid ${composerBorderColor}` : "none",
                boxShadow: composerShadow,
                padding: `${Math.min(Math.max(6, 7 * effectiveScale), 10)}px`,
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                ["--composer-ring" as any]: hexToRgba(primary, 0.28) || "rgba(59,130,246,0.28)",
              }}
            >
              <div className="flex items-center gap-3 w-full min-w-0">
                {config.uploader_enabled && (
                  <div data-tour="upload-area" className="flex-shrink-0">
                    <ImageUpload
                      onImageUpload={onImageUpload}
                      onImageRemove={onImageRemove}
                      currentImages={referenceImages}
                      maxImages={config.uploader_max_images ?? 1}
                      variant="chatgpt"
                      customStyles={{
                        button: {
                          width: controlSizeDesktop,
                          height: controlSizeDesktop,
                          borderRadius: 9999,
                          border: `1px solid ${hexToRgba("#000000", 0.08)}`,
                          backgroundColor: hexToRgba(primary, 0.08) || "rgba(59,130,246,0.08)",
                          boxShadow: "none",
                        },
                      }}
                      textSettings={{
                        secondaryText: config.uploader_secondary_text,
                        textColor: config.uploader_text_color,
                        fontFamily: config.uploader_font_family,
                        fontSize: config.uploader_font_size,
                      }}
                    />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <PromptInput
                  config={config}
                  value={prompt}
                  onChange={(val: string) => setPrompt(val)}
                  onSubmit={() => onPromptSubmit(prompt)}
                  disabled={isLoading}
                  effectiveScale={effectiveScale}
                  rows={1}
                  extraRightPaddingPx={0}
                  className="w-full"
                  style={{ width: '100%', minWidth: 0 }}
                  styleOverrides={{
                    height: `${controlSizeDesktop}px`,
                    minHeight: `${controlSizeDesktop}px`,
                    maxHeight: `${controlSizeDesktop}px`,
                    // Single-line <input>: keep padding-y at 0 for perfect centering.
                    padding: `0px ${promptPaddingX}px`,
                    paddingRight: `${promptPaddingX}px`,
                  }}
                />
                </div>

              <button
                data-tour="submit-button"
                onClick={() => onPromptSubmit(prompt)}
                disabled={isLoading || !prompt.trim() || isSubmissionLimitReached}
                className="flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-150 flex-shrink-0"
                style={{
                  backgroundColor: isSubmissionLimitReached ? "#dc2626" : (config.submit_button_background_color || primary),
                  color: config.submit_button_text_color || "#ffffff",
                  width: `${controlSizeDesktop}px`,
                  height: `${controlSizeDesktop}px`,
                  borderRadius: 9999,
                  border: "none",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.08)",
                }}
                title={isSubmissionLimitReached ? "You've reached your generation limit for this session." : undefined}
                aria-label="Generate"
                onMouseEnter={(e) => {
                  if (!isSubmissionLimitReached) {
                    e.currentTarget.style.backgroundColor = config.submit_button_hover_background_color || "#2563eb";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isSubmissionLimitReached ? "#dc2626" : (config.submit_button_background_color || "#3b82f6");
                }}
              >
                {isLoading ? (
                  <Spinner className={`w-[${Math.round(controlSizeDesktop / 2)}px] h-[${Math.round(controlSizeDesktop / 2)}px]`} />
                ) : (
                  <ArrowUp strokeWidth={2.25} style={{ width: `${controlSizeDesktop / 2.75}px`, height: `${controlSizeDesktop / 2.75}px` }} />
                )}
              </button>
            </div>

        </div>
        </div>
        
        {/* Submission status (kept out of the prompt surface) */}
        {maxSubmissions > 0 && (
          <div
            className="mt-2 px-1 text-xs"
            style={{ color: config.uploader_text_color || "#64748b" }}
          >
            {isSubmissionLimitReached ? (
              <span>
                Limit reached ({cappedSubmissionCount}/{maxSubmissions}).{" "}
                <button
                  onClick={() => window.location.reload()}
                  className="underline"
                  style={{ color: config.primary_color || "#2563eb" }}
                >
                  Reset
                </button>
              </span>
            ) : (
              <span>{cappedSubmissionCount}/{maxSubmissions} used</span>
            )}
          </div>
        )}
        
        {/* Desktop Suggestions */}
        {showSuggestions && (
          <div className="flex-shrink-0 mt-2 min-w-0 overflow-hidden">
            <div 
              className="flex flex-wrap items-center gap-2"
              style={{ 
                gap: `${4 * effectiveScale}px`,
                minHeight: `${24 * effectiveScale}px`
              }}
            >
              <button
                onClick={onRefreshSuggestions}
                className="flex items-center gap-2 transition-all duration-200 flex-shrink-0"
                disabled={isLoading}
                title="Refresh suggestions"
                style={{
                  backgroundColor: config.suggestion_background_color || 'rgba(255,255,255,0.70)',
                  border: `1px solid ${config.suggestion_border_color || hexToRgba("#000000", 0.10)}`,
                  color: config.suggestion_text_color || '#374151',
                  padding: `${Math.min(Math.max(6, 8 * effectiveScale), 12)}px ${Math.min(Math.max(10, 12 * effectiveScale), 16)}px`,
                  borderRadius: `${Math.min((config.suggestion_border_radius || 9999) * effectiveScale, 9999)}px`,
                  minHeight: `${Math.min(Math.max(28, 32 * effectiveScale), 40)}px`,
                  boxShadow: "none",
                }}
              >
                <RefreshCw style={{ 
                  width: `${Math.min(Math.max(10, 12 * effectiveScale), 16)}px`, 
                  height: `${Math.min(Math.max(10, 12 * effectiveScale), 16)}px` 
                }} className="transition-colors" />
                <span style={{ fontSize: `${Math.min(Math.max(10, (config.suggestion_font_size || 12) * effectiveScale), 14)}px` }}>
                  Refresh
                </span>
              </button>
              
              <div className="flex flex-wrap gap-1.5 flex-1 items-center min-w-0 overflow-hidden">
                {suggestions.slice(0, suggestionCount || 3).map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => onSuggestionClick(suggestion)}
                    disabled={isLoading}
                    className="flex items-center group transition-all duration-200 font-medium flex-shrink-0"
                    title={suggestion.prompt}
                    style={{
                      backgroundColor: config.suggestion_background_color || 'rgba(255,255,255,0.70)',
                      border: `1px solid ${config.suggestion_border_color || hexToRgba("#000000", 0.10)}`,
                      borderRadius: `${Math.min((config.suggestion_border_radius || 9999) * effectiveScale, 9999)}px`,
                      fontFamily: config.suggestion_font_family || 'inherit',
                      fontSize: `${Math.min(Math.max(10, (config.suggestion_font_size || 12) * effectiveScale), 14)}px`,
                      padding: `${Math.min(Math.max(6, 8 * effectiveScale), 12)}px ${Math.min(Math.max(10, 12 * effectiveScale), 16)}px`,
                      gap: `${Math.min(4 * effectiveScale, 6)}px`,
                      minHeight: `${Math.min(Math.max(24, 28 * effectiveScale), 32)}px`,
                      maxWidth: containerWidth < 500 ? 'calc(100% - 0.375rem)' : 'calc(50% - 0.375rem)',
                      boxShadow: "none"
                    }}
                  >
                    <span 
                      className="group-hover:opacity-90 transition-opacity truncate"
                      style={{ 
                        color: config.suggestion_text_color || '#374151',
                        maxWidth: '100%'
                      }}
                    >
                      {suggestion.text}
                    </span>
                    {(config.suggestion_arrow_icon ?? true) && (
                      <ArrowUpRight 
                        className="flex-shrink-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        style={{ 
                          color: config.suggestion_text_color || '#6b7280',
                          width: `${Math.min(Math.max(10, 12 * effectiveScale), 14)}px`,
                          height: `${Math.min(Math.max(10, 12 * effectiveScale), 14)}px`
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
} 
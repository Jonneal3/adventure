"use client";

import React, { useMemo } from "react";
import { ArrowUp } from "lucide-react";
import Image from "next/image";

import { DesignSettings, hexToRgba } from "../../../types";
import { Suggestion } from "../../../lib/suggestions";
import { cn } from "../../../lib/utils";
import { ImageUpload } from "../user-input-section/ImageUpload.Widget";
import { PromptInput } from "../user-input-section/PromptInput";
import { useInstanceImages } from "../../../hooks/use-instance-images";

type SampleImage = {
  id?: string;
  image?: string;
  prompt?: string | null;
};

interface JourneyStartProps {
  config: DesignSettings;
  instanceId?: string;
  showSampleGallery?: boolean;
  prompt: string;
  setPrompt: (prompt: string) => void;
  isGenerating?: boolean;
  suggestions: Suggestion[];
  referenceImages: string[];
  onPromptSubmit: (prompt: string) => void;
  onSuggestionClick: (suggestion: Suggestion) => void;
  onImageUpload: (imageData: string | null) => void;
  onImageRemove: (index: number) => void;
  onRefreshSuggestions: () => void;
  isSubmissionLimitReached?: boolean;
  submissionCount?: number;
  maxSubmissions?: number;
}

export function JourneyStart({
  config,
  instanceId,
  showSampleGallery = true,
  prompt,
  setPrompt,
  isGenerating,
  suggestions,
  referenceImages,
  onPromptSubmit,
  onSuggestionClick,
  onImageUpload,
  onImageRemove,
  onRefreshSuggestions,
  isSubmissionLimitReached = false,
  submissionCount,
  maxSubmissions,
}: JourneyStartProps) {
  const accent = config.primary_color || "#111827";
  const surface = config.prompt_input_background_color || config.secondary_color || "rgba(255,255,255,0.72)";
  const border = config.prompt_input_border_color || config.prompt_border_color || hexToRgba("#000000", 0.1);
  const text = config.prompt_text_color || config.brand_name_color || "#0f172a";
  const muted = config.uploader_text_color || config.cta_color || "#475569";
  const radius = config.prompt_border_radius ?? config.border_radius ?? 14;
  const controlSize = 44;
  const composerRadius = 9999;
  const submitBtnHover =
    config.submit_button_hover_background_color || config.submit_button_background_color || accent;
  const submitButtonStyle = {
    backgroundColor: isSubmissionLimitReached ? "#dc2626" : (config.submit_button_background_color || accent),
    color: config.submit_button_text_color || "#ffffff",
    width: `${controlSize}px`,
    height: `${controlSize}px`,
    borderRadius: `9999px`,
    border: `1px solid ${hexToRgba("#000000", 0.10)}`,
    boxShadow: "none",
    ["--submit-btn-hover"]: submitBtnHover,
  } as React.CSSProperties & Record<string, string>;

  const limitLabel = (() => {
    const max = typeof maxSubmissions === "number" ? maxSubmissions : null;
    const count = typeof submissionCount === "number" ? submissionCount : null;
    if (!max || max <= 0) return null;
    if (count === null || count < 0) return null;
    const capped = Math.min(count, max);
    return `${capped}/${max}`;
  })();

  // Match the "clean composer" surface used elsewhere (border + subtle lift).
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

  const shouldShowSamples = Boolean(showSampleGallery && instanceId && config.gallery_show_placeholder_images === true);
  const { images: sampleImages, loading: sampleLoading } = useInstanceImages(shouldShowSamples ? instanceId! : null);
  const visibleSamples = useMemo(() => (sampleImages as SampleImage[] | undefined || []).slice(0, 4), [sampleImages]);

  const shownSuggestions = useMemo(() => {
    if (config.suggestions_enabled === false) return [];
    const n = typeof config.suggestions_count === "number" ? config.suggestions_count : 3;
    // Visually keep it light on the start screen as well.
    return (suggestions || []).slice(0, Math.max(0, Math.min(3, n)));
  }, [config.suggestions_enabled, config.suggestions_count, suggestions]);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="min-h-full w-full flex items-start md:items-center justify-center px-6 py-10">
          <div className="w-full max-w-3xl mx-auto">
            <div className="flex flex-col items-center gap-6">
              {shouldShowSamples && (
                <div className="w-full">
                  {sampleLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(Array.from({ length: 4 }, () => null) as Array<SampleImage | null>).map((_, idx) => (
                        <div
                          key={`skeleton-${idx}`}
                          className="relative w-full aspect-[16/10] overflow-hidden border"
                          style={{
                            borderColor: border,
                            borderRadius: `${Math.max(10, Math.round(radius * 0.8))}px`,
                            backgroundColor: surface,
                            boxShadow: "0 10px 26px rgba(0,0,0,0.10)",
                          }}
                        >
                          <div className="absolute inset-0 animate-pulse" style={{ backgroundColor: hexToRgba(accent, 0.08) }} />
                        </div>
                      ))}
                    </div>
                  ) : visibleSamples.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {visibleSamples.map((img, idx: number) => {
                        const src = img?.image ? String(img.image) : "";
                        const promptText = img?.prompt ? String(img.prompt) : "";
                        return (
                          <button
                            key={img?.id || `${src}-${idx}`}
                            type="button"
                            onClick={() => {
                              if (promptText) setPrompt(promptText);
                            }}
                            disabled={!promptText}
                            className={cn(
                              "relative w-full aspect-[16/10] overflow-hidden border text-left group",
                              "disabled:opacity-70 disabled:cursor-not-allowed"
                            )}
                            style={{
                              borderColor: border,
                              borderRadius: `${Math.max(10, Math.round(radius * 0.8))}px`,
                              backgroundColor: surface,
                              boxShadow: "0 10px 26px rgba(0,0,0,0.10)",
                            }}
                          >
                            <Image
                              src={src}
                              alt="Sample"
                              fill
                              className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                            <div className="absolute bottom-0 left-0 right-0 p-3">
                              <div className="text-xs font-medium text-white line-clamp-2">
                                {promptText || "Use this prompt"}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              )}

              {shownSuggestions.length > 0 && (
                <div className="w-full flex items-center justify-center gap-2 overflow-x-auto hide-scrollbar">
                  {shownSuggestions.map((s, idx) => (
                    <button
                      key={`${s.text}-${idx}`}
                      type="button"
                      onClick={() => onSuggestionClick(s)}
                      className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all hover:opacity-90 active:scale-95 border"
                      style={{
                        backgroundColor: config.suggestion_background_color || surface,
                        color: config.suggestion_text_color || text,
                        borderColor: config.suggestion_border_color || border,
                        borderRadius: `${config.suggestion_border_radius ?? 9999}px`,
                        fontFamily: config.suggestion_font_family || config.prompt_font_family || "inherit",
                        fontSize: `${config.suggestion_font_size ?? 12}px`,
                      }}
                    >
                      {s.text}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={onRefreshSuggestions}
                    className="flex-shrink-0 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all hover:opacity-90 active:scale-95 border flex items-center gap-2"
                    style={{
                      backgroundColor: config.suggestion_background_color || surface,
                      color: config.suggestion_text_color || text,
                      borderColor: config.suggestion_border_color || border,
                      borderRadius: `${config.suggestion_border_radius ?? 9999}px`,
                      fontFamily: config.suggestion_font_family || config.prompt_font_family || "inherit",
                      fontSize: `${config.suggestion_font_size ?? 12}px`,
                    }}
                    title="Refresh suggestions"
                  >
                    <span>Refresh</span>
                  </button>
                </div>
              )}

              <div
                className="w-full border backdrop-blur-md"
                style={{
                  backgroundColor: surface,
                  borderColor: border,
                  borderRadius: `${composerRadius}px`,
                  boxShadow: composerShadow,
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                }}
              >
                <div className="flex items-center gap-2 px-2 py-2">
                  {config.uploader_enabled !== false && (
                    <div className="flex-shrink-0" data-tour="upload-area">
                      <ImageUpload
                        onImageUpload={onImageUpload}
                        onImageRemove={onImageRemove}
                        currentImages={referenceImages}
                        maxImages={config.uploader_max_images ?? 1}
                        variant="chatgpt"
                        customStyles={{
                          button: {
                            width: controlSize,
                            height: controlSize,
                            borderRadius: 9999,
                            border: `1px solid ${hexToRgba("#000000", 0.08)}`,
                            backgroundColor: hexToRgba(accent, 0.08) || "rgba(15,23,42,0.06)",
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
                      onChange={(val) => setPrompt(val)}
                      onSubmit={() => onPromptSubmit(prompt)}
                      disabled={Boolean(isGenerating)}
                      rows={1}
                      extraRightPaddingPx={0}
                      className="w-full"
                      styleOverrides={{
                        backgroundColor: "transparent",
                        border: "none",
                        borderRadius: "0px",
                        height: `${controlSize}px`,
                        minHeight: `${controlSize}px`,
                        maxHeight: `${controlSize}px`,
                        padding: "10px 12px",
                      }}
                    />
                  </div>

                  <button
                    data-tour="submit-button"
                    type="button"
                    onClick={() => onPromptSubmit(prompt)}
                    disabled={Boolean(isGenerating) || !prompt.trim() || isSubmissionLimitReached}
                    className={cn(
                      "flex-shrink-0 flex items-center justify-center rounded-full text-white",
                      "disabled:opacity-50 disabled:cursor-not-allowed",
                      "transition-all duration-150 hover:bg-[var(--submit-btn-hover)]"
                    )}
                    style={submitButtonStyle}
                    aria-label="Generate"
                    title={
                      isSubmissionLimitReached
                        ? limitLabel
                          ? `Limit reached: ${limitLabel} generations`
                          : "Limit reached"
                        : undefined
                    }
                  >
                    <ArrowUp strokeWidth={2.5} className="w-4 h-4" />
                  </button>
                </div>

              </div>

              {isSubmissionLimitReached && (
                <div className="text-center text-xs" style={{ color: muted }}>
                  You’ve reached the generation limit for this session{limitLabel ? ` (${limitLabel})` : ""}.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

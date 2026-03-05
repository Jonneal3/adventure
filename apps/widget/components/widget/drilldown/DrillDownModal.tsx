"use client";

import React, { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Download, Plus, RefreshCw, Image as ImageIcon } from "lucide-react";
import { DesignSettings } from "../../../types";
import { Suggestion } from "../../../lib/suggestions";
import { Button } from "../../ui/button";
import { imageHelpers } from "../../../lib/image-helpers";
import { Textarea } from "../../ui/textarea";

interface DrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedImage: string | null;
  config: DesignSettings;
  prompt: string;
  setPrompt: (prompt: string) => void;
  isLoading: boolean;
  suggestions: Suggestion[];
  referenceImages: string[];
  generatedImages: Array<{ image: string | null }>;
  containerWidth?: number;
  onPromptSubmit: (prompt: string) => void;
  onSuggestionClick: (suggestion: Suggestion) => void;
  onImageUpload: (
    imageData: string | null,
    opts?: { suppressAutoRegenerate?: boolean; source?: string }
  ) => void;
  onImageRemove: (index: number) => void;
  onRefreshSuggestions: () => void;
  onReplaceImage?: (imageData: string) => void;
  originalPrompt?: string;
  instanceId?: string;
  // Lead capture plumbing
  hasSubmitted?: boolean;
  onRequestLeadCapture?: () => void;
}

export function DrillDownModal({
  isOpen,
  onClose,
  selectedImage,
  config,
  prompt,
  setPrompt,
  isLoading,
  suggestions,
  referenceImages,
  generatedImages,
  containerWidth = 1024,
  onPromptSubmit,
  onSuggestionClick,
  onImageUpload,
  onImageRemove,
  onRefreshSuggestions,
  onReplaceImage,
  originalPrompt,
  instanceId,
  hasSubmitted,
  onRequestLeadCapture
}: DrillDownModalProps) {
  const closeOnEscape = config.modal_close_on_escape !== false;
  const closeOnBackdrop = config.modal_close_on_backdrop !== false;
  const showCloseButton = config.modal_show_close_button !== false;
  const animationDuration =
    typeof config.modal_animation_duration === "number" ? config.modal_animation_duration : 200;

  const isEditMode = Boolean(selectedImage);
  const title = isEditMode ? "Edit image" : "Manage placeholder images";
  const subtitle = isEditMode
    ? "Describe a small change. Use + to add this image to uploads."
    : "Generate and curate your placeholder gallery.";

  const accent = config.submit_button_background_color || config.primary_color || "#2563eb";
  const bg = config.background_color || "#ffffff";
  const surface = config.prompt_background_color || config.prompt_input_background_color || "#f8fafc";
  const text = config.prompt_text_color || "#0f172a";
  const muted = config.uploader_text_color || config.cta_color || "#64748b";
  const border = config.prompt_border_color || "rgba(0,0,0,0.12)";

  const safeSuggestions = useMemo(() => (Array.isArray(suggestions) ? suggestions : []), [suggestions]);
  const suggestionPills = useMemo(() => safeSuggestions.slice(0, 6), [safeSuggestions]);

  const [modalPrompt, setModalPrompt] = useState(prompt);

  // Reset modal state when modal opens/closes (avoid noisy prompt re-sync while typing)
  useEffect(() => {
    if (isOpen) {
      setModalPrompt(prompt);
    } else {
      setModalPrompt("");
    }
  }, [isOpen]); // intentionally do not depend on `prompt`

  const handleDownload = async () => {
    // Gate download with lead capture when configured
    if (config.lead_capture_enabled && (config as any).lead_capture_trigger === 'download' && !hasSubmitted) {
      onRequestLeadCapture?.();
      return;
    }
    if (!selectedImage) return;
    try {
      // Test if the image is accessible
      let imageUrl = selectedImage;
      if (selectedImage.startsWith('/') && !selectedImage.startsWith('//')) {
        // Convert relative URL to absolute URL for testing
        imageUrl = `${window.location.origin}${selectedImage}`;
      }
      
      if (imageUrl.startsWith('http')) {
        const testResponse = await fetch(imageUrl, { method: 'HEAD' });
        if (!testResponse.ok) {
          throw new Error(`Image URL not accessible: ${testResponse.status}`);
        }
      }
      
      await imageHelpers.shareOrDownload(selectedImage, 'generated');
    } catch (error) {
      console.error('Failed to download image:', error);
      // Could add toast notification here if needed
    }
  };

  const handleSetAsMainImage = () => {
    if (!selectedImage) return;
    // Add to uploads without triggering auto-regenerate.
    onImageUpload(selectedImage, { suppressAutoRegenerate: true, source: "drilldown_add_reference" });
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalPrompt.trim()) return;
    // Keep main prompt in sync, but delegate generation to parent (single source of truth).
    setPrompt(modalPrompt);
    onPromptSubmit(modalPrompt);
  };

  const handleSuggestionClick = (suggestion: Suggestion) => {
    onSuggestionClick?.(suggestion);
    const next = (suggestion.prompt || suggestion.text || "").trim();
    if (!next) return;
    setModalPrompt(next);
    // Auto-submit for speed.
    setPrompt(next);
    onPromptSubmit(next);
  };

  const handleRefreshSuggestions = async () => {
    try {
      await onRefreshSuggestions();
    } catch (error) {
      console.error('Failed to refresh suggestions:', error);
    }
  };

  // Escape-to-close behavior
  useEffect(() => {
    if (!isOpen) return;
    if (!closeOnEscape) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, closeOnEscape]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      style={{
        backgroundColor: (config as any)?.overlay_background_color || `rgba(0, 0, 0, 0.4)`,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          if (closeOnBackdrop) onClose();
        }
      }}
    >
      <div
        className="relative w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col rounded-3xl shadow-2xl border"
        style={{
          backgroundColor: bg,
          borderColor: border,
          fontFamily: config.overlay_font_family || config.prompt_font_family || "inherit",
          animationDuration: `${animationDuration}ms`,
        }}
      >
        {/* Top bar */}
        <div
          className="flex items-center justify-between px-4 sm:px-6 py-4 border-b"
          style={{ borderColor: border, backgroundColor: bg }}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: accent }} />
              <h2 className="text-base sm:text-lg font-semibold truncate" style={{ color: text }}>
                {title}
              </h2>
            </div>
            <p className="text-xs sm:text-sm truncate" style={{ color: muted }}>
              {subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              disabled={!selectedImage}
              className="h-9 w-9 p-0"
              style={{ color: text, backgroundColor: "transparent" }}
              title={selectedImage ? "Download" : "Download is available in edit mode"}
              aria-label="Download"
            >
              <Download className="w-4 h-4" />
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSetAsMainImage}
              disabled={!selectedImage}
              className="h-9 w-9 p-0"
              style={{ color: text, backgroundColor: "transparent" }}
              title={selectedImage ? "Add to uploads" : "Add to uploads is available in edit mode"}
              aria-label="Add to uploads"
            >
              <Plus className="w-4 h-4" />
            </Button>

            {showCloseButton && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-9 w-9 p-0"
                style={{ color: text }}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Left: preview */}
            <div className="min-h-0 border-b lg:border-b-0 lg:border-r p-4 sm:p-6 flex flex-col gap-4"
              style={{ borderColor: border }}
            >
              <div className="flex-1 min-h-0 flex items-center justify-center">
                {selectedImage ? (
                  <div
                    className="w-full max-w-[min(70vh,820px)] aspect-square overflow-hidden rounded-2xl border"
                    style={{ borderColor: border, backgroundColor: surface }}
                  >
                    <img src={selectedImage} alt="Selected image" className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div
                    className="w-full max-w-[min(70vh,820px)] aspect-square rounded-2xl border flex items-center justify-center"
                    style={{ borderColor: border, backgroundColor: surface, color: muted }}
                  >
                    <div className="text-center px-6">
                      <div className="mx-auto mb-3 h-12 w-12 rounded-2xl border flex items-center justify-center"
                        style={{ borderColor: border, backgroundColor: bg }}
                      >
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <div className="text-sm font-medium" style={{ color: text }}>
                        No image selected
                      </div>
                      <div className="text-xs mt-1" style={{ color: muted }}>
                        Use the prompt to generate placeholder images.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {originalPrompt && (
                <div className="text-xs leading-relaxed line-clamp-3" style={{ color: muted }}>
                  <span className="font-medium" style={{ color: text }}>
                    Original prompt:
                  </span>{" "}
                  {originalPrompt}
                </div>
              )}
            </div>

            {/* Right: prompt + suggestions */}
            <div className="min-h-0 p-4 sm:p-6 overflow-auto">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium" style={{ color: text }}>
                    Prompt
                  </label>
                  <Textarea
                    value={modalPrompt}
                    onChange={(e) => setModalPrompt(e.target.value)}
                    placeholder={
                      isEditMode
                        ? "Describe the change you want (keep it subtle)…"
                        : "Describe the placeholder gallery you want to create…"
                    }
                    className="min-h-[120px] resize-none rounded-2xl"
                    style={{
                      backgroundColor: surface,
                      borderColor: border,
                      color: text,
                      fontFamily: config.prompt_font_family || "inherit",
                      fontSize: `${config.prompt_font_size || 14}px`,
                    }}
                  />
                  {referenceImages?.length > 1 && !isEditMode && (
                    <div className="text-xs" style={{ color: muted }}>
                      Note: multiple reference images may be rejected by some generation routes.
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end">
                  <Button
                    type="submit"
                    disabled={!modalPrompt.trim() || Boolean(isLoading)}
                    className="rounded-xl h-10 px-4"
                    style={{
                      backgroundColor: accent,
                      color: config.submit_button_text_color || "#ffffff",
                      fontFamily: config.prompt_font_family || "inherit",
                    }}
                  >
                    {isEditMode ? "Apply" : "Generate"}
                  </Button>
                </div>
              </form>

              {suggestionPills.length > 0 && (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-sm font-medium" style={{ color: text }}>
                      Suggestions
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRefreshSuggestions}
                      className="h-8 w-8 p-0"
                      style={{ color: muted }}
                      aria-label="Refresh suggestions"
                      title="Refresh"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestionPills.map((s, idx) => {
                      const label = (s.text || s.prompt || "").trim();
                      if (!label) return null;
                      return (
                        <button
                          key={`${label}-${idx}`}
                          type="button"
                          onClick={() => handleSuggestionClick(s)}
                          className="px-3 py-1.5 rounded-full border text-xs hover:opacity-90 transition"
                          style={{
                            borderColor: border,
                            backgroundColor: bg,
                            color: text,
                          }}
                          title={s.prompt || s.text}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
} 

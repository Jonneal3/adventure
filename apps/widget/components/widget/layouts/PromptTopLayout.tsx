"use client";

import { DesignSettings } from "../../../types";
import { Suggestion } from "../../../lib/suggestions";
import { ImageGallery } from "../gallery/ImageGallery";
import { UserInputSection } from "../user-input-section/UserInputSection";
import { GalleryViewport } from "./GalleryViewport";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { JourneyStart } from "./JourneyStart";

interface PromptTopLayoutProps {
  config: DesignSettings;
  prompt: string;
  setPrompt: (prompt: string) => void;
  isLoading: boolean;
  isGenerating?: boolean; // Add this prop
  suggestions: Suggestion[];
  referenceImages: string[];
  generatedImages: Array<{ image: string | null }>;
  fullPage?: boolean;
  deployment?: boolean;
  containerWidth?: number;
  instanceId?: string;
  onGenerateGallery?: () => void;
  onResetToSampleGallery?: () => void; // Add this prop
  onPromptSubmit: (prompt: string) => void;
  onDrillDownSubmit?: (drillDownPrompt: string, selectedImage: string) => void;
  onSuggestionClick: (suggestion: Suggestion) => void;
  onImageUpload: (imageData: string | null) => void;
  onImageRemove: (index: number) => void;
  onRefreshSuggestions: () => void;
  onReplaceImage?: (imageData: string) => void;
  originalPrompt?: string;
  isSubmissionLimitReached?: boolean;
  submissionCount?: number;
  maxSubmissions?: number;
  hideInMobile?: boolean;
  refreshTrigger?: number;
  error?: string | null;
  setError?: (error: string | null) => void;
  // Lead capture plumbing
  hasSubmitted?: boolean;
  onRequestLeadCapture?: () => void;
  onMeasuredAspectChange?: (aspect: string) => void;
}

export function PromptTopLayout({
  config,
  prompt,
  setPrompt,
  isLoading,
  isGenerating, // Add this parameter
  suggestions,
  referenceImages,
  generatedImages,
  fullPage = false,
  deployment = false,
  containerWidth = 1024,
  instanceId,
  onGenerateGallery,
  onResetToSampleGallery,
  onPromptSubmit,
  onDrillDownSubmit,
  onSuggestionClick,
  onImageUpload,
  onImageRemove,
  onRefreshSuggestions,
  onReplaceImage,
  originalPrompt,
  isSubmissionLimitReached = false,
  submissionCount = 0,
  maxSubmissions = 10,
  refreshTrigger,
  hasSubmitted,
  onRequestLeadCapture,
  onMeasuredAspectChange
}: PromptTopLayoutProps) {
  // Separate height control from visual scaling
  const promptSectionHeight = Math.max(20, Math.min(50, config.prompt_section_height || 30)); // 20-50% range
  // Width control for top/bottom layouts (percentage of container)
  const promptSectionWidth = Math.max(50, Math.min(80, config.prompt_section_width ?? 60)); // 50-80% range, default 60%
  const reduceMotion = useReducedMotion();
  const effectiveScale = Math.max(0.75, Math.min(1.5, config.ui_scale ?? 1.0));
  const alignment = config.prompt_section_alignment || "center";
  const alignmentClass =
    alignment === "left" ? "justify-start" : alignment === "right" ? "justify-end" : "justify-center";

  // Calculate gallery width based on columns (responsive)
  const isMultiColumn = (config.gallery_columns || 3) >= 2;
  const galleryMaxWidthPercent = isMultiColumn ? 95 : 70; // Percentage of container
  const galleryContainerWidth = containerWidth * (galleryMaxWidthPercent / 100);

  // Configurable layering and gap
  const promptZ = typeof config.prompt_z_index === 'number' ? config.prompt_z_index : 20;
  const galleryZ = typeof config.gallery_z_index === 'number' ? config.gallery_z_index : 1;
  const allowUnderScroll = config.gallery_scrolls_under_prompt !== false; // default true
  const promptBorderWidth = config.prompt_border_width ?? 1;
  const promptBorderStyle = config.prompt_border_style ?? "solid";
  const promptBorderColor = config.prompt_border_color ?? "#e5e7eb";
  const promptBorder =
    promptBorderStyle === "none" || promptBorderWidth <= 0
      ? "none"
      : `${promptBorderWidth}px ${promptBorderStyle} ${promptBorderColor}`;
  const promptRadius = config.prompt_border_radius ?? config.border_radius ?? 12;
  const hasRealGeneratedImages = (generatedImages || []).some((img) => {
    const src = img?.image;
    return Boolean(src) && typeof src === "string" && !src.startsWith("/homepage/");
  });
  const showJourneyStart = !isGenerating && !hasRealGeneratedImages;
  const sampleGalleryEnabled =
    (config.gallery_sample_gallery_enabled ?? true) &&
    config.gallery_show_placeholder_images === true;

  return (
    <div 
      className="h-full w-full flex flex-col relative overflow-hidden"
      style={{
        // STRICTLY RESPECT GOD CONTAINER - NO OVERFLOW ALLOWED
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        overflow: 'hidden',
        gap: 0
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {showJourneyStart ? (
          <motion.div
            key="journey"
            initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
            transition={reduceMotion ? undefined : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="h-full w-full"
          >
            <JourneyStart
              config={config}
              instanceId={instanceId}
              showSampleGallery={sampleGalleryEnabled}
              prompt={prompt}
              setPrompt={setPrompt}
              isGenerating={isGenerating}
              suggestions={suggestions}
              referenceImages={referenceImages}
              onPromptSubmit={onPromptSubmit}
              onSuggestionClick={onSuggestionClick}
              onImageUpload={onImageUpload}
              onImageRemove={onImageRemove}
              onRefreshSuggestions={onRefreshSuggestions}
              isSubmissionLimitReached={isSubmissionLimitReached}
              submissionCount={submissionCount}
              maxSubmissions={maxSubmissions}
            />
          </motion.div>
        ) : (
          <motion.div
            key="full"
            initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={reduceMotion ? undefined : { duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="h-full w-full flex flex-col"
          >
            {/* Prompt Section */}
            <div
              className={`flex-shrink-0 flex ${alignmentClass}`}
              style={{
                height: `${promptSectionHeight}%`,
                minHeight: "120px",
                maxHeight: "50%",
                transition: "height 0.3s ease-in-out",
                overflow: "visible",
                position: allowUnderScroll ? "sticky" : "relative",
                top: allowUnderScroll ? 0 : undefined,
                zIndex: promptZ,
              }}
            >
              <motion.div
                initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
                animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                transition={reduceMotion ? undefined : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
                data-alignment={alignment}
                style={{
                  width: "100%",
                  maxWidth: `${promptSectionWidth}%`,
                  height: "100%",
                  maxHeight: "100%",
                  backgroundColor: "transparent",
                  borderRadius: 0,
                  border: "none",
                  position: "relative",
                  overflow: "visible",
                  display: "flex",
                  flexDirection: "column",
                  boxSizing: "border-box",
                }}
              >
                <UserInputSection
                  config={config}
                  prompt={prompt}
                  setPrompt={setPrompt}
                  isLoading={isLoading}
                  suggestions={suggestions}
                  referenceImages={referenceImages}
                  onPromptSubmit={onPromptSubmit}
                  onSuggestionClick={onSuggestionClick}
                  onImageUpload={onImageUpload}
                  onImageRemove={onImageRemove}
                  onRefreshSuggestions={onRefreshSuggestions}
                  variant="desktop"
                  heightScaleFactor={effectiveScale}
                  containerWidth={containerWidth}
                  isSubmissionLimitReached={isSubmissionLimitReached}
                  submissionCount={submissionCount}
                  maxSubmissions={maxSubmissions}
                  style={{
                    height: "100%",
                    maxHeight: "100%",
                    overflow: "visible",
                    display: "flex",
                    flexDirection: "column",
                  }}
                />
              </motion.div>
            </div>

            {/* Gallery Section */}
            <motion.div
              initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={reduceMotion ? undefined : { duration: 0.26, delay: 0.03, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 min-h-0 flex justify-center items-start overflow-hidden"
              style={{
                minHeight: "200px",
                maxHeight: "100%",
                position: "relative",
                zIndex: allowUnderScroll ? Math.min(galleryZ, promptZ - 1) : galleryZ,
                flexShrink: 1,
                clear: "both",
              }}
            >
              <div
                style={{
                  maxWidth: `${galleryMaxWidthPercent}%`,
                  width: "100%",
                  height: "100%",
                  maxHeight: "100%",
                  margin: "0 auto",
                  position: "relative",
                  overflow: "hidden",
                  boxSizing: "border-box",
                }}
              >
                <GalleryViewport
                  style={{ height: "100%", maxHeight: "100%" }}
                  onMeasuredAspectChange={onMeasuredAspectChange}
                >
                  {(gallerySize) => (
                    <ImageGallery
                      images={generatedImages}
                      isLoading={isLoading}
                      config={config}
                      fullPage={fullPage}
                      deployment={deployment}
                      layoutContext="vertical"
                      containerWidth={gallerySize.width || galleryContainerWidth}
                      containerHeight={gallerySize.height || 400}
                      instanceId={instanceId}
                      onGenerateGallery={onGenerateGallery}
                      prompt={prompt}
                      setPrompt={setPrompt}
                      suggestions={suggestions}
                      referenceImages={referenceImages}
                      onPromptSubmit={onPromptSubmit}
                      onDrillDownSubmit={onDrillDownSubmit}
                      onSuggestionClick={onSuggestionClick}
                      onImageUpload={onImageUpload}
                      onImageRemove={onImageRemove}
                      onRefreshSuggestions={onRefreshSuggestions}
                      onReplaceImage={onReplaceImage}
                      originalPrompt={originalPrompt}
                      refreshTrigger={refreshTrigger}
                      onResetToSampleGallery={onResetToSampleGallery}
                      isGenerating={isGenerating}
                      hasSubmitted={hasSubmitted}
                      onRequestLeadCapture={onRequestLeadCapture}
                    />
                  )}
                </GalleryViewport>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

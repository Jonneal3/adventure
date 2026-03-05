"use client";

import { DesignSettings } from "../../../types";
import { Suggestion } from "../../../lib/suggestions";
import { ImageGallery } from "../gallery/ImageGallery";
import { UserInputSection } from "../user-input-section/UserInputSection";
import { MobileLayout } from "./MobileLayout";
import { GalleryViewport } from "./GalleryViewport";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { JourneyStart } from "./JourneyStart";

interface LeftRightLayoutProps {
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
  onPromptSubmit: (prompt?: string) => void;
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
  // Lead capture plumbing
  hasSubmitted?: boolean;
  onRequestLeadCapture?: () => void;
  onMeasuredAspectChange?: (aspect: string) => void;
}

export function LeftRightLayout({
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
  hideInMobile = false,
  refreshTrigger,
  hasSubmitted,
  onRequestLeadCapture,
  onMeasuredAspectChange
}: LeftRightLayoutProps) {
  const isMobile = containerWidth < 768;
  const reduceMotion = useReducedMotion();

  // Clamp inter-panel gap for aesthetics (8px–24px)
  const galleryGapPx = Math.min(24, Math.max(8, config.prompt_gallery_spacing ?? 24));
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

  // For mobile, use MobileLayout
  if (isMobile) {
    return (
      <MobileLayout
        config={config}
        prompt={prompt}
        setPrompt={setPrompt}
        isLoading={isLoading}
        isGenerating={isGenerating}
        suggestions={suggestions}
        referenceImages={referenceImages}
        generatedImages={generatedImages}
        fullPage={fullPage}
        deployment={deployment}
        containerWidth={containerWidth}
        instanceId={instanceId}
        onGenerateGallery={onGenerateGallery}
        onResetToSampleGallery={onResetToSampleGallery}
        onPromptSubmit={onPromptSubmit}
        onDrillDownSubmit={onDrillDownSubmit}
        onSuggestionClick={onSuggestionClick}
        onImageUpload={onImageUpload}
        onImageRemove={onImageRemove}
        onRefreshSuggestions={onRefreshSuggestions}
        onReplaceImage={onReplaceImage}
        originalPrompt={originalPrompt}
        isSubmissionLimitReached={isSubmissionLimitReached}
        submissionCount={submissionCount}
        maxSubmissions={maxSubmissions}
        hideInMobile={hideInMobile}
          refreshTrigger={refreshTrigger}
          hasSubmitted={hasSubmitted}
          onRequestLeadCapture={onRequestLeadCapture}
      />
    );
  }

  return (
    <div 
      className="h-full w-full flex flex-col overflow-hidden"
      style={{
        // STRICTLY RESPECT GOD CONTAINER - NO OVERFLOW ALLOWED
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        overflow: 'hidden'
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
              onPromptSubmit={(p) => onPromptSubmit(p)}
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
            className="flex-1 flex min-h-0 overflow-hidden"
            style={{ gap: galleryGapPx }}
          >
            {/* Left Side - Prompt Section */}
            <motion.div
              initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={reduceMotion ? undefined : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              layout
              className="flex-shrink-0 flex flex-col relative"
              style={{ 
                width: `${Math.max(18, Math.min(40, config.prompt_section_width || 28))}%`,
                height: '100%',
                backgroundColor: 'transparent',
                borderRadius: 0,
                border: 'none',
                overflow: 'visible'
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
                containerWidth={containerWidth}
                style={{ height: '100%', overflow: 'hidden' }}
                isSubmissionLimitReached={isSubmissionLimitReached}
                submissionCount={submissionCount}
                maxSubmissions={maxSubmissions}
              />
            </motion.div>

            {/* Right Side - Gallery */}
            <motion.div
              initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
              animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
              transition={reduceMotion ? undefined : { duration: 0.26, delay: 0.03, ease: [0.16, 1, 0.3, 1] }}
              className="flex-1 min-h-0 relative overflow-hidden"
            >
              <div className="absolute inset-0 p-2 md:p-3 overflow-hidden">
                <GalleryViewport
                  className="overflow-auto"
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
                      containerWidth={gallerySize.width || containerWidth * 0.6}
                      containerHeight={
                        gallerySize.height ||
                        (typeof window !== "undefined" ? window.innerHeight * 0.8 : 0)
                      }
                      instanceId={instanceId}
                      onGenerateGallery={onGenerateGallery}
                      prompt={prompt}
                      setPrompt={setPrompt}
                      suggestions={suggestions}
                      referenceImages={referenceImages}
                      onPromptSubmit={(p: string) => onPromptSubmit(p)}
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

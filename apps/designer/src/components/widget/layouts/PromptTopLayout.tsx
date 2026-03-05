"use client";

import { DesignSettings, getEffectivePadding } from "@mage/types";
import { Suggestion } from "@/lib/suggestions";
import { ImageGallery } from "../ImageGallery";
import { UserInputSection } from "../UserInputSection";

interface PromptTopLayoutProps {
  config: DesignSettings;
  prompt: string;
  setPrompt: (prompt: string) => void;
  isLoading: boolean;
  suggestions: Suggestion[];
  referenceImages: string[];
  generatedImages: Array<{ image: string | null }>;
  fullPage?: boolean;
  deployment?: boolean;
  containerWidth?: number;
  instanceId?: string;
  onGenerateGallery?: () => void;
  onPromptSubmit: (prompt: string) => void;
  onSuggestionClick: (suggestion: Suggestion) => void;
  onImageUpload: (imageData: string | null) => void;
  onImageRemove: (index: number) => void;
  onRefreshSuggestions: () => void;
  isSubmissionLimitReached?: boolean;
  submissionCount?: number;
  maxSubmissions?: number;
  hideInMobile?: boolean;
}

export function PromptTopLayout({
  config,
  prompt,
  setPrompt,
  isLoading,
  suggestions,
  referenceImages,
  generatedImages,
  fullPage = false,
  deployment = false,
  containerWidth = 1024,
  instanceId,
  onGenerateGallery,
  onPromptSubmit,
  onSuggestionClick,
  onImageUpload,
  onImageRemove,
  onRefreshSuggestions,
  isSubmissionLimitReached,
  submissionCount,
  maxSubmissions,
  hideInMobile = false
}: PromptTopLayoutProps) {
  const isMobile = containerWidth < 768;
  const effectivePadding = getEffectivePadding(config);
  const heightScaleFactor = isMobile ? 1 : Math.max(0.5, Math.min(1.5, (config.prompt_section_height || 30) / 30));

  // Get alignment class based on config
  const getAlignmentClass = (alignment: string) => {
    switch (alignment) {
      case 'left':
        return 'justify-start';
      case 'right':
        return 'justify-end';
      case 'center':
      default:
        return 'justify-center';
    }
  };

  return (
    <div className="flex flex-col h-full relative">
      <div className="flex-1 relative">
        {/* Gallery Section - Full height, scrollable */}
        <div className="absolute inset-0 overflow-auto" style={{
          paddingTop: `${Math.max(5, 10 * heightScaleFactor)}vh`,
          minHeight: '200px' // Ensure minimum height for gallery
        }}>
          <ImageGallery
            images={generatedImages}
            isLoading={isLoading}
            config={config}
            fullPage={fullPage}
            deployment={deployment}
            layoutContext="vertical"
            containerWidth={containerWidth}
            instanceId={instanceId}
            onGenerateGallery={onGenerateGallery}
            prompt={prompt}
            setPrompt={setPrompt}
            suggestions={suggestions}
            referenceImages={referenceImages}
            onPromptSubmit={onPromptSubmit}
            onSuggestionClick={onSuggestionClick}
            onImageUpload={onImageUpload}
            onImageRemove={onImageRemove}
            onRefreshSuggestions={onRefreshSuggestions}
            originalPrompt={prompt}
          />
        </div>

        {/* User Input Section - Fixed at top */}
        <div className={`absolute top-0 left-0 right-0 z-10 flex ${getAlignmentClass(config.prompt_section_alignment || 'center')}`} style={{
          minHeight: `${Math.max(15, 20 * heightScaleFactor)}vh`,
          backgroundColor: 'transparent'
        }}>
        <div 
          className="w-full"
          data-alignment={config.prompt_section_alignment || 'center'}
          style={{ 
            minHeight: `${Math.max(20, 30 * heightScaleFactor)}vh`,
            backgroundColor: 'transparent',
            borderRadius: `${config.prompt_border_radius || 12}px`,
            border: `${config.prompt_border_width || 1}px ${config.prompt_border_style || 'solid'} ${config.prompt_border_color || '#e5e7eb'}`,
            margin: `${Math.max(1, 2 * heightScaleFactor)}vh ${effectivePadding.right}px`,
            position: 'sticky',
            top: 0,
            maxWidth: `${config.prompt_section_width || 60}%`
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
              variant={isMobile ? "mobile" : "desktop"}
              heightScaleFactor={heightScaleFactor}
              containerWidth={containerWidth}
              isSubmissionLimitReached={isSubmissionLimitReached}
              submissionCount={submissionCount}
              maxSubmissions={maxSubmissions}
            />
          </div>
        </div>
      </div>
    </div>
  );
} 
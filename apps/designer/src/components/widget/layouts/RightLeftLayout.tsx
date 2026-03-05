"use client";

import { DesignSettings, getEffectivePadding } from "@mage/types";
import { Suggestion } from "@/lib/suggestions";
import { ImageGallery } from "../ImageGallery";
import { UserInputSection } from "../UserInputSection";
import { PromptTopLayout } from "./PromptTopLayout";

interface RightLeftLayoutProps {
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
  onPromptSubmit: (prompt: string) => void;
  onSuggestionClick: (suggestion: Suggestion) => void;
  onImageUpload: (imageData: string | null) => void;
  onImageRemove: (index: number) => void;
  onRefreshSuggestions: () => void;
  hideInMobile?: boolean;
}

export function RightLeftLayout({
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
  onPromptSubmit,
  onSuggestionClick,
  onImageUpload,
  onImageRemove,
  onRefreshSuggestions,
  hideInMobile = false
}: RightLeftLayoutProps) {
  const isMobile = containerWidth < 768;

  // For mobile, use PromptTopLayout
  if (isMobile) {
    return (
      <PromptTopLayout
        config={config}
        prompt={prompt}
        setPrompt={setPrompt}
        isLoading={isLoading}
        suggestions={suggestions}
        referenceImages={referenceImages}
        generatedImages={generatedImages}
        fullPage={fullPage}
        deployment={deployment}
        containerWidth={containerWidth}
        onPromptSubmit={onPromptSubmit}
        onSuggestionClick={onSuggestionClick}
        onImageUpload={onImageUpload}
        onImageRemove={onImageRemove}
        onRefreshSuggestions={onRefreshSuggestions}
      />
    );
  }

  // Get configured container padding
  const effectivePadding = getEffectivePadding(config);
  
  // Calculate container padding
  const containerPadding = {
    paddingTop: `${effectivePadding.top}px`,
    paddingRight: `${effectivePadding.right}px`,
    paddingBottom: `${effectivePadding.bottom}px`,
    paddingLeft: `${effectivePadding.left}px`,
  };



  return (
    <div 
      className={`${fullPage || deployment ? 'h-screen' : 'h-full'} flex flex-col overflow-hidden`}
      style={!fullPage ? containerPadding : undefined}
    >
      <div className="flex-shrink-0">
        {/* BrandHeader is now handled at the Widget level */}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left Side - Gallery */}
        <div className="flex-1 min-h-0 relative pr-6">
          <div className="absolute inset-0 overflow-auto">
            <ImageGallery
              images={generatedImages}
              isLoading={isLoading}
              config={config}
              fullPage={fullPage}
              deployment={deployment}
              layoutContext="vertical"
              containerWidth={containerWidth * 0.6} // Adjust for side-by-side layout
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
        </div>

        {/* Right Side - Prompt Section */}
        <div 
          className="flex-shrink-0 flex flex-col relative"
          style={{ 
            width: `${config.prompt_section_width || 40}%`,
            backgroundColor: config.prompt_background_color || 'transparent',
            borderRadius: `${config.prompt_border_radius || 12}px`,
            border: `${config.prompt_border_width || 1}px ${config.prompt_border_style || 'solid'} ${config.prompt_border_color || '#e5e7eb'}`,
            marginLeft: `${config.prompt_gallery_spacing || 24}px`
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
            style={{ height: '100%' }}
          />
        </div>
      </div>
    </div>
  );
} 
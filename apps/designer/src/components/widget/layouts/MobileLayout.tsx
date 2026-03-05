import { LayoutProps } from "@mage/types";
import { UserInputSection } from "../UserInputSection";
import { ImageGallery } from "../ImageGallery";
import { getEffectivePadding } from "@mage/types";
import { cn } from "@/lib/utils";
import { ArrowUp } from "lucide-react";
import { ImageUploadWidget as ImageUpload } from "../../index";

export function MobileLayout({
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
  isSubmissionLimitReached = false,
  submissionCount = 0,
  maxSubmissions = 10,
  hideInMobile = false
}: LayoutProps) {
  const effectivePadding = getEffectivePadding(config);
  const heightScaleFactor = 1; // Fixed scale for mobile

  // Convert string arrays to image objects
  const formattedImages = [...generatedImages, ...referenceImages.map(url => ({ image: url }))];
  const hasImages = formattedImages.length > 0;

  return (
    <div
      className="flex flex-col h-full"
      style={{
        backgroundColor: config.background_color || "#ffffff",
      }}
    >
      <div className="flex-shrink-0">
        {/* BrandHeader is now handled at the Widget level */}
      </div>

      {/* Fixed Input Section */}
      <div 
        className="flex-shrink-0 w-full z-10"
        style={{
          backgroundColor: config.prompt_background_color || '#ffffff',
          borderBottom: `1px solid ${config.prompt_border_color || '#e5e7eb'}`
        }}
      >
        {/* Input Area with Uploader */}
        <div>
          <div className="flex flex-col gap-2">
            {/* Prompt Input */}
            <div className="flex gap-2">
              {config.uploader_enabled && (
                <ImageUpload
                  onImageUpload={onImageUpload}
                  onImageRemove={onImageRemove}
                  currentImages={referenceImages}
                  maxImages={config.uploader_max_images ?? 1}
                  variant="chatgpt"
                  customStyles={{
                    container: {
                      backgroundColor: config.uploader_background_color || '#f8fafc',
                      borderStyle: config.uploader_border_style || 'dashed',
                      borderColor: config.uploader_border_color || '#cbd5e1',
                      borderWidth: `${config.uploader_border_width ?? 2}px`,
                      borderRadius: `${config.uploader_border_radius ?? 12}px`,
                      padding: '6px',
                      maxHeight: '50px',
                      overflow: 'hidden',
                      width: 'auto',
                      minWidth: '40px'
                    },
                    button: {
                      backgroundColor: config.uploader_background_color || '#f8fafc',
                      borderStyle: config.uploader_border_style || 'dashed',
                      borderColor: config.uploader_border_color || '#cbd5e1',
                      borderWidth: `${config.uploader_border_width ?? 2}px`,
                      borderRadius: `${config.uploader_border_radius ?? 12}px`,
                      padding: '6px',
                      maxHeight: '50px',
                      overflow: 'hidden',
                      width: 'auto',
                      minWidth: '40px'
                    }
                  }}
                  textSettings={{
                    secondaryText: config.uploader_secondary_text,
                    textColor: config.uploader_text_color,
                    fontFamily: config.uploader_font_family,
                    fontSize: config.uploader_font_size
                  }}
                />
              )}
              <div className="flex-1 relative">
                <textarea
                  value={prompt}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value)}
                  onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!isLoading && prompt.trim()) {
                        onPromptSubmit();
                      }
                    }
                  }}
                  placeholder="Describe what you want to create..."
                  className="w-full min-h-[44px] max-h-[120px] px-4 py-3 rounded-2xl resize-none outline-none transition-colors"
                  style={{
                    backgroundColor: config.prompt_input_background_color || config.prompt_background_color || '#f8fafc',
                    border: `${config.prompt_input_border_width || config.prompt_border_width || 1}px ${config.prompt_input_border_style || config.prompt_border_style || 'solid'} ${config.prompt_input_border_color || config.prompt_border_color || '#e5e7eb'}`,
                    borderRadius: `${config.prompt_input_border_radius || config.prompt_border_radius || 16}px`,
                    color: config.prompt_input_text_color || config.prompt_text_color || '#111827',
                    fontFamily: config.prompt_font_family || 'inherit',
                    fontSize: `${config.prompt_font_size || config.base_font_size || 16}px`,
                  }}
                  disabled={isLoading}
                />
                <button
                  onClick={() => onPromptSubmit()}
                  disabled={isLoading || !prompt.trim() || isSubmissionLimitReached}
                  className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md hover:scale-105 hover:bg-blue-600 active:scale-95"
                  style={{
                    backgroundColor: isSubmissionLimitReached ? "#dc2626" : (config.submit_button_background_color || config.primary_color || '#3b82f6'),
                    color: config.submit_button_text_color || config.secondary_color || '#ffffff'
                  }}
                  title={isSubmissionLimitReached ? `Limit reached: ${submissionCount}/${maxSubmissions} submissions` : undefined}
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ArrowUp className="w-4 h-4" strokeWidth={2.5} />
                  )}
                </button>
              </div>
            </div>

            {/* Suggestions */}
            <div 
              className="flex items-center gap-2 px-4 py-2 overflow-x-auto hide-scrollbar"
              style={{
                backgroundColor: config.suggestion_background_color || '#f8fafc',
                borderTop: `1px solid ${config.prompt_border_color || '#e5e7eb'}`
              }}
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => onSuggestionClick(suggestion)}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all",
                    "hover:opacity-90 active:scale-95"
                  )}
                  style={{
                    backgroundColor: config.suggestion_background_color || '#f1f5f9',
                    color: config.suggestion_text_color || '#475569',
                    border: `1px solid ${config.suggestion_border_color || '#e2e8f0'}`,
                    fontFamily: config.suggestion_font_family || 'inherit',
                    fontSize: `${config.suggestion_font_size || 14}px`
                  }}
                >
                  {suggestion.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Gallery Area */}
      <div 
        className="flex-1 min-h-0 w-full overflow-auto"
        style={{
          backgroundColor: config.gallery_background_color || '#ffffff',
          paddingBottom: '5rem' // Extra padding at bottom to prevent overlap
        }}
      >
        <ImageGallery
          config={{
            ...config,
            gallery_columns: 1 // Force single column for mobile
          }}
          images={formattedImages}
          isLoading={isLoading}
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
          onImageRemove={(index: number) => onImageRemove(index)}
          onRefreshSuggestions={onRefreshSuggestions}
          originalPrompt={prompt}
        />
      </div>
    </div>
  );
} 

"use client";

import { LayoutProps } from "../../../types";
import { PromptInput } from "../user-input-section/PromptInput";
import { SquareImage } from "../gallery/SquareImage";
import { cn } from "../../../lib/utils";
import { ArrowUp, ImageIcon, Copy } from "lucide-react";
import { ImageUpload } from "../user-input-section/ImageUpload.Widget";
import { Button } from "../../ui/button";
import { motion, useReducedMotion } from "framer-motion";

export function MobileLayout({
  config,
  prompt,
  setPrompt,
  isLoading,
  suggestions,
  referenceImages,
  generatedImages,
  deployment = false,
  onPromptSubmit,
  onSuggestionClick,
  onImageUpload,
  onImageRemove,
  isSubmissionLimitReached = false,
  submissionCount = 0,
  maxSubmissions = 10,
  error,
  setError,
}: LayoutProps) {
  const reduceMotion = useReducedMotion();
  const showPrompts = config.gallery_show_prompts !== false;
  const cappedSubmissionCount =
    typeof submissionCount === "number" && typeof maxSubmissions === "number" && maxSubmissions > 0
      ? Math.min(Math.max(0, submissionCount), maxSubmissions)
      : submissionCount;
  const mobileGalleryBg =
    config.gallery_background_color && config.gallery_background_color !== "transparent"
      ? config.gallery_background_color
      : (config.background_color || "#ffffff");
  const mobileTileBg =
    !config.gallery_background_color || config.gallery_background_color === "transparent"
      ? (config.prompt_input_background_color || config.secondary_color || "rgba(255,255,255,0.70)")
      : config.gallery_background_color;

  // Convert string arrays to image objects
  const formattedImages = [
    ...generatedImages.map(img => ({ image: img.image, prompt: (img as any).prompt || null, id: (img as any).id || `generated-${Math.random()}` })),
    ...referenceImages.map((url: string) => ({ image: url, prompt: null, id: `ref-${Math.random()}` }))
  ];
  const singleImageMode = (config.gallery_max_images || 1) === 1;

  // Determine mobile layout mode based on main layout_mode config
  // For mobile, we only support prompt-top and prompt-bottom (not left-right variants)
  const layoutMode = config.layout_mode || 'prompt-bottom';
  
  // Check if the layout_mode is specifically prompt-top or prompt-bottom
  // If it's left-right or right-left, check mobile_layout_mode preference
  let mobileLayoutMode = 'prompt-bottom'; // default
  
  if (layoutMode === 'prompt-top') {
    mobileLayoutMode = 'prompt-top';
  } else if (layoutMode === 'prompt-bottom') {
    mobileLayoutMode = 'prompt-bottom';
  } else {
    // For left-right/right-left layouts, use mobile_layout_mode if specified
    // Otherwise default to prompt-bottom
    mobileLayoutMode = config.mobile_layout_mode || 'prompt-bottom';
  }
  
  // Minimal composer styling (Vercel/shadcn-like)
  const accent = config.primary_color || "#3b82f6";
  const composerSurface =
    config.prompt_input_background_color ||
    config.prompt_background_color ||
    "rgba(255,255,255,0.86)";
  const composerBorder =
    config.prompt_input_border_color ||
    config.prompt_border_color ||
    "rgba(0,0,0,0.10)";
  const composerRadius = 9999;
  const controlSize = 40; // px


  // Render based on mobile layout mode
  if (mobileLayoutMode === 'prompt-bottom') {
    return (
      <motion.div
        initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
        transition={reduceMotion ? undefined : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="h-full w-full flex flex-col overflow-hidden"
        style={{
          backgroundColor: config.background_color || "#ffffff",
          // STRICTLY RESPECT GOD CONTAINER - NO OVERFLOW ALLOWED
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          overflow: 'hidden'
        }}
      >
        {/* Error Display */}
        {error && (
          <div className="absolute top-0 left-0 right-0 z-20 bg-red-50 border-b border-red-200 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                <span className="text-xs text-red-800 font-medium">{error}</span>
              </div>
              <button
                onClick={() => setError?.('')}
                className="text-red-600 hover:text-red-800 text-xs"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Gallery Area - Takes up most of the space */}
        <div 
          className="flex-1 min-h-0 w-full overflow-y-auto"
          style={{
            backgroundColor: mobileGalleryBg,
            paddingBottom: '5rem', // Extra padding at bottom to prevent overlap
            height: '100%',
            maxHeight: '100%'
          }}
        >
          <div className="flex flex-col items-center gap-4 p-4 min-h-full">
            {isLoading ? (
              // Loading state
              Array.from({ length: config.gallery_max_images || 12 }).map((_, index) => (
                <div key={`loading-${index}`} className="w-full max-w-sm">
                  <SquareImage
                    src="/placeholder.jpg"
                    alt="Loading..."
                    sizePercent={100}
                    borderRadius={config.gallery_image_border_radius || 8}
                    backgroundColor="rgba(0,0,0,0.1)"
                    objectFit="cover"
                  />
                </div>
              ))
            ) : (
              // Images - Show up to max_images
              Array.from({ length: config.gallery_max_images || 12 }).map((_, index) => {
                const img = formattedImages[index];
                return img ? (
                <div key={img.id || index} className={cn("w-full group relative", !singleImageMode && "max-w-sm")}>
	                  <SquareImage
	                    src={img.image!}
	                    alt={`Generated image ${index + 1}`}
	                    sizePercent={100}
	                    borderRadius={config.gallery_image_border_radius || 8}
	                    border={config.gallery_image_border_enabled ? `${config.gallery_image_border_width || 1}px ${config.gallery_image_border_style || 'solid'} ${config.gallery_image_border_color || '#e5e7eb'}` : 'none'}
	                    backgroundColor={mobileTileBg}
	                    objectFit="cover"
	                    onClick={() => {
	                      if (img.prompt) {
	                        setPrompt(img.prompt);
                      }
                    }}
                  />
                  
	                  {/* Prompt overlay */}
	                  {showPrompts && img.prompt && (
	                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent transition-opacity duration-200 pointer-events-none opacity-0 group-hover:opacity-100">
	                      <div className="absolute bottom-0 left-0 right-0 p-3">
	                        <div className="flex items-center justify-between text-white">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs truncate">
                              {img.prompt}
                            </p>
                          </div>
                          <div className="pointer-events-auto">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 text-white hover:bg-white/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (img.prompt) {
                                  setPrompt(img.prompt);
                                }
                              }}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                )}
              </div>
              ) : (
                // Empty slot placeholder
                <div key={`empty-${index}`} className={cn("w-full", !singleImageMode && "max-w-sm")}>
                  <div 
                    className="w-full aspect-square flex flex-col items-center justify-center text-gray-400 transition-colors duration-200 cursor-pointer"
                    onClick={() => {
                      if (onPromptSubmit) {
                        onPromptSubmit();
                      }
                    }}
                    style={{
                      backgroundColor: config.gallery_background_color === 'transparent' ? 'rgba(0,0,0,0.02)' : config.gallery_background_color,
                      borderRadius: config.gallery_image_border_radius || 8,
                      border: config.gallery_image_border_enabled ? `${config.gallery_image_border_width || 1}px ${config.gallery_image_border_style || 'solid'} ${config.gallery_image_border_color || '#e5e7eb'}` : '2px dashed #d1d5db',
                    }}
                  >
                    <div className="w-12 h-12 mb-2 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-400" />
                    </div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Generate Image</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Click to create</p>
                    {!deployment && (
                      <div className="mt-2 px-2 py-1 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-300">
                        💰 1 credit
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          </div>
        </div>

        {/* Fixed Input Section - At bottom for prompt-bottom mode */}
        <div 
          className="flex-shrink-0 w-full z-10 relative"
          style={{
            backgroundColor: 'transparent',
            borderTop: 'none',
            padding: '12px 16px',
            boxSizing: 'border-box'
          }}
        >
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
          {/* Input Area with Uploader */}
          <div>
            <div className="flex flex-col gap-2">
              {/* Minimal composer bar (upload + prompt + submit in one line) */}
              <div
                className="w-full border backdrop-blur-sm"
                style={{
                  backgroundColor: composerSurface,
                  borderColor: composerBorder,
                  borderRadius: `${composerRadius}px`,
                  boxShadow: "0 1px 1px rgba(0,0,0,0.04), 0 10px 26px rgba(0,0,0,0.10)",
                  backdropFilter: "blur(10px)",
                  WebkitBackdropFilter: "blur(10px)",
                }}
              >
                <div className="flex items-center gap-2 px-2 py-2">
                  {config.uploader_enabled !== false && (
                    <div data-tour="upload-area" className="flex-shrink-0">
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
                            border: `1px solid rgba(0,0,0,0.08)`,
                            backgroundColor: "rgba(255,255,255,0.55)",
                            boxShadow: "0 1px 1px rgba(0,0,0,0.04)",
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
                      onSubmit={() => onPromptSubmit()}
                      disabled={isLoading}
                      rows={1}
                      extraRightPaddingPx={0}
                      styleOverrides={{
                        backgroundColor: "transparent",
                        border: "none",
                        borderRadius: "0px",
                        height: `${controlSize}px`,
                        minHeight: `${controlSize}px`,
                        maxHeight: `${controlSize}px`,
                        padding: "8px 10px",
                      }}
                    />
                  </div>

                  <button
                    data-tour="submit-button"
                    type="button"
                    onClick={() => onPromptSubmit()}
                    disabled={isLoading || !prompt.trim() || isSubmissionLimitReached}
                    className="flex-shrink-0 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
                    style={{
                      width: `${controlSize}px`,
                      height: `${controlSize}px`,
                      borderRadius: 9999,
                      border: `1px solid rgba(0,0,0,0.10)`,
                      backgroundColor: isSubmissionLimitReached ? "#dc2626" : (config.submit_button_background_color || accent),
                      color: config.submit_button_text_color || "#ffffff",
                      boxShadow: "0 1px 1px rgba(0,0,0,0.04), 0 12px 22px rgba(0,0,0,0.12)",
                    }}
                    aria-label="Generate"
                    title={
                      isSubmissionLimitReached && typeof maxSubmissions === "number" && maxSubmissions > 0
                        ? `Limit reached: ${cappedSubmissionCount}/${maxSubmissions} submissions`
                        : isSubmissionLimitReached
                        ? "Limit reached"
                        : undefined
                    }
                  >
                    {isLoading ? (
                      <div className="border-2 border-white border-t-transparent rounded-full animate-spin" style={{ width: 18, height: 18 }} />
                    ) : (
                      <ArrowUp strokeWidth={2.5} style={{ width: 16, height: 16 }} />
                    )}
                  </button>
                </div>
              </div>

              {/* Suggestions - Only show if enabled */}
              {config.suggestions_enabled && suggestions.length > 0 && (
                <div 
                  className="flex items-center gap-2 px-4 py-2 overflow-x-auto hide-scrollbar"
                >
                  {suggestions.map((suggestion: any, index: number) => (
                    <button
                      key={index}
                      onClick={() => onSuggestionClick(suggestion)}
                      className={cn(
                        "flex-shrink-0 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all",
                        "hover:opacity-90 active:scale-95"
                      )}
                      title={suggestion.prompt}
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
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Default prompt-top layout (existing implementation)
  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
      animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      transition={reduceMotion ? undefined : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="h-full w-full flex flex-col overflow-hidden"
      style={{
        backgroundColor: config.background_color || "#ffffff",
        // STRICTLY RESPECT GOD CONTAINER - NO OVERFLOW ALLOWED
        width: '100%',
        height: '100%',
        maxWidth: '100%',
        maxHeight: '100%',
        overflow: 'hidden'
      }}
    >
      {/* Error Display */}
      {error && (
        <div className="absolute top-0 left-0 right-0 z-20 bg-red-50 border-b border-red-200 px-3 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full"></div>
              <span className="text-xs text-red-800 font-medium">{error}</span>
            </div>
            <button
              onClick={() => setError?.('')}
              className="text-red-600 hover:text-red-800 text-xs"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {/* Fixed Input Section - At top for prompt-top mode */}
      <div 
        className="flex-shrink-0 w-full z-10 relative"
        style={{
          backgroundColor: 'transparent',
          borderBottom: 'none'
        }}
      >
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
        {/* Input Area with Uploader */}
        <div>
          <div className="flex flex-col gap-2">
            {/* Minimal composer bar (upload + prompt + submit in one line) */}
            <div
              className="w-full border backdrop-blur-sm"
              style={{
                backgroundColor: composerSurface,
                borderColor: composerBorder,
                borderRadius: `${composerRadius}px`,
                boxShadow: "0 1px 1px rgba(0,0,0,0.04), 0 10px 26px rgba(0,0,0,0.10)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
              }}
            >
              <div className="flex items-center gap-2 px-2 py-2">
                {config.uploader_enabled !== false && (
                  <div data-tour="upload-area" className="flex-shrink-0">
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
                          border: `1px solid rgba(0,0,0,0.08)`,
                          backgroundColor: "rgba(255,255,255,0.55)",
                          boxShadow: "0 1px 1px rgba(0,0,0,0.04)",
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
                    onSubmit={() => onPromptSubmit()}
                    disabled={isLoading}
                    rows={1}
                    extraRightPaddingPx={0}
                    styleOverrides={{
                      backgroundColor: "transparent",
                      border: "none",
                      borderRadius: "0px",
                      height: `${controlSize}px`,
                      minHeight: `${controlSize}px`,
                      maxHeight: `${controlSize}px`,
                      padding: "8px 10px",
                    }}
                  />
                </div>

                <button
                  data-tour="submit-button"
                  type="button"
                  onClick={() => onPromptSubmit()}
                  disabled={isLoading || !prompt.trim() || isSubmissionLimitReached}
                  className="flex-shrink-0 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
                  style={{
                    width: `${controlSize}px`,
                    height: `${controlSize}px`,
                    borderRadius: 9999,
                    border: `1px solid rgba(0,0,0,0.10)`,
                    backgroundColor: isSubmissionLimitReached ? "#dc2626" : (config.submit_button_background_color || accent),
                    color: config.submit_button_text_color || "#ffffff",
                    boxShadow: "0 1px 1px rgba(0,0,0,0.04), 0 12px 22px rgba(0,0,0,0.12)",
                  }}
                  aria-label="Generate"
                  title={
                    isSubmissionLimitReached && typeof maxSubmissions === "number" && maxSubmissions > 0
                      ? `Limit reached: ${cappedSubmissionCount}/${maxSubmissions} submissions`
                      : isSubmissionLimitReached
                      ? "Limit reached"
                      : undefined
                  }
                >
                  {isLoading ? (
                    <div className="border-2 border-white border-t-transparent rounded-full animate-spin" style={{ width: 18, height: 18 }} />
                  ) : (
                    <ArrowUp strokeWidth={2.5} style={{ width: 16, height: 16 }} />
                  )}
                </button>
              </div>
            </div>

            {/* Suggestions - Only show if enabled */}
            {config.suggestions_enabled && suggestions.length > 0 && (
              <div 
                className="flex items-center gap-2 px-4 py-2 overflow-x-auto hide-scrollbar"
              >
                {suggestions.map((suggestion: any, index: number) => (
                  <button
                    key={index}
                    onClick={() => onSuggestionClick(suggestion)}
                    className={cn(
                      "flex-shrink-0 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all",
                      "hover:opacity-90 active:scale-95"
                    )}
                    title={suggestion.prompt}
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
            )}
          </div>
        </div>
      </div>

      {/* Gallery Area */}
      <div 
        className="flex-1 min-h-0 w-full overflow-y-auto"
        style={{
          backgroundColor: mobileGalleryBg,
          paddingBottom: '5rem', // Extra padding at bottom to prevent overlap
          height: '100%',
          maxHeight: '100%'
        }}
      >
        <div className="flex flex-col items-center gap-4 p-4 min-h-full">
          {isLoading ? (
            // Loading state
            Array.from({ length: config.gallery_max_images || 12 }).map((_, index) => (
              <div key={`loading-${index}`} className="w-full max-w-sm">
                <SquareImage
                  src="/placeholder.jpg"
                  alt="Loading..."
                  sizePercent={100}
                  borderRadius={config.gallery_image_border_radius || 8}
                  backgroundColor="rgba(0,0,0,0.1)"
                  objectFit="cover"
                />
              </div>
            ))
          ) : (
            // Images - Show up to max_images
            Array.from({ length: config.gallery_max_images || 12 }).map((_, index) => {
              const img = formattedImages[index];
              return img ? (
              <div key={img.id || index} className={cn("w-full group relative", !singleImageMode && "max-w-sm")}>
	                <SquareImage
	                  src={img.image!}
	                  alt={`Generated image ${index + 1}`}
	                  sizePercent={100}
	                  borderRadius={config.gallery_image_border_radius || 8}
	                  border={config.gallery_image_border_enabled ? `${config.gallery_image_border_width || 1}px ${config.gallery_image_border_style || 'solid'} ${config.gallery_image_border_color || '#e5e7eb'}` : 'none'}
	                  backgroundColor={mobileTileBg}
	                  objectFit="cover"
	                  onClick={() => {
	                    if (img.prompt) {
	                      setPrompt(img.prompt);
                    }
                  }}
                />
                
	                {/* Prompt overlay */}
	                {showPrompts && img.prompt && (
	                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent transition-opacity duration-200 pointer-events-none opacity-0 group-hover:opacity-100">
	                    <div className="absolute bottom-0 left-0 right-0 p-3">
	                      <div className="flex items-center justify-between text-white">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs truncate">
                            {img.prompt}
                          </p>
                        </div>
                        <div className="pointer-events-auto">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 text-white hover:bg-white/20"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (img.prompt) {
                                setPrompt(img.prompt);
                              }
                            }}
                          >
                            <Copy className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
                ) : (
                  // Empty slot placeholder
                  <div key={`empty-${index}`} className={cn("w-full", !singleImageMode && "max-w-sm")}>
                    <div 
                      className="w-full aspect-square flex flex-col items-center justify-center text-gray-400 transition-colors duration-200 cursor-pointer"
                      onClick={() => {
                        if (onPromptSubmit) {
                          onPromptSubmit();
                        }
                      }}
                      style={{
                        backgroundColor: config.gallery_background_color === 'transparent' ? 'rgba(0,0,0,0.02)' : config.gallery_background_color,
                        borderRadius: config.gallery_image_border_radius || 8,
                        border: config.gallery_image_border_enabled ? `${config.gallery_image_border_width || 1}px ${config.gallery_image_border_style || 'solid'} ${config.gallery_image_border_color || '#e5e7eb'}` : '2px dashed #d1d5db',
                      }}
                    >
                      <div className="w-12 h-12 mb-2 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <ImageIcon className="w-6 h-6 text-gray-400" />
                      </div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Generate Image</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Click to create</p>
                      {!deployment && (
                        <div className="mt-2 px-2 py-1 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-300">
                          💰 1 credit
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </div>
    </motion.div>
  );
}

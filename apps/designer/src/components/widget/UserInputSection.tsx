"use client";

import React, { useState } from "react";
import { DesignSettings } from "@mage/types/design";
import { Suggestion } from "@/lib/suggestions";
import { ImageUpload } from "../ImageUpload.Widget";
import { RefreshCw, ArrowUp, ArrowUpRight } from "lucide-react";
import { Spinner } from "../ui/spinner";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

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
  maxSubmissions = 10,
  disableSuggestionsScroll = false
}: UserInputSectionProps) {
  const isMobile = variant === 'mobile';
  const [isPromptFocused, setIsPromptFocused] = useState(false);
  const promptFocusShadow = isPromptFocused ? "0 0 0 3px rgba(59, 130, 246, 0.25)" : "none";
  const showSuggestions = false; // Temporarily hidden (will re-add soon)



  // Base container styles with responsive padding
  const containerStyles = {
    display: 'flex',
    flexDirection: 'column' as const,
    padding: variant === "desktop" 
      ? `${Math.min(Math.max(8, 12 * heightScaleFactor), 16)}px ${Math.min(Math.max(12, 16 * (containerWidth / 1200)), 20)}px`
      : `${Math.min(Math.max(4, 6 * heightScaleFactor), 8)}px ${Math.min(Math.max(6, 8 * (containerWidth / 768)), 10)}px`,
    backgroundColor: config.prompt_background_color || 'transparent',
    borderRadius: `${Math.min((config.prompt_border_radius || 8) * heightScaleFactor, 12)}px`,
    height: '100%',
    minHeight: 'min-content',
    maxHeight: '100%',
    width: '100%',
    maxWidth: '100%',
    overflow: 'hidden',
    boxSizing: 'border-box' as const,

    ...style
  };

  // Inside the component, before the return:
  const placeholderStyle = {
    '--placeholder-color': config.prompt_input_placeholder_color || config.prompt_placeholder_color || '#9ca3af',
    color: config.prompt_input_text_color || config.prompt_text_color || '#000000'
  } as React.CSSProperties;



  // Mobile version
  if (isMobile) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className={`relative flex flex-col overflow-hidden ${className}`}
        style={containerStyles}
      >
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {/* Mobile Upload Section */}
          {config.uploader_enabled && (
            <div className="flex-shrink-0 mb-3 overflow-hidden" style={{ maxHeight: '30%' }}>
              <div 
                data-tour="upload-area"
                className="flex items-center p-3 rounded-lg min-h-[60px] cursor-pointer hover:opacity-90 transition-opacity overflow-hidden" 
                style={{
                  backgroundColor: config.uploader_background_color || '#f8fafc',
                  borderStyle: config.uploader_border_style || 'dashed',
                  borderColor: config.uploader_border_color || '#cbd5e1',
                  borderWidth: `${Math.min(config.uploader_border_width ?? 2, 2)}px`,
                  borderRadius: `${Math.min(config.uploader_border_radius ?? 12, 12)}px`,
                  maxHeight: '100%'
                }}
              >
                <div className="flex items-center w-full overflow-hidden">
                  <ImageUpload
                    onImageUpload={onImageUpload}
                    onImageRemove={onImageRemove}
                    currentImages={referenceImages}
                    maxImages={config.uploader_max_images ?? 1}
                    variant="chatgpt"
                    customStyles={{
                      container: {
                        backgroundColor: 'transparent',
                        borderStyle: 'none' as const,
                        flex: '0 0 auto',
                        maxWidth: '100%',
                        maxHeight: '100%',
                        overflow: 'hidden'
                      },
                      button: {
                        backgroundColor: 'transparent',
                        borderStyle: 'none' as const,
                        maxHeight: '100%'
                      }
                    }}
                    textSettings={{
                      secondaryText: config.uploader_secondary_text,
                      textColor: config.uploader_text_color,
                      fontFamily: config.uploader_font_family,
                      fontSize: config.uploader_font_size
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{
                      color: config.uploader_text_color || '#64748b',
                      fontFamily: config.uploader_font_family || 'inherit',
                      fontSize: `${Math.min((config.uploader_font_size || 14), 14)}px`
                    }}>
                      {config.uploader_primary_text || "Add reference images to guide the AI generation"}
                    </p>
                    <p
                      className="text-xs truncate"
                      style={{
                        color: config.uploader_text_color || '#64748b',
                        fontFamily: config.uploader_font_family || 'inherit',
                        opacity: 0.8
                      }}
                    >
                      {config.uploader_secondary_text || "Drag & drop or click to upload"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Mobile Prompt Input */}
          <div className="flex gap-2 items-end overflow-hidden" style={{ 
            maxHeight: `${70 * heightScaleFactor}%`,
            minHeight: `${40 * heightScaleFactor}%`,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div className="flex-1 overflow-hidden flex flex-col">
              <motion.textarea
                data-tour="prompt-input"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (!isLoading && prompt.trim()) {
                      onPromptSubmit(prompt);
                    }
                  }
                }}
                placeholder="Describe what you want to create..."
                rows={2}
                className={cn(
                  "bg-transparent resize-none outline-none leading-relaxed w-full overflow-auto flex-1 placeholder-color",
                  "placeholder:text-[var(--placeholder-color)]"
                )}
                onFocus={() => setIsPromptFocused(true)}
                onBlur={() => setIsPromptFocused(false)}
                animate={{ boxShadow: promptFocusShadow }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                style={{
                  ...placeholderStyle,
                  fontSize: `${Math.min((config.prompt_font_size || config.base_font_size || 16) * heightScaleFactor, 16)}px`,
                  padding: `${Math.min(Math.max(4, 6 * heightScaleFactor), 8)}px`,
                  boxSizing: 'border-box',
                  height: '100%',
                  minHeight: '100%',
                  backgroundColor: config.prompt_input_background_color || 'transparent',
                  border: `${config.prompt_input_border_width || 1}px ${config.prompt_input_border_style || 'solid'} ${config.prompt_input_border_color || '#e5e7eb'}`,
                  borderRadius: `${config.prompt_input_border_radius || 8}px`,
                  color: config.prompt_input_text_color || '#374151',
                }}
                disabled={isLoading}
              />
            </div>
            
            <div className="flex-shrink-0">
              <motion.button
                data-tour="submit-button"
                onClick={() => onPromptSubmit(prompt)}
                disabled={isLoading || !prompt.trim() || isSubmissionLimitReached}
                whileHover={!isLoading && !!prompt.trim() && !isSubmissionLimitReached ? { scale: 1.06 } : undefined}
                whileTap={!isLoading && !!prompt.trim() && !isSubmissionLimitReached ? { scale: 0.98 } : undefined}
                className="flex items-center justify-center rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed transition-shadow duration-200 shadow-md hover:shadow-lg"
                style={{
                  backgroundColor: isSubmissionLimitReached ? "#dc2626" : (config.submit_button_background_color || config.primary_color || "#3b82f6"),
                  color: config.submit_button_text_color || config.secondary_color || "#ffffff",
                  width: `${32 * heightScaleFactor}px`,
                  height: `${32 * heightScaleFactor}px`
                }}
                title={isSubmissionLimitReached ? `Limit reached: ${submissionCount}/${maxSubmissions} submissions` : undefined}
                onMouseEnter={(e) => {
                  if (!isSubmissionLimitReached) {
                    e.currentTarget.style.backgroundColor =
                      config.submit_button_hover_background_color || config.primary_color || "#2563eb";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    isSubmissionLimitReached ? "#dc2626" : (config.submit_button_background_color || config.primary_color || "#3b82f6");
                }}
                >
                  {isLoading ? (
                    <Spinner className="w-3 h-3" />
                  ) : (
                    <ArrowUp className="w-3 h-3" strokeWidth={2.5} />
                  )}
              </motion.button>
            </div>
          </div>
          
          {/* Mobile Suggestions */}
          {showSuggestions && (config.suggestions_enabled ?? true) && (
            <div className="flex flex-wrap gap-1.5 px-3 mt-3">
              <button
                onClick={onRefreshSuggestions}
                className="flex items-center justify-center p-2 rounded-lg border transition-all duration-200 shadow-sm hover:shadow-md flex-shrink-0"
                disabled={isLoading}
                title="Refresh suggestions"
                style={{
                  backgroundColor: config.suggestion_background_color || '#ffffff',
                  borderColor: config.suggestion_border_color || '#e5e7eb',
                  color: config.suggestion_text_color || '#374151',
                  transform: `scale(${heightScaleFactor})`
                }}
              >
                <RefreshCw className="w-3 h-3 transition-colors" />
              </button>
              
              {suggestions.slice(0, 3).map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => onSuggestionClick(suggestion)}
                  disabled={isLoading}
                  className="flex items-center gap-1 px-3 py-2 rounded-md border text-xs font-medium flex-shrink-0 max-w-[calc(50%-0.375rem)]"
                  style={{
                    backgroundColor: config.suggestion_background_color || '#ffffff',
                    borderColor: config.suggestion_border_color || '#e5e7eb',
                    color: config.suggestion_text_color || '#374151',
                    transform: `scale(${heightScaleFactor})`
                  }}
                >
                  <span className="truncate">{suggestion.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // Desktop version
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`relative flex flex-col flex-1 h-full ${className}`}
      style={containerStyles}
    >
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden h-full">
        {/* Desktop Upload Section */}
        {config.uploader_enabled && (
          <div className="flex-shrink-0 min-w-0">
            <div className="flex flex-wrap items-center max-w-full gap-2">
              <div className="flex-shrink-0 min-w-[40px]" style={{ maxWidth: '70%' }}>
                <div data-tour="upload-area">
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
                        borderWidth: `${(config.uploader_border_width ?? 2) * heightScaleFactor}px`,
                        borderRadius: `${(config.uploader_border_radius ?? 12) * heightScaleFactor}px`,
                        padding: `${6 * heightScaleFactor}px`,
                        maxHeight: `${50 * heightScaleFactor}px`,
                        overflow: 'hidden',
                        width: 'auto',
                        minWidth: '40px'
                      },
                      button: {
                        backgroundColor: config.uploader_background_color || '#f8fafc',
                        borderStyle: config.uploader_border_style || 'dashed',
                        borderColor: config.uploader_border_color || '#cbd5e1',
                        borderWidth: `${(config.uploader_border_width ?? 2) * heightScaleFactor}px`,
                        borderRadius: `${(config.uploader_border_radius ?? 12) * heightScaleFactor}px`,
                        padding: `${6 * heightScaleFactor}px`,
                        maxHeight: `${50 * heightScaleFactor}px`,
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
                </div>
              </div>
              <div className="flex-1 min-w-[150px] min-w-0">
                <p
                  className="font-medium leading-tight truncate"
                  style={{
                    fontSize: `${12 * heightScaleFactor}px`,
                    color: config.uploader_text_color || '#64748b',
                    fontFamily: config.uploader_font_family || 'inherit'
                  }}
                >
                  {config.uploader_primary_text || "Add reference images to guide the AI generation"}
                </p>
                <p
                  className="text-xs leading-tight truncate"
                  style={{
                    color: config.uploader_text_color || '#64748b',
                    fontFamily: config.uploader_font_family || 'inherit',
                    opacity: 0.8,
                    marginTop: `${Math.max(1, 2 * heightScaleFactor)}px`
                  }}
                >
                  {config.uploader_secondary_text || "Drag & drop or click to upload"}
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Desktop Prompt Input */}
        <div className="flex-1 flex flex-col mt-4 min-h-0 flex-grow overflow-hidden">
          <div className="flex-1 flex flex-col min-h-0 w-full h-full">
            {/* Main Prompt Input - Responsive to container */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden w-full">
              <div className="relative flex-1 min-h-0 flex items-stretch overflow-hidden w-full">
                <motion.textarea
                  data-tour="prompt-input"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (!isLoading && prompt.trim()) {
                        onPromptSubmit(prompt);
                      }
                    }
                  }}
                  placeholder="Describe what you want to create..."
                  rows={1}
                  className={cn(
                    "bg-transparent resize-none outline-none leading-relaxed w-full placeholder-color overflow-auto",
                    "placeholder:text-[var(--placeholder-color)]"
                  )}
                  onFocus={() => setIsPromptFocused(true)}
                  onBlur={() => setIsPromptFocused(false)}
                  animate={{ boxShadow: promptFocusShadow }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  style={{
                    ...placeholderStyle,
                    fontSize: `${Math.min((config.prompt_font_size || config.base_font_size || 16) * heightScaleFactor, 18)}px`,
                    padding: `${8 * heightScaleFactor}px`,
                    backgroundColor: config.prompt_input_background_color || 'transparent',
                    border: `${config.prompt_input_border_width || 1}px ${config.prompt_input_border_style || 'solid'} ${config.prompt_input_border_color || '#e5e7eb'}`,
                    borderRadius: `${config.prompt_input_border_radius || 8}px`,
                    color: config.prompt_input_text_color || '#374151',
                    height: '100%',
                    width: '100%',
                    minHeight: `${Math.max(30, 40 * heightScaleFactor)}px`,
                    maxHeight: `${Math.min(800, 1000 * heightScaleFactor)}px`,
                    boxSizing: 'border-box'
                  }}
                  disabled={isLoading}
                />
              </div>
            </div>
          </div>
          
	          {/* Submit Button Section */}
	          <div className="flex-shrink-0 mt-2 flex justify-end">
	            <motion.button
	              data-tour="submit-button"
	              onClick={() => onPromptSubmit(prompt)}
	              disabled={isLoading || !prompt.trim() || isSubmissionLimitReached}
	              whileHover={!isLoading && !!prompt.trim() && !isSubmissionLimitReached ? { scale: 1.06 } : undefined}
	              whileTap={!isLoading && !!prompt.trim() && !isSubmissionLimitReached ? { scale: 0.98 } : undefined}
	              className="flex items-center justify-center rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed transition-shadow duration-200 shadow-md hover:shadow-lg"
	              style={{
	                backgroundColor: isSubmissionLimitReached ? "#dc2626" : (config.submit_button_background_color || config.primary_color || "#3b82f6"),
	                color: config.submit_button_text_color || config.secondary_color || "#ffffff",
	                width: `${Math.min(40, 45 * heightScaleFactor)}px`,
	                height: `${Math.min(40, 45 * heightScaleFactor)}px`
              }}
              title={isSubmissionLimitReached ? "You've reached your generation limit for this session." : undefined}
              onMouseEnter={(e) => {
                if (!isSubmissionLimitReached) {
                  e.currentTarget.style.backgroundColor =
                    config.submit_button_hover_background_color || config.primary_color || "#2563eb";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor =
                  isSubmissionLimitReached ? "#dc2626" : (config.submit_button_background_color || config.primary_color || "#3b82f6");
              }}
	            >
	              {isLoading ? (
	                <Spinner className="w-3 h-3" />
	              ) : (
	                <ArrowUp className="w-3 h-3" strokeWidth={2.5} />
	              )}
	            </motion.button>
	          </div>
	        </div>
        
        {/* Desktop Suggestions */}
        {showSuggestions && (config.suggestions_enabled ?? true) && (
          <div className="flex-shrink-0 mt-2 min-w-0 overflow-hidden">
            <div 
              className="flex flex-wrap items-center border-t border-zinc-200/50 pt-2 gap-1.5"
              style={{ 
                gap: `${4 * heightScaleFactor}px`,
                minHeight: `${24 * heightScaleFactor}px`
              }}
            >
	              <motion.button
	                onClick={onRefreshSuggestions}
	                className="flex items-center justify-center rounded-lg border transition-all duration-200 shadow-sm hover:shadow-md flex-shrink-0"
	                disabled={isLoading}
	                title="Refresh suggestions"
	                whileHover={!isLoading ? { rotate: 10, scale: 1.04 } : undefined}
	                whileTap={!isLoading ? { scale: 0.98 } : undefined}
	                style={{
	                  backgroundColor: config.suggestion_background_color || '#ffffff',
	                  borderColor: config.suggestion_border_color || '#e5e7eb',
	                  color: config.suggestion_text_color || '#374151',
	                  padding: `${8 * heightScaleFactor}px`,
	                  minWidth: `${32 * heightScaleFactor}px`,
	                  minHeight: `${32 * heightScaleFactor}px`,
	                  maxWidth: `${32 * heightScaleFactor}px`,
	                  maxHeight: `${32 * heightScaleFactor}px`
	                }}
	              >
	                <RefreshCw style={{ width: `${12 * heightScaleFactor}px`, height: `${12 * heightScaleFactor}px` }} className="transition-colors" />
	              </motion.button>
              
              <div className="flex flex-wrap gap-1.5 flex-1 items-center min-w-0 overflow-hidden">
                {suggestions.slice(0, config.suggestions_count || 4).map((suggestion, index) => (
	                  <motion.button
	                    key={index}
	                    onClick={() => onSuggestionClick(suggestion)}
	                    disabled={isLoading}
	                    whileHover={!isLoading ? { y: -1 } : undefined}
	                    whileTap={!isLoading ? { scale: 0.98 } : undefined}
	                    className="flex items-center border group transition-all duration-200 shadow-sm font-medium flex-shrink-0"
	                    style={{
	                      backgroundColor: config.suggestion_background_color || '#ffffff',
                      borderColor: config.suggestion_border_color || '#e5e7eb',
                      borderWidth: `${Math.min((config.suggestion_border_width || 1) * heightScaleFactor, 2)}px`,
                      borderStyle: config.suggestion_border_style || 'solid',
                      borderRadius: `${Math.min((config.suggestion_border_radius || 8) * heightScaleFactor, 12)}px`,
                      fontFamily: config.suggestion_font_family || 'inherit',
                      fontSize: `${Math.min(Math.max(10, (config.suggestion_font_size || 12) * heightScaleFactor), 14)}px`,
                      padding: `${Math.min(Math.max(4, 6 * heightScaleFactor), 8)}px ${Math.min(Math.max(6, 8 * heightScaleFactor), 10)}px`,
                      gap: `${Math.min(4 * heightScaleFactor, 6)}px`,
                      minHeight: `${Math.min(Math.max(24, 28 * heightScaleFactor), 32)}px`,
                      maxWidth: containerWidth < 500 ? 'calc(100% - 0.375rem)' : 'calc(50% - 0.375rem)',
                      boxShadow: config.suggestion_shadow_style === 'none' ? 'none' :
                                config.suggestion_shadow_style === 'subtle' ? '0 1px 2px rgba(0,0,0,0.05)' :
                                config.suggestion_shadow_style === 'medium' ? '0 4px 6px rgba(0,0,0,0.1)' :
                                config.suggestion_shadow_style === 'large' ? '0 10px 15px rgba(0,0,0,0.1)' :
                                config.suggestion_shadow_style === 'glow' ? '0 0 15px rgba(99, 102, 241, 0.3)' : 
                                '0 1px 2px rgba(0,0,0,0.05)'
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
                          width: `${Math.min(Math.max(10, 12 * heightScaleFactor), 14)}px`,
                          height: `${Math.min(Math.max(10, 12 * heightScaleFactor), 14)}px`
                        }}
	                      />
	                    )}
	                  </motion.button>
	                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
} 

"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Download, Plus, Sparkles } from "lucide-react";
import { DesignSettings } from "@mage/types";
import { Suggestion } from "@/lib/suggestions";
import { BrandHeader } from "./BrandHeader";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { imageHelpers } from "@/lib/image-helpers";
import { Textarea } from "../ui/textarea";

interface DrillDownModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedImage: string | null;
  prompt: string;
  setPrompt: (prompt: string) => void;
  suggestions: Suggestion[];
  referenceImages: string[];
  onPromptSubmit: (prompt: string) => void;
  onSuggestionClick: (suggestion: Suggestion) => void;
  onImageUpload: (imageData: string | null) => void;
  onImageRemove: (index: number) => void;
  onRefreshSuggestions: () => void;
  originalPrompt?: string;
  onImageGenerated?: (image: { id: string; image: string; prompt: string | null; category?: string | null; subcategory?: string | null; created_at: string }) => void;
}

export function DrillDownModal({
  isOpen,
  onClose,
  selectedImage,
  prompt,
  setPrompt,
  suggestions,
  referenceImages,
  onPromptSubmit,
  onSuggestionClick,
  onImageUpload,
  onImageRemove,
  onRefreshSuggestions,
  originalPrompt,
  onImageGenerated
}: DrillDownModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const handleDownload = async () => {
    if (!selectedImage) {
      return;
    }
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
    } catch (error) {}
  };

  const handleSetAsMainImage = () => {
    if (selectedImage) {
      // Call onImageUpload to add this image to the reference images (main uploader)
      onImageUpload(selectedImage);
      // Close the modal after adding the image
      onClose();
    } else {}
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      // If we have an onImageGenerated callback, handle generation here
      if (onImageGenerated) {
        setIsLoading(true);
        try {
          // Call the generate API
          const response = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: prompt.trim(),
              numOutputs: 1,
            })
          });

          if (!response.ok) {
            throw new Error('Failed to generate image');
          }

          const data = await response.json();
          
          if (data.success && data.images && data.images.length > 0) {
            // Call the callback with the new image
            onImageGenerated({
              id: data.predictionId || `generated-${Date.now()}`,
              image: data.images[0],
              prompt: prompt.trim(),
              category: null,
              subcategory: null,
              created_at: new Date().toISOString(),
            });
            
            // Close the modal
            onClose();
          }
        } catch (error) {} finally {
          setIsLoading(false);
        }
      } else {
        // Fallback to the original onPromptSubmit
        onPromptSubmit(prompt);
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Only render if modal should be open and we have a selected image
  if (!isOpen || !selectedImage) return null;

  // Create a compact config for the modal
  const modalConfig: DesignSettings = {
    // Default values for modal
    container_padding: 16,
    prompt_font_size: 12,
    brand_name_font_size: 14,
    prompt_border_radius: 6,
    prompt_border_width: 0.5,
    background_color: '#ffffff',
    submit_button_background_color: '#3b82f6',
    prompt_text_color: '#111827',
    prompt_font_family: 'inherit',
    prompt_background_color: '#f8fafc',
    prompt_border_color: '#e5e7eb',
    prompt_placeholder_color: '#6b7280',
    submit_button_text_color: '#ffffff',
  };

  return createPortal(
    <div 
      className="fixed inset-0 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4 md:p-6"
      style={{
        backgroundColor: `rgba(0, 0, 0, 0.4)`,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <Card 
        className="max-w-5xl w-full max-h-[98vh] sm:max-h-[96vh] overflow-hidden flex flex-col shadow-2xl border-0 animate-in fade-in-0 zoom-in-95 duration-200"
        style={{
          backgroundColor: modalConfig.background_color || '#ffffff',
          borderRadius: '20px',
        }}
      >
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-3 sm:p-6 border-b border-gray-100"
          style={{ backgroundColor: modalConfig.background_color || '#ffffff' }}>
          {/* Left - Title */}
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
            <div 
              className="w-1 h-6 sm:h-8 rounded-full flex-shrink-0"
              style={{
                backgroundColor: modalConfig.submit_button_background_color || '#3b82f6',
              }}
            />
            <div className="min-w-0 flex-1">
              <h2 
                className="text-base sm:text-xl font-semibold truncate"
                style={{
                  color: modalConfig.prompt_text_color || '#111827',
                  fontFamily: modalConfig.prompt_font_family || 'inherit',
                }}
              >
                Edit Image
              </h2>
              <p 
                className="text-xs sm:text-sm text-gray-500 truncate"
                style={{
                  fontFamily: modalConfig.prompt_font_family || 'inherit',
                }}
              >
                Make changes to your image
              </p>
            </div>
          </div>
          
          {/* Right - Actions */}
          <div className="flex items-center gap-1 sm:gap-3 flex-shrink-0 ml-2 sm:ml-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 h-auto"
              style={{
                borderColor: modalConfig.prompt_border_color || '#e5e7eb',
                color: modalConfig.prompt_text_color || '#111827',
                borderRadius: '10px',
              }}
            >
              <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Download</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSetAsMainImage}
              className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 h-auto"
              style={{
                borderColor: modalConfig.prompt_border_color || '#e5e7eb',
                color: modalConfig.prompt_text_color || '#111827',
                borderRadius: '10px',
              }}
            >
              <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Add to Reference</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="p-1.5 sm:p-2 h-auto"
              style={{
                color: modalConfig.prompt_text_color || '#111827',
                borderRadius: '10px',
              }}
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden gap-4 lg:gap-6 p-3 sm:p-4 lg:p-6">
          {/* Left Side - Image Display */}
          <div className="flex-1 flex items-center justify-center min-h-0 order-1 lg:order-1 mb-4 lg:mb-0">
            <div className="relative w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[400px]">
              <div className="aspect-square relative rounded-lg sm:rounded-xl lg:rounded-2xl overflow-hidden shadow-lg sm:shadow-xl lg:shadow-2xl w-full group">
                <img
                  src={selectedImage}
                  alt="Selected image"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Right Side - Content */}
          <div className="w-full lg:w-[400px] xl:w-[480px] flex-shrink-0 flex flex-col order-2 lg:order-2 space-y-3 sm:space-y-4 lg:space-y-5">
            {/* Original Prompt */}
            <div className="animate-in slide-in-from-right-2 duration-300">
              <div 
                className="rounded-xl sm:rounded-2xl p-2 sm:p-3 lg:p-4"
                style={{
                  backgroundColor: modalConfig.prompt_background_color || '#f8fafc',
                  borderRadius: `${Math.max(12, modalConfig.prompt_border_radius || 16)}px`,
                }}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div 
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: modalConfig.submit_button_background_color || '#3b82f6',
                    }}
                  />
                  <p 
                    className="text-xs font-medium"
                    style={{ 
                      color: modalConfig.prompt_placeholder_color || '#6b7280',
                      fontFamily: modalConfig.prompt_font_family || 'inherit',
                    }}
                  >
                    Original Prompt
                  </p>
                </div>
                <p 
                  className="text-sm leading-relaxed"
                  style={{ 
                    color: modalConfig.prompt_text_color || '#111827',
                    fontFamily: modalConfig.prompt_font_family || 'inherit',
                  }}
                >
                  {originalPrompt || "A professional headshot of a confident business person in a modern office setting, wearing a crisp white shirt and navy blue suit, with warm lighting and a clean background"}
                </p>
              </div>
            </div>

            {/* Edit Section */}
            <div className="flex-1 animate-in slide-in-from-right-2 duration-300 delay-100">
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  <label 
                    className="text-sm font-medium"
                    style={{
                      color: modalConfig.prompt_text_color || '#111827',
                      fontFamily: modalConfig.prompt_font_family || 'inherit',
                    }}
                  >
                    New Prompt
                  </label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the changes you want to make to this image..."
                    className="min-h-[60px] sm:min-h-[80px] lg:min-h-[100px] resize-none text-sm focus:ring-2 focus:ring-blue-500/20 transition-all rounded-xl sm:rounded-2xl"
                    style={{
                      backgroundColor: modalConfig.prompt_background_color || '#f8fafc',
                      color: modalConfig.prompt_text_color || '#111827',
                      fontFamily: modalConfig.prompt_font_family || 'inherit',
                      fontSize: `${modalConfig.prompt_font_size || 14}px`,
                    }}
                  />
                </div>
                
                <div className="pt-2 sm:pt-3">
                  <Button
                    type="submit"
                    disabled={!prompt.trim() || isLoading}
                    className="w-full font-medium py-2 sm:py-2.5 lg:py-3 rounded-xl sm:rounded-2xl transition-all duration-200 text-sm shadow-md sm:shadow-lg lg:shadow-xl hover:shadow-lg sm:hover:shadow-xl lg:hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      backgroundColor: modalConfig.submit_button_background_color || '#3b82f6',
                      color: modalConfig.submit_button_text_color || '#ffffff',
                      fontFamily: modalConfig.prompt_font_family || 'inherit',
                    }}
                  >
                    {isLoading ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Applying Changes...</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Sparkles className="w-4 h-4" />
                        <span>Apply Changes</span>
                      </div>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </Card>
    </div>,
    document.body
  );
} 
"use client";

import React, { useState, useRef } from "react";
import Image from "next/image";
import { DesignSettings } from "@mage/types";
import { Skeleton } from "../ui/skeleton";
import { createPortal } from "react-dom";
import { imageHelpers } from "@/lib/image-helpers";
import { DrillDownModal } from "./DrillDownModal";
import { Suggestion } from "@/lib/suggestions";
import { SubcategoryPlaceholder } from "./SubcategoryPlaceholder";
import { PlaceholderGallery } from "./PlaceholderGallery";
import { useSubcategoryImages } from "@/hooks/use-subcategory-images";
import { useHybridGallery } from "@/hooks/use-hybrid-gallery";
import { MessageSquare, Copy, Sparkles, ArrowRight, ImageIcon, DollarSign, Star } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { motion } from "framer-motion";

interface ImageGalleryProps {
  images: Array<{ image: string | null; prompt?: string | null; id?: string }>;
  isLoading: boolean;
  config: DesignSettings;
  fullPage?: boolean;
  deployment?: boolean;
  layoutContext?: 'vertical' | 'horizontal';
  containerWidth?: number;
  instanceId?: string;
  onGenerateGallery?: () => void;
  // DrillDownModal props
  prompt?: string;
  setPrompt?: (prompt: string) => void;
  suggestions?: Suggestion[];
  referenceImages?: string[];
  onPromptSubmit?: (prompt: string) => void;
  onSuggestionClick?: (suggestion: Suggestion) => void;
  onImageUpload?: (imageData: string | null) => void;
  onImageRemove?: (index: number) => void;
  onRefreshSuggestions?: () => void;
  originalPrompt?: string;
  // New props for real-time updates
  onImageGenerated?: (image: { id: string; image: string; prompt: string | null; category?: string | null; subcategory?: string | null; created_at: string }) => void;
}

export function ImageGallery({
  images,
  isLoading,
  config,
  fullPage = false,
  deployment = false,
  layoutContext = "vertical",
  containerWidth = 1024,
  instanceId,
  onGenerateGallery,
  // DrillDownModal props
  prompt = "",
  setPrompt = () => {},
  suggestions = [],
  referenceImages = [],
  onPromptSubmit = () => {},
  onSuggestionClick = () => {},
  onImageUpload = () => {},
  onImageRemove = () => {},
  onRefreshSuggestions = () => {},
  originalPrompt = "",
  // New props
  onImageGenerated,
}: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isDrillDownOpen, setIsDrillDownOpen] = useState(false);
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [showCreditDialog, setShowCreditDialog] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});
  const rootRef = useRef<HTMLDivElement>(null);

  // Check subcategory images if instanceId is provided
  const { subcategories, loading: subcategoryLoading } = useSubcategoryImages(instanceId || '');
  
  // Use the new hybrid gallery hook for real-time updates
  const { 
    images: hybridImages, 
    loading: hybridLoading, 
    error: hybridError,
    hasMore,
    loadMore,
    refresh: refreshImages,
    addGeneratedImage,
    removeImage
  } = useHybridGallery(instanceId || null);

  const showPlaceholderImages = config.gallery_show_placeholder_images ?? true;

  // Use hybrid images if available, otherwise fall back to passed images
  const effectiveImages = instanceId && hybridImages.length > 0 
    ? (showPlaceholderImages ? hybridImages : hybridImages.filter((img) => !img.isPreloaded)).map(img => ({ 
        image: img.image, 
        prompt: img.prompt || null, 
        id: img.id,
        isPreloaded: img.isPreloaded
      }))
    : images.map(img => ({ 
        image: img.image, 
        prompt: img.prompt || null, 
        id: img.id || `fallback-${Math.random()}`,
        isPreloaded: false
      }));

  // Get configuration values with defaults
  const galleryConfig = {
    columns: config.gallery_columns || 2,
    spacing: config.gallery_spacing ?? 0, // Allow zero spacing
    maxImages: config.gallery_max_images || 12,
    backgroundColor: config.gallery_background_color || 'transparent',
    containerBorderEnabled: config.gallery_container_border_enabled ?? false,
    containerBorderWidth: config.gallery_container_border_width ?? 1,
    containerBorderColor: config.gallery_container_border_color || '#e5e7eb',
    containerBorderStyle: config.gallery_container_border_style || 'solid',
    containerBorderRadius: config.gallery_container_border_radius ?? 12,
    imageBorderEnabled: config.gallery_image_border_enabled ?? false,
    imageBorderWidth: config.gallery_image_border_width ?? 1,
    imageBorderColor: config.gallery_image_border_color || '#e5e7eb',
    imageBorderStyle: config.gallery_image_border_style || 'solid',
    imageBorderRadius: config.gallery_image_border_radius ?? 8,
    galleryShadowStyle: config.gallery_shadow_style || 'medium',
    overlayEnabled: false, // Disable overlay since we're using DrillDownModal
  };

  // Create array of slots based on max images
  const imageSlots = Array.from({ length: galleryConfig.maxImages }, (_, index) => {
    const imageData = effectiveImages[index];
    return {
      id: index,
      image: imageData?.image,
      hasImage: !!imageData?.image,
      prompt: imageData?.prompt || null,
      isPreloaded: imageData?.isPreloaded || false,
    };
  });

  // Only show the full-grid loading skeleton when we truly have nothing to render yet.
  // This avoids a jarring "grey boxes then snap" during quick UI toggles/rerenders.
  const showGridLoadingSkeleton = (isLoading || hybridLoading) && effectiveImages.length === 0;

  // Container styles
  const galleryContainerStyles = {
    backgroundColor: galleryConfig.backgroundColor,
    // Only use border radius if container border is enabled
    ...(galleryConfig.containerBorderEnabled && {
      borderRadius: `${galleryConfig.containerBorderRadius}px`,
      border: `${galleryConfig.containerBorderWidth}px ${galleryConfig.containerBorderStyle} ${galleryConfig.containerBorderColor}`
    }),
    padding: `${galleryConfig.spacing}px`,
    gap: `${galleryConfig.spacing}px`,
  };

  // Individual image styles
  const imageStyles = {
    borderRadius: `${galleryConfig.imageBorderRadius}px`,
    border: galleryConfig.imageBorderEnabled ? `${galleryConfig.imageBorderWidth}px ${galleryConfig.imageBorderStyle} ${galleryConfig.imageBorderColor}` : 'none',
    overflow: 'hidden',
  };
  
  // Gallery text style (prompt overlays, etc.)
  const galleryTextStyle: React.CSSProperties = {
    fontFamily: config.gallery_font_family || 'inherit',
    fontSize: `${config.gallery_font_size || 14}px`,
    lineHeight: 1.35
  };
  
  // Apply shadow style to each image container
  const getBoxShadow = (style: string) => {
    switch (style) {
      case 'none':
        return 'none';
      case 'subtle':
        return '0 1px 2px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06)';
      case 'medium':
        return '0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)';
      case 'large':
        return '0 10px 15px rgba(0,0,0,0.15), 0 4px 6px rgba(0,0,0,0.10)';
      case 'glow':
        return '0 0 0 3px rgba(59,130,246,0.25), 0 10px 15px rgba(0,0,0,0.1)';
      default:
        return '0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06)';
    }
  };
  (imageStyles as any).boxShadow = getBoxShadow(galleryConfig.galleryShadowStyle);

  const handleImageClick = (image: string) => {
    setSelectedImage(image);
    setIsDrillDownOpen(true);
  };

  const handleCloseDrillDown = () => {
    setIsDrillDownOpen(false);
    setSelectedImage(null);
  };

  const handleDrillDownPromptSubmit = (newPrompt: string) => {
    onPromptSubmit(newPrompt);
    handleCloseDrillDown();
  };

  const handlePromptClick = (prompt: string) => {
    setPrompt(prompt);
  };

  const handlePlaceholderClick = () => {
    // Show credit confirmation dialog
    setShowCreditDialog(true);
  };

  const handleConfirmGeneration = () => {
    setShowCreditDialog(false);
    // Open the DrillDownModal for image generation
    setSelectedImage(null); // No selected image since we're generating new one
    setIsDrillDownOpen(true);
  };

  const handleShowPlaceholders = () => {
    setShowPlaceholders(true);
  };

  const handleBackToGallery = () => {
    setShowPlaceholders(false);
  };

  // Handle new image generation - add to gallery in real-time
  const handleImageGenerated = (newImage: any) => {
    if (onImageGenerated) {
      onImageGenerated(newImage);
    }
    
    // Also add to local hybrid gallery state
    if (instanceId) {
      addGeneratedImage({
        id: newImage.id,
        image: newImage.image,
        prompt: newImage.prompt,
        category: newImage.category,
        subcategory: newImage.subcategory,
        created_at: newImage.created_at,
      });
    }
  };

  return (
    <>
      {showPlaceholders ? (
        // Show placeholder gallery
        (<div className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBackToGallery}
              className="flex items-center gap-2"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              Back to Gallery
            </Button>
          </div>
          <PlaceholderGallery
            config={config}
            instanceId={instanceId}
            onGenerateGallery={onGenerateGallery}
            onImageClick={handlePlaceholderClick}
            onPromptClick={handlePromptClick}
          />
        </div>)
      ) : (
        // Show main gallery
        (<motion.div
          initial="hidden"
          animate="show"
          variants={{
            hidden: { opacity: 0 },
            show: { opacity: 1, transition: { staggerChildren: 0.05 } },
          }}
          ref={rootRef}
          data-tour="gallery-area"
          className="grid auto-rows-fr"
          style={{
            ...galleryContainerStyles,
            gridTemplateColumns: `repeat(${Math.min(2, Math.max(1, galleryConfig.columns), Math.max(1, galleryConfig.maxImages))}, 1fr)`
          }}
        >
          {showGridLoadingSkeleton ? (
            // Loading placeholders
            (Array.from({ length: galleryConfig.maxImages }).map((_, index) => (
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
                }}
                key={`loading-${index}`}
                className="aspect-square relative"
                style={imageStyles}
              >
                <Skeleton className="absolute inset-0" />
              </motion.div>
            )))
          ) : (
            // Always show image slots (with placeholders for empty slots)
            (imageSlots.map((slot) => (
              <motion.div
                variants={{
                  hidden: { opacity: 0, y: 8 },
                  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
                }}
                key={slot.id}
                className="relative aspect-square bg-gray-50 group"
                style={imageStyles}
              >
                {slot.hasImage ? (
                  <>
                    <motion.div
                      className="absolute inset-0"
                      initial={false}
                      animate={{ opacity: loadedImages[slot.image!] ? 0 : 1 }}
                      transition={{ duration: 0.2, ease: "easeOut" }}
                      style={{ pointerEvents: "none" }}
                    >
                      <Skeleton className="absolute inset-0" />
                    </motion.div>

                    <motion.div
                      className="absolute inset-0"
                      initial={false}
                      animate={{ opacity: loadedImages[slot.image!] ? 1 : 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                    >
                      <Image
                        src={slot.image!}
                        alt={`Generated image ${slot.id + 1}`}
                        fill
                        className="object-cover cursor-pointer transition-transform duration-200 hover:scale-105"
                        onClick={() => handleImageClick(slot.image!)}
                        onLoadingComplete={() => {
                          setLoadedImages((prev) => ({ ...prev, [slot.image!]: true }));
                        }}
                      />
                    </motion.div>
                    
                    {/* Preloaded indicator */}
                    {slot.isPreloaded && (
                      <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-blue-500/80 flex items-center justify-center">
                        <Star className="w-3 h-3 text-white" />
                      </div>
                    )}
                    
                    {/* Prompt overlay */}
                    {slot.prompt && slot.isPreloaded && (
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                        <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <p className="text-xs font-medium line-clamp-2" style={galleryTextStyle}>
                                  {slot.prompt}
                                </p>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-sm whitespace-pre-wrap break-words">
                                <p className="text-xs">{slot.prompt}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  // Empty slot placeholder
                  (<div className="absolute inset-0 flex items-center justify-center text-gray-400">
                    <ImageIcon className="w-8 h-8 opacity-30" />
                  </div>)
                )}
              </motion.div>
            )))
          )}
        </motion.div>)
      )}
      {/* Load more button if there are more images */}
      {hasMore && effectiveImages.length > 0 && (
        <div className="mt-4 text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={hybridLoading}
          >
            {hybridLoading ? 'Loading...' : 'Load More Images'}
          </Button>
        </div>
      )}
      {/* Credit confirmation dialog */}
      <Dialog open={showCreditDialog} onOpenChange={setShowCreditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate New Image</DialogTitle>
            <DialogDescription>
              This will use 1 credit from your account. Continue?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCreditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmGeneration}>
              <DollarSign className="w-4 h-4 mr-2" />
              Use Credit & Generate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* DrillDownModal for image generation and editing */}
      {createPortal(
        <DrillDownModal
          isOpen={isDrillDownOpen}
          onClose={handleCloseDrillDown}
          selectedImage={selectedImage}
          prompt={prompt}
          setPrompt={setPrompt}
          suggestions={suggestions}
          referenceImages={referenceImages}
          onPromptSubmit={handleDrillDownPromptSubmit}
          onSuggestionClick={onSuggestionClick}
          onImageUpload={onImageUpload}
          onImageRemove={onImageRemove}
          onRefreshSuggestions={onRefreshSuggestions}
          originalPrompt={originalPrompt}
          onImageGenerated={handleImageGenerated}
        />,
        document.body
      )}
    </>
  );
} 

"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { DesignSettings } from "@mage/types";
import { Sparkles, ImageIcon, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "../ui/button";
import { useInstanceImages } from "../../hooks/use-instance-images";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";

interface PlaceholderGalleryProps {
  config: DesignSettings;
  instanceId?: string;
  onGenerateGallery?: () => void;
  onImageClick?: (imageUrl: string) => void;
  onPromptClick?: (prompt: string) => void;
}

export function PlaceholderGallery({
  config,
  instanceId,
  onGenerateGallery,
  onImageClick,
  onPromptClick
}: PlaceholderGalleryProps) {
  if (config.gallery_show_placeholder_images === false) {
    return null;
  }

  const { images, loading, error } = useInstanceImages(instanceId || null);
  const [showLoading, setShowLoading] = useState(false);
  const [loadedImages, setLoadedImages] = useState<Record<string, boolean>>({});

  // Delay showing loading spinner to prevent flickering
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => {
        setShowLoading(true);
      }, 300); // Only show loading after 300ms
      
      return () => clearTimeout(timer);
    } else {
      setShowLoading(false);
    }
  }, [loading]);

  const galleryConfig = {
    columns: config.gallery_columns || 2,
    spacing: config.gallery_spacing ?? 0,
    maxImages: config.gallery_max_images || 12,
    backgroundColor: config.gallery_background_color || 'transparent',
    imageBorderEnabled: config.gallery_image_border_enabled ?? false,
    imageBorderWidth: config.gallery_image_border_width ?? 1,
    imageBorderColor: config.gallery_image_border_color || '#e5e7eb',
    imageBorderStyle: config.gallery_image_border_style || 'solid',
    imageBorderRadius: config.gallery_image_border_radius ?? 8,
  };

  const containerStyles = {
    backgroundColor: galleryConfig.backgroundColor,
    padding: `${galleryConfig.spacing}px`,
    gap: `${galleryConfig.spacing}px`,
  };

  const imageStyles = {
    borderRadius: `${galleryConfig.imageBorderRadius}px`,
    border: galleryConfig.imageBorderEnabled ? `${galleryConfig.imageBorderWidth}px ${galleryConfig.imageBorderStyle} ${galleryConfig.imageBorderColor}` : 'none',
    overflow: 'hidden',
  };
  
  // Gallery text style for prompts and labels
  const galleryTextStyle: React.CSSProperties = {
    fontFamily: config.gallery_font_family || 'inherit',
    fontSize: `${config.gallery_font_size || 14}px`,
    lineHeight: 1.35
  };

  const handleImageClick = (image: any) => {
    if (onPromptClick && image.prompt) {
      onPromptClick(image.prompt);
    } else if (onImageClick && image.image) {
      onImageClick(image.image);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 mb-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900 dark:to-indigo-900 flex items-center justify-center mx-auto">
          <Sparkles className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
          Professional Gallery Examples
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-md mx-auto">
          Browse our collection of professional sample images. Click any image to use its prompt as inspiration, or generate your own custom gallery.
        </p>
        
        {onGenerateGallery && (
          <Button
            onClick={onGenerateGallery}
            className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-6 py-2 rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl mb-6"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Custom Gallery
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>
      {/* Gallery Grid */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: { opacity: 0 },
          show: { opacity: 1, transition: { staggerChildren: 0.05 } },
        }}
        className="grid auto-rows-fr"
        style={{
          ...containerStyles,
          gridTemplateColumns: `repeat(${Math.min(2, Math.max(1, galleryConfig.columns), Math.max(1, galleryConfig.maxImages))}, 1fr)`
        }}
      >
        {showLoading ? (
          // Loading state - only show after delay
          (Array.from({ length: galleryConfig.maxImages }).map((_, index) => (
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
              }}
              key={`loading-${index}`}
              className="relative aspect-square bg-gray-50 flex items-center justify-center"
              style={imageStyles}
            >
              <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </motion.div>
          )))
        ) : error ? (
          // Error state
          (<div className="col-span-full text-center py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Unable to load sample gallery. {error}
            </p>
          </div>)
        ) : images.length === 0 ? (
          // Empty state
          (<div className="col-span-full text-center py-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No sample images available for this instance.
            </p>
          </div>)
        ) : (
          // Sample images
          (images.slice(0, galleryConfig.maxImages).map((image, index) => (
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 8 },
                show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: "easeOut" } },
              }}
              key={image.id || index}
              className="relative aspect-square bg-gray-50 group cursor-pointer"
              style={imageStyles}
              onClick={() => handleImageClick(image)}
            >
              <motion.div
                className="absolute inset-0"
                initial={false}
                animate={{ opacity: loadedImages[image.image] ? 1 : 0 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <Image
                  src={image.image}
                  alt={`${image.subcategory || 'Sample'} example`}
                  fill
                  className="object-cover transition-transform duration-200 hover:scale-105"
                  onLoadingComplete={() => {
                    setLoadedImages((prev) => ({ ...prev, [image.image]: true }));
                  }}
                />
              </motion.div>
              
              {/* Overlay with prompt info */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                  {image.prompt && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <p className="text-xs font-medium line-clamp-2 mb-1" style={galleryTextStyle}>
                            {image.prompt}
                          </p>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm whitespace-pre-wrap break-words">
                          <p className="text-xs">{image.prompt}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <p className="text-xs opacity-80" style={galleryTextStyle}>
                    {image.subcategory || image.category || 'Sample Image'}
                  </p>
                </div>
              </div>

              {/* Click indicator */}
              <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <ImageIcon className="w-3 h-3 text-gray-600" />
              </div>
            </motion.div>
          )))
        )}
      </motion.div>
      {/* Footer */}
      <div className="text-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Click any image to use its prompt as inspiration • Generate your own gallery for custom results
        </p>
      </div>
    </div>
  );
} 

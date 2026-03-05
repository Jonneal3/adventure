"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import { DesignSettings, hexToRgba } from "../../../types";
import { Sparkles, ImageIcon, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "../../ui/button";
import { useInstanceImages } from "../../../hooks/use-instance-images";

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
  const { images, loading, error } = useInstanceImages(instanceId || null);
  const [showLoading, setShowLoading] = useState(false);
  const showPrompts = config.gallery_show_prompts !== false;

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
    columns: config.gallery_columns || 3,
    spacing: config.gallery_spacing ?? 0,
    maxImages: config.gallery_max_images || 12,
    backgroundColor: config.gallery_background_color || 'transparent',
    imageBorderEnabled: config.gallery_image_border_enabled ?? false,
    imageBorderWidth: config.gallery_image_border_width ?? 1,
    imageBorderColor: config.gallery_image_border_color || '#e5e7eb',
    imageBorderStyle: config.gallery_image_border_style || 'solid',
    imageBorderRadius: config.gallery_image_border_radius ?? 8,
  };

  const accent = config.submit_button_background_color || config.primary_color || "#0284c7";
  const accentHover = config.submit_button_hover_background_color || config.secondary_color || accent;
  const surface = config.prompt_input_background_color || config.secondary_color || "#ffffff";
  const border = config.prompt_border_color || galleryConfig.imageBorderColor || "rgba(0,0,0,0.10)";
  const text = config.prompt_text_color || config.brand_name_color || "#0f172a";
  const muted = config.cta_color || config.uploader_text_color || "#475569";

  const shadowForStyle = (style: string | undefined): string => {
    switch (style) {
      case "none":
        return "none";
      case "subtle":
        return "0 1px 2px rgba(0,0,0,0.06), 0 6px 16px rgba(0,0,0,0.06)";
      case "large":
        return "0 20px 56px rgba(0,0,0,0.16)";
      case "glow":
        return "0 0 0 1px rgba(0,0,0,0.06), 0 16px 44px rgba(0,0,0,0.16)";
      case "medium":
      default:
        return "0 12px 34px rgba(0,0,0,0.12)";
    }
  };

  const safeRgba = (value: string, opacity: number): string => {
    const v = value.trim();
    if (v.startsWith("#")) return hexToRgba(v, opacity);
    return opacity >= 1 ? v : v;
  };

  const containerStyles = {
    backgroundColor: galleryConfig.backgroundColor,
    fontFamily: config.gallery_font_family || 'inherit',
    fontSize: config.gallery_font_size,
    padding: `${galleryConfig.spacing}px`,
    gap: `${galleryConfig.spacing}px`,
  };

  const imageStyles = {
    borderRadius: `${galleryConfig.imageBorderRadius}px`,
    border: galleryConfig.imageBorderEnabled
      ? `${galleryConfig.imageBorderWidth}px ${galleryConfig.imageBorderStyle} ${galleryConfig.imageBorderColor}`
      : "none",
    overflow: 'hidden',
    backgroundColor: galleryConfig.backgroundColor === "transparent" ? surface : galleryConfig.backgroundColor,
    boxShadow: shadowForStyle(config.gallery_shadow_style),
  };
  const overlayStyles = {
    borderRadius: `${galleryConfig.imageBorderRadius}px`,
    overflow: 'hidden',
  } as React.CSSProperties;

  type SampleImage = {
    id?: string;
    image?: string;
    prompt?: string | null;
    subcategory?: string | null;
    category?: string | null;
  };

  const handleImageClick = (image: SampleImage) => {
    if (onPromptClick && image.prompt) {
      onPromptClick(image.prompt);
    } else if (onImageClick && image.image) {
      onImageClick(image.image);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div
        className="text-center"
        style={{
          fontFamily: config.gallery_font_family || "inherit",
          fontSize: config.gallery_font_size,
        }}
      >
        <div
          className="w-14 h-14 mb-3 rounded-2xl flex items-center justify-center mx-auto border"
          style={{
            background: `linear-gradient(135deg, ${safeRgba(accent, 0.18)}, ${safeRgba(
              accent,
              0.06
            )})`,
            borderColor: border,
            boxShadow: "0 10px 24px rgba(0,0,0,0.10)",
          }}
        >
          <Sparkles className="w-7 h-7" style={{ color: accent }} />
        </div>
        <h3 className="font-semibold mb-1.5" style={{ color: text }}>
          Sample gallery
        </h3>
        <p className="text-[inherit] mb-4 max-w-md mx-auto" style={{ color: muted }}>
          Click any image to use its prompt as inspiration, or generate a custom gallery.
        </p>
        
        {onGenerateGallery && (
          <Button
            onClick={onGenerateGallery}
            className="px-5 py-2 rounded-xl font-medium transition-all duration-200 mb-5"
            style={{
              backgroundColor: accent,
              color: config.submit_button_text_color || "#ffffff",
              boxShadow: "0 10px 24px rgba(0,0,0,0.14)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = accentHover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = accent;
            }}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Generate Custom Gallery
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        )}
      </div>

      {/* Gallery Grid */}
      <div 
        className="grid auto-rows-fr"
        style={{
          ...containerStyles,
          gridTemplateColumns: `repeat(${galleryConfig.columns}, 1fr)`
        }}
      >
        {showLoading ? (
          // Loading state - only show after delay
          Array.from({ length: galleryConfig.maxImages }).map((_, index) => (
            <div
              key={`loading-${index}`}
              className="relative aspect-square flex items-center justify-center"
              style={imageStyles}
            >
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: muted }} />
            </div>
          ))
        ) : error ? (
          // Error state
          <div className="col-span-full text-center py-8">
            <p className="text-sm" style={{ color: muted }}>
              Unable to load sample gallery. {error}
            </p>
          </div>
        ) : images.length === 0 ? (
          // Empty state
          <div className="col-span-full text-center py-8">
            <p className="text-sm" style={{ color: muted }}>
              No sample images available for this instance.
            </p>
          </div>
        ) : (
          // Sample images
          images.slice(0, galleryConfig.maxImages).map((image, index) => (
            <div
              key={image.id || index}
              className="relative aspect-square group cursor-pointer"
              style={imageStyles}
              onClick={() => handleImageClick(image)}
            >
              <Image
                src={image.image}
                alt={`${image.subcategory || 'Sample'} example`}
                fill
                className="object-cover transition-transform duration-200 hover:scale-105"
              />
              
              {/* Overlay with prompt info */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                   style={overlayStyles}>
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                  {showPrompts && image.prompt && (
                    <p className="text-xs font-medium line-clamp-2 mb-1">
                      {image.prompt}
                    </p>
                  )}
                  <p className="text-xs opacity-80">
                    {image.subcategory || image.category || 'Sample Image'}
                  </p>
                </div>
              </div>

              {/* Click indicator */}
              <div
                className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 border"
                style={{
                  backgroundColor: safeRgba(surface, 0.9),
                  borderColor: border,
                  boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
                }}
              >
                <ImageIcon className="w-3.5 h-3.5" style={{ color: text }} />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="text-center">
        <p className="text-xs" style={{ color: muted }}>
          Click any image to use its prompt as inspiration • Generate your own gallery for custom results
        </p>
      </div>
    </div>
  );
} 

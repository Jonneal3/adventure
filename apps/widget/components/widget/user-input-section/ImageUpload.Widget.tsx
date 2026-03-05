"use client";

import { useState, useRef } from "react";
import { cn } from "../../../lib/utils";
import { Upload, X, Image as ImageIcon } from "lucide-react";

interface ImageUploadProps {
  onImageUpload: (image: string | null) => void;
  onImageRemove?: (index: number) => void;
  currentImages?: string[];
  maxImages?: number;
  customStyles?: {
    container?: React.CSSProperties;
    button?: React.CSSProperties;
  };
  children?: React.ReactNode;
  variant?: "default" | "chatgpt" | "minimal"; // Different styles
  textSettings?: {
    secondaryText?: string;
    textColor?: string;
    fontFamily?: string;
    fontSize?: number;
  };
}

export function ImageUpload({
  onImageUpload,
  onImageRemove,
  currentImages = [],
  maxImages,
  customStyles,
  children,
  variant = "default",
  textSettings
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<{ left: number; top: number; width: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ensure maxImages is always a number
  const effectiveMaxImages = maxImages ?? 1;

  const computePreviewPos = (e: React.MouseEvent) => {
    try {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const desiredWidth = Math.min(360, Math.max(180, Math.floor(vw * 0.3)));
      let left = rect.right + 12;
      if (left + desiredWidth + 16 > vw) {
        left = Math.max(16, rect.left - 12 - desiredWidth);
      }
      const top = Math.max(16, Math.min(rect.top, vh - 16 - 240));
      setHoverPos({ left, top, width: desiredWidth });
    } catch {
      setHoverPos(null);
    }
  };

  const clearHover = () => {
    setHoveredIndex(null);
    setHoverPos(null);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Only process the first file if we're not at max
    if (files.length > 0 && currentImages.length < effectiveMaxImages) {
      const file = files[0];
      if (!file.type.startsWith('image/')) return;
      // 10MB cap to match server guard
      if (file.size > 10 * 1024 * 1024) {
        console.error('Image too large (>10MB)');
      } else {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const dataUrl = e.target?.result as string;
          try {
            // Derive instanceId from URL path: /widget/{instanceId}
            let instanceId = 'unknown';
            try {
              const parts = window.location.pathname.split('/').filter(Boolean);
              const idx = parts.indexOf('widget');
              if (idx >= 0 && parts[idx + 1]) instanceId = parts[idx + 1];
            } catch {}
            const res = await fetch('/api/upload-reference-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ instanceId, image: dataUrl })
            });
            if (res.ok) {
              const data = await res.json().catch(() => ({}));
              if (data?.url) {
                onImageUpload(data.url);
                return;
              }
            } else {
              const err = await res.json().catch(() => ({}));
              console.error('Upload API error:', err);
            }
          } catch (err) {
            console.error('Upload error:', err);
          }
          // Fallback to data URL if server upload fails
          onImageUpload(dataUrl);
        };
        reader.readAsDataURL(file);
      }
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    
    // Only process the first image file if we're not at max
    if (files.length > 0 && currentImages.length < effectiveMaxImages) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        // 10MB cap
        if (file.size > 10 * 1024 * 1024) {
          console.error('Image too large (>10MB)');
          return;
        }
        const reader = new FileReader();
        reader.onload = async (e2) => {
          const dataUrl = e2.target?.result as string;
          try {
            let instanceId = 'unknown';
            try {
              const parts = window.location.pathname.split('/').filter(Boolean);
              const idx = parts.indexOf('widget');
              if (idx >= 0 && parts[idx + 1]) instanceId = parts[idx + 1];
            } catch {}
            const res = await fetch('/api/upload-reference-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ instanceId, image: dataUrl })
            });
            if (res.ok) {
              const data = await res.json().catch(() => ({}));
              if (data?.url) {
                onImageUpload(data.url);
                return;
              }
            } else {
              const err = await res.json().catch(() => ({}));
              console.error('Upload API error:', err);
            }
          } catch (err) {
            console.error('Upload error:', err);
          }
          // Fallback to data URL if server upload fails
          onImageUpload(dataUrl);
        };
        reader.readAsDataURL(file);
      }
    }
  };

  const handleRemoveImage = (index: number) => {
    if (onImageRemove) {
      onImageRemove(index);
    }
  };

  // ChatGPT-style inline uploader
  if (variant === "chatgpt") {
    const scale = textSettings?.fontSize ? textSettings.fontSize / 14 : 1;
    const sizePx = Math.min(42, Math.max(30, Math.round(34 * scale)));
    const iconPx = Math.min(20, Math.max(14, Math.round(sizePx * 0.5)));
    const providedButtonStyle = (customStyles?.button || {}) as React.CSSProperties;
    const thumbBaseStyle: React.CSSProperties = {
      width: sizePx,
      height: sizePx,
      borderRadius: 9999,
      overflow: "hidden",
    };
    const visibleImages = currentImages.slice(0, 2);
    return (
      <div className="flex items-center gap-2 w-full min-w-0">
        {/* Uploaded images as compact circular thumbnails (max 2 + count) */}
        {visibleImages.map((image, index) => (
          <div
            key={index}
            className="relative group flex-shrink-0"
          >
            <div 
              className="cursor-pointer transition-colors"
              style={{
                ...thumbBaseStyle,
                border: "1px solid rgba(0,0,0,0.08)",
                background: "rgba(255,255,255,0.65)",
                boxShadow: "0 1px 1px rgba(0,0,0,0.04)",
              }}
              title={`Reference image ${index + 1}`}
            >
              <img
                src={image}
                alt={`Reference ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
            {/* Remove button on hover */}
            <button
              onClick={() => handleRemoveImage(index)}
              className="absolute -top-1 -right-1 bg-zinc-700 hover:bg-zinc-900 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
              style={{
                width: `${Math.min(20, Math.max(14, Math.round(sizePx * 0.46)))}px`,
                height: `${Math.min(20, Math.max(14, Math.round(sizePx * 0.46)))}px`
              }}
              aria-label={`Remove reference image ${index + 1}`}
              title="Remove"
            >
              <X style={{
                width: `${Math.min(12, Math.max(9, Math.round(sizePx * 0.28)))}px`,
                height: `${Math.min(12, Math.max(9, Math.round(sizePx * 0.28)))}px`
              }} />
            </button>
          </div>
        ))}
        {currentImages.length > 2 && (
          <div
            className="flex-shrink-0 text-xs font-medium"
            style={{ color: textSettings?.textColor || "#64748b" }}
            title={`${currentImages.length} reference images attached`}
          >
            +{currentImages.length - 2}
          </div>
        )}

        {/* Show upload button if we can still add more */}
        {currentImages.length < effectiveMaxImages && (
          <div
            className={cn(
              "relative flex-shrink-0",
              isDragging && "ring-2 ring-blue-500 ring-offset-2"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center transition-colors duration-150 flex-shrink-0"
              style={{
                ...providedButtonStyle,
                width: providedButtonStyle.width ?? sizePx,
                height: providedButtonStyle.height ?? sizePx,
                borderRadius: providedButtonStyle.borderRadius ?? 9999,
                border: providedButtonStyle.border ?? "1px solid rgba(0,0,0,0.08)",
                backgroundColor: providedButtonStyle.backgroundColor ?? "rgba(255,255,255,0.60)",
                boxShadow: providedButtonStyle.boxShadow ?? "0 1px 1px rgba(0,0,0,0.04)",
              }}
              title={textSettings?.secondaryText || "Drag & drop or click to upload"}
              aria-label="Upload reference image"
            >
              {children || (
                <ImageIcon
                  style={{
                    width: iconPx,
                    height: iconPx,
                    color: textSettings?.textColor || "#64748b",
                  }}
                />
              )}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Minimal variant for small spaces (prompt-top layout)
  if (variant === "minimal") {
    return (
      <div className="w-full h-full">
        {/* If we have images, show them in a compact stack within the space */}
        {currentImages.length > 0 ? (
          <div className="w-full h-full flex flex-col">
            {/* Compact thumbnail stack - takes most of the space */}
            <div className="flex-1 min-h-0 relative">
              {currentImages.length === 1 ? (
                // Single image - show larger
                <div className="relative w-full h-full group">
                  <img
                    src={currentImages[0]}
                    alt="Reference"
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    onClick={() => handleRemoveImage(0)}
                    className="absolute -top-1 -right-1 bg-zinc-600 hover:bg-zinc-700 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{
                      width: `${Math.min(Math.max(16, 20 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 24)}px`,
                      height: `${Math.min(Math.max(16, 20 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 24)}px`
                    }}
                  >
                    <X style={{
                      width: `${Math.min(Math.max(10, 12 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 16)}px`,
                      height: `${Math.min(Math.max(10, 12 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 16)}px`
                    }} />
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          // No images - show upload area
          <div
            className={cn(
              "relative w-full h-full",
              isDragging && "ring-2 ring-blue-500 ring-offset-2"
            )}
            style={customStyles?.container}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
            <button
              type="button"
              className="w-full h-full"
              onClick={() => fileInputRef.current?.click()}
              style={customStyles?.button}
            >
              {children}
            </button>
          </div>
        )}
      </div>
    );
  }

  // Default variant - show thumbnails within the upload area
  return (
    <div className="w-full h-full min-w-0">
      {currentImages.length > 0 ? (
        <div className="w-full h-full flex flex-col min-w-0">
          {/* Thumbnails area - takes most space */}
          <div className="flex-1 min-h-0 min-w-0">
            <div className="grid grid-cols-3 gap-2 h-full w-full">
              {currentImages.map((image, index) => (
                <div
                  key={index}
                  className="relative group min-w-0"
                  onMouseEnter={(e) => { setHoveredIndex(index); computePreviewPos(e); }}
                  onMouseMove={(e) => computePreviewPos(e)}
                  onMouseLeave={clearHover}
                >
                  <img
                    src={image}
                    alt={`Reference ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg border border-zinc-200 hover:scale-105 transition-transform duration-200"
                  />
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-1 -right-1 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg"
                    style={{
                      width: `${Math.min(Math.max(16, 20 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 24)}px`,
                      height: `${Math.min(Math.max(16, 20 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 24)}px`
                    }}
                  >
                    <X style={{
                      width: `${Math.min(Math.max(10, 12 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 16)}px`,
                      height: `${Math.min(Math.max(10, 12 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 16)}px`
                    }} />
                  </button>
                </div>
              ))}
              {/* Add tile if more images allowed */}
              {currentImages.length < effectiveMaxImages && (
                <div
                  className={cn(
                    "relative w-full h-full rounded-lg border border-dashed border-zinc-300 hover:border-zinc-400 bg-white/50 flex items-center justify-center cursor-pointer transition-colors"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*"
                    onChange={handleFileChange}
                  />
                  <div className="flex flex-col items-center justify-center gap-1 text-zinc-500">
                    <Upload className="w-5 h-5" />
                    <span className="text-xs">Add</span>
                  </div>
                </div>
              )}
            </div>
            {/* Hover preview (default variant) */}
            {hoveredIndex !== null && hoverPos && currentImages[hoveredIndex] && (
              <div
                className="fixed z-[9999] pointer-events-none"
                style={{
                  left: `${hoverPos.left}px`,
                  top: `${hoverPos.top}px`,
                  width: `${hoverPos.width}px`,
                  maxHeight: '70vh'
                }}
              >
                <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 p-3">
                  <img
                    src={currentImages[hoveredIndex]}
                    alt={`Reference ${hoveredIndex + 1}`}
                    className="w-full h-full max-h-[70vh] object-contain rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        // No images - show upload area
        <div
          className={cn(
            "relative w-full h-full rounded-lg transition-all duration-200 flex flex-col items-center justify-center p-6",
            isDragging && "ring-2 ring-primary ring-offset-2"
          )}
          style={customStyles?.container}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="w-full h-full flex flex-col items-center justify-center gap-2"
            onClick={() => fileInputRef.current?.click()}
            style={customStyles?.button}
          >
            {children || (
              <>
                <ImageIcon style={{
                  width: `${Math.min(Math.max(24, 32 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 40)}px`,
                  height: `${Math.min(Math.max(24, 32 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 40)}px`,
                  color: '#9ca3af',
                  marginBottom: `${Math.min(Math.max(4, 8 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 12)}px`
                }} />
                <p className="font-medium text-center" style={{
                  color: textSettings?.textColor || '#64748b',
                  fontFamily: textSettings?.fontFamily || 'inherit',
                  fontSize: `${Math.min(Math.max(10, (textSettings?.fontSize || 14) * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 18)}px`
                }}>
                  {textSettings?.secondaryText || "Drag & drop or click to upload"}
                </p>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
} 
"use client";

import { useState, useRef } from "react";
import { cn } from "@/lib/utils";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ensure maxImages is always a number
  const effectiveMaxImages = maxImages ?? 1;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Only process the first file if we're not at max
    if (files.length > 0 && currentImages.length < effectiveMaxImages) {
      const reader = new FileReader();
      reader.onload = (e) => {
        onImageUpload(e.target?.result as string);
      };
      reader.readAsDataURL(files[0]);
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
        const reader = new FileReader();
        reader.onload = (e) => {
          onImageUpload(e.target?.result as string);
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
    return (
      <div className="flex items-center gap-2">
        {/* Uploaded images as small thumbnails */}
        {currentImages.map((image, index) => (
          <div
            key={index}
            className="relative group"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden border border-zinc-200 cursor-pointer hover:border-zinc-300 transition-colors">
              <img
                src={image}
                alt={`Reference ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
            {/* Remove button on hover */}
            <button
              onClick={() => handleRemoveImage(index)}
              className="absolute -top-1 -right-1 w-4 h-4 bg-zinc-600 hover:bg-zinc-700 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-2.5 h-2.5" />
            </button>
            {/* Large preview on hover */}
            {hoveredIndex === index && (
              <div className="fixed z-[9999] pointer-events-none" style={{
                left: '50%',
                top: '50%',
                transform: 'translate(-50%, -50%)'
              }}>
                <div className="bg-white rounded-lg shadow-xl border border-zinc-200 p-3">
                  <img
                    src={image}
                    alt={`Reference ${index + 1}`}
                    className="w-48 h-48 object-cover rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Only show upload button if we have no images */}
        {currentImages.length === 0 && (
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
              className="w-8 h-8 rounded-lg border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 flex items-center justify-center transition-all duration-200"
              style={customStyles?.button}
              title={textSettings?.secondaryText || "Drag & drop or click to upload"}
            >
              {children || <ImageIcon className="w-4 h-4" style={{ color: textSettings?.textColor || '#64748b' }} />}
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
                (<div className="relative w-full h-full group">
                  <img
                    src={currentImages[0]}
                    alt="Reference"
                    className="w-full h-full object-cover rounded-lg"
                  />
                  <button
                    onClick={() => handleRemoveImage(0)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-600 hover:bg-zinc-700 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>)
              ) : null}
            </div>
          </div>
        ) : (
          // No images - show upload area
          (<div
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
          </div>)
        )}
      </div>
    );
  }

  // Default variant - show thumbnails within the upload area
  return (
    <div className="w-full h-full">
      {currentImages.length > 0 ? (
        <div className="w-full h-full flex flex-col">
          {/* Thumbnails area - takes most space */}
          <div className="flex-1 min-h-0">
            <div className="grid grid-cols-3 gap-2 h-full">
              {currentImages.map((image, index) => (
                <div key={index} className="relative group">
                  <img
                    src={image}
                    alt={`Reference ${index + 1}`}
                    className="w-full h-full object-cover rounded-lg border border-zinc-200 hover:scale-105 transition-transform duration-200"
                  />
                  <button
                    onClick={() => handleRemoveImage(index)}
                    className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        // No images - show upload area
        (<div
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
                <ImageIcon className="w-8 h-8 text-zinc-400 mb-2" />
                <p className="text-sm font-medium text-center" style={{
                  color: textSettings?.textColor || '#64748b',
                  fontFamily: textSettings?.fontFamily || 'inherit',
                  fontSize: textSettings?.fontSize ? `${textSettings.fontSize}px` : '14px'
                }}>
                  {textSettings?.secondaryText || "Drag & drop or click to upload"}
                </p>
              </>
            )}
          </button>
        </div>)
      )}
    </div>
  );
} 
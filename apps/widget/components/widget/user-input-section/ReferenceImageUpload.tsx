"use client";

import { useState, useRef } from "react";
import { cn } from "../../../lib/utils";
import { Upload, X, Image as ImageIcon } from "lucide-react";

interface ReferenceImageUploadProps {
  onImageUpload: (image: string | null) => void;
  onImageRemove?: (index: number) => void;
  currentImages?: string[];
  maxImages?: number;
  /** Optional override (needed outside `/widget/[instanceId]` routes, e.g. `/form/[instanceId]`). */
  instanceId?: string;
  customStyles?: {
    container?: React.CSSProperties;
    button?: React.CSSProperties;
  };
  children?: React.ReactNode;
  variant?: "default" | "chatgpt" | "minimal";
  textSettings?: {
    secondaryText?: string;
    textColor?: string;
    fontFamily?: string;
    fontSize?: number;
  };
}

export function ReferenceImageUpload({
  onImageUpload,
  onImageRemove,
  currentImages = [],
  maxImages,
  instanceId: instanceIdOverride,
  customStyles,
  children,
  variant = "default",
  textSettings
}: ReferenceImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const effectiveMaxImages = maxImages ?? 1;

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length > 0 && currentImages.length < effectiveMaxImages) {
      const file = files[0];
      if (!file.type.startsWith('image/')) return;
      if (file.size > 10 * 1024 * 1024) {
        console.error('Image too large (>10MB)');
      } else {
        const reader = new FileReader();
        reader.onload = async (e) => {
          const dataUrl = e.target?.result as string;
          try {
            let instanceId = instanceIdOverride || 'unknown';
            if (!instanceIdOverride) {
              try {
                const parts = window.location.pathname.split('/').filter(Boolean);
                const idx = parts.indexOf('widget');
                if (idx >= 0 && parts[idx + 1]) instanceId = parts[idx + 1];
              } catch {}
            }
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
          onImageUpload(dataUrl);
        };
        reader.readAsDataURL(file);
      }
    }
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
    if (files.length > 0 && currentImages.length < effectiveMaxImages) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        if (file.size > 10 * 1024 * 1024) {
          console.error('Image too large (>10MB)');
          return;
        }
        const reader = new FileReader();
        reader.onload = async (e2) => {
          const dataUrl = e2.target?.result as string;
          try {
            let instanceId = instanceIdOverride || 'unknown';
            if (!instanceIdOverride) {
              try {
                const parts = window.location.pathname.split('/').filter(Boolean);
                const idx = parts.indexOf('widget');
                if (idx >= 0 && parts[idx + 1]) instanceId = parts[idx + 1];
              } catch {}
            }
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

  if (variant === "chatgpt") {
    return (
      <div className="flex items-center gap-2 w-full min-w-0">
        {currentImages.map((image, index) => (
          <div
            key={index}
            className="relative group flex-shrink-0"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <div 
              className="rounded-lg overflow-hidden border border-zinc-200 cursor-pointer hover:border-zinc-300 transition-colors"
              style={{
                width: `${Math.min(Math.max(24, 32 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 40)}px`,
                height: `${Math.min(Math.max(24, 32 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 40)}px`
              }}
            >
              <img
                src={image}
                alt={`Reference ${index + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
            <button
              onClick={() => handleRemoveImage(index)}
              className="absolute -top-1 -right-1 bg-zinc-600 hover:bg-zinc-700 text-white rounded-full text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{
                width: `${Math.min(Math.max(12, 16 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 20)}px`,
                height: `${Math.min(Math.max(12, 16 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 20)}px`
              }}
            >
              <X style={{
                width: `${Math.min(Math.max(8, 10 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 12)}px`,
                height: `${Math.min(Math.max(8, 10 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 12)}px`
              }} />
            </button>
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
              className="rounded-lg border border-zinc-200 hover:border-zinc-300 bg-white hover:bg-zinc-50 flex items-center justify-center transition-all duration-200 flex-shrink-0"
              style={{
                ...customStyles?.button,
                width: `${Math.min(Math.max(24, 32 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 40)}px`,
                height: `${Math.min(Math.max(24, 32 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 40)}px`
              }}
              title={textSettings?.secondaryText || "Drag & drop or click to upload"}
            >
              {children || <ImageIcon style={{ 
                width: `${Math.min(Math.max(12, 16 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 20)}px`,
                height: `${Math.min(Math.max(12, 16 * (textSettings?.fontSize ? textSettings.fontSize / 14 : 1)), 20)}px`,
                color: textSettings?.textColor || '#64748b' 
              }} />}
            </button>
          </div>
        )}
      </div>
    );
  }

  if (variant === "minimal") {
    return (
      <div className="w-full h-full">
        {currentImages.length > 0 ? (
          <div className="w-full h-full flex flex-col">
            <div className="flex-1 min-h-0 relative">
              {currentImages.length === 1 ? (
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

  return (
    <div className="w-full h-full min-w-0">
      {currentImages.length > 0 ? (
        <div className="w-full h-full flex flex-col min-w-0">
          <div className="flex-1 min-h-0 min-w-0">
            <div className="grid grid-cols-3 gap-2 h-full w-full">
              {currentImages.map((image, index) => (
                <div key={index} className="relative group min-w-0">
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
            </div>
          </div>
        </div>
      ) : (
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



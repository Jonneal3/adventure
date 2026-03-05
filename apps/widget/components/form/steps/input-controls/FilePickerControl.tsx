"use client";

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useFormTheme } from '../../demo/FormThemeProvider';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload as UploadIcon, X, Check, Camera, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useLayoutDensity } from "../ui-layout/layout-density";
import { isImageRefLike } from "@/lib/ai-form/utils/reference-images";

interface FilePickerProps {
  value?: string | string[];
  onChange: (data: string | string[]) => void;
  onUploadingChange?: (isUploading: boolean) => void;
  maxFiles?: number;
  accept?: string;
  uploadRole?: string;
  cameraEnabled?: boolean;
  instanceId?: string;
  className?: string;
  layoutVariant?: "default" | "choice_compact";
}

async function readAsDataUrl(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(blob);
  });
}

async function loadImageForCanvas(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void }> {
  if (typeof createImageBitmap !== "undefined") {
    const bitmap = await createImageBitmap(file);
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => {
        ctx.drawImage(bitmap, 0, 0, w, h);
        try {
          // @ts-ignore - close exists on ImageBitmap in modern browsers
          bitmap.close?.();
        } catch {}
      },
    };
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Failed to decode image"));
      el.src = url;
    });
    return {
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function canvasToJpegBlob(
  file: File,
  opts: { maxDim: number; maxBytes: number; quality: number }
): Promise<Blob> {
  const { width, height, draw } = await loadImageForCanvas(file);
  const maxSide = Math.max(1, Math.max(width, height));
  const scale = Math.min(1, opts.maxDim / maxSide);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not available");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  draw(ctx, w, h);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", opts.quality));
  if (!blob) throw new Error("Failed to encode jpeg");

  if (blob.size <= opts.maxBytes) return blob;
  return blob;
}

async function compressImageToDataUrl(
  file: File,
  opts?: { maxDim?: number; maxBytes?: number }
): Promise<string> {
  const maxBytes = Math.max(120_000, Math.floor(opts?.maxBytes ?? 850_000));
  let maxDim = Math.max(480, Math.floor(opts?.maxDim ?? 1600));
  let quality = 0.82;

  for (let attempt = 0; attempt < 10; attempt++) {
    const blob = await canvasToJpegBlob(file, { maxDim, maxBytes, quality });
    if (blob.size <= maxBytes) return await readAsDataUrl(blob);

    if (quality > 0.45) {
      quality = Math.max(0.45, quality - 0.12);
      continue;
    }

    // If quality is already low, start shrinking dimensions.
    if (maxDim > 1024) maxDim = 1280;
    else if (maxDim > 896) maxDim = 1024;
    else if (maxDim > 768) maxDim = 896;
    else if (maxDim > 640) maxDim = 768;
    else maxDim = 640;
    quality = 0.78;
  }

  // Worst case fallback: still return something (may be large).
  return await readAsDataUrl(file);
}

export function FilePicker({
  value,
  onChange,
  onUploadingChange,
  maxFiles = 1,
  accept = "image/*",
  uploadRole,
  cameraEnabled = false,
  instanceId,
  className,
  layoutVariant = "default",
}: FilePickerProps) {
  const { theme } = useFormTheme();
  const density = useLayoutDensity();
  const isCompact = density === "compact";
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [items, setItems] = useState<Array<{ id: string; src: string; name: string; status: "uploading" | "ready" | "error"; error?: string }>>([]);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const hasUploads = items.length > 0;
  const anyUploading = items.some((i) => i.status === "uploading");

  useEffect(() => {
    onUploadingChange?.(anyUploading);
  }, [anyUploading, onUploadingChange]);

  const baseRadius =
    typeof (theme as any)?.borderRadius === "number" && Number.isFinite((theme as any).borderRadius)
      ? Number((theme as any).borderRadius)
      : 12;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobileViewport(Boolean(mq.matches));
    update();
    try {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    } catch {
      // Safari < 14
      // @ts-ignore
      mq.addListener(update);
      // @ts-ignore
      return () => mq.removeListener(update);
    }
  }, []);

  useEffect(() => {
    const seeded = (Array.isArray(value) ? value : value ? [value] : [])
      .filter((x: any) => typeof x === 'string' && (x.startsWith('data:') || x.startsWith('http')))
      .slice(0, maxFiles);
    setItems(prev => {
      const readySrcs = prev.filter(i => i.status === 'ready').map(i => i.src);
      if (seeded.length === readySrcs.length && seeded.every((s, i) => s === readySrcs[i])) return prev;
      return seeded.map((src, idx) => ({ id: `seed-${idx}`, src, name: `Uploaded item ${idx + 1}`, status: 'ready' as const }));
    });
  }, [value, maxFiles]);

  const uploadToReferenceImages = useCallback(
    async (dataUrl: string) => {
      if (!instanceId) return null;
      try {
        const res = await fetch("/api/upload-reference-image", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          cache: "no-store",
          body: JSON.stringify({ instanceId, image: dataUrl }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return null;
        const url = typeof (json as any)?.url === "string" ? String((json as any).url) : null;
        return url && isImageRefLike(url, true) ? url : null;
      } catch {
        return null;
      }
    },
    [instanceId]
  );

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const remaining = Math.max(0, maxFiles - items.length);
    const toAdd = acceptedFiles.slice(0, remaining);
    if (toAdd.length === 0) return;

    const newPlaceholders = toAdd.map((file) => {
      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const preview = (() => {
        try {
          return URL.createObjectURL(file);
        } catch {
          return "";
        }
      })();
      return { id, src: preview, name: file.name || "Photo", status: "uploading" as const, file };
    });

    setItems((prev) => [...prev, ...newPlaceholders.map(({ id, src, name, status }) => ({ id, src, name, status }))].slice(0, maxFiles));

    (async () => {
      for (const placeholder of newPlaceholders) {
        const { id, file } = placeholder;
        try {
          const compressed = await compressImageToDataUrl(file, { maxDim: 1600, maxBytes: 850_000 });
          const uploadedUrl = await uploadToReferenceImages(compressed);
          const finalSrc = uploadedUrl || compressed;

          setItems((prev) => {
            const next = prev.map((it) => (it.id === id ? { ...it, src: finalSrc, status: "ready" as const, error: undefined } : it));
            const out = next
              .filter((i) => i.status === "ready" && typeof i.src === "string" && i.src)
              .slice(0, maxFiles)
              .map((i) => i.src);
            onChange(maxFiles === 1 ? (out[0] || "") : out);
            return next;
          });

          if (placeholder.src) {
            try {
              URL.revokeObjectURL(placeholder.src);
            } catch {}
          }
        } catch (e: any) {
          setItems((prev) =>
            prev.map((it) =>
              it.id === id
                ? { ...it, status: "error" as const, error: typeof e?.message === "string" ? e.message : "Upload failed" }
                : it
            )
          );
        }
      }
    })();
  }, [items.length, maxFiles, onChange, uploadToReferenceImages]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept ? { [accept]: [] } : undefined,
    maxFiles,
    multiple: maxFiles > 1
  });

  const removeItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    const out = newItems.filter((i) => i.status === "ready").map(i => i.src);
    onChange(maxFiles === 1 ? out[0] : out);
  };

  const dropzoneHeadline = hasUploads ? (maxFiles === 1 ? "Replace photo" : "Add more photos") : "Upload a photo";
  const dropzoneSubhead =
    maxFiles === 1
      ? "JPG/PNG works best"
      : `Up to ${maxFiles} images`;

  const compactInline = isCompact && hasUploads && maxFiles > 1;
  const isChoiceCompact = layoutVariant === "choice_compact";
  const shouldShowCamera = Boolean(cameraEnabled && isMobileViewport && !isChoiceCompact);
  const compactThumbStrip = (
    <div className="min-w-0">
      {/* Fixed-height strip so compact layouts never overflow vertically */}
      <div className="flex h-16 w-full max-w-full items-center gap-2 overflow-x-auto overflow-y-hidden min-w-0 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            layout
            className={cn(
              "group relative h-16 w-16 shrink-0 overflow-hidden border bg-background/60 shadow-sm",
              item.status === "error" ? "border-red-500/30" : "border-[color:var(--form-surface-border-color)]"
            )}
            style={{ borderRadius: `${baseRadius}px` }}
          >
            {item.src.startsWith("data:image") || item.src.startsWith("http") || item.src.startsWith("blob:") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.src} alt={item.name} className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-muted">
                <UploadIcon className="h-5 w-5 text-muted-foreground" />
              </div>
            )}

            {/* Status indicator */}
            <div className="absolute left-1.5 top-1.5">
              {item.status === "ready" ? (
                <div
                  className="flex h-5 w-5 items-center justify-center rounded-full shadow-sm ring-2 ring-white/90"
                  style={{ backgroundColor: theme.primaryColor }}
                >
                  <Check className="h-3 w-3 text-white stroke-[3]" />
                </div>
              ) : item.status === "uploading" ? (
                <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-white/80 shadow-sm ring-2 ring-black/20" />
              ) : (
                <div className="h-2.5 w-2.5 rounded-full bg-red-500 shadow-sm ring-2 ring-white/80" />
              )}
            </div>

            {/* Remove */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeItem(index);
              }}
              className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white/90 shadow-sm opacity-100 transition hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              aria-label="Remove uploaded image"
              title="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            {item.status === "error" && item.error ? (
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-red-700/70 via-red-700/20 to-transparent p-1.5">
                <div className="text-[10px] font-semibold text-white/95 truncate">{item.error}</div>
              </div>
            ) : null}
          </motion.div>
        ))}
      </div>
    </div>
  );

  // Non-compact, image(s) uploaded → show big preview + compact upload strip below
  const fullHasUploads = hasUploads && !compactInline;

  const compactUploadStrip = (
    <div className="flex items-stretch gap-2">
      <div
        {...getRootProps()}
        data-upload-role={uploadRole || undefined}
        className={cn(
          "group relative h-14 min-w-0 flex-1 border-2 border-dashed text-center cursor-pointer transition-colors duration-200 ease-out flex items-center px-3 overflow-hidden",
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/10 bg-background/60"
        )}
        style={{ borderRadius: `${baseRadius * 1.5}px` }}
      >
        <input {...getInputProps({ className: "hidden" })} />
        <div className="flex items-center gap-2.5 w-full min-w-0">
          <div className={cn("p-1.5 rounded-full bg-muted/50 group-hover:bg-primary/10 transition-colors duration-200", isDragActive && "bg-primary/20")}>
            <UploadIcon className={cn("w-4 h-4 transition-colors duration-200", isDragActive ? "text-primary" : "text-muted-foreground group-hover:text-primary/70")} />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-sm font-semibold tracking-tight leading-tight truncate" style={{ color: theme.textColor }}>
              {isDragActive ? "Drop here" : dropzoneHeadline}
            </p>
            <p className="text-[10px] text-muted-foreground font-medium truncate">
              {isDragActive ? "Release to upload" : dropzoneSubhead}
            </p>
          </div>
        </div>
      </div>
      {shouldShowCamera ? (
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="h-14 w-14 shrink-0"
          style={{ borderRadius: `${baseRadius * 1.5}px` }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            cameraInputRef.current?.click();
          }}
          aria-label="Use camera"
          title="Use camera"
        >
          <Camera className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  );

  return (
    <div className={cn(isCompact ? (compactInline ? "space-y-2" : "space-y-4") : "space-y-4", isChoiceCompact ? "h-full" : null, className)}>
      {/* Hidden camera input (shared across layouts) */}
      <input
        ref={cameraInputRef}
        type="file"
        accept={accept}
        capture="environment"
        className="hidden"
        multiple={maxFiles > 1}
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          e.target.value = "";
          if (files.length === 0) return;
          onDrop(files);
        }}
      />

      {/* ── Compact inline layout (compact density + has uploads) ── */}
      {compactInline ? (
        <div className="flex items-stretch gap-2 min-w-0 overflow-hidden">
          <motion.div
            className="flex-1 min-w-0 flex items-stretch gap-2 overflow-hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div
              {...getRootProps()}
              data-upload-role={uploadRole || undefined}
              className={cn(
                "group relative h-16 min-w-0 flex-1 border-2 border-dashed text-center cursor-pointer transition-colors duration-200 ease-out flex items-center",
                "px-3 overflow-hidden",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/10 bg-background/60"
              )}
              style={{ borderRadius: `${baseRadius * 1.5}px` }}
            >
              <input {...getInputProps({ className: "hidden" })} />
              <div className="flex items-center justify-center w-full min-w-0 gap-2">
                <div className={cn("p-2 rounded-full bg-muted/50 group-hover:bg-primary/10 transition-colors duration-200", isDragActive && "bg-primary/20")}>
                  <UploadIcon className={cn("w-5 h-5 transition-colors duration-200", isDragActive ? "text-primary" : "text-muted-foreground group-hover:text-primary/70")} />
                </div>
                <div className="min-w-0 text-left space-y-0">
                  <p className="text-sm font-semibold tracking-tight leading-tight truncate" style={{ color: theme.textColor }}>
                    {isDragActive ? "Drop here" : dropzoneHeadline}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-medium truncate">
                    {isDragActive ? "Release to upload" : dropzoneSubhead}
                  </p>
                </div>
              </div>
            </div>

            {shouldShowCamera ? (
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-16 w-16 rounded-full shrink-0"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  cameraInputRef.current?.click();
                }}
                aria-label="Use camera"
                title="Use camera"
              >
                <Camera className="h-5 w-5" />
              </Button>
            ) : null}
          </motion.div>

          <div className="flex-1 min-w-0">{compactThumbStrip}</div>
        </div>

      ) : fullHasUploads ? (
        /* ── Non-compact with uploads: minimal preview + lightweight actions ── */
        <AnimatePresence mode="wait">
          <motion.div
            key="uploaded-view"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25 }}
            className="space-y-3"
          >
            {/* Uploaded image preview */}
            <div className={cn(items.length === 1 ? "relative" : "grid grid-cols-2 gap-2")}>
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={cn(
                    "relative overflow-hidden bg-muted/10",
                    items.length === 1 ? "rounded-2xl border p-2" : null
                  )}
                  style={{ borderRadius: `${baseRadius * 1.5}px` }}
                >
                  {items.length === 1 ? (
                    <div className="absolute right-4 top-4 z-20">
                      <div className="flex items-center gap-2 rounded-xl border border-black/10 bg-white/90 p-1.5 shadow-md backdrop-blur-md">
                        {(maxFiles === 1 || items.length < maxFiles) ? (
                          <div {...getRootProps()}>
                            <input {...getInputProps({ className: "hidden" })} />
                            <button
                              type="button"
                              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-transparent px-2.5 text-[11px] font-semibold text-foreground/80 transition-colors hover:border-foreground/15 hover:bg-background"
                            >
                              <RefreshCw className="h-3 w-3" />
                              Change
                            </button>
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removeItem(index)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-transparent px-2.5 text-[11px] font-semibold text-foreground/70 transition-colors hover:border-red-300/70 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-3 w-3" />
                          Remove
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {item.src.startsWith("data:image") || item.src.startsWith("http") || item.src.startsWith("blob:") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.src}
                      alt={item.name}
                      className={cn(
                        "w-full bg-transparent",
                        items.length === 1
                          ? isChoiceCompact
                            ? "h-[34dvh] sm:h-[38dvh] rounded-xl object-contain"
                            : "h-[40dvh] sm:h-[46dvh] rounded-xl object-contain"
                          : "aspect-square object-cover"
                      )}
                    />
                  ) : (
                    <div className={cn("w-full bg-muted flex items-center justify-center", items.length === 1 ? "h-64" : "aspect-square")}>
                      <UploadIcon className="w-10 h-10 text-muted-foreground" />
                    </div>
                  )}

                  {item.status === "uploading" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
                      <div className="h-3 w-3 animate-pulse rounded-full bg-white shadow" />
                    </div>
                  )}

                  {item.status === "error" && item.error ? (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-red-700/80 to-transparent px-3 pb-2 pt-4">
                      <div className="text-xs font-semibold text-white truncate">{item.error}</div>
                    </div>
                  ) : null}
                </div>
              ))}

            </div>

            {/* Multi-image mode affordance */}
            {items.length > 1 && (maxFiles === 1 || items.length < maxFiles) ? (
              <div className="flex items-center justify-center">
                <div {...getRootProps()} className="flex justify-center">
                  <input {...getInputProps({ className: "hidden" })} />
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Add more photos
                  </button>
                </div>
              </div>
            ) : null}
          </motion.div>
        </AnimatePresence>

      ) : (
        /* ── Non-compact, no uploads: big dropzone ── */
        <motion.div
          className={isChoiceCompact ? "h-full" : undefined}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div
            {...getRootProps()}
            data-upload-role={uploadRole || undefined}
            className={cn(
              "group relative text-center cursor-pointer transition-all duration-200 ease-out",
              isChoiceCompact ? "h-full min-h-[220px] p-4 sm:p-5 flex items-center" : isCompact ? "p-5 sm:p-6" : "p-9 sm:p-10",
              isDragActive
                ? (isChoiceCompact ? "border-2 border-dashed border-primary bg-primary/5" : "border bg-primary/5")
                : (isChoiceCompact
                    ? "border-2 border-dashed border-muted-foreground/25 hover:border-primary/45 bg-background"
                    : "border hover:bg-muted/10 bg-background/60")
            )}
            style={{ borderRadius: `${baseRadius * 2}px` }}
          >
            <input {...getInputProps({ className: "hidden" })} />
            <div className={cn("flex items-center justify-center", isChoiceCompact ? "gap-2.5" : "gap-4")}>
              <div className={cn(isChoiceCompact ? "" : "p-3.5 rounded-full bg-muted/40", isDragActive && !isChoiceCompact ? "bg-primary/20" : null)}>
                <UploadIcon className={cn(isChoiceCompact ? "w-5 h-5" : "w-8 h-8", "transition-colors duration-200", isDragActive ? "text-primary" : "text-muted-foreground")} />
              </div>
              <div className={cn("min-w-0 space-y-1", isChoiceCompact ? "text-center" : "text-left")}>
                <p
                  className={cn(
                    isChoiceCompact ? "text-sm sm:text-base" : "text-base sm:text-lg",
                    "font-semibold tracking-tight leading-tight"
                  )}
                  style={{ color: theme.textColor }}
                >
                  {isDragActive ? "Drop files here" : dropzoneHeadline}
                </p>
                <p className={cn(isChoiceCompact ? "text-xs" : "text-sm", "text-muted-foreground font-medium truncate")}>
                  {isDragActive ? "Release to upload" : isChoiceCompact ? "JPG/PNG" : dropzoneSubhead}
                </p>
              </div>
            </div>
          </div>

          {shouldShowCamera ? (
            <div className="flex items-center justify-center mt-3">
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="h-11 w-11 rounded-full"
                onClick={() => cameraInputRef.current?.click()}
                aria-label="Use camera"
                title="Use camera"
              >
                <Camera className="h-5 w-5" />
              </Button>
            </div>
          ) : null}
        </motion.div>
      )}
    </div>
  );
}

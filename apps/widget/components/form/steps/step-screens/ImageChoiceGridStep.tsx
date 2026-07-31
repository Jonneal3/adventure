"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { StepDefinition } from "@/types/ai-form";
import type { MultipleChoiceUI } from "@/types/ai-form-ui-contract";
import { StepLayout } from "../ui-layout/StepLayout";
import { ImageChoiceGrid } from "../input-controls/ImageChoiceGridControl";
import { layoutDebugClassName, withLayoutDebugStyle } from "../runtime/step-engine/debug-layout";
import { Camera, Loader2 } from "lucide-react";

interface ImageChoiceGridStepProps {
  step: StepDefinition | MultipleChoiceUI;
  stepData?: any;
  onComplete: (data: any) => void;
  onBack?: () => void;
  canGoBack: boolean;
  isLoading: boolean;
  headerInlineControl?: React.ReactNode;
  guidedThumbnailMode?: boolean;
  actionsVariant?: "default" | "sticky_mobile" | "icon_only";
  compactInPreview?: boolean;
  layoutDebugEnabled?: boolean;
  instanceId?: string;
  onProjectPhotoSelected?: (url: string) => void | Promise<void>;
}

type PriceTier = "$" | "$$" | "$$$" | "$$$$";
type Opt = {
  label: string;
  value?: string;
  description?: string;
  imageUrl?: string;
  priceTier?: PriceTier;
  priceRange?: { low: number; high: number; currency?: string };
  disabled?: boolean;
};

type ImageChoiceVariant = "swipe" | "selectors";

function normalizeOptions(raw: any[]): Opt[] {
  const normalizePriceTier = (v: unknown): PriceTier | undefined => {
    const t = typeof v === "string" ? v.trim() : "";
    if (t === "$" || t === "$$" || t === "$$$" || t === "$$$$") return t;
    return undefined;
  };
  return (Array.isArray(raw) ? raw : []).map((o) => {
    if (typeof o === "string") return { label: o, value: o };
    const imageUrl =
      typeof o?.imageUrl === "string"
        ? o.imageUrl
        : typeof o?.image_url === "string"
          ? o.image_url
          : typeof o?.image === "string"
            ? o.image
            : undefined;
    return {
      label: String(o?.label || o?.value || ""),
      value: String(o?.value || o?.label || ""),
      description: typeof o?.description === "string" ? o.description : undefined,
      imageUrl,
      priceTier: normalizePriceTier(o?.price_tier ?? o?.priceTier),
      priceRange:
        o?.priceRange && typeof o.priceRange === "object"
          ? {
              low: Number((o as any).priceRange.low),
              high: Number((o as any).priceRange.high),
              currency: typeof (o as any).priceRange.currency === "string" ? (o as any).priceRange.currency : undefined,
            }
          : undefined,
      disabled: Boolean(o?.disabled),
    };
  });
}

function isOtherOption(option: Opt): boolean {
  const label = String(option.label || "").trim().toLowerCase();
  const value = String(option.value || "").trim().toLowerCase();
  return label === "other" || value === "other";
}

function useIsNarrowViewport(maxWidthPx: number): boolean {
  const [isNarrow, setIsNarrow] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(`(max-width: ${Math.max(0, Math.floor(maxWidthPx))}px)`);
    const onChange = () => setIsNarrow(Boolean(mql.matches));
    onChange();
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    // Safari < 14
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [maxWidthPx]);

  return isNarrow;
}

function isStyleDirectionStep(step: StepDefinition | MultipleChoiceUI): boolean {
  const rawId = String((step as any)?.id || (step as any)?.key || "").trim().toLowerCase();
  return rawId === "style_direction" || rawId === "step-style-direction";
}

function isPricedImageGridStep(step: StepDefinition | MultipleChoiceUI): boolean {
  const rawId = String((step as any)?.id || (step as any)?.key || "").trim().toLowerCase();
  return rawId === "step-priced-image-grid";
}

export function ImageChoiceGridStep({
  step,
  stepData,
  onComplete,
  onBack,
  canGoBack,
  isLoading,
  headerInlineControl,
  guidedThumbnailMode,
  actionsVariant,
  compactInPreview,
  layoutDebugEnabled = false,
  instanceId,
  onProjectPhotoSelected,
}: ImageChoiceGridStepProps) {
  const isUIStep = "type" in (step as any) && !("componentType" in (step as any));
  const optionsRaw = isUIStep
    ? (step as MultipleChoiceUI).options
    : (step as StepDefinition).content?.options || (step as StepDefinition).data?.options || [];
  const options = normalizeOptions(optionsRaw as any[]).filter((option) => !isOtherOption(option));
  const multiple = isUIStep ? Boolean((step as MultipleChoiceUI).multi_select) : Boolean((step as StepDefinition).data?.multiple);
  const isStyleStep = isStyleDirectionStep(step);
  const isPricedGridStep = isPricedImageGridStep(step);
  const minSelections =
    isUIStep && multiple && Number.isFinite(Number((step as any)?.min_selections))
      ? Math.max(1, Math.floor(Number((step as any).min_selections)))
      : isStyleStep && multiple
        ? 3
      : multiple
        ? 1
        : 1;
  const maxSelections =
    isUIStep && multiple && Number.isFinite(Number((step as any)?.max_selections))
      ? Math.max(1, Math.floor(Number((step as any).max_selections)))
      : isStyleStep && multiple
        ? 5
      : undefined;
  const [value, setValue] = React.useState<any>(stepData ?? (multiple ? [] : ""));
  const [starterPage, setStarterPage] = React.useState(0);
  const projectPhotoInputRef = React.useRef<HTMLInputElement>(null);
  const [projectPhotoUploading, setProjectPhotoUploading] = React.useState(false);
  const [projectPhotoError, setProjectPhotoError] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (stepData !== undefined) setValue(stepData);
  }, [stepData]);
  React.useEffect(() => {
    setStarterPage(0);
  }, [(step as any)?.id]);

  const isNarrowViewport = useIsNarrowViewport(768);
  const effectiveVariant: ImageChoiceVariant = guidedThumbnailMode
    ? "selectors"
    : compactInPreview
      ? "selectors"
      : isNarrowViewport
        ? "selectors"
        : "selectors";

  const columns = isUIStep ? (step as any)?.columns : (step as any)?.data?.columns;
  const normalizedColumns = Number.isFinite(Number(columns)) ? Math.max(1, Math.min(6, Math.floor(Number(columns)))) : undefined;
  const effectiveColumns =
    !isPricedGridStep && !guidedThumbnailMode && !compactInPreview && isNarrowViewport
      ? 1
      : normalizedColumns;

  const selectedArray = Array.isArray(value) ? value : value ? [value] : [];
  const visibleOptions = isStyleStep
    ? options.slice(starterPage * 10, starterPage * 10 + 10)
    : options;
  const hasMoreStarterOptions = isStyleStep && options.length > 10;
  const canContinue = multiple ? selectedArray.length >= minSelections : Boolean(value);
  const maxReached = Boolean(multiple && Number.isFinite(Number(maxSelections)) && selectedArray.length >= Number(maxSelections));
  const autoContinueOnSelect = isPricedGridStep
    ? !multiple
    : false;
  const handleValueChange = React.useCallback(
    (nextValue: string | string[]) => {
      setValue(nextValue);
      if (!autoContinueOnSelect || isLoading) return;
      const resolvedValue = Array.isArray(nextValue) ? nextValue[0] : nextValue;
      if (!resolvedValue) return;
      onComplete(resolvedValue);
    },
    [autoContinueOnSelect, isLoading, onComplete]
  );
  const handleStarterPhoto = React.useCallback(async (file?: File | null) => {
    if (!file || !isStyleStep || !instanceId || !onProjectPhotoSelected || projectPhotoUploading) return;
    if (!file.type.startsWith("image/")) {
      setProjectPhotoError("Choose an image file.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setProjectPhotoError("Choose an image smaller than 8 MB.");
      return;
    }
    setProjectPhotoUploading(true);
    setProjectPhotoError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Could not read that photo."));
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/upload-reference-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId, image: dataUrl }),
      });
      const payload = response.ok ? await response.json().catch(() => ({})) : null;
      const url = typeof payload?.url === "string" && payload.url ? payload.url : dataUrl;
      await onProjectPhotoSelected(url);
      onComplete("__project_photo__");
    } catch (error) {
      setProjectPhotoError(error instanceof Error ? error.message : "Could not add that photo.");
    } finally {
      setProjectPhotoUploading(false);
    }
  }, [instanceId, isStyleStep, onComplete, onProjectPhotoSelected, projectPhotoUploading]);
  const selectionCounter = multiple && Number.isFinite(Number(maxSelections))
    ? (
        <span
          className={cn(
            "shrink-0 tabular-nums text-sm sm:text-base",
            maxReached ? "font-semibold text-primary" : "font-medium text-muted-foreground"
          )}
        >
          {selectedArray.length}/{Number(maxSelections)}
        </span>
      )
    : null;
  /** In preview-under compact layout, hide "Pick n–m" + n/m counter — it used a full-height grid row and overlapped the title/images. */
  const styleSelectionHeader =
    compactInPreview
      ? null
      : isStyleStep && multiple && selectionCounter
        ? (
            <div
              className={cn(
                "flex max-w-full flex-col items-end gap-0.5 sm:flex-row sm:items-baseline sm:gap-2.5",
                headerInlineControl ? "sm:items-center" : null
              )}
            >
              <span className="text-right text-[11px] leading-snug text-muted-foreground max-w-[14rem] sm:max-w-[min(100%,20rem)] sm:text-sm">
                <span className="sm:hidden">
                  Pick {minSelections}–{Number(maxSelections)} styles
                </span>
                <span className="hidden sm:inline">
                  Select at least {minSelections} examples (up to {Number(maxSelections)})
                </span>
              </span>
              {selectionCounter}
            </div>
          )
        : (
            selectionCounter
          );
  const resolvedHeaderInlineControl = styleSelectionHeader || headerInlineControl
    ? (
        <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 sm:justify-start">
          {headerInlineControl}
          {styleSelectionHeader}
        </div>
      )
    : undefined;
  const trustLine =
    isPricedGridStep
      ? String((step as any)?.blueprint?.validation?.trust_line || "").trim() || "Based on real examples similar to yours"
      : "";

  return (
    <StepLayout
      step={step}
      onComplete={() => onComplete(value)}
      onBack={isStyleStep ? undefined : onBack}
      canGoBack={canGoBack}
      isLoading={isLoading}
      canContinue={canContinue}
      continueLabel={isStyleStep ? "See similar concepts" : undefined}
      headerInlineControl={resolvedHeaderInlineControl}
      actionsVariant={isStyleStep ? "default" : actionsVariant ?? (isNarrowViewport ? "sticky_mobile" : "default")}
      stickyActionsTransparent={isStyleStep}
      hideContinueAction={isPricedGridStep}
      compactInPreview={isPricedGridStep ? false : compactInPreview}
      preferWideLayout={isPricedGridStep || !compactInPreview}
      layoutDebugEnabled={layoutDebugEnabled}
    >
      <div
        className={layoutDebugClassName(
          layoutDebugEnabled,
          isPricedGridStep
            ? "flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
            : isStyleStep
              ? "relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
            : !isPricedGridStep && compactInPreview
              ? "mx-auto flex w-full max-w-none min-w-0 shrink-0 flex-col min-h-0"
              : "flex min-h-0 w-full min-w-0 flex-col"
        )}
        style={isPricedGridStep ? undefined : withLayoutDebugStyle(undefined, layoutDebugEnabled, "emerald")}
      >
        <div
          className={layoutDebugClassName(
            layoutDebugEnabled,
            isPricedGridStep
              ? "w-full min-w-0 flex min-h-0 flex-1 flex-col"
              : isStyleStep
                ? "relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden"
              : "w-full min-h-0 flex-1 flex flex-col"
          )}
          style={
            isPricedGridStep
              ? undefined
              : withLayoutDebugStyle(undefined, layoutDebugEnabled, "answerGreen")
          }
        >
          {isPricedGridStep ? (
            <div className="shrink-0 pb-2 text-center text-xs text-muted-foreground">{trustLine}</div>
          ) : null}
          <div
            data-starter-scroll-viewport={isStyleStep ? "true" : undefined}
            className={cn(
              isPricedGridStep || isStyleStep
                ? "min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain touch-pan-y"
                : null,
              isStyleStep ? "pb-20 sm:pb-20" : null,
            )}
            style={isPricedGridStep || isStyleStep ? ({ WebkitOverflowScrolling: "touch" } as React.CSSProperties) : undefined}
          >
            <ImageChoiceGrid
              value={value}
              onChange={handleValueChange}
              onSwipeComplete={(finalValue) => {
                if (isLoading) return;
                onComplete(finalValue);
              }}
              options={visibleOptions}
              multiple={multiple}
              maxSelections={maxSelections}
              variant={effectiveVariant}
              columns={effectiveColumns}
              thumbnailMode={isPricedGridStep ? false : Boolean(guidedThumbnailMode || compactInPreview)}
              compactScroller={isPricedGridStep ? false : Boolean(compactInPreview)}
              hideOptionText={isStyleStep || isPricedGridStep}
              displayMode={isPricedGridStep ? "priced_examples" : isStyleStep ? "starter_concepts" : "default"}
              sharedSelectionLayoutPrefix={isStyleStep ? "starting-idea" : undefined}
              className={!isPricedGridStep && compactInPreview ? "w-full min-h-0 shrink-0" : undefined}
            />
          </div>
          {isStyleStep ? (
            <div className="absolute inset-x-0 bottom-0 z-20 w-full border-t border-black/[0.07] bg-[var(--form-surface-color)] px-4 py-3 shadow-[0_-10px_28px_rgba(15,23,42,0.06)]">
              <input
                ref={projectPhotoInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  void handleStarterPhoto(file);
                  event.currentTarget.value = "";
                }}
              />
              <div className="mx-auto grid w-full max-w-[720px] grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={() => {
                    if (hasMoreStarterOptions) {
                      setStarterPage((page) => (page + 1) * 10 >= options.length ? 0 : page + 1);
                      return;
                    }
                    onComplete("__not_sure__");
                  }}
                  className="flex h-10 items-center justify-center rounded-full border border-black/[0.11] bg-transparent px-4 text-[12px] font-semibold text-foreground/65 transition hover:border-black/20 hover:bg-black/[0.025] hover:text-foreground sm:text-[13px]"
                >
                  None of these — show me more
                </button>
                <button
                  type="button"
                  disabled={isLoading || projectPhotoUploading || !onProjectPhotoSelected}
                  onClick={() => projectPhotoInputRef.current?.click()}
                  className="flex h-10 items-center justify-center gap-2 rounded-full border border-black/[0.11] bg-transparent px-4 text-[12px] font-semibold text-foreground/65 transition hover:border-black/20 hover:bg-black/[0.025] hover:text-foreground disabled:opacity-45 sm:text-[13px]"
                >
                  {projectPhotoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                  {projectPhotoUploading ? "Adding your photo…" : "Start with my project photo"}
                </button>
              </div>
              {projectPhotoError ? <p className="mt-1 text-center text-xs font-medium text-red-600" role="alert">{projectPhotoError}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </StepLayout>
  );
}

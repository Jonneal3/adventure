"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { hexToRgba } from "@/types/design";
import { Button } from "@/components/ui/button";
import { FormLoader } from "@/components/form/FormLoader";
import { ComponentRenderer } from "../../ComponentRenderer";
import { EaseFeedbackPrompt, ReflectionFeedbackPrompt } from "../../../../dev-helpers/UserFeedbackPrompt";
import { ArrowLeft, ArrowRight, ImagePlus } from "lucide-react";

interface FormQuestionSectionProps {
  config?: any;
  effectiveCurrentStep: any;
  flowCompleted: boolean;
  handleBack: () => void;
  handleEaseFeedback: (vote: "up" | "down") => void;
  handleReflectionFeedback: (rating: number, comment: string) => void;
  handleStepComplete: (data: any) => void;
  hideQuestionPane: boolean;
  instanceId: string;
  isBatchLoading: boolean;
  isFetchingNext: boolean;
  loadingMessageIndex: number;
  isMobileViewport: boolean;
  isRefinementUploadStep: boolean;
  leadCapturedForUI: boolean;
  leadGateLocksQuestionArea: boolean;
  loadingMessages: string[];
  adventureInputMode: "questions" | "prompt";
  setAdventureInputMode: (mode: "questions" | "prompt") => void;
  promptDraft: string;
  setPromptDraft: (value: string) => void;
  handlePromptSubmit: () => void;
  onRegeneratePreview: (uploadedUrl?: string) => void;
  previewEnabled: boolean;
  previewHasImage: boolean;
  questionContentRef: React.RefObject<HTMLDivElement>;
  questionScale: number;
  questionViewportRef: React.RefObject<HTMLDivElement>;
  refinementUploadInputRef: React.RefObject<HTMLInputElement>;
  refinementUploading: boolean;
  reflectionFeedbackSent: boolean;
  sessionId: string;
  setRefinementUploading: React.Dispatch<React.SetStateAction<boolean>>;
  showStepTransitionSkeleton: boolean;
  showAccuratePricingLoader: boolean;
  showEasePrompt: boolean;
  showQuestionPaneUnderPreview: boolean;
  state: any;
  stepForRenderer: any;
  theme: { borderRadius?: number; fontFamily?: string; textColor?: string; primaryColor?: string; secondaryColor?: string };
  usePreviewDominantLayout: boolean;
  guidedThumbnailMode: boolean;
}

export function FormQuestionSection({
  config,
  effectiveCurrentStep,
  flowCompleted,
  handleBack,
  handleEaseFeedback,
  handleReflectionFeedback,
  handleStepComplete,
  hideQuestionPane,
  instanceId,
  isBatchLoading,
  isFetchingNext,
  loadingMessageIndex,
  isMobileViewport,
  isRefinementUploadStep,
  leadCapturedForUI,
  leadGateLocksQuestionArea,
  loadingMessages,
  adventureInputMode,
  setAdventureInputMode,
  promptDraft,
  setPromptDraft,
  handlePromptSubmit,
  onRegeneratePreview,
  previewEnabled,
  previewHasImage,
  questionContentRef,
  questionScale,
  questionViewportRef,
  refinementUploadInputRef,
  refinementUploading,
  reflectionFeedbackSent,
  sessionId,
  setRefinementUploading,
  showStepTransitionSkeleton,
  showAccuratePricingLoader,
  showEasePrompt,
  showQuestionPaneUnderPreview,
  state,
  stepForRenderer,
  theme,
  usePreviewDominantLayout,
  guidedThumbnailMode,
}: FormQuestionSectionProps) {
  const showPromptControls = Boolean(previewEnabled && previewHasImage && !isRefinementUploadStep);
  const usePreviewPaneLayout = Boolean(previewEnabled && previewHasImage && usePreviewDominantLayout);
  const useBottomDockLayout = Boolean(usePreviewPaneLayout && showQuestionPaneUnderPreview && isMobileViewport);
  const useCompactNav = useBottomDockLayout;
  const promptText = promptDraft.trim();
  const canGoBack = (state?.currentStepIndex || 0) > 0;
  const primary = theme.primaryColor || "#3b82f6";
  const textMuted = theme.textColor ? hexToRgba(theme.textColor, 0.65) : undefined;
  const darkenHex = (hex: string, mixBlack: number): string => {
    const h = String(hex || "").replace("#", "").trim();
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    if (full.length !== 6) return hex;
    const r = parseInt(full.slice(0, 2), 16);
    const g = parseInt(full.slice(2, 4), 16);
    const b = parseInt(full.slice(4, 6), 16);
    if (![r, g, b].every((n) => Number.isFinite(n))) return hex;
    const f = Math.max(0, Math.min(1, 1 - mixBlack));
    return `rgb(${Math.round(r * f)}, ${Math.round(g * f)}, ${Math.round(b * f)})`;
  };
  const pillBg = darkenHex(primary, 0.5);
  const inputModeToggle = showPromptControls ? (
      <div className="inline-flex items-center gap-0.5 rounded-full border border-[color:var(--form-surface-border-color)] bg-[var(--form-surface-color)] p-0.5">
        <button
          type="button"
          onClick={() => setAdventureInputMode("questions")}
          className={cn(
            "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium transition-colors",
            adventureInputMode === "questions" ? "bg-primary/10 text-foreground" : ""
          )}
          style={
            adventureInputMode !== "questions"
              ? { color: textMuted || "var(--form-text-color)" }
              : undefined
          }
        >
          Guided
        </button>
        <button
          type="button"
          onClick={() => setAdventureInputMode("prompt")}
          className={cn(
            "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium transition-colors",
            adventureInputMode === "prompt" ? "bg-primary/10 text-foreground" : ""
          )}
          style={
            adventureInputMode !== "prompt"
              ? { color: textMuted || "var(--form-text-color)" }
              : undefined
          }
        >
          Prompt
        </button>
      </div>
  ) : undefined;

  return (
    <AnimatePresence initial={false}>
      {!hideQuestionPane ? (
        <motion.div
          ref={questionViewportRef}
          key="question-pane"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={cn(
            "relative flex w-full min-h-0 flex-col overflow-hidden",
            usePreviewPaneLayout
              ? (
                  useBottomDockLayout
                    ? "h-full shrink-0 border-t border-[color:var(--form-surface-border-color)] bg-[var(--form-surface-color)]"
                    : "h-full shrink-0"
                )
              : "flex-1"
          )}
          style={undefined}
        >
          <div
            className={cn(
              useBottomDockLayout ? "flex h-full min-h-0 flex-col overflow-hidden" : "flex h-full min-h-0 flex-col overflow-hidden",
              useBottomDockLayout ? "justify-end" : useCompactNav ? "justify-center" : null,
              usePreviewPaneLayout && !showQuestionPaneUnderPreview ? "max-h-0" : null
            )}
          >
            <div
              ref={questionContentRef}
              className={cn(
                useBottomDockLayout
                  ? "mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden"
                  : "mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden",
                usePreviewPaneLayout ? "max-w-5xl" : "max-w-6xl"
              )}
            >
              <div
                className={cn(
                  "flex min-h-0 flex-1 flex-col overflow-hidden",
                  useBottomDockLayout ? "justify-end" : useCompactNav ? "justify-center" : null,
                  usePreviewPaneLayout ? "px-4" : null
                )}
                style={
                  !usePreviewPaneLayout && questionScale < 0.999
                    ? {
                        transform: `scale(${questionScale})`,
                        transformOrigin: "top center",
                        width: `${100 / questionScale}%`,
                      }
                    : undefined
                }
              >
                <AnimatePresence mode="wait">
                  {!showAccuratePricingLoader ? (
                    leadGateLocksQuestionArea ? null : isRefinementUploadStep ? (
                      <motion.div
                        key="refinement-upload"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="w-full min-h-0 flex flex-col items-center justify-center gap-2 px-4 py-2"
                      >
                        <p
                          className="text-center text-base font-semibold"
                          style={{ color: primary, fontFamily: theme.fontFamily }}
                        >
                          Got a photo handy? Upload one for better results.
                        </p>
                        <input
                          ref={refinementUploadInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!e.target) return;
                            (e.target as HTMLInputElement).value = "";
                            if (!file) return;
                            setRefinementUploading(true);
                            try {
                              const reader = new FileReader();
                              const dataUrl = await new Promise<string>((res, rej) => {
                                reader.onload = () => res(reader.result as string);
                                reader.onerror = rej;
                                reader.readAsDataURL(file);
                              });
                              const uploadRes = await fetch("/api/upload-reference-image", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ instanceId, image: dataUrl }),
                              });
                              const uploadedRaw = uploadRes.ok ? ((await uploadRes.json().catch(() => ({}))) as any)?.url ?? dataUrl : dataUrl;
                              const uploadedUrl =
                                typeof uploadedRaw === "string" && uploadedRaw.startsWith("/") && typeof window !== "undefined"
                                  ? `${window.location.origin}${uploadedRaw}`
                                  : uploadedRaw;
                              handleStepComplete(uploadedUrl);
                              onRegeneratePreview(uploadedUrl);
                            } catch {
                              handleStepComplete(null);
                            } finally {
                              setRefinementUploading(false);
                            }
                          }}
                        />
                        <div className="flex w-full max-w-2xl flex-row flex-wrap items-center justify-center gap-3">
                          <button
                            type="button"
                            disabled={refinementUploading}
                            onClick={() => refinementUploadInputRef.current?.click()}
                            aria-busy={refinementUploading}
                            className={cn(
                              "group inline-flex min-h-[48px] flex-1 min-w-0 items-center justify-between gap-3 rounded-full border border-dashed px-4 py-2.5 pr-2 shadow-sm transition-colors sm:min-w-[320px]",
                              refinementUploading && "cursor-wait opacity-80"
                            )}
                            style={{
                              backgroundColor: hexToRgba(primary, 0.06) || "#f8fafc",
                              borderColor: primary,
                              fontFamily: theme.fontFamily,
                            }}
                          >
                            <div className="flex min-w-0 items-center gap-2.5">
                              <ImagePlus className="h-5 w-5 shrink-0" style={{ color: primary }} aria-hidden />
                              <span className="text-sm font-semibold" style={{ color: primary }}>Choose file</span>
                            </div>
                            <span
                              className="inline-flex shrink-0 items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold shadow-sm transition-colors hover:bg-primary/5"
                              style={{
                                color: primary,
                                backgroundColor: "#ffffff",
                                borderColor: hexToRgba(primary, 0.35),
                              }}
                            >
                              {refinementUploading ? "Uploading..." : "Choose file"}
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={refinementUploading}
                            onClick={() => handleStepComplete("__skip__")}
                            className="shrink-0 text-sm font-medium transition-colors hover:opacity-80"
                            style={{ fontFamily: theme.fontFamily, color: textMuted || theme.textColor }}
                          >
                            Skip for now
                          </button>
                        </div>
                      </motion.div>
                    ) : showStepTransitionSkeleton ? (
                      <motion.div
                        key="step-transition-skeleton"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.14, ease: "easeOut" }}
                        className="flex h-full min-h-0 w-full flex-col justify-center px-4 py-4 sm:px-6"
                      >
                        <div className="mx-auto flex w-full max-w-4xl flex-col gap-3">
                          <div
                            className="h-4 w-32 animate-pulse rounded-full"
                            style={{ backgroundColor: hexToRgba(primary, 0.18) }}
                          />
                          <div
                            className="h-12 w-full animate-pulse rounded-2xl"
                            style={{ backgroundColor: hexToRgba(primary, 0.14) }}
                          />
                          <div className="flex justify-end gap-2">
                            <div
                              className="h-9 w-24 animate-pulse rounded-full"
                              style={{ backgroundColor: hexToRgba(primary, 0.14) }}
                            />
                          </div>
                        </div>
                      </motion.div>
                    ) : adventureInputMode === "prompt" && showPromptControls ? (
                      <motion.div
                        key="prompt-input-mode"
                        initial={{ opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="w-full min-h-0 flex flex-col"
                      >
                        <div className="w-full max-w-[68rem] mx-auto px-2.5 py-2 sm:px-3 sm:py-2.5">
                          {inputModeToggle ? <div className="mb-2 flex justify-center">{inputModeToggle}</div> : null}
                          {useCompactNav ? (
                            <div className="flex items-center gap-3 min-w-0">
                              {canGoBack ? (
                                <Button
                                  type="button"
                                  onClick={handleBack}
                                  variant="outline"
                                  className="h-8 w-10 shrink-0 rounded-full p-0"
                                  style={{
                                    borderColor: "var(--form-surface-border-color, rgba(0,0,0,0.14))",
                                    color: theme.textColor,
                                    fontFamily: theme.fontFamily,
                                  }}
                                  aria-label="Go back"
                                >
                                  <ArrowLeft className="h-3 w-3" />
                                </Button>
                              ) : (
                                <div className="h-8 w-10 shrink-0" aria-hidden="true" />
                              )}
                              <div className="flex-1 min-w-0">
                                <div
                                  className="rounded-lg border p-2"
                                  style={{
                                    backgroundColor: "var(--form-surface-color, rgba(255,255,255,0.70))",
                                    borderColor: "var(--form-surface-border-color, rgba(0,0,0,0.10))",
                                    borderRadius: `${theme.borderRadius ?? 8}px`,
                                  }}
                                >
                                  <textarea
                                    value={promptDraft}
                                    onChange={(e) => setPromptDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        if (promptText.length >= 4) handlePromptSubmit();
                                      }
                                    }}
                                    rows={2}
                                    placeholder="Add details..."
                                    className="min-h-14 w-full resize-none rounded border-0 bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                                  />
                                </div>
                              </div>
                              <Button
                                type="button"
                                onClick={() => setAdventureInputMode("questions")}
                                className="h-8 w-10 shrink-0 rounded-full p-0"
                                style={{
                                  backgroundColor: theme.primaryColor || "var(--form-primary-color, #3b82f6)",
                                  color: "#fff",
                                  fontFamily: theme.fontFamily,
                                }}
                                aria-label="Continue to guided question"
                              >
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div
                                className="rounded-lg border p-2"
                                style={{
                                  backgroundColor: "var(--form-surface-color, rgba(255,255,255,0.70))",
                                  borderColor: "var(--form-surface-border-color, rgba(0,0,0,0.10))",
                                  borderRadius: `${theme.borderRadius ?? 8}px`,
                                }}
                              >
                                <textarea
                                  value={promptDraft}
                                  onChange={(e) => setPromptDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      if (promptText.length >= 4) handlePromptSubmit();
                                    }
                                  }}
                                  rows={3}
                                  placeholder="Add details..."
                                  className="min-h-20 w-full resize-none rounded border-0 bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                                />
                              </div>
                              <div className="flex min-w-0 justify-center gap-2 pt-2.5">
                                {canGoBack ? (
                                  <Button
                                    type="button"
                                    onClick={handleBack}
                                    variant="outline"
                                    className="h-9 min-w-[88px] px-3 text-xs font-semibold shrink-0"
                                    style={{
                                      borderColor: theme.primaryColor || "var(--form-primary-color, #3b82f6)",
                                      color: theme.primaryColor || "var(--form-primary-color, #3b82f6)",
                                      fontFamily: theme.fontFamily,
                                      borderRadius: `${theme.borderRadius ?? 12}px`,
                                    }}
                                  >
                                    Back
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  onClick={() => setAdventureInputMode("questions")}
                                  className="h-9 min-w-[96px] px-3 text-xs font-semibold shrink-0"
                                  style={{
                                    backgroundColor: theme.primaryColor || "var(--form-primary-color, #3b82f6)",
                                    color: "#fff",
                                    fontFamily: theme.fontFamily,
                                    borderRadius: `${theme.borderRadius ?? 12}px`,
                                  }}
                                >
                                  Continue
                                </Button>
                              </div>
                            </>
                          )}
                        </div>
                      </motion.div>
                    ) : (
                      <motion.div
                        key={(effectiveCurrentStep as any).id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="w-full h-full min-h-0 flex flex-col"
                      >
                        <div className="flex-1 min-h-0 overflow-hidden">
                          <ComponentRenderer
                            step={stepForRenderer}
                            stepData={state?.stepData ? state.stepData[(stepForRenderer as any).id] : undefined}
                            onComplete={handleStepComplete}
                            onBack={handleBack}
                            canGoBack={canGoBack}
                            isLoading={isFetchingNext || isBatchLoading}
                            allStepData={state?.stepData || {}}
                            allSteps={state?.steps || []}
                            instanceId={instanceId}
                            sessionId={sessionId}
                            config={config}
                            leadCaptured={leadCapturedForUI}
                            feedbackPrompt={showEasePrompt ? <EaseFeedbackPrompt visible={true} onSelect={handleEaseFeedback} /> : undefined}
                            headerInlineControl={inputModeToggle}
                            actionsVariant={useCompactNav || usePreviewPaneLayout ? "icon_only" : "default"}
                            guidedThumbnailMode={guidedThumbnailMode}
                            compactInPreview={usePreviewPaneLayout}
                          />
                        </div>
                      </motion.div>
                    )
                  ) : (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: "easeOut" }}>
                      <FormLoader
                        message="Getting you accurate pricing..."
                        subMessage={isBatchLoading ? loadingMessages[loadingMessageIndex] : undefined}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="shrink-0">
                <ReflectionFeedbackPrompt visible={flowCompleted && !reflectionFeedbackSent} onSubmit={handleReflectionFeedback} />
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

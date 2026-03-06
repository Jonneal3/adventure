"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
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
  theme: { borderRadius?: number; fontFamily?: string; textColor?: string; primaryColor?: string };
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
  const inputModeToggle = showPromptControls ? (
      <div className="inline-flex items-center gap-0.5 rounded-full border border-[color:var(--form-surface-border-color)] bg-[var(--form-surface-color)] p-0.5">
        <button
          type="button"
          onClick={() => setAdventureInputMode("questions")}
          className={cn(
            "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium transition-colors",
            adventureInputMode === "questions" ? "bg-primary/10 text-foreground" : "text-muted-foreground"
          )}
        >
          Guided
        </button>
        <button
          type="button"
          onClick={() => setAdventureInputMode("prompt")}
          className={cn(
            "inline-flex h-6 items-center rounded-full px-2.5 text-xs font-medium transition-colors",
            adventureInputMode === "prompt" ? "bg-primary/10 text-foreground" : "text-muted-foreground"
          )}
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
                usePreviewPaneLayout ? "max-w-[76rem]" : "max-w-6xl"
              )}
            >
              <div
                className={cn(
                  "flex min-h-0 flex-1 flex-col overflow-hidden",
                  useBottomDockLayout ? "justify-end" : useCompactNav ? "justify-center" : null,
                  usePreviewPaneLayout ? "px-1 sm:px-2" : null
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
                        className="w-full min-h-0 flex flex-col items-center justify-center gap-4 px-4 py-4"
                      >
                        <p className="text-[15px] font-medium text-center" style={{ fontFamily: theme.fontFamily, color: theme.textColor }}>
                          Upload a reference image for better results.
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
                        <div className="flex w-full max-w-2xl items-stretch justify-center gap-3">
                          <div className="min-w-0 flex-[1.6]">
                            <button
                              type="button"
                              disabled={refinementUploading}
                              onClick={() => refinementUploadInputRef.current?.click()}
                              aria-busy={refinementUploading}
                              className={cn(
                                "group flex h-full min-h-[56px] w-full items-center justify-between gap-4 rounded-2xl border border-dashed px-5 py-3 text-left shadow-sm transition-colors duration-200",
                                refinementUploading
                                  ? "cursor-wait opacity-80"
                                  : "hover:border-foreground/30"
                              )}
                              style={{
                                borderColor: "rgba(0,0,0,0.22)",
                                backgroundColor: "rgba(255,255,255,0.98)",
                                fontFamily: theme.fontFamily,
                                borderRadius: `${theme.borderRadius ?? 16}px`,
                              }}
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <div className="flex min-w-0 items-center gap-2.5">
                                  <ImagePlus className="h-4.5 w-4.5 shrink-0 text-muted-foreground" />
                                  <p
                                    className="truncate text-[15px] font-semibold leading-tight"
                                    style={{ color: theme.textColor }}
                                  >
                                    {refinementUploading ? "Uploading image..." : "Upload reference image"}
                                  </p>
                                </div>
                                <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">
                                  JPG, PNG, or HEIC
                                </span>
                              </div>
                              <span
                                className="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold"
                                style={{
                                  backgroundColor: theme.textColor || "rgba(17,24,39,0.92)",
                                  color: "#ffffff",
                                }}
                              >
                                {refinementUploading ? "Uploading..." : "Choose file"}
                              </span>
                            </button>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={refinementUploading}
                            onClick={() => handleStepComplete("__skip__")}
                            className="h-auto min-h-[56px] shrink-0 bg-white px-5 text-[15px] font-semibold shadow-sm"
                            style={{
                              fontFamily: theme.fontFamily,
                              borderColor: "rgba(0,0,0,0.22)",
                              color: theme.textColor,
                              borderRadius: `${theme.borderRadius ?? 12}px`,
                            }}
                          >
                            Skip
                          </Button>
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
                            style={{ backgroundColor: "rgba(148, 163, 184, 0.18)" }}
                          />
                          <div
                            className="h-12 w-full animate-pulse rounded-2xl"
                            style={{ backgroundColor: "rgba(148, 163, 184, 0.16)" }}
                          />
                          <div className="flex justify-end gap-2">
                            <div
                              className="h-9 w-24 animate-pulse rounded-full"
                              style={{ backgroundColor: "rgba(148, 163, 184, 0.16)" }}
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
                            actionsVariant={useCompactNav ? "icon_only" : "default"}
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

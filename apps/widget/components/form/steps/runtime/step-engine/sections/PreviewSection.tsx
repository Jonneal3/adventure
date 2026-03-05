"use client";

import React from "react";
import { ImagePreviewExperience } from "../../../image-preview-experience/ImagePreviewExperience";
import { cn } from "@/lib/utils";

interface PreviewSectionProps {
  adventureInputMode: "questions" | "prompt";
  completedQuestionCount: number;
  config?: any;
  hasPreviewSubsections: boolean;
  instanceId: string;
  isAdventureSurface: boolean;
  isRefinementUploadStep: boolean;
  previewMaxPx: number | null;
  previewHasImage: boolean;
  previewRefreshNonce: number;
  pendingPreviewSceneUploadUrl?: string | null;
  promptDraft: string;
  promptSubmitCount: number;
  sessionId: string;
  setPreviewHasImage: (hasImage: boolean) => void;
  setPreviewVisible: (visible: boolean) => void;
  showQuestionPaneUnderPreview: boolean;
  stateStepData?: Record<string, any>;
  useMobilePreviewLayout: boolean;
  usePreviewDominantLayout: boolean;
}

export function PreviewSection({
  adventureInputMode,
  completedQuestionCount,
  config,
  hasPreviewSubsections,
  instanceId,
  isAdventureSurface,
  isRefinementUploadStep,
  previewMaxPx,
  previewRefreshNonce,
  pendingPreviewSceneUploadUrl,
  promptDraft,
  promptSubmitCount,
  sessionId,
  setPreviewHasImage,
  setPreviewVisible,
  showQuestionPaneUnderPreview,
  stateStepData,
  useMobilePreviewLayout,
  usePreviewDominantLayout,
}: PreviewSectionProps) {
  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden",
        usePreviewDominantLayout
          ? hasPreviewSubsections
            ? "flex-1"
            : "flex-1 flex items-center justify-center"
          : "flex-1 shrink-0"
      )}
    >
      <div
        className={cn(
          "w-full mx-auto h-full",
          useMobilePreviewLayout ? "px-2 max-w-none" : isAdventureSurface ? "max-w-6xl px-4" : "max-w-4xl px-4",
          usePreviewDominantLayout ? "py-2" : null
        )}
      >
        <div className="h-full min-h-0">
          <ImagePreviewExperience
            key="image-preview"
            enabled={true}
            instanceId={instanceId}
            sessionId={sessionId}
            leadGateEnabled={true}
            transparentChrome={true}
            config={config}
            stepDataSoFar={{
              ...(stateStepData || {}),
              ...(previewRefreshNonce > 0 ? { "__previewRefreshNonce": previewRefreshNonce } : {}),
              ...(pendingPreviewSceneUploadUrl
                ? { "step-refinement-upload-scene-image": pendingPreviewSceneUploadUrl }
                : {}),
              ...(adventureInputMode === "prompt" && promptDraft.trim()
                ? {
                    "step-promptInput": promptDraft.trim(),
                    "__promptSubmitNonce": promptSubmitCount,
                  }
                : {}),
            }}
            answeredQuestionCount={
              completedQuestionCount + previewRefreshNonce + (adventureInputMode === "prompt" ? promptSubmitCount : 0)
            }
            autoRegenerateEveryNAnsweredQuestions={1}
            onPreviewVisibleChange={setPreviewVisible}
            onHasImageChange={setPreviewHasImage}
            variant="hero"
            previewMaxPx={previewMaxPx ?? undefined}
            previewMaxVh={
              usePreviewDominantLayout
                ? 80
                : useMobilePreviewLayout
                  ? 72
                  : 78
            }
            previewChromePx={8}
            suppressUploadOverlay={isRefinementUploadStep}
          />
        </div>
      </div>
    </div>
  );
}

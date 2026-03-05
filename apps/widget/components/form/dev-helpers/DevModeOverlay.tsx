"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { StepDefinition, UIStep } from "@/types/ai-form";
import { clearSession } from "@/lib/ai-form/session-manager";
import { clearStepState } from "@/lib/ai-form/state/step-state";
import { loadFormStateSnapshot, loadLeadState } from "@/lib/ai-form/state/form-state-storage";

export type DevModeStats = {
  totalSteps: number;
  currentStepIndex: number;
  completedSteps: number;
  questionStepsCount: number;
  answeredQuestionSteps: number;
  answeredKeys: number;
  satiety: number | null;
  flowProgressPercent: number | null;
};

export type DevModeUIState = {
  density?: "normal" | "compact";
  preview?: {
    hasReceivedQuestionsFromGenerateSteps: boolean;
    backendAllowsPreview: boolean;
    frontendPreviewEligible: boolean;
    previewEverEnabled: boolean;
    previewEnabled: boolean;
    previewVisible: boolean;
    completedQuestionCount: number;
    previewQuestionCount: number;
    effectiveFlowProgressFraction?: number;
    imagePreviewAtFraction?: number;
    imagePreviewAfterAnsweredQuestionsOverride?: number | null;
    imagePreviewAfterAnsweredQuestions: number;
    initialQuestionCountSnapshot: number | null;
  };
  prompts?: {
    easePromptVisible: boolean;
    reflectionPromptVisible: boolean;
  };
};

type StepMeta = {
  modelRequestId?: string | null;
  order?: number | null;
  payloadRequest?: any | null;
  payloadResponse?: any | null;
};

interface DevModeOverlayProps {
  enabled: boolean;
  sessionId: string;
  instanceId: string;
  sessionScopeKey?: string;
  step: StepDefinition | UIStep | null;
  meta?: StepMeta | null;
  stats?: DevModeStats | null;
  ui?: DevModeUIState | null;
}

function getStepType(step: StepDefinition | UIStep): string {
  const isUIStep = "type" in (step as any) && !(step as any).componentType;
  return isUIStep ? String((step as any).type || "unknown") : String((step as StepDefinition).componentType || "unknown");
}

export function DevModeOverlay({
  enabled,
  sessionId,
  instanceId,
  sessionScopeKey,
  step,
  meta,
  stats,
  ui,
}: DevModeOverlayProps) {
  const [view, setView] = useState<"icon" | "basic" | "details">("icon");
  const [formStateVersion, setFormStateVersion] = useState(0);

  const stepId = step ? String((step as any).id || "") : "";
  const stepType = useMemo(() => (step ? getStepType(step) : "unknown"), [step]);
  const scopeKey = sessionScopeKey || instanceId;

  useEffect(() => {
    if (!enabled) return;
    try {
      const raw = window.localStorage.getItem("sif_dev_mode_overlay_view");
      if (raw === "basic" || raw === "details" || raw === "icon") setView(raw);
    } catch {}
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    try {
      window.localStorage.setItem("sif_dev_mode_overlay_view", view);
    } catch {}
  }, [enabled, view]);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: Event) => {
      try {
        const detail = (e as any)?.detail;
        if (!detail || detail.sessionId !== sessionId) return;
        setFormStateVersion((v) => v + 1);
      } catch {}
    };
    window.addEventListener("sif_form_state_updated", handler as any);
    return () => window.removeEventListener("sif_form_state_updated", handler as any);
  }, [enabled, sessionId]);

  const formStateSnapshot = useMemo(() => {
    if (!enabled) return null;
    void formStateVersion;
    return loadFormStateSnapshot(sessionId);
  }, [enabled, formStateVersion, sessionId]);

  const lead = useMemo(
    () => {
      if (!enabled) return { leadCaptured: false, leadEmail: null, leadPhone: null, leadCapturedAt: null, leadGates: null };
      void formStateVersion;
      return loadLeadState(sessionId);
    },
    [enabled, formStateVersion, sessionId]
  );
  const leadCaptured = lead.leadCaptured;
  const leadEmail = lead.leadEmail;
  const leadCapturedAt = lead.leadCapturedAt;
  const leadGates = lead.leadGates;
  const leadGateKeys = useMemo(() => (leadGates ? Object.keys(leadGates) : []), [leadGates]);

  const copyText = async (text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      } catch {}
    }
  };

  const formatPercent = (value?: number | null) =>
    typeof value === "number" && Number.isFinite(value) ? `${(value * 100).toFixed(1)}%` : "n/a";
  const preview = ui?.preview ?? null;

  if (!enabled || !step) return null;

  const rootClassName =
    view === "icon"
      ? "fixed top-4 right-4 z-[60]"
      : "fixed top-4 right-4 z-[60] w-[360px] max-h-[80vh] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-4 text-xs shadow-lg";

  const questionsAnswered =
    typeof (formStateSnapshot as any)?.answeredQuestionCount === "number"
      ? Number((formStateSnapshot as any).answeredQuestionCount)
      : typeof stats?.answeredQuestionSteps === "number"
        ? stats.answeredQuestionSteps
        : null;
  const questionsTotal =
    typeof (formStateSnapshot as any)?.totalQuestionSteps === "number"
      ? Number((formStateSnapshot as any).totalQuestionSteps)
      : typeof stats?.questionStepsCount === "number"
        ? stats.questionStepsCount
        : null;
  const previewStatus = preview ? (preview.previewVisible ? "visible" : preview.previewEnabled ? "on" : "off") : "n/a";
  const flowProgress =
    typeof stats?.flowProgressPercent === "number" && Number.isFinite(stats.flowProgressPercent) ? `${stats.flowProgressPercent}%` : "n/a";

  const overlayContent = (
    <div className={rootClassName}>
      {view === "icon" ? (
        <button
          type="button"
          className={`inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700 shadow-lg hover:bg-slate-50 ${
            leadCaptured ? "ring-1 ring-emerald-200" : "ring-1 ring-rose-200"
          }`}
          onClick={() => setView("basic")}
          aria-label="Open Dev Mode"
          title="Open Dev Mode"
        >
          <span>Dev</span>
          <span className={leadCaptured ? "text-emerald-700" : "text-rose-700"}>{leadCaptured ? "✓" : "×"}</span>
        </button>
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-3 flex items-start justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 pt-4 pb-3 backdrop-blur">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-700">Dev</div>
              <div className="mt-0.5 text-[11px] text-slate-500">
                {stats ? `Step ${stats.currentStepIndex + 1}/${stats.totalSteps}` : "Step n/a"} •{" "}
                {ui?.density ? `Density: ${ui.density}` : "Density n/a"}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Quick debug panel (safe to ignore).
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  try {
                    clearStepState(instanceId);
                    clearSession(scopeKey);
                    window.location.reload();
                  } catch {}
                }}
                title="Reset local step/session state, then reload."
              >
                Reset
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => void copyText(sessionId)}
                title="Copy session_id"
              >
                Copy ID
              </button>
              <button
                type="button"
                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                onClick={() => setView("icon")}
                aria-label="Minimize Dev Mode"
                title="Minimize"
              >
                ×
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
            <div className="flex items-center justify-between gap-2">
              <div className="font-semibold">Basics</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setView(view === "details" ? "basic" : "details")}
                  title={view === "details" ? "Show fewer fields" : "Show more fields"}
                >
                  {view === "details" ? "Less" : "All"}
                </button>
              </div>
            </div>

            <div className="mt-1 grid grid-cols-[110px_1fr] gap-x-3 gap-y-1">
              <div className="text-slate-500" title="Unique ID for this user session in the flow.">session_id</div>
              <div className="break-all font-mono">{sessionId || "n/a"}</div>
              <div className="text-slate-500" title="Whether the lead gate is unlocked for this session.">lead_captured</div>
              <div className={leadCaptured ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>{leadCaptured ? "true" : "false"}</div>
              <div className="text-slate-500" title="How many questions have been answered so far.">questions</div>
              <div>{typeof questionsAnswered === "number" && typeof questionsTotal === "number" ? `${questionsAnswered}/${questionsTotal}` : "n/a"}</div>
              <div className="text-slate-500" title="Whether the early image preview module is on / visible.">preview</div>
              <div>{previewStatus}</div>
              <div className="text-slate-500" title="Overall progress through the flow (0–100%).">progress</div>
              <div>{flowProgress}</div>
              <div className="text-slate-500" title="Internal completion signal (0–100%). Higher means closer to done.">satiety</div>
              <div>{formatPercent(stats?.satiety ?? null)}</div>
              <div className="text-slate-500" title="The ID of the current step being rendered.">step_id</div>
              <div className="break-all">{stepId || "n/a"}</div>
              <div className="text-slate-500" title="The kind of step (question/gallery/designer/etc).">step_type</div>
              <div className="break-all">{stepType}</div>
            </div>
          </div>

          {view === "details" ? (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700">
                <div className="font-semibold">More (plain English)</div>
                <div className="mt-1 grid grid-cols-[140px_1fr] gap-x-3 gap-y-1">
                  <div className="text-slate-500" title="Which form config is running.">instance_id</div>
                  <div className="break-all font-mono">{instanceId || "n/a"}</div>
                  <div className="text-slate-500" title="Key used to cache session state on this device.">scope_key</div>
                  <div className="break-all font-mono">{scopeKey || "n/a"}</div>
                  <div className="text-slate-500" title="Backend request ID (only present for AI-generated steps).">model_request_id</div>
                  <div className="break-all">{meta?.modelRequestId || "n/a"}</div>
                  <div className="text-slate-500" title="Email captured so far (if any).">lead_email</div>
                  <div className="break-all">{leadEmail || "n/a"}</div>
                  <div className="text-slate-500" title="When the lead gate was completed (local timestamp).">lead_captured_at</div>
                  <div>{leadCapturedAt ? new Date(leadCapturedAt).toLocaleString() : "n/a"}</div>
                  <div className="text-slate-500" title="Which gates have been shown/completed for this session.">lead_gates</div>
                  <div className="whitespace-pre-wrap break-words">{leadGateKeys.length ? leadGateKeys.join(", ") : "n/a"}</div>
                </div>

                <div className="mt-2 text-[11px] text-slate-500">
                  Tip: hover any label to see what it means.
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );

  // Portal into body so debug overlay never participates in parent flex/layout (cannot shrink image).
  if (typeof document === "undefined") return overlayContent;
  return createPortal(overlayContent, document.body);
}

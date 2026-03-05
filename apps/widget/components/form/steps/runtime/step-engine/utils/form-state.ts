import type { FormState } from "@/types/ai-form";
import { DEFAULT_TOKEN_BUDGET_TOTAL, FORM_STATE_SCHEMA_VERSION } from "../constants";
import { normalizeOptionalString } from "./core";

export function formStateStorageKey(sessionId: string) {
  return `formState:${sessionId}`;
}

export function normalizeFormState(raw: any, sessionId: string): FormState {
  const batchIndex = Number.isFinite(raw?.batchIndex) ? Math.max(0, Number(raw.batchIndex)) : 0;
  const maxBatches = Number.isFinite(raw?.maxBatches) ? Math.max(1, Number(raw.maxBatches)) : undefined;
  const tokenBudgetTotal = Number.isFinite(raw?.tokenBudgetTotal) ? Math.max(0, Number(raw.tokenBudgetTotal)) : DEFAULT_TOKEN_BUDGET_TOTAL;
  const tokensUsedSoFar = Number.isFinite(raw?.tokensUsedSoFar) ? Math.max(0, Number(raw.tokensUsedSoFar)) : 0;
  const askedStepIds = (
    Array.isArray(raw?.askedStepIds)
      ? raw.askedStepIds.map((k: any) => String(k)).filter(Boolean)
      : Array.isArray(raw?.alreadyAskedKeys)
        ? raw.alreadyAskedKeys.map((k: any) => String(k)).filter(Boolean)
        : []
  ).filter((id: string) => id !== "step-promptInput");
  const metricProgressRaw = Number(raw?.metricProgress);
  const metricProgress = Number.isFinite(metricProgressRaw) ? Math.max(0, Math.min(1, metricProgressRaw)) : 0;
  const metricProgressCountedStepIds = Array.isArray(raw?.metricProgressCountedStepIds)
    ? raw.metricProgressCountedStepIds.map((k: any) => String(k)).filter(Boolean)
    : [];
  const totalQuestionSteps = Number.isInteger(raw?.totalQuestionSteps) && raw.totalQuestionSteps >= 0 ? raw.totalQuestionSteps : undefined;
  const answeredQuestionCount = Number.isInteger(raw?.answeredQuestionCount) && raw.answeredQuestionCount >= 0 ? raw.answeredQuestionCount : undefined;
  const serviceSummary = typeof raw?.serviceSummary === "string" ? raw.serviceSummary.trim() || null : null;
  const businessContext = typeof raw?.businessContext === "string" ? raw.businessContext.trim() || null : null;
  const userFullName = normalizeOptionalString(raw?.userFullName);
  const userFirstName = normalizeOptionalString(raw?.userFirstName);
  const leadCaptured = typeof raw?.leadCaptured === "boolean" ? raw.leadCaptured : undefined;
  const leadEmail = normalizeOptionalString(raw?.leadEmail);
  const leadCapturedAt = Number.isFinite(raw?.leadCapturedAt) ? Math.max(0, Number(raw.leadCapturedAt)) : undefined;
  const leadGatesRaw = raw?.leadGates;
  const leadGates =
    leadGatesRaw && typeof leadGatesRaw === "object" && !Array.isArray(leadGatesRaw)
      ? (Object.fromEntries(
          Object.entries(leadGatesRaw as Record<string, any>).map(([k, v]) => {
            const shownAt = Number.isFinite((v as any)?.shownAt) ? Math.max(0, Number((v as any).shownAt)) : null;
            const completedAt = Number.isFinite((v as any)?.completedAt) ? Math.max(0, Number((v as any).completedAt)) : null;
            const dismissedAt = Number.isFinite((v as any)?.dismissedAt) ? Math.max(0, Number((v as any).dismissedAt)) : null;
            return [String(k), { shownAt, completedAt, dismissedAt }];
          })
        ) as any)
      : undefined;

  return {
    formId: String(raw?.formId || sessionId),
    batchIndex,
    ...(typeof maxBatches === "number" ? { maxBatches } : {}),
    tokenBudgetTotal,
    tokensUsedSoFar,
    askedStepIds,
    metricProgress,
    metricProgressCountedStepIds,
    alreadyAskedKeys: askedStepIds,
    totalQuestionSteps,
    answeredQuestionCount,
    serviceSummary,
    businessContext,
    ...(userFullName ? { userFullName } : {}),
    ...(userFirstName ? { userFirstName } : {}),
    ...(typeof leadCaptured === "boolean" ? { leadCaptured } : {}),
    ...(leadEmail ? { leadEmail } : {}),
    ...(typeof leadCapturedAt === "number" ? { leadCapturedAt } : {}),
    ...(leadGates ? { leadGates } : {}),
    schemaVersion: typeof raw?.schemaVersion === "string" ? raw.schemaVersion : FORM_STATE_SCHEMA_VERSION,
  };
}

export function toPersistedFormState(state: FormState): Omit<FormState, "maxBatches"> {
  const next = { ...(state as any) };
  delete next.maxBatches;
  return next;
}

export function loadFormState(sessionId: string): FormState | null {
  try {
    const raw = window.localStorage.getItem(formStateStorageKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return normalizeFormState(parsed, sessionId);
  } catch {
    return null;
  }
}

export function saveFormState(sessionId: string, state: FormState) {
  try {
    window.localStorage.setItem(formStateStorageKey(sessionId), JSON.stringify(toPersistedFormState(state)));
    try {
      const dispatch = () => {
        window.dispatchEvent(new CustomEvent("sif_form_state_updated", { detail: { sessionId } }));
      };
      if (typeof queueMicrotask === "function") queueMicrotask(dispatch);
      else setTimeout(dispatch, 0);
    } catch {}
  } catch {}
}

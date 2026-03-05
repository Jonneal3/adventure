export type FunctionCallHint = {
  name?: string | null;
  endpoint?: string | null;
  args?: unknown;
  triggerAfterStepKeys?: string[];
  [key: string]: unknown;
};

export type FunctionCallOutput = {
  status: "idle" | "running" | "complete" | "error";
  functionCall?: FunctionCallHint | null;
  triggerSatisfiedCount?: number | null;
  triggerTotalCount?: number | null;
  triggerMinCount?: number | null;
  startedAt?: number | null;
  completedAt?: number | null;
  error?: string | null;
  result?: unknown;
};

export function getFunctionCallOutputs(stepData: Record<string, any> | null | undefined): Record<string, FunctionCallOutput> {
  const raw = (stepData as any)?.__functionCallOutputs;
  if (!raw || typeof raw !== "object") return {};
  return raw as Record<string, FunctionCallOutput>;
}

export function isFunctionCallStep(step: any): boolean {
  return Boolean(step && typeof step === "object" && (step as any).functionCall);
}

export function extractCompositeBlockCalls(step: any): Array<{ callKey: string; functionCall: FunctionCallHint }> {
  if (!step || typeof step !== "object") return [];
  const type = String((step as any)?.type || "");
  if (type !== "composite") return [];
  const stepId = String((step as any)?.id || "");
  if (!stepId) return [];
  const blocks = Array.isArray((step as any)?.blocks) ? (step as any).blocks : [];
  const out: Array<{ callKey: string; functionCall: FunctionCallHint }> = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    if (!b || typeof b !== "object") continue;
    const fc = (b as any)?.functionCall;
    if (!fc || typeof fc !== "object") continue;
    const blockId = String((b as any)?.id || `block-${i}`);
    out.push({ callKey: `${stepId}:${blockId}`, functionCall: fc as FunctionCallHint });
  }
  return out;
}

export function resolveTriggerKeyCandidates(key: string): string[] {
  const k = String(key || "").trim();
  if (!k) return [];
  const dashed = k.replace(/_/g, "-");
  const prefixed = k.startsWith("step-") ? k : `step-${dashed}`;
  const altPrefixed = k.startsWith("step-") ? k : `step-${k}`;
  return Array.from(new Set([k, prefixed, altPrefixed]));
}

export function getTriggerProgress(stepData: Record<string, any>, triggerAfterStepKeys: string[]) {
  const keys = Array.isArray(triggerAfterStepKeys) ? triggerAfterStepKeys : [];
  const total = keys.length;
  let satisfied = 0;
  for (const raw of keys) {
    const candidates = resolveTriggerKeyCandidates(raw);
    if (candidates.some((k) => stepData[k] !== undefined)) satisfied += 1;
  }
  return { satisfied, total };
}

export function getMinTriggerCount(functionCall: FunctionCallHint | null | undefined, triggerAfterStepKeys: string[]) {
  const raw = Number((functionCall as any)?.minTriggerCount);
  if (Number.isFinite(raw)) {
    return Math.max(0, Math.min(triggerAfterStepKeys.length, Math.floor(raw)));
  }
  return triggerAfterStepKeys.length;
}

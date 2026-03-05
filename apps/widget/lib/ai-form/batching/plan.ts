const DEFAULT_BATCH_PLAN = ["batch-0", "batch-1"];
const BATCH_PLAN_PARAM_KEYS = ["batch_ids", "batchIds", "batch-plan", "batchPlan"];

function normalizeStringList(raw?: any): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item !== null && item !== undefined)
    .map((item) => (typeof item === "string" ? item.trim() : String(item)))
    .filter(Boolean);
}

function parseBatchPlanParam(raw?: string): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function batchIdFallback(index: number): string {
  if (typeof index === "number" && index >= 0) return `batch-${index}`;
  return "batch-0";
}

export function normalizeBatchPlan(raw?: any, fallbackPlan: string[] = DEFAULT_BATCH_PLAN): string[] {
  const cleaned = normalizeStringList(raw);
  if (cleaned.length === 0) return fallbackPlan;
  return cleaned;
}

export function parseBatchPlanFromSearch(search?: string): string[] {
  if (!search) return [];
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  for (const key of BATCH_PLAN_PARAM_KEYS) {
    const value = params.get(key);
    if (value) {
      return parseBatchPlanParam(value);
    }
  }
  return [];
}

export function resolveBatchPlanFromEnv(fallbackPlan: string[] = DEFAULT_BATCH_PLAN): string[] {
  const envValue = process.env.NEXT_PUBLIC_AI_FORM_BATCH_IDS || process.env.AI_FORM_BATCH_IDS;
  const parsed = parseBatchPlanParam(envValue ?? "");
  return parsed.length > 0 ? parsed : fallbackPlan;
}

export function getBatchMetadata(index: number, plan: string[] = DEFAULT_BATCH_PLAN) {
  const normalizedPlan = plan.length > 0 ? plan : DEFAULT_BATCH_PLAN;
  const candidate = normalizedPlan[index];
  return {
    batchId: candidate || batchIdFallback(index),
    batchNumber: index + 1,
    plan: normalizedPlan,
  };
}

export function pickBatchId(index: number, plan: string[] = DEFAULT_BATCH_PLAN) {
  return getBatchMetadata(index, plan).batchId;
}

export { DEFAULT_BATCH_PLAN };

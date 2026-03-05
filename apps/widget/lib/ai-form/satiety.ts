import type { FormPlanItem } from "@/types/ai-form";

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function isNonEmpty(v: any) {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

/**
 * Normalize importance weights so total = 1.0 (and 100% satiety is reachable).
 * This is intentionally dumb + deterministic.
 */
export function normalizePlanWeights(formPlan: FormPlanItem[]): FormPlanItem[] {
  const items = Array.isArray(formPlan) ? formPlan : [];
  if (items.length === 0) return [];

  const clamped = items.map((it) => ({
    ...it,
    importance_weight: clamp01(Number((it as any)?.importance_weight ?? 0)),
  }));

  const sum = clamped.reduce((acc, it) => acc + (it.importance_weight || 0), 0);
  if (sum <= 0) {
    const w = 1 / clamped.length;
    return clamped.map((it) => ({ ...it, importance_weight: w }));
  }

  return clamped.map((it) => ({ ...it, importance_weight: (it.importance_weight || 0) / sum }));
}

export type SatietyResult = {
  satiety: number; // 0..1
  ready: boolean; // satiety >= 1 AND no missing plan items
  answeredKeys: string[];
  missingKeysSorted: string[]; // highest-weight missing first
  missingItemsSorted: FormPlanItem[]; // same ordering as missingKeysSorted
};

/**
 * Single source of truth:
 * satiety = answered plan items / total plan items, clamped [0,1]
 *
 * This is what you use for:
 * - top-right HUD (glass fill)
 * - whether to queue Batch2 (based on predicted batch1 sum, not answers)
 * - what to ask next (highest-weight missing)
 */
export function computeSatietyFromStepData(
  stepDataSoFar: Record<string, any>,
  formPlan: FormPlanItem[]
): SatietyResult {
  const sd = stepDataSoFar || {};
  const plan = normalizePlanWeights(formPlan);

  const answeredKeys: string[] = [];
  const missing: Array<{ item: FormPlanItem; w: number }> = [];

  for (const item of plan) {
    const key = String((item as any)?.key || "");
    if (!key) continue;

    // Be permissive in what we accept (legacy step ids vs new ids)
    const possibleStepIds = [`step-${key}`, key, `step-${key.replace(/_/g, "-")}`];
    const answered = possibleStepIds.some((id) => isNonEmpty(sd[id]));
    if (answered) {
      answeredKeys.push(key);
    } else {
      missing.push({ item, w: item.importance_weight || 0 });
    }
  }

  // Sort missing by weight desc
  missing.sort((a, b) => (b.w || 0) - (a.w || 0));

  const missingItemsSorted = missing.map((m) => m.item);
  const missingKeysSorted = missingItemsSorted.map((it) => String((it as any)?.key || "")).filter(Boolean);

  const totalCount = plan.length;
  const rawSatiety = totalCount > 0 ? answeredKeys.length / totalCount : 0;
  const satiety = clamp01(rawSatiety);
  const ready = missingItemsSorted.length === 0 && satiety >= 1;

  return { satiety, ready, answeredKeys, missingKeysSorted, missingItemsSorted };
}


/**
 * Thin client for Adventure V7 → api-service adventure_pipeline.
 * Falls back to null on failure so the experience can keep using local mocks.
 */

import type { V7BudgetSource, V7PhotoAnalysis, V7ProjectState, V7StartPath } from "./types";

export type V7DesignPayload = {
  instanceId: string;
  /** Nested ProjectState (preferred). */
  project?: V7ProjectState;
  serviceId?: string | null;
  serviceLabel?: string | null;
  customerServiceLabel?: string | null;
  /** Grounding for the pricing engine and prompt builder (business configuration, not AI). */
  industry?: string | null;
  serviceSummary?: string | null;
  visualEligible?: boolean;
  /** Joined scope string (legacy). */
  scope?: string | null;
  /** Structured multi-scope. */
  scopes?: string[];
  scopeKeys?: string[];
  scopeOther?: string | null;
  otherScope?: string | null;
  budget?: number;
  budgetBandId?: string | null;
  budgetSource?: V7BudgetSource;
  budgetConfidence?: number;
  startPath?: V7StartPath | string | null;
  start?: {
    path?: V7StartPath | null;
    photo?: { url: string; analysis?: V7PhotoAnalysis | null } | null;
  };
  photoUrl?: string | null;
  photoAnalysis?: V7PhotoAnalysis | null;
  favoriteUrls?: string[];
  taste?: {
    tags?: Array<{
      id: string;
      label: string;
      attributePath?: string;
      imageUrl?: string;
      focalX?: number;
      focalY?: number;
      selected?: boolean;
    }>;
    confirmedIds?: string[];
    source?: string;
  };
  selectedIdeaUrl?: string | null;
  selection?: {
    inspirationIds?: string[];
    ideaId?: string | null;
    ideaUrl?: string | null;
    history?: string[];
  };
  refineNote?: string | null;
  priceImpact?: number;
  lead?: {
    email?: string | null;
    phone?: string | null;
    intent?: string | null;
  };
};

export type AdventureAction =
  | "taste"
  | "inspiration"
  | "ideas"
  | "refine"
  | "final"
  | "estimate"
  | "consult"
  | "interpret"
  | "spec"
  | "budget_bands"
  | "taxonomy"
  | "analyze_photo"
  | "handoff"
  | "library"
  | "suggest_scopes"
  | "scope_covers"
  | "contracts";

export type LibraryImageCandidate = {
  url: string;
  label?: string;
  description?: string | null;
  priceTier?: string | null;
  featuredRank?: number | null;
  imageId?: string | null;
  timesShown?: number;
  timesSelected?: number;
  timesSaved?: number;
  conversions?: number;
  qualityScore?: number;
  tags?: string[];
  scope?: string | null;
  scopeKey?: string | null;
  generatedFor?: string | null;
  performanceCue?: string | null;
  cue?: string | null;
};

export async function callAdventurePipeline(
  action: AdventureAction,
  design: V7DesignPayload,
  extra?: Record<string, unknown>
): Promise<Record<string, any> | null> {
  const instanceId = String(design.instanceId || "").trim();
  if (!instanceId) return null;
  try {
    const res = await fetch(
      `/api/adventure/v7/${encodeURIComponent(instanceId)}/${encodeURIComponent(action)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design,
          instruction: extra?.instruction,
          numOutputs: extra?.numOutputs,
          ...extra,
        }),
        cache: "no-store",
      }
    );
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return null;
    return data;
  } catch {
    return null;
  }
}

/** Fire shown/selected counters and optionally write a winning generation into the library. */
export async function curateAdventureImages(
  instanceId: string,
  payload: {
    events?: Array<{ type: string; url: string; source?: string; mode?: string }>;
    candidates?: Array<Record<string, unknown>>;
    writeBack?: boolean;
    preferences?: Record<string, unknown>;
    project?: Record<string, unknown>;
    sessionId?: string;
  }
): Promise<void> {
  const id = String(instanceId || "").trim();
  if (!id) return;
  try {
    await fetch(`/api/adventure/v7/${encodeURIComponent(id)}/curate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    // Curation is best-effort.
  }
}

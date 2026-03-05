import type { ComponentType } from "@/types/ai-form";
import { buildGlossaryText } from "./glossary";

export type AnchorPriority = "must" | "nice";

export type GroundingAnchor = {
  key: string;
  priority: AnchorPriority;
  label: string;
  examples?: string[];
};

export type ServiceGrounding = {
  version: number;
  service: {
    categoryName: string | null;
    subcategoryName: string | null;
    subcategoryId?: string | null;
  };
  anchors: GroundingAnchor[];
  anchorPriorities: {
    mustAsk: string[];
    niceToAsk: string[];
  };
  preferredComponents: ComponentType[];
  exampleQuestions: string[];
  glossaryText: string;
  stateHints: {
    answeredKeys: string[];
    answeredSummary: string;
  };
};

const cache = new Map<string, { ts: number; value: ServiceGrounding }>();
const TTL_MS = 3 * 60_000;

function norm(s: any) {
  return String(s || "").trim();
}

function normLower(s: any) {
  return norm(s).toLowerCase();
}

function cacheKey(p: {
  categoryName?: string | null;
  subcategoryName?: string | null;
  subcategoryId?: string | null;
  trafficSource?: string | null;
  industry?: string | null;
}) {
  return [
    normLower(p.categoryName),
    normLower(p.subcategoryName),
    normLower(p.subcategoryId),
    normLower(p.industry),
    normLower(p.trafficSource),
  ].join("|");
}

function buildAnchors(params: { categoryName?: string | null; subcategoryName?: string | null }): GroundingAnchor[] {
  // Return empty anchors - DSPy will generate all questions dynamically
  return [];
}

function buildPreferredComponents(params: { categoryName?: string | null; subcategoryName?: string | null }): ComponentType[] {
  // Visual-first bias for all services. The UI must still enforce supported types.
  return ["segmented_choice", "image_choice_grid", "chips_multi", "yes_no", "choice", "slider"];
}

function buildExampleQuestions(params: { categoryName?: string | null; subcategoryName?: string | null }): string[] {
  // Return empty - DSPy will generate all questions dynamically
  return [];
}

function buildStateHints(stepDataSoFar?: Record<string, any>) {
  const data = stepDataSoFar && typeof stepDataSoFar === "object" ? stepDataSoFar : {};
  const keys = Object.keys(data).filter((k) => !k.startsWith("__")).slice(0, 80);
  // Minimal summary: key names only (avoid leaking PII like emails/phones).
  const answeredKeys = keys.filter((k) => data[k] !== null && data[k] !== undefined && !(typeof data[k] === "string" && data[k].trim() === ""));
  const answeredSummary = answeredKeys.length ? `Already answered: ${answeredKeys.slice(0, 20).join(", ")}` : "No prior answers.";
  return { answeredKeys, answeredSummary };
}

export function getServiceGrounding(params: {
  categoryName?: string | null;
  subcategoryName?: string | null;
  subcategoryId?: string | null;
  industry?: string | null;
  trafficSource?: string | null;
  businessContext?: string | null;
  stepDataSoFar?: Record<string, any> | null;
}): ServiceGrounding {
  const key = cacheKey({
    categoryName: params.categoryName,
    subcategoryName: params.subcategoryName,
    subcategoryId: params.subcategoryId,
    industry: params.industry,
    trafficSource: params.trafficSource,
  });
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && now - cached.ts < TTL_MS) return cached.value;

  const categoryName = params.categoryName ?? null;
  const subcategoryName = params.subcategoryName ?? null;

  const anchors = buildAnchors({ categoryName, subcategoryName });
  const anchorPriorities = {
    mustAsk: anchors.filter((a) => a.priority === "must").map((a) => a.key),
    niceToAsk: anchors.filter((a) => a.priority === "nice").map((a) => a.key),
  };

  const preferredComponents = buildPreferredComponents({ categoryName, subcategoryName });
  const exampleQuestions = buildExampleQuestions({ categoryName, subcategoryName });
  const glossary = buildGlossaryText({ subcategoryName, categoryName });
  const stateHints = buildStateHints(params.stepDataSoFar || undefined);

  const grounding: ServiceGrounding = {
    version: 1,
    service: { categoryName, subcategoryName, subcategoryId: params.subcategoryId ?? null },
    anchors,
    anchorPriorities,
    preferredComponents,
    exampleQuestions,
    glossaryText: glossary.text,
    stateHints,
  };

  cache.set(key, { ts: now, value: grounding });
  return grounding;
}



import type { CanvasHistoryEntry, ServiceOption, StableAsset } from "../v2/types";

export type VisualPricingStage =
  | "loading"
  | "intro"
  | "project"
  | "scope"
  | "budget"
  | "gallery"
  | "details"
  | "customize"
  | "personalize"
  | "personalized-preview"
  | "personalized-result";

export type BudgetBandId =
  | "under-15"
  | "15-25"
  | "25-40"
  | "40-60"
  | "60-plus"
  | "not-sure";

export type BudgetBand = {
  id: BudgetBandId;
  label: string;
  galleryLabel: string;
  min: number | null;
  max: number | null;
};

export type RawVisualProject = {
  assetId: string;
  imageUrl: string;
  storagePath: string;
  label: string;
  scope: string;
  /** Optional catalog tier from asset metadata ($ / $$ / premium / luxury, etc.). */
  priceTier?: string | null;
  modelId?: string | null;
  createdAt: number;
};

export type VisualPricingProject = RawVisualProject & {
  title: string;
  serviceLabel: string;
  priceMin: number;
  priceMax: number;
  currency: string;
  fitLabel: string;
  layoutSummary: string;
  inclusions: string[];
  assumptions: string[];
  priceIncreases: string[];
  compromises: string[];
};

export type VisualPricingLead = {
  emailCaptured: boolean;
  /** Soft unlock: show a partial planning range without capturing email yet. */
  previewUnlocked?: boolean;
  submissionId?: string | null;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  emailStatus?: "idle" | "sending" | "sent" | "failed";
  phoneStatus?: "idle" | "saving" | "unlocked" | "failed";
  consultationStatus?: "idle" | "requesting" | "requested" | "failed";
};

export type VisualPricingEstimateConfig = {
  finishLevel: "value" | "selected" | "premium";
  scopeLevel: "focused" | "complete";
  layoutPlan: "keep" | "rework";
  sourcing: "standard" | "custom";
};

export type PersonalizedRefinementRecord = {
  id: string;
  label: string;
  instruction: string;
  priceImpact: number;
  resultingRange?: { totalMin: number; totalMax: number; currency: string } | null;
  createdAt: number;
};

export type VisualPricingSnapshot = {
  version: 3;
  experiment: "visual_pricing_two_stage";
  sessionId: string;
  stage: VisualPricingStage;
  selectedServiceId: string | null;
  selectedScope: string | null;
  budgetBandId: BudgetBandId | null;
  projects: VisualPricingProject[];
  selectedProjectId: string | null;
  favoriteProjectIds: string[];
  lead: VisualPricingLead;
  estimateConfig: VisualPricingEstimateConfig;
  refinementPrompt: string;
  refinementSuggestions: string[];
  refinementPriceImpact: number;
  projectRefinementHistory: CanvasHistoryEntry[];
  projectActiveRefinementIndex: number;
  sourceAsset: StableAsset | null;
  keepLayout: boolean;
  featuresToKeep: string[];
  personalizedConcepts: CanvasHistoryEntry[];
  personalizedBaseRange: { totalMin: number; totalMax: number; currency: string } | null;
  personalizedRange: { totalMin: number; totalMax: number; currency: string } | null;
  personalizedRefinements: PersonalizedRefinementRecord[];
  personalizedRefinementChoiceId: string | null;
  personalizedRefinementPrompt: string;
  personalizedActiveConceptIndex: number;
  updatedAt: number;
};

export type VisualPricingContext = {
  service: ServiceOption;
  project: VisualPricingProject;
  budgetMidpoint: number;
};

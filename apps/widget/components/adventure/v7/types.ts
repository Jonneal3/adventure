export type V7Stage =
  | "loading"
  | "service"
  | "project"
  | "budget"
  | "path"
  | "inspiration"
  | "review"
  | "likes" // alias of review (compat)
  | "exploration"
  | "refine"
  | "email_gate"
  | "final"
  | "consultation"
  | "connect"
  | "done";

export type V7StartPath = "inspiration" | "photo";

export type V7GateExperiment = "a" | "b";

export type V7TradeoffId = "match" | "affordable" | "elevated";

export type V7GeneratedImage = {
  id: string;
  url: string;
  label: string;
  /**
   * Subtle local/market intelligence cue (not a person testimonial).
   * Prefer performance / price metadata over synthetic “Popular nearby”.
   */
  cue?: string | null;
  /** Where the tile came from — makes retrieve-vs-generate visible. */
  source?: "library" | "generated" | "fallback";
  /** Catalog style / variant label when distinct from scope. */
  styleLabel?: string | null;
  priceTier?: string | null;
  /** From adventure_stats (e.g. Often saved, Popular pick). */
  performanceCue?: string | null;
  scopeKey?: string | null;
};

/** Visual taste tag inferred from the visitor's favorite inspirations. */
export type V7TasteTag = {
  id: string;
  label: string;
  /** Crop / thumb from one of the selected inspiration images. */
  imageUrl: string;
  /** object-position hints so crops feel like different detections. */
  focalX: number;
  focalY: number;
  /** Ontology attribute path when provided by adventure_pipeline. */
  attributePath?: string;
};

/** A concrete change the pricing engine says moves the number, with its dollar effect. */
export type V7PriceLever = {
  label: string;
  /** Phrase handed to the design pipeline when the visitor applies it. */
  delta: string;
  amount: number;
};

/** Live estimate from the pricing engine (never model-invented). */
export type V7Estimate = {
  min: number;
  max: number;
  source: string;
  savingsLevers: V7PriceLever[];
  upgradeLevers: V7PriceLever[];
};

export type V7FinalOption = {
  id: V7TradeoffId;
  url: string;
  label: string;
  subtitle: string;
  priceMin: number;
  priceMax: number;
};

/** Structured scope item — project schema foundation. */
export type V7ScopeItem = {
  key: string;
  label: string;
  source?: "business" | "ai" | "customer" | "stored";
};

export type V7BudgetSource = "ai" | "business" | "customer" | "learned";

export type V7PhotoAnalysis = {
  materials?: string[];
  condition?: string;
  constraints?: string[];
  notes?: string;
};

export type V7BudgetBand = {
  id: string;
  label: string;
  min: number;
  max: number;
  source?: string;
};

export type V7BudgetBounds = {
  min: number;
  max: number;
  step: number;
  defaultAmount?: number;
  bands?: V7BudgetBand[];
  source?: string;
  confidence?: number;
  scopeMultiplier?: number;
};

/**
 * Canonical ProjectState mirror (api-service schemas.ProjectState).
 * Widget V7State remains the UI bag; designPayload serializes into this shape.
 */
export type V7ProjectState = {
  instanceId: string;
  service: {
    id: string;
    businessLabel: string;
    customerLabel: string;
    industry?: string;
    summary?: string;
    visualEligible?: boolean;
  };
  scope: {
    items: V7ScopeItem[];
    otherText?: string;
    mode?: "single" | "multi";
  };
  budget: {
    amount: number;
    bandId?: string | null;
    currency?: string;
    source?: V7BudgetSource;
    confidence?: number;
  };
  start: {
    path?: V7StartPath | null;
    photo?: { url: string; analysis?: V7PhotoAnalysis | null } | null;
  };
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
  selection?: {
    inspirationIds?: string[];
    ideaId?: string | null;
    ideaUrl?: string | null;
    history?: string[];
  };
  estimate?: V7Estimate | null;
  lead?: {
    email?: string | null;
    phone?: string | null;
    intent?: string | null;
  };
  refineNote?: string | null;
  priceImpact?: number;
};

export type V7State = {
  stage: V7Stage;
  serviceId: string | null;
  /** Multi-select scope labels (project schema). */
  scopes: string[];
  otherScope: string;
  budget: number;
  budgetBandId: string | null;
  budgetSource: V7BudgetSource;
  /** Live bounds from service+scope (pipeline); null until fetched. */
  budgetBounds: V7BudgetBounds | null;
  startPath: V7StartPath | null;
  photoDataUrl: string | null;
  photoAnalysis: V7PhotoAnalysis | null;
  inspiration: V7GeneratedImage[];
  favorites: string[];
  /** AI-inferred visual tags from favorites (single taste-summary step). */
  tasteTags: V7TasteTag[];
  /** Tag ids the visitor confirmed. */
  selectedTasteTagIds: string[];
  explorations: V7GeneratedImage[];
  explorationPicks: string[];
  /** How many more idea-grid regenerations the visitor can request. */
  explorationRegenRemaining: number;
  /** Focused idea in exploration — click an image to open refine beside it. */
  explorationFocusId: string | null;
  refineNote: string | null;
  /** Generation stack for the focused idea (oldest → newest). */
  workspaceHistory: string[];
  workspaceHistoryIndex: number;
  /** Cumulative design/cost tilt from Adjust actions. */
  priceImpact: number;
  /** Pricing-engine estimate for the focused design, when the service is reachable. */
  estimate: V7Estimate | null;
  email: string;
  emailCaptured: boolean;
  emailFormOpen: boolean;
  finalOptions: V7FinalOption[];
  selectedFinalId: V7TradeoffId | null;
  phone: string;
  phoneCaptured: boolean;
  connectIntent: string | null;
  /** Full handoff package returned at connect. */
  handoff: Record<string, unknown> | null;
  chatInput: string;
  chatLog: Array<{ role: "user" | "ai"; text: string }>;
  generating: boolean;
  generatingLabel: string;
  gate: V7GateExperiment;
  pricingUnlocked: boolean;
};

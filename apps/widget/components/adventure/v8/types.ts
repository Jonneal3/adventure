export type V8Stage =
  | "loading"
  | "service"
  | "project"
  | "budget"
  | "visual"
  | "price"
  | "connect"
  | "done";

export type V8RailQuestion = "refine";

export type V8LookChip = {
  label: string;
  kind: "proof" | "price" | "scope" | "source";
};

export type V8VisualDirection = {
  label: string;
  prompt: string;
  family?: string;
  palette?: string;
  surfaces?: string;
  fixtures?: string;
  style?: string;
};

export type V8FinishTierId = "starter" | "value" | "mid" | "upper" | "plus" | "premium" | "luxury" | "estate";

export type V8FinishTier = {
  id: V8FinishTierId;
  label: string;
  min: number;
  max: number;
  openEnded?: boolean;
  catalogTier?: "value" | "mid" | "premium" | "luxury";
};

export type V8GeneratedImage = {
  id: string;
  url: string;
  label: string;
  source?: "library" | "generated" | "fallback";
  cue?: string | null;
  styleLabel?: string | null;
  priceTier?: string | null;
  finishTier?: V8FinishTierId | null;
  primaryScope?: string | null;
  scopeLabel?: string | null;
  tags?: string[];
  chips?: V8LookChip[];
  timesShown?: number;
  timesSelected?: number;
  timesSaved?: number;
  conversions?: number;
  local?: boolean;
  direction?: V8VisualDirection | null;
  modelId?: string | null;
  pinAspect?: string;
  generatedFor?: string | null;
  estimate?: V8Estimate | null;
  budget?: number | null;
};

export type V8Estimate = {
  min: number;
  max: number;
  source: string;
};

export type V8BudgetBounds = {
  min: number;
  max: number;
  step: number;
  defaultAmount?: number;
  source?: string;
  confidence?: number;
  finishTiers?: V8FinishTier[];
};

export type V8IntakeChoice = {
  id: string;
  label: string;
  serviceId?: string | null;
  hint?: string | null;
  role?: "full" | "part" | "other";
};

export type V8IntakeQuestion = {
  step: "service" | "scope";
  skip: boolean;
  selectedServiceId?: string | null;
  question: string;
  subtitle?: string | null;
  selectionType: "single" | "multiple";
  choices: V8IntakeChoice[];
  allowOther?: boolean;
  source?: string;
};

export type V8ProjectSnapshot = {
  instanceId: string;
  service: {
    id: string;
    businessLabel: string;
    customerLabel: string;
    industry?: string;
    summary?: string;
  };
  scope: string;
  otherText?: string;
  budget: number;
  photoUrl: string | null;
  styleUrls: string[];
  designUrl: string | null;
  estimate: V8Estimate | null;
};

export type V8State = {
  stage: V8Stage;
  serviceId: string | null;
  serviceSkipped: boolean;
  scopes: string[];
  otherScope: string;
  budget: number;
  budgetBounds: V8BudgetBounds | null;
  finishTierId: V8FinishTierId | null;
  galleryHasMore: boolean;
  galleryOffset: number;
  photoUrl: string | null;
  photoSkipped: boolean;
  looks: V8GeneratedImage[];
  favorites: string[];
  layoutId: string | null;
  styleId: string | null;
  moodId: string | null;
  railQuestion: V8RailQuestion;
  inspirationRound: number;
  discoveryModelId: string | null;
  selectedDesignId: string | null;
  refineRemaining: number;
  changeNote: string;
  estimate: V8Estimate | null;
  email: string;
  emailCaptured: boolean;
  phone: string;
  phoneCaptured: boolean;
  connectIntent: string | null;
  generating: boolean;
  generatingLabel: string;
  sessionId: string;
  submissionId: string | null;
};

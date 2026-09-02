import type {
  GalleryPricingBreakdownItem,
  GalleryPricingConfidence,
  PriceableGalleryManifest,
} from "./galleryEnrichment";

export type V8Stage =
  | "loading"
  | "service"
  | "project"
  | "budget"
  | "path"
  | "style"
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

export type V8ProjectManifestComponent = {
  key: string;
  label: string;
  confidence: number;
  quantity?: number;
};

export type V8ProjectManifest = {
  version: 1;
  analysisStatus: "verified" | "pending" | "rejected";
  sceneType: "full-project" | "component";
  description?: string | null;
  primaryScope?: string | null;
  components: V8ProjectManifestComponent[];
  model?: string | null;
  analyzedAt?: string | null;
};

export type V8GeneratedImage = {
  id: string;
  url: string;
  beforeUrl?: string | null;
  label: string;
  source?: "library" | "generated" | "fallback" | "uploaded";
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
  timesShared?: number;
  conversions?: number;
  businessUsageCount?: number;
  localShown?: number;
  localSelections?: number;
  localSaves?: number;
  localShares?: number;
  localConversions?: number;
  local?: boolean;
  catalogSource?: "instance" | "business" | "platform" | "generated" | "fallback";
  worthKeeping?: boolean;
  reusableStatus?: "candidate" | "reusable" | string;
  direction?: V8VisualDirection | null;
  modelId?: string | null;
  pinAspect?: string;
  generatedFor?: string | null;
  estimate?: V8Estimate | null;
  budget?: number | null;
  changeSummary?: string | null;
  includedItems?: string[];
  projectManifest?: V8ProjectManifest | null;
  priceableManifest?: PriceableGalleryManifest | null;
  verificationConfidence?: number | null;
  pricingConfidence?: GalleryPricingConfidence | null;
  pricingLabel?: string | null;
  pricingBreakdown?: GalleryPricingBreakdownItem[];
  pricingAssumptions?: string[];
  beforeDisclosure?: "ai_generated_illustrative_before" | null;
  focusRegions?: Record<string, { x: number; y: number; width: number; height: number }>;
  focusOutlines?: Record<string, Array<{ x: number; y: number }>>;
};

export type V8Estimate = {
  min: number;
  max: number;
  source: string;
};

export type V8RefinementOption = {
  id: string;
  label: string;
  prompt: string;
  imagePrompt?: string;
  imageUrl: string;
  fallbackImageUrl?: string;
  budgetDelta: number;
  target?: string | null;
  searchTerms?: string[];
};

export type V8RefinementCategory = {
  id: string;
  label: string;
  description: string;
  options: V8RefinementOption[];
};

export type V8RefinementCatalog = {
  source: "vision" | "service" | "fallback";
  diagnosis: string;
  categories: V8RefinementCategory[];
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
  pricingParts?: string[];
  experiencePath?: "photo" | "pricing";
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
  selectedDesignId: string | null;
  activeRevisionIndex: number;
  refineRemaining: number;
  changeNote: string;
  pendingBudgetDelta: number;
  estimate: V8Estimate | null;
  teaserEstimate: V8Estimate | null;
  photoPathChosen: boolean | null;
  pricingParts: string[];
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

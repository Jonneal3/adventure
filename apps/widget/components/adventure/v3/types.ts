import type {
  CanvasHistoryEntry,
  ExperienceMode,
  ServiceOption,
  StableAsset,
  StarterCanvas,
  V2Pricing,
} from "../v2/types";

export type V3Stage =
  | "loading"
  | "project"
  | "scope"
  | "details"
  | "starting-room"
  | "look"
  | "concepts"
  | "result";

export type FinishLevel = "standard" | "premium" | "luxury";
export type ProjectSize = "compact" | "average" | "large";
export type LayoutChoice = "keep" | "change";
export type StartingRoomMethod = "upload" | "example";

export type V3CostDrivers = {
  layout: LayoutChoice;
  finishLevel: FinishLevel;
  size: ProjectSize;
  components: string[];
};

export type V3PlanningRange = {
  totalMin: number;
  totalMax: number;
  currency: string;
  assumptions: string[];
  increases: string[];
  reductions: string[];
  source: "configured_planning_range";
};

export type V3StyleDirection = {
  id: string;
  label: string;
  description: string;
  prompt: string;
};

export type V3ExampleRoom = {
  assetId: string;
  imageUrl: string;
  storagePath: string;
  label: string;
  modelId?: string | null;
  createdAt: number;
};

export type V3LeadState = {
  emailCaptured: boolean;
  submissionId?: string | null;
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  emailStatus?: "idle" | "sending" | "sent" | "failed";
  consultationStatus?: "idle" | "saving" | "requested" | "failed";
};

export type AdventureV3Snapshot = {
  version: 3;
  sessionId: string;
  stage: V3Stage;
  selectedServiceId: string | null;
  scope: string | null;
  costDrivers: V3CostDrivers;
  startingRoomMethod: StartingRoomMethod | null;
  selectedExampleRoom: V3ExampleRoom | null;
  sourceAsset: StableAsset | null;
  selectedStyleId: string | null;
  concepts: CanvasHistoryEntry[];
  selectedConceptIndex: number;
  detailedPricing: V2Pricing | null;
  lead: V3LeadState;
  updatedAt: number;
};

export type V3CanvasContext = {
  service: ServiceOption;
  scope: string;
  mode: ExperienceMode;
  budget: number;
  source: StarterCanvas;
};

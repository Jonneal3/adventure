export type AdventureExperienceVersion = "v1" | "v2";

export type ExperienceMode = "scene" | "tryon" | "placement";

export type DirectionCardType =
  | "complete_look"
  | "material_palette"
  | "product_style"
  | "color_palette";

export type DirectionConfig = {
  id: string;
  label: string;
  summary: string;
  prompt: string;
  cardType: DirectionCardType;
  previewColors: string[];
  materials?: string[];
  colors?: string[];
  fixtures?: string[];
  affectedRegions?: string[];
  preserve?: string[];
};

export type RegionOptionConfig = {
  id: string;
  label: string;
  prompt: string;
};

export type RegionConfig = {
  id: string;
  label: string;
  description: string;
  options: RegionOptionConfig[];
  preserve?: string[];
};

export type ScopeExperienceConfig = {
  scopeId: string;
  directionCardType: DirectionCardType;
  directions: DirectionConfig[];
  supportsFinishedVersions: boolean;
  supportedRegions: RegionConfig[];
  wholeDesignPreserveRules: string[];
  regionEditPreserveRules: string[];
};

export type StructuredDesignInstruction = {
  mode: "whole_design" | "target_region" | "finished_version";
  directionId?: string | null;
  directionLabel?: string | null;
  versionId?: string | null;
  targetRegion?: {
    id: string;
    label: string;
    confidence?: number | null;
  } | null;
  optionId?: string | null;
  optionLabel?: string | null;
  style?: string | null;
  materials?: string[];
  colors?: string[];
  fixtures?: string[];
  affectedRegions?: string[];
  layoutConstraints?: string[];
  preserve?: string[];
  customInstruction?: string | null;
  readableSummary: string;
};

export type UiModuleKey =
  | "photo_upload"
  | "person_photo_upload"
  | "product_photo_upload"
  | "prompt_box"
  | "budget_slider"
  | "color_swatches"
  | "material_picker"
  | "finish_selector"
  | "feature_chips"
  | "region_selector"
  | "intensity_slider"
  | "dimensions_input";

export type CapabilityKey =
  | "scene_canvas"
  | "property_photo"
  | "person_photo"
  | "product_photo"
  | "prompt_editing"
  | "budget_required"
  | "color_selection"
  | "material_selection"
  | "finish_selection"
  | "feature_selection"
  | "surface_regions"
  | "intensity_control"
  | "dimensions"
  | "identity_preservation";

export type UiModuleDefinition = {
  key: UiModuleKey;
  label: string;
  componentType: string;
  configSchema: Record<string, unknown>;
};

export type CapabilityDefinition = {
  key: CapabilityKey;
  label: string;
  defaultModules: UiModuleKey[];
};

export type ServiceModuleOverride = {
  moduleKey: UiModuleKey;
  enabled: boolean;
  order: number;
  config?: Record<string, unknown>;
};

export type ServiceConfiguration = {
  serviceId?: string;
  serviceName?: string;
  experienceMode?: ExperienceMode;
  capabilityKeys?: CapabilityKey[];
  moduleOverrides?: ServiceModuleOverride[];
  scopeOptions?: string[];
  quickChanges?: string[];
};

export type ServiceOption = {
  value: string;
  label: string;
  serviceName?: string | null;
  industryId?: string | null;
  industryName?: string | null;
  serviceSummary?: string | null;
  subcategoryComponents?: Array<{ key: string; label: string; priority: number }>;
  subcategoryScope?: string[];
};

export type ResolvedUiModule = UiModuleDefinition & {
  order: number;
  config: Record<string, unknown>;
};

export type ResolvedServiceProfile = {
  service: ServiceOption;
  mode: ExperienceMode;
  capabilityKeys: CapabilityKey[];
  modules: ResolvedUiModule[];
  scopeOptions: string[];
  quickChanges: string[];
};

export type StableAsset = {
  assetId: string;
  url: string;
  storagePath: string;
  contentType?: string | null;
};

export type StarterCanvas = {
  assetId: string;
  imageUrl: string;
  sourceType: "generated" | "uploaded";
  storagePath: string;
  modelId?: string | null;
  predictionId?: string | null;
  prompt?: string | null;
  serviceId: string;
  scope: string;
  budget: number;
  experienceMode: ExperienceMode;
  starterExperimentKey?: string | null;
  starterVariantId?: string | null;
  starterVariantLabel?: string | null;
  createdAt: number;
};

export type CanvasHistoryEntry = StarterCanvas & {
  changeLabel?: string | null;
  designInstruction?: StructuredDesignInstruction | null;
};

export type V2Stage =
  | "loading"
  | "service"
  | "scope"
  | "budget"
  | "inputs"
  | "canvas";

export type V2Pricing = {
  totalMin: number;
  totalMax: number;
  currency: string;
  source?: string | null;
};

export type AdventureV2Snapshot = {
  version: 2;
  sessionId: string;
  stage: V2Stage;
  selectedServiceId: string | null;
  scope: string | null;
  budget: number | null;
  sourceAssets: {
    scene?: StableAsset | null;
    person?: StableAsset | null;
    product?: StableAsset | null;
  };
  canvasHistory: CanvasHistoryEntry[];
  activeCanvasIndex?: number;
  successfulEditCount: number;
  promptHistory: string[];
  lead: {
    captured: boolean;
    submissionId?: string | null;
    email?: string | null;
    emailStatus?: "idle" | "sending" | "sent" | "failed";
    pricingStatus?: "idle" | "calculating" | "ready" | "failed";
  };
  pricing: V2Pricing | null;
  updatedAt: number;
};

import type { StepDefinition, UIStep } from "@/types/ai-form";
import { buildDeterministicStyleStep } from "../../../static/deterministic-style-step";

export const LOCAL_SKELETON_FLOW_MODE = "local_skeleton";
export const LOCAL_SKELETON_VERSION = "local-skeleton-v11-price-first-retrieval";
export const LOCAL_SCOPE_STEP_ID = "step-project-scope";
/** Refinement checklist when both DB scope presets and components exist (second scope step). */
export const LOCAL_PARTS_STEP_ID = "step-project-parts";

export type LocalSkeletonServiceOption = {
  value?: string | null;
  label?: string | null;
  serviceName?: string | null;
  serviceSummary?: string | null;
  /** Preset strings from categories_subcategories.subcategory_scope (first scope question). */
  subcategoryScope?: string[] | null;
  subcategoryComponents?: Array<{ key?: string | null; label?: string | null; priority?: number | null }>;
  styleQuestion?: string | null;
  styleOptions?: Array<{
    label?: string | null;
    value?: string | null;
    imageUrl?: string | null;
    description?: string | null;
    featuredRank?: number | null;
    priceTier?: string | null;
    priceRange?: { low?: number | null; high?: number | null; currency?: string | null } | null;
  }>;
};

function normalizeSubcategoryScopeStrings(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    const s = typeof x === "string" ? x.trim() : "";
    if (s.length < 1) continue;
    const k = s.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s.slice(0, 200));
    if (out.length >= 12) break;
  }
  return out;
}

function scopePresetValue(label: string, index: number): string {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
  return slug || `scope_${index}`;
}

type ChoiceOpt = { label: string; value: string };

function stepHasOtherOption(opts: ChoiceOpt[]): boolean {
  return opts.some((o) => {
    const v = String(o?.value || "").toLowerCase();
    const l = String(o?.label || "").toLowerCase();
    return v === "other" || l === "other";
  });
}

/** Matches generate-steps `sanitizeMiniStep`: append Other when there is room and it is not already listed. */
function withOtherChoiceOption(opts: ChoiceOpt[]): ChoiceOpt[] {
  if (opts.length === 0 || opts.length >= 12 || stepHasOtherOption(opts)) return opts;
  return [...opts, { label: "Other", value: "other" }];
}

function normalizeServiceLabel(serviceOption: LocalSkeletonServiceOption | null | undefined): string {
  const label =
    typeof serviceOption?.label === "string" && serviceOption.label.trim()
      ? serviceOption.label.trim()
      : typeof serviceOption?.serviceName === "string" && serviceOption.serviceName.trim()
        ? serviceOption.serviceName.trim()
        : "project";
  return label;
}

/** Placeholder labels from API fallbacks — using them in "your X project?" reads as broken copy ("service project"). */
function isGenericServiceLabel(label: string): boolean {
  const s = label.trim().toLowerCase();
  return !s || s === "service" || s === "project";
}

export function resolveSelectedServiceOption(
  serviceOptions: LocalSkeletonServiceOption[],
  selectedServiceId?: string | null,
): LocalSkeletonServiceOption | null {
  const normalizedId = typeof selectedServiceId === "string" ? selectedServiceId.trim() : "";
  if (normalizedId) {
    const direct = serviceOptions.find((option) => String(option?.value || "").trim() === normalizedId);
    if (direct) return direct;
  }
  return serviceOptions.length === 1 ? serviceOptions[0] : null;
}

export function buildServiceSelectionStep(serviceOptions: LocalSkeletonServiceOption[]): UIStep | null {
  if (!Array.isArray(serviceOptions) || serviceOptions.length <= 1) return null;
  return {
    id: "step-service-primary",
    type: "multiple_choice",
    question: "What are you pricing?",
    humanism: "Let’s build a quick concept so we can give you more relevant pricing.",
    options: serviceOptions.slice(0, 40).map((option) => ({
      label: String(option?.label || option?.serviceName || "Service"),
      value: String(option?.value || ""),
    })),
    multi_select: false,
    columns: 2,
    variant: "cards",
    metricGain: 0.08,
    blueprint: { presentation: { auto_advance: true, continue_label: "Continue" } },
  } as UIStep;
}

function normalizeComponents(serviceOption: LocalSkeletonServiceOption | null | undefined) {
  return Array.isArray(serviceOption?.subcategoryComponents)
    ? serviceOption.subcategoryComponents
        .map((component) => ({
          key: String(component?.key || "").trim(),
          label: normalizeComponentChoiceLabel(component?.label || component?.key),
          priority: Number(component?.priority ?? 0),
        }))
        .filter((component) => component.key && component.label)
        .sort((a, b) => a.priority - b.priority || a.label.localeCompare(b.label))
    : [];
}

const COMPONENT_DIMENSION_WORDS = new Set([
  "style",
  "type",
  "material",
  "finish",
  "color",
  "system",
  "species",
  "design",
  "option",
]);

/**
 * Component metadata often names an attribute ("Cabinet style", "Polish color")
 * while this screen asks what the design should include. Strip only generic
 * trailing dimension words so the same normalization works for every service.
 */
function normalizeComponentChoiceLabel(raw: unknown): string {
  const source = String(raw || "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!source) return "";
  const words = source.split(" ");
  while (words.length > 1 && COMPONENT_DIMENSION_WORDS.has(String(words[words.length - 1] || "").toLowerCase())) {
    words.pop();
  }
  const normalized = words.join(" ");
  return normalized === normalized.toLowerCase()
    ? normalized.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : normalized;
}

function buildPresetScopeStep(
  serviceOption: LocalSkeletonServiceOption | null | undefined,
  presets: string[],
): UIStep {
  const presetOptions = withOtherChoiceOption(
    presets.slice(0, 5).map((label, i) => ({
      label,
      value: scopePresetValue(label, i),
    })),
  );
  return {
    id: LOCAL_SCOPE_STEP_ID,
    type: "multiple_choice",
    question: "What are you mainly interested in?",
    humanism: "Let’s build a quick concept so we can give you more relevant pricing. Choose the closest option.",
    options: presetOptions,
    multi_select: false,
    columns: 2,
    variant: "cards",
    metricGain: 0.14,
    blueprint: { presentation: { auto_advance: true, continue_label: "Continue" } },
  } as UIStep;
}

function buildPartsScopeStep(
  components: ReturnType<typeof normalizeComponents>,
  usePartsOnlyStepId: boolean,
  afterPresetScopeStep: boolean,
): UIStep {
  const scopeQuestion = afterPresetScopeStep
    ? "What should the design include?"
    : "What should the design include?";
  const partOptions = withOtherChoiceOption(
    components.slice(0, 8).map((component) => ({
      label: component.label,
      value: component.key,
    })),
  );
  return {
    id: usePartsOnlyStepId ? LOCAL_SCOPE_STEP_ID : LOCAL_PARTS_STEP_ID,
    type: "multiple_choice",
    question: "What are you mainly interested in?",
    humanism: "Let’s build a quick concept so we can give you more relevant pricing. Choose the closest option.",
    options: [
      ...partOptions.slice(0, 7),
      { label: "Not sure yet", value: "not_sure" },
    ],
    multi_select: false,
    min_selections: 1,
    max_selections: 1,
    columns: 2,
    metricGain: 0.14,
    blueprint: { presentation: { auto_advance: true, continue_label: "Continue" } },
  } as UIStep;
}

function buildGenericExtentStep(serviceOption: LocalSkeletonServiceOption | null | undefined): UIStep {
  const serviceLabel = normalizeServiceLabel(serviceOption);
  const scaleQuestion = isGenericServiceLabel(serviceLabel)
    ? "How much are you looking to do?"
    : `How much are you looking to do for your ${serviceLabel.toLowerCase()}?`;

  return {
    id: LOCAL_SCOPE_STEP_ID,
    type: "multiple_choice",
    question: "What are you mainly interested in?",
    humanism: "Let’s build a quick concept so we can give you more relevant pricing. Choose the closest option.",
    options: withOtherChoiceOption([
      { label: "A quick refresh", value: "refresh" },
      { label: "A focused update", value: "partial_update" },
      { label: "A full transformation", value: "full_project" },
      { label: "Not sure yet", value: "not_sure" },
    ]),
    multi_select: false,
    columns: 1,
    variant: "cards",
    metricGain: 0.14,
    blueprint: { presentation: { auto_advance: true, continue_label: "Continue" } },
  } as UIStep;
}

/**
 * Deterministic scope steps for local skeleton: DB `subcategory_scope` first (when set),
 * then refinement `subcategory_components`, else generic extent.
 * When both presets and components exist, presets use step-project-scope and parts use step-project-parts.
 */
export function buildLocalScopeSteps(_serviceOption: LocalSkeletonServiceOption | null | undefined): UIStep[] {
  const presets = normalizeSubcategoryScopeStrings(_serviceOption?.subcategoryScope);
  if (presets.length > 0) return [buildPresetScopeStep(_serviceOption, presets)];

  const components = normalizeComponents(_serviceOption);
  if (components.length > 0) {
    return [buildPartsScopeStep(components, true, false)];
  }

  return [buildGenericExtentStep(_serviceOption)];
}

/** @deprecated Prefer buildLocalScopeSteps — this returns only the first scope step (legacy). */
export function buildLocalScopeStep(serviceOption: LocalSkeletonServiceOption | null | undefined): UIStep {
  const steps = buildLocalScopeSteps(serviceOption);
  return steps[0] ?? buildGenericExtentStep(serviceOption);
}

export function buildLocalPostServiceSteps(serviceOption: LocalSkeletonServiceOption | null | undefined): Array<StepDefinition | UIStep> {
  return buildLocalPostServiceStepsWithConfig({ serviceOption });
}

export function buildLocalPostServiceStepsWithConfig(params: {
  serviceOption: LocalSkeletonServiceOption | null | undefined;
  useCase?: string | null;
  previewPricing?: any;
}): Array<StepDefinition | UIStep> {
  const { serviceOption, useCase, previewPricing } = params;
  if (!serviceOption) return [];
  const scopeSteps = buildLocalScopeSteps(serviceOption);
  const styleStep = buildDeterministicStyleStep(serviceOption);
  // V1 is pricing-first: retrieve relevant library concepts after one intent
  // question. Budget, uploads, and AI generation belong after lead capture.
  return styleStep ? [...scopeSteps, styleStep] : scopeSteps;
}

export function buildLocalSkeletonFlow(params: {
  serviceOptions: LocalSkeletonServiceOption[];
  selectedServiceId?: string | null;
  useCase?: string | null;
  previewPricing?: any;
}): Array<StepDefinition | UIStep> {
  const { serviceOptions, selectedServiceId, useCase, previewPricing } = params;
  const steps: Array<StepDefinition | UIStep> = [];
  const serviceStep = buildServiceSelectionStep(serviceOptions);
  if (serviceStep) steps.push(serviceStep);
  const selectedService = resolveSelectedServiceOption(serviceOptions, selectedServiceId);
  if (selectedService) {
    steps.push(
      ...buildLocalPostServiceStepsWithConfig({
        serviceOption: selectedService,
        useCase,
        previewPricing,
      }),
    );
  }
  return steps;
}

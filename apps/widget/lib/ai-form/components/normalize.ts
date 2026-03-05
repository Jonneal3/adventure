import type { StepDefinition } from "@/types/ai-form";

type AnyObj = Record<string, any>;

function isNonEmptyString(s: any): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

function looksLikeBudgetIntent(intent?: string): boolean {
  if (!intent) return false;
  const s = intent.toLowerCase();
  return (
    s.includes("budget") ||
    s.includes("cost") ||
    s.includes("price") ||
    s.includes("spend") ||
    s.includes("pricing") ||
    s.includes("estimate")
  );
}

function normalizeOption(opt: any): AnyObj {
  if (typeof opt === "string") return { label: opt, value: opt };
  if (opt && typeof opt === "object") {
    const label = isNonEmptyString(opt.label) ? opt.label : isNonEmptyString(opt.value) ? opt.value : String(opt);
    const value = isNonEmptyString(opt.value) ? opt.value : label;
    const out: AnyObj = { ...opt, label, value };
    // unify image key
    if (!out.imageUrl && typeof out.image_url === "string") out.imageUrl = out.image_url;
    return out;
  }
  return { label: String(opt), value: String(opt) };
}

function normalizeChoiceData(data: AnyObj): AnyObj {
  const raw = Array.isArray(data?.options) ? data.options : [];
  const options = raw.map(normalizeOption);
  return {
    ...data,
    options,
    multiple: Boolean(data?.multiple),
  };
}

function normalizeSliderData(step: StepDefinition, data: AnyObj): AnyObj {
  const min = typeof data?.min === "number" ? data.min : 0;
  const max = typeof data?.max === "number" ? data.max : 100;
  const stepSize = typeof data?.step === "number" ? data.step : 1;
  const def = typeof data?.default === "number" ? data.default : min;

  const out: AnyObj = { ...data, min, max, step: stepSize, default: def };
  if (!out.format && looksLikeBudgetIntent(step.intent)) {
    out.format = "currency";
  }
  return out;
}

export function normalizeStepDefinition(step: StepDefinition): StepDefinition {
  const data: AnyObj = step?.data && typeof step.data === "object" ? (step.data as AnyObj) : {};
  const content: AnyObj = step?.content && typeof step.content === "object" ? (step.content as AnyObj) : {};

  switch (step.componentType) {
    case "choice":
    case "segmented_choice":
    case "chips_multi":
    case "image_choice_grid":
      // v2 -> v1 compatibility: if DSPy emitted content.options but not data.options,
      // mirror options into data so older UI components still render.
      // Also normalize option shape + imageUrl key on both.
      {
        const v1Opts = Array.isArray(data?.options) ? data.options : [];
        const v2Opts = Array.isArray(content?.options) ? content.options : [];
        const mergedOpts = v1Opts.length > 0 ? v1Opts : v2Opts;
        const normalizedOpts = mergedOpts.map(normalizeOption);

        const nextData = normalizeChoiceData({ ...data, options: normalizedOpts });
        const nextContent = step.content
          ? {
              ...content,
              options: Array.isArray(content?.options) ? normalizedOpts : content?.options,
            }
          : step.content;

        return { ...step, data: nextData, content: nextContent as any };
      }
    case "slider":
      return { ...step, data: normalizeSliderData(step, data) };
    case "yes_no":
      return {
        ...step,
        data: {
          ...data,
          yesLabel: isNonEmptyString(data?.yesLabel) ? data.yesLabel : "Yes",
          noLabel: isNonEmptyString(data?.noLabel) ? data.noLabel : "No",
        },
      };
    default:
      return step;
  }
}

export function normalizeSteps(steps: StepDefinition[] | undefined | null): StepDefinition[] {
  if (!Array.isArray(steps)) return [];
  return steps.map((s) => normalizeStepDefinition(s));
}



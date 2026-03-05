type SearchParams = Record<string, string | string[] | undefined>;

type AnyRecord = Record<string, any>;

function isPlainObject(value: unknown): value is AnyRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function coerceBoolean(raw: unknown): boolean | undefined {
  if (typeof raw === "boolean") return raw;
  if (typeof raw === "string") {
    const v = raw.trim().toLowerCase();
    if (v === "0" || v === "false" || v === "off" || v === "no") return false;
    if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
    return undefined;
  }
  if (typeof raw === "number") {
    if (raw === 0) return false;
    if (raw === 1) return true;
  }
  return undefined;
}

function getFirstSearchParam(sp: SearchParams | undefined, key: string): string | undefined {
  if (!sp) return undefined;
  const v = (sp as any)?.[key];
  if (Array.isArray(v)) return v[0];
  return v;
}

/**
 * Resolve whether the AI-form experience is enabled for an instance.
 *
 * - Supports URL overrides for quick testing.
 * - V2 single source of truth: `instances.config.form_status_enabled`.
 * - Legacy keys are supported as a fallback for old payloads.
 * - Defaults to `true` to preserve existing behavior unless explicitly disabled.
 */
export function resolveAIFormEnabled(params: {
  instance?: unknown;
  instanceConfig?: unknown;
  searchParams?: SearchParams;
}): boolean {
  const sp = params.searchParams;

  // URL override for quick testing / forced behavior.
  // Examples:
  // - ?form=0
  // - ?formEnabled=false
  // - ?aiFormEnabled=0
  // - ?ai_form_enabled=false
  const overrideRaw =
    getFirstSearchParam(sp, "form") ??
    getFirstSearchParam(sp, "formEnabled") ??
    getFirstSearchParam(sp, "form_enabled") ??
    getFirstSearchParam(sp, "formStatusEnabled") ??
    getFirstSearchParam(sp, "form_status_enabled") ??
    getFirstSearchParam(sp, "aiFormEnabled") ??
    getFirstSearchParam(sp, "ai_form_enabled") ??
    getFirstSearchParam(sp, "enableAiForm") ??
    getFirstSearchParam(sp, "enable_ai_form");

  const override = coerceBoolean(overrideRaw);
  if (typeof override === "boolean") return override;

  const instance = isPlainObject(params.instance) ? (params.instance as AnyRecord) : {};

  const parsedConfig =
    typeof params.instanceConfig === "string"
      ? (() => {
          try {
            return JSON.parse(params.instanceConfig);
          } catch {
            return undefined;
          }
        })()
      : undefined;

  const cfg =
    isPlainObject(params.instanceConfig)
      ? (params.instanceConfig as AnyRecord)
      : isPlainObject(parsedConfig)
        ? (parsedConfig as AnyRecord)
        : isPlainObject(instance?.config)
          ? (instance.config as AnyRecord)
          : {};

  // V2: single source of truth.
  const v2 = coerceBoolean(cfg?.form_status_enabled);
  if (typeof v2 === "boolean") return v2;

  const candidates = [
    // Instance root keys (DB columns / API payloads).
    instance?.aiFormEnabled,
    instance?.ai_form_enabled,
    instance?.formEnabled,
    instance?.form_enabled,
    instance?.formStatusEnabled,
    instance?.form_status_enabled,
    instance?.formStatus?.enabled,
    instance?.form_status?.enabled,
    instance?.enableAiForm,
    instance?.enable_ai_form,

    // Common root keys in instance.config (camel + snake).
    cfg?.aiFormEnabled,
    cfg?.ai_form_enabled,
    cfg?.formEnabled,
    cfg?.form_enabled,
    cfg?.formStatusEnabled,
    cfg?.formStatus?.enabled,
    cfg?.form_status?.enabled,
    cfg?.enableAiForm,
    cfg?.enable_ai_form,

    // Common nested keys.
    cfg?.aiForm?.enabled,
    cfg?.ai_form?.enabled,
    cfg?.aiFormConfig?.enabled,
    cfg?.ai_form_config?.enabled,
    cfg?.form?.enabled,
    cfg?.formConfig?.enabled,
    cfg?.form_config?.enabled,

    // Occasional "experience"/"adventure" nesting.
    cfg?.adventure?.formEnabled,
    cfg?.adventure?.form_enabled,
    cfg?.experience?.formEnabled,
    cfg?.experience?.form_enabled,
  ];

  for (const v of candidates) {
    const b = coerceBoolean(v);
    if (typeof b === "boolean") return b;
  }

  return true;
}

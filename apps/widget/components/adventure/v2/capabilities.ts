import type {
  CapabilityDefinition,
  CapabilityKey,
  ExperienceMode,
  ResolvedServiceProfile,
  ResolvedUiModule,
  ServiceConfiguration,
  ServiceOption,
  UiModuleDefinition,
  UiModuleKey,
} from "./types";

export const UI_MODULES: Record<UiModuleKey, UiModuleDefinition> = {
  photo_upload: {
    key: "photo_upload",
    label: "Photo",
    componentType: "photo_upload",
    configSchema: { required: "boolean", role: "scene" },
  },
  person_photo_upload: {
    key: "person_photo_upload",
    label: "Person photo",
    componentType: "photo_upload",
    configSchema: { required: true, role: "person" },
  },
  product_photo_upload: {
    key: "product_photo_upload",
    label: "Product photo",
    componentType: "photo_upload",
    configSchema: { required: true, role: "product" },
  },
  prompt_box: {
    key: "prompt_box",
    label: "Describe a change",
    componentType: "prompt_box",
    configSchema: { maxLength: 800 },
  },
  budget_slider: {
    key: "budget_slider",
    label: "Budget",
    componentType: "budget_slider",
    configSchema: { required: true },
  },
  color_swatches: {
    key: "color_swatches",
    label: "Color mood",
    componentType: "color_swatches",
    configSchema: { options: ["Warm neutral", "Cool neutral", "Dark contrast", "Natural color"] },
  },
  material_picker: {
    key: "material_picker",
    label: "Materials",
    componentType: "material_picker",
    configSchema: { options: ["Natural", "Low maintenance", "Premium", "Minimal"] },
  },
  finish_selector: {
    key: "finish_selector",
    label: "Finish",
    componentType: "finish_selector",
    configSchema: { options: ["Matte", "Satin", "Polished", "Textured"] },
  },
  feature_chips: {
    key: "feature_chips",
    label: "Quick changes",
    componentType: "feature_chips",
    configSchema: { maxVisible: 4 },
  },
  region_selector: {
    key: "region_selector",
    label: "Area",
    componentType: "region_selector",
    configSchema: { options: ["Main focal area", "Surrounding surfaces", "Details and trim"] },
  },
  intensity_slider: {
    key: "intensity_slider",
    label: "Intensity",
    componentType: "intensity_slider",
    configSchema: { min: 1, max: 5, default: 3 },
  },
  dimensions_input: {
    key: "dimensions_input",
    label: "Dimensions",
    componentType: "dimensions_input",
    configSchema: { placeholder: "Add approximate dimensions" },
  },
};

export const CAPABILITIES: Record<CapabilityKey, CapabilityDefinition> = {
  scene_canvas: { key: "scene_canvas", label: "Editable scene", defaultModules: ["photo_upload"] },
  property_photo: { key: "property_photo", label: "Property photo", defaultModules: ["photo_upload"] },
  person_photo: { key: "person_photo", label: "Person photo", defaultModules: ["person_photo_upload"] },
  product_photo: { key: "product_photo", label: "Product photo", defaultModules: ["product_photo_upload"] },
  prompt_editing: { key: "prompt_editing", label: "Prompt editing", defaultModules: ["prompt_box"] },
  budget_required: { key: "budget_required", label: "Budget", defaultModules: ["budget_slider"] },
  color_selection: { key: "color_selection", label: "Color selection", defaultModules: ["color_swatches"] },
  material_selection: { key: "material_selection", label: "Material selection", defaultModules: ["material_picker"] },
  finish_selection: { key: "finish_selection", label: "Finish selection", defaultModules: ["finish_selector"] },
  feature_selection: { key: "feature_selection", label: "Feature changes", defaultModules: ["feature_chips"] },
  surface_regions: { key: "surface_regions", label: "Surface regions", defaultModules: ["region_selector"] },
  intensity_control: { key: "intensity_control", label: "Intensity", defaultModules: ["intensity_slider"] },
  dimensions: { key: "dimensions", label: "Dimensions", defaultModules: ["dimensions_input"] },
  identity_preservation: { key: "identity_preservation", label: "Identity preservation", defaultModules: [] },
};

const BASE_MODULE_ORDER: UiModuleKey[] = [
  "budget_slider",
  "photo_upload",
  "person_photo_upload",
  "product_photo_upload",
  "feature_chips",
  "region_selector",
  "color_swatches",
  "material_picker",
  "finish_selector",
  "intensity_slider",
  "dimensions_input",
  "prompt_box",
];

function normalizeMode(raw: unknown): ExperienceMode | null {
  const value = String(raw || "").trim().toLowerCase().replace(/_/g, "-");
  if (value === "tryon" || value === "try-on") return "tryon";
  if (value === "placement" || value === "scene-placement") return "placement";
  if (value === "scene" || value === "scene-refinement") return "scene";
  return null;
}

function asRecord(raw: unknown): Record<string, any> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, any>) : {};
}

function readV2Config(instance: any): Record<string, any> {
  const root = asRecord(instance?.config);
  const legacy = asRecord(root.aiFormConfig);
  return asRecord(
    root.adventureV2 ??
      root.adventure_v2 ??
      legacy.adventureV2 ??
      legacy.adventure_v2
  );
}

function normalizeServiceConfig(raw: unknown): ServiceConfiguration | null {
  const value = asRecord(raw);
  if (Object.keys(value).length === 0) return null;
  const capabilityKeys = Array.isArray(value.capabilityKeys ?? value.capability_keys)
    ? (value.capabilityKeys ?? value.capability_keys).filter((key: unknown): key is CapabilityKey =>
        typeof key === "string" && key in CAPABILITIES
      )
    : undefined;
  const moduleOverrides = Array.isArray(value.moduleOverrides ?? value.module_overrides)
    ? (value.moduleOverrides ?? value.module_overrides)
        .map((override: any, index: number) => {
          const moduleKey = override?.moduleKey ?? override?.module_key;
          if (typeof moduleKey !== "string" || !(moduleKey in UI_MODULES)) return null;
          return {
            moduleKey,
            enabled: override?.enabled !== false,
            order: Number.isFinite(Number(override?.order)) ? Number(override.order) : 100 + index,
            config: asRecord(override?.config),
          };
        })
        .filter(Boolean)
    : undefined;
  return {
    serviceId: typeof value.serviceId === "string" ? value.serviceId : undefined,
    serviceName: typeof value.serviceName === "string" ? value.serviceName : undefined,
    experienceMode: normalizeMode(value.experienceMode ?? value.experience_mode) ?? undefined,
    capabilityKeys,
    moduleOverrides: moduleOverrides as ServiceConfiguration["moduleOverrides"],
    scopeOptions: Array.isArray(value.scopeOptions ?? value.scope_options)
      ? (value.scopeOptions ?? value.scope_options).map(String).map((item: string) => item.trim()).filter(Boolean).slice(0, 12)
      : undefined,
    quickChanges: Array.isArray(value.quickChanges ?? value.quick_changes)
      ? (value.quickChanges ?? value.quick_changes).map(String).map((item: string) => item.trim()).filter(Boolean).slice(0, 8)
      : undefined,
  };
}

function findServiceConfiguration(instance: any, service: ServiceOption): ServiceConfiguration | null {
  const config = readV2Config(instance);
  const rawConfigs = config.serviceConfigurations ?? config.service_configurations ?? config.services;
  if (Array.isArray(rawConfigs)) {
    const found = rawConfigs.find((entry: any) => {
      const normalized = normalizeServiceConfig(entry);
      return normalized?.serviceId === service.value || normalized?.serviceName?.toLowerCase() === service.label.toLowerCase();
    });
    return normalizeServiceConfig(found);
  }
  const map = asRecord(rawConfigs);
  return normalizeServiceConfig(map[service.value] ?? map[service.label] ?? map[service.label.toLowerCase()]);
}

function inferMode(instance: any, service: ServiceOption, explicit?: ExperienceMode): ExperienceMode {
  if (explicit) return explicit;
  const v2 = readV2Config(instance);
  const configured =
    normalizeMode(v2.experienceMode ?? v2.experience_mode) ??
    normalizeMode(instance?.use_case ?? instance?.useCase ?? instance?.config?.useCase ?? instance?.config?.use_case);
  if (configured) return configured;

  const searchable = [
    service.label,
    service.serviceName,
    service.industryName,
    service.serviceSummary,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (/\b(try.?on|apparel|clothing|fashion|jewelry|eyewear|glasses|makeup|hairstyle)\b/.test(searchable)) {
    return "tryon";
  }
  if (/\b(place|placement|furniture|appliance|artwork|decor|product staging)\b/.test(searchable)) {
    return "placement";
  }
  return "scene";
}

function inferredCapabilities(mode: ExperienceMode, service: ServiceOption): CapabilityKey[] {
  const capabilities: CapabilityKey[] =
    mode === "tryon"
      ? ["person_photo", "product_photo", "identity_preservation", "feature_selection", "intensity_control", "prompt_editing", "budget_required"]
      : mode === "placement"
        ? ["property_photo", "product_photo", "feature_selection", "prompt_editing", "budget_required"]
        : ["scene_canvas", "property_photo", "feature_selection", "prompt_editing", "budget_required"];

  const searchable = [
    service.label,
    service.serviceSummary,
    ...(service.subcategoryComponents || []).flatMap((component) => [component.key, component.label]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(color|colour|paint|shade|stain|palette)\b/.test(searchable)) capabilities.push("color_selection");
  if (/\b(material|surface|floor|tile|stone|wood|fabric|siding|paver)\b/.test(searchable)) capabilities.push("material_selection");
  if (/\b(finish|hardware|fixture|polish|matte|gloss|texture)\b/.test(searchable)) capabilities.push("finish_selection");
  if (/\b(region|area|wall|trim|facade|façade|zone)\b/.test(searchable)) capabilities.push("surface_regions");
  if (/\b(size|dimension|length|width|height|square|layout)\b/.test(searchable)) capabilities.push("dimensions");

  return Array.from(new Set(capabilities));
}

function defaultScopes(mode: ExperienceMode): string[] {
  if (mode === "tryon") return ["Preview this item", "Compare a different look", "Complete styling"];
  if (mode === "placement") return ["One focal placement", "Coordinate the surrounding area", "Complete scene"];
  return ["Focused update", "Multiple areas", "Full transformation"];
}

function defaultQuickChanges(mode: ExperienceMode, service: ServiceOption): string[] {
  const componentLabels = (service.subcategoryComponents || [])
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((component) => component.label)
    .filter(Boolean)
    .slice(0, 2)
    .map((label) => `Update ${label.toLowerCase()}`);

  const defaults =
    mode === "tryon"
      ? ["Make the fit more natural", "Try a different color", "Use subtler styling", "Polish the final look"]
      : mode === "placement"
        ? ["Try a better position", "Match the scene lighting", "Adjust the scale", "Coordinate the finishes"]
        : ["Use warmer materials", "Make it brighter", "Add modern details", "Use a more premium finish"];
  return Array.from(new Set([...componentLabels, ...defaults])).slice(0, 4);
}

const SCOPE_QUICK_CHANGES: Record<string, string[]> = {
  "full bathroom renovation": [
    "Try a warmer vanity",
    "Use a half-wall shower",
    "Change the tile palette",
    "Make it brighter",
  ],
  "shower or tub area only": [
    "Add a shower half wall",
    "Try warmer wet-area tile",
    "Use brushed brass fixtures",
    "Add a built-in niche",
  ],
  "vanity, cabinets & fixtures": [
    "Try a floating vanity",
    "Use warmer cabinet wood",
    "Change the countertop",
    "Update mirrors and sconces",
  ],
  "tile & flooring": [
    "Try larger floor tile",
    "Add a shower accent tile",
    "Use warmer stone tones",
    "Reduce grout contrast",
  ],
  "cosmetic refresh (paint, lighting, hardware)": [
    "Use warmer wall paint",
    "Update the sconces",
    "Try brushed brass hardware",
    "Make it brighter",
  ],
  "layout or plumbing changes": [
    "Add a shower half wall",
    "Improve the tub clearance",
    "Reposition the fixtures",
    "Open up the walkway",
  ],
  "full outdoor renovation": [
    "Add layered planting",
    "Warm up the hardscape",
    "Improve the path layout",
    "Add subtle lighting",
  ],
  "patio and walkway upgrade": [
    "Try larger pavers",
    "Warm up the stone color",
    "Soften the path edges",
    "Add step lighting",
  ],
  "new lawn and garden installation": [
    "Add layered garden beds",
    "Use more native plants",
    "Refine the lawn shape",
    "Add seasonal color",
  ],
  "driveway resurfacing and repair": [
    "Try a lighter finish",
    "Add a clean border",
    "Use permeable pavers",
    "Improve the driveway curve",
  ],
  "hardscape color scheme refresh": [
    "Try warmer stone tones",
    "Add subtle color contrast",
    "Use a lighter border",
    "Reduce pattern variation",
  ],
  "outdoor lighting installation": [
    "Light the mature trees",
    "Add subtle path lights",
    "Illuminate the steps",
    "Make the lighting softer",
  ],
  "irrigation system installation": [
    "Improve lawn coverage",
    "Add drip irrigation",
    "Reduce path overspray",
    "Create separate zones",
  ],
  "tree and shrub pruning service": [
    "Lift the tree canopies",
    "Open the sightlines",
    "Shape the shrubs naturally",
    "Remove crowded growth",
  ],
};

export function quickChangesForScope(
  profile: Pick<ResolvedServiceProfile, "quickChanges">,
  scope: string | null | undefined
): string[] {
  const key = String(scope || "").trim().toLowerCase();
  return (SCOPE_QUICK_CHANGES[key] || profile.quickChanges).slice(0, 4);
}

function resolveModules(capabilityKeys: CapabilityKey[], configuration: ServiceConfiguration | null): ResolvedUiModule[] {
  const moduleKeys = new Set<UiModuleKey>();
  for (const capabilityKey of capabilityKeys) {
    for (const moduleKey of CAPABILITIES[capabilityKey].defaultModules) moduleKeys.add(moduleKey);
  }

  const overrides = configuration?.moduleOverrides || [];
  for (const override of overrides) {
    if (override.enabled) moduleKeys.add(override.moduleKey);
    else moduleKeys.delete(override.moduleKey);
  }

  return Array.from(moduleKeys)
    .map((moduleKey) => {
      const override = overrides.find((item) => item.moduleKey === moduleKey);
      const baseOrder = BASE_MODULE_ORDER.indexOf(moduleKey);
      return {
        ...UI_MODULES[moduleKey],
        order: override?.order ?? (baseOrder >= 0 ? baseOrder : 100),
        config: { ...UI_MODULES[moduleKey].configSchema, ...(override?.config || {}) },
      };
    })
    .sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
}

export function resolveServiceProfile(instance: any, service: ServiceOption): ResolvedServiceProfile {
  const configuration = findServiceConfiguration(instance, service);
  const mode = inferMode(instance, service, configuration?.experienceMode);
  const capabilityKeys =
    configuration?.capabilityKeys && configuration.capabilityKeys.length > 0
      ? Array.from(new Set(configuration.capabilityKeys))
      : inferredCapabilities(mode, service);
  return {
    service,
    mode,
    capabilityKeys,
    modules: resolveModules(capabilityKeys, configuration),
    scopeOptions:
      configuration?.scopeOptions?.length
        ? configuration.scopeOptions
        : service.subcategoryScope?.length
          ? service.subcategoryScope.slice(0, 12)
          : defaultScopes(mode),
    quickChanges:
      configuration?.quickChanges?.length
        ? configuration.quickChanges.slice(0, 4)
        : defaultQuickChanges(mode, service),
  };
}

export function moduleOptions(module: ResolvedUiModule): string[] {
  const options = module.config.options;
  return Array.isArray(options) ? options.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 8) : [];
}

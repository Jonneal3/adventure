import type {
  DirectionCardType,
  DirectionConfig,
  RegionConfig,
  RegionOptionConfig,
  ResolvedServiceProfile,
  ScopeExperienceConfig,
} from "./types";

type ScopePreset = {
  cardType: DirectionCardType;
  directions: DirectionConfig[];
  regions: RegionConfig[];
};

function direction(
  id: string,
  label: string,
  summary: string,
  prompt: string,
  cardType: DirectionCardType,
  previewColors: string[],
  details: Partial<DirectionConfig> = {}
): DirectionConfig {
  return {
    id,
    label,
    summary,
    prompt,
    cardType,
    previewColors,
    ...details,
  };
}

function region(
  id: string,
  label: string,
  description: string,
  options: Array<[string, string, string]>,
  preserve: string[] = []
): RegionConfig {
  return {
    id,
    label,
    description,
    options: options.map(([optionId, optionLabel, prompt]) => ({
      id: optionId,
      label: optionLabel,
      prompt,
    })),
    preserve,
  };
}

const BATHROOM_COMPLETE_DIRECTIONS: DirectionConfig[] = [
  direction(
    "warm-organic",
    "Warm organic",
    "Natural oak · warm stone · soft ivory · quiet brass",
    "Create a coordinated warm organic bathroom using restrained natural oak, softly varied warm stone, ivory surfaces, and quiet aged-brass details.",
    "complete_look",
    ["#d8c4a7", "#8d6d4f", "#eee8dc", "#a68754"],
    {
      materials: ["natural oak", "warm stone", "ivory tile"],
      colors: ["warm ivory", "sand", "natural wood"],
      fixtures: ["quiet aged-brass fixtures"],
    }
  ),
  direction(
    "clean-spa",
    "Clean spa",
    "Ivory tile · light stone · subtle grout · brushed nickel",
    "Create a calm, complete spa direction with ivory tile, light honed stone, subtle low-contrast grout, simple lines, and brushed-nickel fixtures.",
    "complete_look",
    ["#f1eee7", "#d8d7d1", "#b7b9b7", "#ffffff"],
    {
      materials: ["ivory tile", "light honed stone"],
      colors: ["soft white", "pale warm gray"],
      fixtures: ["brushed-nickel fixtures"],
    }
  ),
  direction(
    "bold-contemporary",
    "Bold contemporary",
    "Graphite accents · large format · dark metal · crisp white",
    "Create a complete bold contemporary bathroom using large-format surfaces, clean white forms, controlled graphite contrast, and refined dark-metal fixtures.",
    "complete_look",
    ["#20262b", "#7a807f", "#e9e7e1", "#fafafa"],
    {
      materials: ["large-format tile", "refined dark metal"],
      colors: ["graphite", "crisp white", "soft gray"],
      fixtures: ["dark-metal fixtures"],
    }
  ),
];

const BATHROOM_MATERIAL_DIRECTIONS: DirectionConfig[] = [
  direction(
    "warm-modern",
    "Warm modern",
    "Warm limestone · large format · low-contrast grout",
    "Use a coordinated warm-modern tile and flooring palette with large-format limestone tones, subtle variation, and low-contrast grout.",
    "material_palette",
    ["#cdbda5", "#a9987f", "#ece4d7", "#817565"],
    {
      materials: ["large-format warm limestone tile"],
      colors: ["sand", "warm greige"],
      affectedRegions: ["shower tile", "tub surround", "flooring", "grout"],
    }
  ),
  direction(
    "clean-spa",
    "Clean spa",
    "Ivory vertical tile · light floor · subtle grout",
    "Use a clean spa tile direction with softly textured ivory wet-area tile, a light stone floor, and very subtle grout lines.",
    "material_palette",
    ["#eeeae0", "#d5d2c8", "#f8f7f2", "#bbb9b0"],
    {
      materials: ["ivory vertical tile", "light stone flooring"],
      colors: ["ivory", "pale warm gray"],
      affectedRegions: ["shower tile", "tub surround", "flooring", "grout"],
    }
  ),
  direction(
    "bold-contrast",
    "Bold contrast",
    "Deep charcoal · pale stone · graphic restraint",
    "Use a bold but buildable tile palette with a controlled charcoal focal surface, pale stone flooring, and clean consistent grout.",
    "material_palette",
    ["#2d3336", "#62696a", "#e4dfd4", "#b8b1a5"],
    {
      materials: ["charcoal focal tile", "pale stone flooring"],
      colors: ["charcoal", "pale stone"],
      affectedRegions: ["shower tile", "tub surround", "flooring", "grout"],
    }
  ),
];

const BATHROOM_PRODUCT_DIRECTIONS: DirectionConfig[] = [
  direction(
    "natural-floating",
    "Natural floating",
    "Oak cabinetry · pale quartz · simple hardware",
    "Use a refined floating natural-oak vanity, pale quartz top, simple hardware, and coordinated understated fixtures.",
    "product_style",
    ["#9c7653", "#d9c3a5", "#eeeae2", "#777a78"],
    { materials: ["natural oak", "pale quartz"], fixtures: ["understated fixtures"] }
  ),
  direction(
    "tailored-classic",
    "Tailored classic",
    "Painted cabinetry · framed mirrors · polished nickel",
    "Use tailored painted vanity cabinetry, a restrained stone top, framed mirrors, and polished-nickel fixtures with classic proportions.",
    "product_style",
    ["#d9d7cf", "#7d8582", "#f4f0e7", "#a9aaac"],
    { materials: ["painted cabinetry", "restrained stone"], fixtures: ["polished-nickel fixtures"] }
  ),
  direction(
    "dark-modern",
    "Dark modern",
    "Deep wood · crisp counter · sculptural lighting",
    "Use deep-toned modern vanity cabinetry, a crisp light countertop, minimal hardware, and sculptural contemporary lighting.",
    "product_style",
    ["#37312d", "#715c4b", "#f0eee8", "#ba8e58"],
    { materials: ["deep-toned wood", "light countertop"], fixtures: ["minimal hardware", "sculptural lighting"] }
  ),
];

const BATHROOM_COLOR_DIRECTIONS: DirectionConfig[] = [
  direction(
    "soft-warm",
    "Soft warm",
    "Warm white · muted clay · aged brass",
    "Refresh the visible paint, lighting, and hardware with warm white, muted clay undertones, soft illumination, and restrained aged-brass accents.",
    "color_palette",
    ["#f1eadf", "#c6a28a", "#9f7e4e", "#ffffff"]
  ),
  direction(
    "fresh-neutral",
    "Fresh neutral",
    "Clean white · pale greige · brushed nickel",
    "Refresh the visible paint, lighting, and hardware with clean white, pale greige, brighter balanced lighting, and brushed-nickel accents.",
    "color_palette",
    ["#f8f7f2", "#d9d5cb", "#aeb1b0", "#ffffff"]
  ),
  direction(
    "moody-polished",
    "Moody polished",
    "Deep olive · cream · dark bronze",
    "Refresh the visible paint, lighting, and hardware with a controlled deep-olive accent, warm cream, flattering illumination, and dark-bronze details.",
    "color_palette",
    ["#424a3c", "#7b8066", "#e9dfcc", "#4b3d32"]
  ),
];

const BATHROOM_REGIONS: Record<string, RegionConfig> = {
  shower_tile: region(
    "shower_tile",
    "Shower tile",
    "Tile inside and immediately surrounding the shower.",
    [
      ["larger-format", "Larger format", "Replace only the selected shower tile with larger-format tile and clean aligned joints."],
      ["warm-stone", "Warm stone", "Replace only the selected shower tile with restrained warm-stone tile."],
      ["vertical-layout", "Vertical layout", "Change only the selected shower tile to a refined vertical layout."],
      ["lower-grout", "Lower grout contrast", "Reduce grout contrast only within the selected shower tile."],
    ],
    ["shower geometry", "glass", "plumbing fixtures", "all non-shower surfaces"]
  ),
  tub_surround: region(
    "tub_surround",
    "Tub surround",
    "The wall tile and finish immediately around the tub.",
    [
      ["ivory-tile", "Soft ivory tile", "Change only the selected tub surround to softly textured ivory tile."],
      ["warm-stone", "Warm stone", "Change only the selected tub surround to warm honed stone tile."],
      ["vertical-layout", "Vertical layout", "Change only the selected tub-surround tile to a vertical layout."],
      ["simple-niche", "Simple niche", "Add one simple, buildable recessed niche only within the selected tub surround."],
    ],
    ["tub shape", "windows", "plumbing", "flooring"]
  ),
  flooring: region(
    "flooring",
    "Flooring",
    "The visible finished floor surface.",
    [
      ["larger-format", "Larger format", "Replace only the selected flooring with larger-format tile."],
      ["warm-limestone", "Warm limestone", "Replace only the selected flooring with warm limestone-look tile."],
      ["light-terrazzo", "Light terrazzo", "Replace only the selected flooring with restrained light terrazzo."],
      ["lower-grout", "Lower grout contrast", "Reduce grout contrast only across the selected flooring."],
    ],
    ["walls", "cabinetry", "fixtures", "room layout"]
  ),
  vanity: region(
    "vanity",
    "Vanity & cabinetry",
    "The vanity cabinet, doors, and visible millwork.",
    [
      ["floating-oak", "Floating oak", "Change only the selected vanity to a buildable floating natural-oak design."],
      ["painted-cabinetry", "Painted cabinetry", "Change only the selected vanity to refined painted cabinetry."],
      ["warmer-wood", "Warmer wood", "Warm only the selected vanity wood tone while preserving its dimensions."],
      ["simpler-hardware", "Simpler hardware", "Update only the selected vanity hardware to a restrained modern style."],
    ],
    ["countertop", "plumbing", "walls", "flooring", "vanity dimensions"]
  ),
  countertop: region(
    "countertop",
    "Countertop",
    "The vanity top and backsplash immediately attached to it.",
    [
      ["pale-quartz", "Pale quartz", "Change only the selected countertop to quiet pale quartz."],
      ["warm-stone", "Warm stone", "Change only the selected countertop to warm honed natural stone."],
      ["thin-profile", "Thinner profile", "Refine only the selected countertop to a thinner buildable edge profile."],
      ["short-backsplash", "Short backsplash", "Use a simple short matching backsplash only along the selected countertop."],
    ],
    ["cabinetry", "sink locations", "fixtures", "walls"]
  ),
  walls: region(
    "walls",
    "Walls",
    "Painted wall surfaces outside the wet-area tile.",
    [
      ["warm-white", "Warm white", "Repaint only the selected walls a soft warm white."],
      ["pale-greige", "Pale greige", "Repaint only the selected walls a quiet pale greige."],
      ["muted-green", "Muted green", "Repaint only the selected walls a restrained muted green."],
      ["brighter", "Make brighter", "Brighten only the selected wall finish while preserving material and geometry."],
    ],
    ["tile", "cabinetry", "fixtures", "openings", "flooring"]
  ),
  fixtures: region(
    "fixtures",
    "Fixtures & hardware",
    "Visible faucets, shower hardware, pulls, and related metal details.",
    [
      ["brushed-nickel", "Brushed nickel", "Change only the selected visible fixtures to brushed nickel."],
      ["aged-brass", "Aged brass", "Change only the selected visible fixtures to restrained aged brass."],
      ["dark-bronze", "Dark bronze", "Change only the selected visible fixtures to dark bronze."],
      ["simpler-style", "Simpler style", "Update only the selected fixtures to a simpler contemporary style."],
    ],
    ["fixture locations", "plumbing geometry", "all surrounding materials"]
  ),
};

const LANDSCAPE_DIRECTIONS: DirectionConfig[] = [
  direction(
    "soft-natural",
    "Soft natural",
    "Layered planting · soft paths · quiet native color",
    "Create a coordinated soft-natural landscape with layered planting, gentle edges, region-appropriate native texture, and restrained seasonal color.",
    "complete_look",
    ["#556746", "#87956b", "#b9ae8e", "#ddd7c7"]
  ),
  direction(
    "clean-structured",
    "Clean structured",
    "Crisp beds · architectural greens · simple stone",
    "Create a clean structured landscape with crisp bed geometry, architectural evergreen planting, simple stone, and controlled visual rhythm.",
    "complete_look",
    ["#31463a", "#72806b", "#aca89b", "#e5e2da"]
  ),
  direction(
    "warm-entertaining",
    "Warm entertaining",
    "Warm paving · layered lighting · comfortable planting",
    "Create a warm entertaining landscape with welcoming hardscape, comfortable planted edges, subtle layered lighting, and durable materials.",
    "complete_look",
    ["#785f46", "#b39774", "#5b684d", "#d8c5a9"]
  ),
];

const LANDSCAPE_REGIONS: RegionConfig[] = [
  region("planting", "Planting area", "Visible planting beds and shrubs.", [
    ["layered", "Layer the planting", "Change only the selected planting area to a layered, region-appropriate composition."],
    ["more-native", "Use more natives", "Change only the selected planting area to more region-appropriate native species."],
    ["less-busy", "Simplify it", "Simplify only the selected planting area with fewer, stronger plant groupings."],
    ["seasonal-color", "Seasonal color", "Add restrained seasonal color only within the selected planting area."],
  ]),
  region("hardscape", "Patio or path", "Visible paving, patio, or walkway surface.", [
    ["larger-pavers", "Larger pavers", "Change only the selected hardscape to larger-format pavers."],
    ["warmer-stone", "Warmer stone", "Warm only the selected hardscape material."],
    ["clean-border", "Clean border", "Add a simple clean border only to the selected hardscape."],
    ["soften-edges", "Soften edges", "Soften only the planted edges around the selected hardscape."],
  ]),
  region("lawn", "Lawn", "Visible turf or open planted ground plane.", [
    ["clean-shape", "Clean the shape", "Refine only the selected lawn into a cleaner, buildable shape."],
    ["reduce-lawn", "Reduce lawn", "Reduce only the selected lawn area with coordinated planting beds."],
    ["improve-coverage", "Improve coverage", "Improve the visual turf coverage only within the selected lawn."],
    ["native-groundcover", "Use groundcover", "Replace only the selected lawn with region-appropriate groundcover."],
  ]),
  region("lighting", "Outdoor lighting", "Visible path, step, tree, or architectural lighting.", [
    ["path-lights", "Subtle path lights", "Add subtle low-glare lighting only along the selected path."],
    ["uplight", "Uplight planting", "Add restrained uplighting only within the selected planted area."],
    ["step-lights", "Light the steps", "Add integrated lighting only to the selected steps."],
    ["softer", "Make it softer", "Soften only the selected outdoor lighting effect."],
  ]),
];

const GENERIC_DIRECTIONS: DirectionConfig[] = [
  direction(
    "warm-modern",
    "Warm modern",
    "Natural texture · warm neutrals · refined details",
    "Create a coordinated warm-modern direction using natural texture, warm neutrals, and restrained refined details.",
    "complete_look",
    ["#c8b294", "#8a735d", "#eee7dc", "#57534d"]
  ),
  direction(
    "clean-minimal",
    "Clean minimal",
    "Simple lines · light palette · low visual noise",
    "Create a coordinated clean-minimal direction with simple lines, a light palette, and low visual noise.",
    "complete_look",
    ["#f5f3ee", "#d5d5d0", "#a9adaa", "#ffffff"]
  ),
  direction(
    "bold-refined",
    "Bold refined",
    "Controlled contrast · premium materials · crisp details",
    "Create a coordinated bold-refined direction with controlled contrast, premium-looking materials, and crisp details.",
    "complete_look",
    ["#252b2e", "#777d7b", "#d9d3c8", "#b58a56"]
  ),
];

function isBathroom(profile: ResolvedServiceProfile, scope: string): boolean {
  return /bath|shower|tub|vanity|tile|flooring|fixture|plumbing/i.test(
    `${profile.service.label} ${profile.service.serviceName || ""} ${scope}`
  );
}

function isLandscape(profile: ResolvedServiceProfile, scope: string): boolean {
  return /landscap|garden|lawn|patio|walkway|hardscape|driveway|irrigation|tree|shrub|outdoor/i.test(
    `${profile.service.label} ${profile.service.serviceName || ""} ${scope}`
  );
}

function bathroomPreset(scope: string): ScopePreset {
  const key = scope.trim().toLowerCase();
  if (/tile|floor/.test(key)) {
    return {
      cardType: "material_palette",
      directions: BATHROOM_MATERIAL_DIRECTIONS,
      regions: [
        BATHROOM_REGIONS.shower_tile,
        BATHROOM_REGIONS.tub_surround,
        BATHROOM_REGIONS.flooring,
      ],
    };
  }
  if (/vanity|cabinet|fixture/.test(key)) {
    return {
      cardType: "product_style",
      directions: BATHROOM_PRODUCT_DIRECTIONS,
      regions: [
        BATHROOM_REGIONS.vanity,
        BATHROOM_REGIONS.countertop,
        BATHROOM_REGIONS.fixtures,
      ],
    };
  }
  if (/cosmetic|paint|lighting|hardware/.test(key)) {
    return {
      cardType: "color_palette",
      directions: BATHROOM_COLOR_DIRECTIONS,
      regions: [BATHROOM_REGIONS.walls, BATHROOM_REGIONS.fixtures],
    };
  }
  if (/shower|tub/.test(key)) {
    return {
      cardType: "product_style",
      directions: BATHROOM_MATERIAL_DIRECTIONS.map((item) => ({
        ...item,
        cardType: "product_style",
      })),
      regions: [
        BATHROOM_REGIONS.shower_tile,
        BATHROOM_REGIONS.tub_surround,
        BATHROOM_REGIONS.fixtures,
      ],
    };
  }
  return {
    cardType: "complete_look",
    directions: BATHROOM_COMPLETE_DIRECTIONS,
    regions: [
      BATHROOM_REGIONS.shower_tile,
      BATHROOM_REGIONS.tub_surround,
      BATHROOM_REGIONS.flooring,
      BATHROOM_REGIONS.vanity,
      BATHROOM_REGIONS.countertop,
      BATHROOM_REGIONS.walls,
      BATHROOM_REGIONS.fixtures,
    ],
  };
}

function genericRegions(profile: ResolvedServiceProfile): RegionConfig[] {
  const components = (profile.service.subcategoryComponents || []).slice(0, 5);
  if (components.length === 0) {
    return [
      region("main_focal_area", "Main focal area", "The primary editable feature nearest the selected point.", [
        ["warmer", "Make it warmer", "Update only the selected focal area with a warmer coordinated finish."],
        ["lighter", "Make it lighter", "Update only the selected focal area with a lighter coordinated finish."],
        ["modern", "Make it modern", "Update only the selected focal area to a restrained modern design."],
        ["premium", "More premium", "Upgrade only the selected focal area with a more refined finish."],
      ]),
    ];
  }
  return components.map((component) =>
    region(
      component.key || component.label.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
      component.label,
      `The visible ${component.label.toLowerCase()} nearest the selected point.`,
      [
        ["warmer", "Make it warmer", `Update only the selected ${component.label.toLowerCase()} with a warmer coordinated finish.`],
        ["lighter", "Make it lighter", `Update only the selected ${component.label.toLowerCase()} with a lighter coordinated finish.`],
        ["modern", "Make it modern", `Update only the selected ${component.label.toLowerCase()} to a restrained modern design.`],
        ["premium", "More premium", `Upgrade only the selected ${component.label.toLowerCase()} with a more refined finish.`],
      ]
    )
  );
}

export function resolveScopeExperienceConfig(
  profile: ResolvedServiceProfile,
  rawScope: string | null | undefined
): ScopeExperienceConfig {
  const scope = String(rawScope || profile.service.label || "project").trim();
  let preset: ScopePreset;
  if (isBathroom(profile, scope)) {
    preset = bathroomPreset(scope);
  } else if (isLandscape(profile, scope)) {
    preset = {
      cardType: "complete_look",
      directions: LANDSCAPE_DIRECTIONS,
      regions: LANDSCAPE_REGIONS,
    };
  } else {
    preset = {
      cardType: "complete_look",
      directions: GENERIC_DIRECTIONS,
      regions: genericRegions(profile),
    };
  }

  return {
    scopeId: scope,
    directionCardType: preset.cardType,
    directions: preset.directions.slice(0, 3),
    supportsFinishedVersions: profile.mode === "scene",
    supportedRegions: profile.mode === "tryon" ? [] : preset.regions,
    wholeDesignPreserveRules: [
      "Preserve the current camera position, crop, perspective, openings, and recognizable layout.",
      "Keep all visible features outside the selected scope unchanged unless required for a coherent buildable result.",
    ],
    regionEditPreserveRules: [
      "Change only the confirmed semantic region.",
      "Preserve every visible surface, object, fixture, opening, and material outside that region.",
    ],
  };
}

export function finishedVersionPrompt(
  config: ScopeExperienceConfig,
  directionConfig: DirectionConfig | null,
  index: number
): string {
  const interpretation = [
    "Create a restrained, broadly appealing finished interpretation with excellent material coordination.",
    "Create a more elevated finished interpretation with richer detail while remaining realistic and buildable.",
    "Create a confident, visually distinctive finished interpretation without changing the existing layout.",
  ][Math.max(0, Math.min(2, index))];
  const selected =
    directionConfig ||
    config.directions[Math.max(0, Math.min(config.directions.length - 1, index))] ||
    null;
  return [
    "Create a complete, presentation-ready version of this exact current space.",
    selected ? selected.prompt : "",
    interpretation,
    ...config.wholeDesignPreserveRules,
  ]
    .filter(Boolean)
    .join(" ");
}

export function premadeConceptPrompt(
  config: ScopeExperienceConfig,
  serviceName: string,
  scope: string,
  index: number
): string {
  const directions = config.directions.length > 0 ? config.directions : GENERIC_DIRECTIONS;
  const selected = directions[index % directions.length] || directions[0];
  const interpretation = [
    "restrained, approachable, and broadly appealing",
    "bright, polished, and quietly luxurious",
    "warm, tactile, and naturally detailed",
    "minimal, architectural, and low-clutter",
    "confident, contemporary, and visually distinctive",
    "timeless, refined, and highly buildable",
  ][index % 6];
  return [
    `Generate one photorealistic, fully finished ${scope} concept for ${serviceName}.`,
    selected?.prompt || "",
    `Make the result ${interpretation}.`,
    `Frame the composition tightly around the selected scope: ${scope}.`,
    "The selected service and scope must be the clear visual subject; adjacent room or property features may appear only as quiet context.",
    "Use realistic construction, professional residential photography, coherent perspective, natural lighting, and no people.",
    "Return one clean design image with no labels, text, split screens, collages, or watermarks.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function regionStylePreviewPrompt(
  serviceName: string,
  scope: string,
  region: RegionConfig,
  option: RegionOptionConfig
): string {
  return [
    `Create one photorealistic visual style reference for the ${region.label.toLowerCase()} in a ${scope} project for ${serviceName}.`,
    option.prompt,
    `Show the ${region.label.toLowerCase()} as the clear, close-framed subject so a homeowner can quickly understand this specific option.`,
    "Show only enough adjacent space to communicate scale and installation context.",
    "Use realistic residential materials, accurate construction details, natural lighting, and an editorial product-detail composition.",
    "Return one clean image with no labels, text, arrows, people, split screens, collages, or watermarks.",
  ]
    .filter(Boolean)
    .join(" ");
}

import type { ServiceOption } from "../v2/types";
import type { VisualPricingProject } from "./visual-pricing-types";

export type RefinementComponentSource = "curated" | "business" | "generated";

export type RefinementComponentOption = {
  id: string;
  label: string;
  instruction: string;
  priceImpact: number;
  imageUrl?: string | null;
  source: RefinementComponentSource;
};

export type RefinementComponentCategory = {
  id: string;
  label: string;
  libraryKey: string;
  source: RefinementComponentSource;
  options: RefinementComponentOption[];
};

const preserve = "Preserve the layout, lighting, camera angle, and every unrelated material.";

function option(
  id: string,
  label: string,
  change: string,
  priceImpact: number,
  source: RefinementComponentSource = "curated"
): RefinementComponentOption {
  return { id, label, instruction: `${change} ${preserve}`, priceImpact, source };
}

const CURATED_OPTIONS: Record<string, RefinementComponentOption[]> = {
  vanity: [
    option("light-oak", "Light oak", "Replace the current vanity with a light-oak double vanity.", 0.04),
    option("white-double", "White double", "Replace the current vanity with a clean white double vanity.", 0.03),
    option("floating", "Floating", "Replace the current vanity with a floating vanity with integrated storage.", 0.08),
    option("dark-wood", "Dark wood", "Replace the current vanity with a dark walnut vanity.", 0.05),
    option("natural-stone", "Natural stone", "Replace the current vanity with a furniture-style vanity and natural-stone top.", 0.11),
    option("more-ideas", "More ideas", "Create a distinct designer-recommended vanity that fits this project and budget.", 0.05, "generated"),
  ],
  shower: [
    option("frameless", "Frameless glass", "Replace the current shower with a frameless glass shower.", 0.06),
    option("walk-in", "Open walk-in", "Replace the current shower with an open walk-in shower.", 0.09),
    option("bench", "Built-in bench", "Add a built-in bench and coordinated niche to the current shower.", 0.07),
    option("double", "Double shower", "Upgrade the current shower with two coordinated shower fixtures.", 0.12),
    option("arched", "Arched entry", "Give the shower a softly arched entry with refined trim details.", 0.1),
    option("more-ideas", "More ideas", "Create a distinct designer-recommended shower that fits this project and budget.", 0.06, "generated"),
  ],
  tile: [
    option("zellige", "Handmade look", "Replace the main wall tile with softly varied handmade-look tile.", 0.07),
    option("large-format", "Large format", "Replace the main tile with large-format stone-look tile and minimal grout lines.", 0.05),
    option("dark-stone", "Dark stone", "Replace the main tile with rich dark natural-stone tile.", 0.11),
    option("warm-neutral", "Warm neutral", "Replace the main tile with warm neutral limestone-look tile.", 0.03),
    option("pattern", "Subtle pattern", "Replace the feature tile with a restrained geometric pattern.", 0.06),
    option("more-ideas", "More ideas", "Create a distinct designer-recommended tile palette that fits this project and budget.", 0.05, "generated"),
  ],
  flooring: [
    option("light-stone", "Light stone", "Replace the flooring with light natural-stone flooring.", 0.07),
    option("warm-stone", "Warm stone", "Replace the flooring with warm honed stone flooring.", 0.08),
    option("large-format", "Large format", "Replace the flooring with large-format tile and restrained grout lines.", 0.05),
    option("terrazzo", "Terrazzo", "Replace the flooring with refined neutral terrazzo.", 0.06),
    option("dark-tile", "Dark tile", "Replace the flooring with deep charcoal tile.", 0.04),
    option("more-ideas", "More ideas", "Create a distinct designer-recommended flooring direction that fits this project and budget.", 0.05, "generated"),
  ],
  fixtures: [
    option("brass", "Warm brass", "Replace the visible fixtures and hardware with coordinated warm brass finishes.", 0.03),
    option("nickel", "Brushed nickel", "Replace the visible fixtures and hardware with coordinated brushed nickel finishes.", 0.01),
    option("black", "Matte black", "Replace the visible fixtures and hardware with coordinated matte black finishes.", 0.02),
    option("bronze", "Dark bronze", "Replace the visible fixtures and hardware with coordinated dark bronze finishes.", 0.03),
    option("minimal", "Minimal", "Replace the visible fixtures with slim, minimal-profile fixtures.", 0.04),
    option("more-ideas", "More ideas", "Create a distinct designer-recommended fixture package that fits this project and budget.", 0.03, "generated"),
  ],
  lighting: [
    option("soft-sconces", "Soft sconces", "Replace the main decorative lighting with soft diffused sconces.", 0.02),
    option("statement", "Statement light", "Add one refined statement light appropriate to the space.", 0.05),
    option("warm-layered", "Warm layered", "Create warmer layered lighting with discreet ambient and task sources.", 0.06),
    option("minimal", "Minimal", "Replace the visible lighting with minimal architectural fixtures.", 0.03),
    option("vintage", "Vintage inspired", "Replace the decorative lighting with restrained vintage-inspired fixtures.", 0.04),
    option("more-ideas", "More ideas", "Create a distinct designer-recommended lighting direction that fits this project and budget.", 0.04, "generated"),
  ],
  mirrors: [
    option("arched", "Arched", "Replace the current mirror with a softly arched mirror.", 0.02),
    option("double", "Matching pair", "Replace the current mirror with a coordinated pair of mirrors.", 0.04),
    option("frameless", "Frameless", "Replace the current mirror with a minimal frameless mirror.", 0.01),
    option("dark-frame", "Dark frame", "Replace the current mirror with a slim dark-framed mirror.", 0.02),
    option("statement", "Statement", "Replace the current mirror with a sculptural statement mirror.", 0.04),
    option("more-ideas", "More ideas", "Create a distinct designer-recommended mirror treatment that fits this project and budget.", 0.03, "generated"),
  ],
};

function libraryKeyForLabel(label: string): string {
  const normalized = label.toLowerCase();
  if (/vanity|cabinet/.test(normalized)) return "vanity";
  if (/shower/.test(normalized)) return "shower";
  if (/tile/.test(normalized)) return "tile";
  if (/floor/.test(normalized)) return "flooring";
  if (/fixture|hardware|faucet/.test(normalized)) return "fixtures";
  if (/light/.test(normalized)) return "lighting";
  if (/mirror/.test(normalized)) return "mirrors";
  return normalized.replace(/[^a-z0-9]+/g, "-");
}

function genericOptions(category: string): RefinementComponentOption[] {
  const target = category.toLowerCase();
  return [
    option("light-natural", "Light natural", `Replace the current ${target} with a light, natural version.`, 0.03, "business"),
    option("warm", "Warm", `Replace the current ${target} with a warmer material direction.`, 0.04, "business"),
    option("clean-lined", "Clean-lined", `Replace the current ${target} with a cleaner-lined version.`, 0.03, "business"),
    option("dark-statement", "Dark statement", `Replace the current ${target} with a darker statement version.`, 0.05, "business"),
    option("premium", "Premium detail", `Upgrade the current ${target} with premium materials and detailing.`, 0.09, "business"),
    option("more-ideas", "More ideas", `Create a distinct designer-recommended ${target} that fits this project and budget.`, 0.04, "generated"),
  ];
}

export function refinementCategoryHeading(label: string): string {
  const normalized = label.trim().toLowerCase();
  if (/^(tile|flooring|fixtures|lighting|mirrors|planting|materials|finishes|details)$/.test(normalized)) {
    return `Choose ${normalized}`;
  }
  return `Choose a ${normalized}`;
}

export function refinementComponentsForProject(
  project: VisualPricingProject,
  service: ServiceOption | null
): RefinementComponentCategory[] {
  const context = [
    project.serviceLabel,
    project.scope,
    service?.industryName,
    service?.serviceSummary,
    ...(service?.subcategoryComponents || []).map((component) => component.label),
  ].filter(Boolean).join(" ").toLowerCase();

  let labels: string[];
  if (/bath|shower|tub|vanity/.test(context)) {
    labels = ["Shower", "Vanity", "Tile", "Flooring", "Fixtures", "Lighting"];
  } else if (/landscap|garden|yard|outdoor|patio/.test(context)) {
    labels = ["Patio", "Planting", "Lighting", "Fire feature", "Water feature", "Structures"];
  } else {
    const configured = (service?.subcategoryComponents || [])
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .map((component) => component.label.trim())
      .filter(Boolean);
    labels = configured.length >= 4
      ? configured.slice(0, 6)
      : [...configured, "Main feature", "Materials", "Finishes", "Lighting", "Details"].slice(0, 6);
  }

  return Array.from(new Set(labels)).slice(0, 6).map((label) => {
    const libraryKey = libraryKeyForLabel(label);
    const curated = CURATED_OPTIONS[libraryKey];
    return {
      id: libraryKey,
      label,
      libraryKey,
      source: curated ? "curated" : "business",
      options: curated || genericOptions(label),
    };
  });
}

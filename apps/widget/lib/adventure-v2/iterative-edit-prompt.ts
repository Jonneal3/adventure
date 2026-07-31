import type {
  ExperienceMode,
  StructuredDesignInstruction,
} from "@/components/adventure/v2/types";

export type V2IterativeEditPromptContext = {
  serviceName: string;
  scope: string;
  budget: number;
  mode: ExperienceMode;
  requestedChange: string;
  priorChanges?: string[];
  designInstruction?: StructuredDesignInstruction | null;
};

const STRUCTURAL_CHANGE_PATTERN =
  /\b(add|remove|replace|expand|enlarge|larger|smaller|move|relocate|layout|walk.?in|open up|build|demolish|dimensions?|structur|convert|reconfigure|extend|shorten|widen|narrow|curbless|doorless)\b|half[- ]?wall|pony wall|shower wall|wall opening|glass enclosure|partition wall/i;

function compact(value: string, max = 220): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

export function isStructuralSceneChange(requestedChange: string): boolean {
  return STRUCTURAL_CHANGE_PATTERN.test(compact(requestedChange, 800));
}

export function buildV2IterativeEditPrompt(params: V2IterativeEditPromptContext): string {
  const requestedChange = compact(params.requestedChange, 800);
  const instruction = params.designInstruction;
  const priorChanges = (params.priorChanges || [])
    .map((change) => compact(change))
    .filter(Boolean)
    .slice(-6);
  const structural = params.mode === "scene" && isStructuralSceneChange(requestedChange);
  const acceptedDirection =
    priorChanges.length > 0
      ? `Previously accepted directions already visible in the current image: ${priorChanges
          .map((change, index) => `${index + 1}) ${change}`)
          .join(" ")} Retain those decisions unless the latest request explicitly changes one of them.`
      : "Retain all design decisions already visible in the current image.";
  const preservation =
    params.mode === "tryon"
      ? [
          "Keep the same person, identity, face, body proportions, pose, camera viewpoint, and natural anatomy.",
          "Keep every accepted styling choice already visible unless the latest request explicitly replaces it.",
        ].join(" ")
      : params.mode === "placement"
        ? [
            "Keep the same scene geometry, camera viewpoint, product identity, perspective, scale, lighting, and shadows.",
            "Integrate only the requested change into the existing composition.",
          ].join(" ")
        : [
            "Return the same space from the exact same camera position, crop, perspective, and lighting logic.",
            "Keep the existing room layout, openings, fixtures, finishes, colors, and objects exactly as they appear except where the latest request requires a change.",
            structural
              ? "Treat this as a precise architectural geometry edit. Make the requested construction physically buildable with believable wall thickness, clean junctions, correct perspective, functional clearances, and coherent material transitions."
              : "Treat this as a focused local edit and preserve the surrounding architecture and materials.",
          ].join(" ");
  const structuredDirection = instruction
    ? [
        `Edit mode: ${instruction.mode}.`,
        instruction.directionLabel
          ? `Selected design direction: ${compact(instruction.directionLabel, 100)}.`
          : "",
        instruction.targetRegion?.label
          ? `Confirmed semantic target region: ${compact(instruction.targetRegion.label, 120)}.`
          : "",
        instruction.optionLabel
          ? `Selected regional option: ${compact(instruction.optionLabel, 120)}.`
          : "",
        instruction.materials?.length
          ? `Requested materials: ${instruction.materials.map((item) => compact(item, 80)).join(", ")}.`
          : "",
        instruction.colors?.length
          ? `Requested colors: ${instruction.colors.map((item) => compact(item, 80)).join(", ")}.`
          : "",
        instruction.fixtures?.length
          ? `Requested fixtures: ${instruction.fixtures.map((item) => compact(item, 80)).join(", ")}.`
          : "",
        instruction.affectedRegions?.length
          ? `Allowed affected regions: ${instruction.affectedRegions.map((item) => compact(item, 80)).join(", ")}.`
          : "",
        instruction.preserve?.length
          ? `Explicit preservation rules: ${instruction.preserve.map((item) => compact(item, 120)).join("; ")}.`
          : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  const regionConstraint =
    instruction?.mode === "target_region" && instruction.targetRegion?.label
      ? `This is a localized edit. Change only the confirmed ${compact(
          instruction.targetRegion.label,
          120
        )} region. Do not restyle, replace, move, recolor, or regenerate any other part of the image.`
      : "";

  return [
    "EDIT THE SUPPLIED CURRENT IMAGE. The supplied image is the single authoritative current design and the output must be its next revision.",
    `Latest request—highest priority: "${requestedChange}".`,
    `Project: ${compact(params.serviceName, 180)}. Original pricing scope: ${compact(params.scope, 240)}. Budget context: ${params.budget}.`,
    "The latest request is allowed to expand or override the original pricing scope; follow the latest request exactly and preserve everything it does not affect.",
    structuredDirection,
    regionConstraint,
    acceptedDirection,
    preservation,
    "Produce one coherent, photorealistic professional result with realistic construction detail and clean, continuous geometry. Return only the edited image without text, labels, comparison panels, or watermarks.",
  ].join(" ");
}

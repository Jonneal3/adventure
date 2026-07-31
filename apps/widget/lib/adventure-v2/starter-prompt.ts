import type { ExperienceMode } from "@/components/adventure/v2/types";

export type V2StarterPromptContext = {
  serviceName: string;
  industryName: string;
  serviceSummary: string;
  scope: string;
  budget: number;
  mode: ExperienceMode;
  components: string[];
};

const SCOPE_TOKEN_STOPWORDS = new Set([
  "all",
  "area",
  "complete",
  "entire",
  "focused",
  "full",
  "only",
  "preview",
  "project",
  "scope",
  "the",
  "update",
  "whole",
]);

function tokenRoots(value: string): string[] {
  return (value.toLowerCase().match(/[a-z0-9]+/g) || [])
    .map((token) => {
      if (token.length > 5 && token.endsWith("ing")) return token.slice(0, -3);
      if (token.length > 4 && token.endsWith("es")) return token.slice(0, -2);
      if (token.length > 3 && token.endsWith("s")) return token.slice(0, -1);
      return token;
    })
    .filter((token) => token.length > 2 && !SCOPE_TOKEN_STOPWORDS.has(token));
}

function scopeRelevantComponents(scope: string, components: string[]): string[] {
  if (/\b(full|complete|entire|whole|all|multiple)\b/i.test(scope)) return components;
  const scopeTokens = new Set(tokenRoots(scope));
  if (scopeTokens.size === 0) return [];
  return components.filter((component) =>
    tokenRoots(component).some((token) => scopeTokens.has(token))
  );
}

function categoryBaseline(params: V2StarterPromptContext): string {
  const searchable = [
    params.industryName,
    params.serviceName,
    params.serviceSummary,
    params.scope,
    ...params.components,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (/\b(bath|bathroom|shower|tub|toilet|vanity)\b/.test(searchable)) {
    return [
      "Bathroom baseline: use plain white painted walls, simple white ceramic fixtures, a stock flat-front white vanity,",
      "a plain white or very light gray Formica-style laminate counter with no stone veining, basic chrome hardware,",
      "a standard frameless mirror, clear glass or a plain white shower curtain, and basic white or pale-gray tile only where required.",
      "Do not add wood tones, marble, terrazzo, mosaic or accent tile, wallpaper, statement lighting, decorative objects, plants, or spa styling.",
    ].join(" ");
  }

  if (/\b(landscap|yard|garden|lawn|patio|deck|outdoor|hardscap|pool)\b/.test(searchable)) {
    return [
      "Landscape baseline: show an ordinary, clean residential yard appropriate to the selected scope—level green lawn,",
      "a plain wood boundary fence, neutral daylight, and only the simplest concrete or basic paver surface when the service requires it.",
      "Use sparse, common planting only when needed to explain the scope.",
      "Do not add a pool, pergola, fire feature, outdoor kitchen, luxury furniture, elaborate planting beds, dramatic lighting, or resort styling unless explicitly required by the selected service and scope.",
    ].join(" ");
  }

  if (/\b(kitchen|interior|bedroom|living room|dining room|office|basement|closet|cabinet|floor|paint)\b/.test(searchable)) {
    return [
      "Interior baseline: use plain white or off-white painted walls, simple flat-front white stock cabinetry where required,",
      "plain white or pale-gray laminate work surfaces, basic light neutral flooring, standard chrome or brushed-nickel hardware,",
      "and simple functional lighting.",
      "Do not add décor, art, plants, styled accessories, luxury furniture, wood feature walls, stone veining, bold patterns, accent colors, or statement lighting.",
    ].join(" ");
  }

  if (/\b(exterior|roof|siding|facade|façade|window|door|driveway|garage|fence)\b/.test(searchable)) {
    return [
      "Exterior baseline: use a straightforward ordinary property with plain white or very light neutral finishes,",
      "standard stock components, simple geometry, neutral daylight, and no decorative upgrades.",
      "Do not add premium masonry, ornate trim, dramatic lighting, luxury landscaping, styled vehicles, décor, or architectural embellishment.",
    ].join(" ");
  }

  return [
    "Category baseline: render the most ordinary, entry-level, stock version of every service-relevant element.",
    "Prefer white, off-white, and very light neutral gray; use simple shapes, standard materials, basic hardware, and neutral daylight.",
    "Do not introduce décor, luxury finishes, premium materials, visual themes, accent colors, patterns, statement features, or editorial styling.",
  ].join(" ");
}

export function buildV2StarterPrompt(params: V2StarterPromptContext): string {
  const relevantComponents = scopeRelevantComponents(params.scope, params.components);
  const componentContext =
    relevantComponents.length > 0
      ? `Scope-relevant components only, each shown in its simplest basic form: ${relevantComponents.join(", ")}.`
      : "Do not infer additional service components. Include only the minimum elements needed to make the selected scope understandable.";
  const scopeBoundary = [
    `HARD SCOPE BOUNDARY: create a starter concept for exactly "${params.scope}" and nothing broader.`,
    "Treat the selected scope as an exclusive boundary: do not design, replace, upgrade, decorate, or feature any adjacent service area.",
    "Make the selected scope the only designed focal area. Show only the minimum surrounding environment needed for credible context,",
    "and keep that surrounding context plain, background-only, visually subordinate, and outside the concept.",
    "If a service component is not explicitly named by or unambiguously contained within the selected scope, omit it from the concept.",
  ].join(" ");
  const context = [
    params.industryName ? `Industry: ${params.industryName}.` : "",
    `Service: ${params.serviceName}.`,
    params.serviceSummary ? `Service context (use for functional relevance, not aesthetics): ${params.serviceSummary}` : "",
    `Selected scope: ${params.scope}.`,
    scopeBoundary,
    `Budget context: ${params.budget}. Use budget only to keep the scope plausible; never use it to upgrade finishes or styling.`,
    componentContext,
  ]
    .filter(Boolean)
    .join(" ");

  if (params.mode === "tryon") {
    return [
      context,
      "Create one realistic baseline try-on using the supplied person and exact product.",
      "Preserve the person's identity, face, body proportions, pose, and natural anatomy, and preserve the product's recognizable design.",
      "Keep lighting and background plain and neutral. Do not add accessories, coordinated styling, glamour treatment, or any change that was not supplied.",
    ].join(" ");
  }

  if (params.mode === "placement") {
    return [
      context,
      "Create one realistic baseline placement using the supplied scene and exact product.",
      "Preserve scene geometry and product identity while matching perspective, scale, shadows, and lighting.",
      "Do not redesign the surrounding scene or add coordinated décor, premium finishes, accessories, or unrelated objects.",
    ].join(" ");
  }

  return [
    context,
    "STARTER CANVAS, NOT A FINISHED DESIGN: create one deliberately plain, minimally designed, photorealistic starting concept tightly framed around only the selected scope.",
    "Every visible choice must be builder-basic, stock, low-decoration, and easy for the visitor to change later.",
    categoryBaseline(params),
    "Avoid aspirational design inspiration, cohesive style direction, staged décor, people, text, labels, logos, watermarks, and editorial effects.",
  ].join(" ");
}

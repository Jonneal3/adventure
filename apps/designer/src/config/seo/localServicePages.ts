import { SITE_URL } from "@/config/services";
import { toSlug } from "@/utils/slug";

export type LocalSeoCity = {
  city: string;
  state: string; // 2-letter, e.g. "TX"
  marketContextSentences: string[]; // 1–3 short, declarative sentences
  pricingFactors: string[]; // used to answer "what does it cost" without guessing numbers
  buyerObjections: string[]; // common friction points for this market
};

export type LocalSeoUseCase = {
  title: string;
  description: string;
  conversionBenefit: string;
  kind: "primary" | "secondary";
};

export type LocalSeoService = {
  slug: string;
  name: string; // e.g. "Fence Installation"
  outcome: string; // used in hero subhead
  definition: string; // must be self-contained and quotable
  useCases: LocalSeoUseCase[]; // at least 2 (primary + secondary)
  exampleScenarios: string[]; // rotated examples to avoid duplication
  comparison: {
    vsAiGenerators: string[]; // declarative bullets
    vsQuoteForms: string[]; // declarative bullets
  };
};

export function toCityStateSlug(city: string, state: string) {
  return `${toSlug(city)}-${String(state || "").toLowerCase()}`;
}

export function parseCityStateSlug(cityState: string) {
  const parts = String(cityState || "").split("-").filter(Boolean);
  if (parts.length < 2) return null;
  const citySlug = parts.slice(0, -1).join("-");
  const state = parts[parts.length - 1].toUpperCase();
  return { citySlug, state };
}

export const LOCAL_SEO_CITIES: LocalSeoCity[] = [
  {
    buyerObjections: ["uncertainty about final appearance", "fear of overpaying", "hesitation to schedule an onsite visit"],
    city: "Dallas",
    marketContextSentences: [
      "In Dallas, buyers often want to see the finished look before they agree to a site visit or estimate.",
      "Visual confirmation matters when style and price swing based on material, layout, and neighborhood norms.",
    ],
    pricingFactors: ["material choice", "linear footage", "site access", "permit requirements"],
    state: "TX",
  },
  {
    buyerObjections: ["too many style options", "worry about delays", "unclear scope before pricing"],
    city: "Austin",
    marketContextSentences: [
      "In Austin, homeowners compare options quickly and expect a clear visual direction before committing.",
      "Projects that look simple on paper can vary widely once design preferences and site constraints are visible.",
    ],
    pricingFactors: ["design complexity", "material availability", "HOA constraints", "timeline"],
    state: "TX",
  },
  {
    buyerObjections: ["concerns about durability", "uncertainty about shade and comfort", "price sensitivity across materials"],
    city: "Phoenix",
    marketContextSentences: [
      "In Phoenix, sun exposure and outdoor durability influence decisions as much as aesthetics.",
      "Buyers want to confirm the look in real photos because color and shade read differently in bright conditions.",
    ],
    pricingFactors: ["heat-resistant materials", "shade coverage", "site prep", "wind loads"],
    state: "AZ",
  },
  {
    buyerObjections: ["maintenance concerns", "fear of choosing the wrong finish", "uncertainty about long-term performance"],
    city: "Tampa",
    marketContextSentences: [
      "In Tampa, weather, moisture, and long-term maintenance are part of the buying decision.",
      "Customers often ask for a preview because finishes and styles can look very different once installed and exposed.",
    ],
    pricingFactors: ["moisture resistance", "wind rating", "maintenance needs", "site conditions"],
    state: "FL",
  },
  {
    buyerObjections: ["uncertainty about fit with the home", "concerns about weather impact", "hesitation to start without clarity"],
    city: "Denver",
    marketContextSentences: [
      "In Denver, buyers balance curb appeal with practicality, especially when seasons change the look of a space.",
      "A visual preview reduces hesitation when the final result depends on layout, elevation, and material contrast.",
    ],
    pricingFactors: ["snow load considerations", "grading", "material choice", "access and hauling"],
    state: "CO",
  },
];

export const LOCAL_SEO_SERVICES: LocalSeoService[] = [
  {
    comparison: {
      vsAiGenerators: [
        "Generic AI images are not anchored to the customer’s real property photo, so buyers cannot verify fit.",
        "Image generators optimize for novelty, not for repeatable, sales-ready options and constraints.",
        "A sales visualization flow captures intent and choices that you can quote against.",
      ],
      vsQuoteForms: [
        "A quote form collects text, not alignment, so buyers submit vague requests and churn later.",
        "Visualization clarifies scope earlier, which improves lead quality and reduces ghosting.",
        "A preview produces a concrete reference that sales and installation can share.",
      ],
    },
    definition:
      "AI fence visualization is a pre-design workflow that allows a customer to preview fence styles, heights, and layouts in real photos of their yard before pricing or installation.",
    exampleScenarios: [
      "Compare cedar vs vinyl on a real backyard photo.",
      "Preview gate styles and placement on the actual side yard.",
      "Show a corner-lot layout and height choice before measuring.",
    ],
    name: "Fence Installation",
    outcome: "the fence style and layout on their actual property",
    slug: "fence-installation",
    useCases: [
      {
        conversionBenefit: "More estimate requests from serious buyers and fewer time-wasting visits.",
        description:
          "Show a homeowner what a privacy fence, picket fence, or horizontal design looks like on their own yard photo.",
        kind: "primary",
        title: "Pre-sell the exact look before the estimate",
      },
      {
        conversionBenefit: "Fewer revisions, fewer surprises, and smoother handoff from sales to install.",
        description:
          "Confirm gate placement, height, and material style visually so the buyer knows what they are approving.",
        kind: "secondary",
        title: "Align on scope to prevent change orders",
      },
    ],
  },
  {
    comparison: {
      vsAiGenerators: [
        "Generic AI images do not preserve exact yard geometry, so buyers cannot trust sizing and placement.",
        "Sales visualization prioritizes consistent options and constraints over artistic variation.",
        "A structured flow captures what the buyer chose so pricing matches the preview.",
      ],
      vsQuoteForms: [
        "A quote form cannot show shade coverage or roof style, so customers stay uncertain.",
        "Visualization reduces decision friction and improves follow-through after the first contact.",
        "Previews help the customer justify the spend internally before the estimate.",
      ],
    },
    definition:
      "AI pergola and patio cover visualization is a pre-design workflow that shows shade structure options in a customer’s backyard photo to confirm style and placement before pricing and construction.",
    exampleScenarios: [
      "Compare modern flat-roof vs traditional pergola styles.",
      "Preview shade coverage over a patio seating area.",
      "Show post placement options around doors and windows.",
    ],
    name: "Pergola & Patio Covers",
    outcome: "shade coverage, style, and scale before scheduling an estimate",
    slug: "pergola-patio-cover",
    useCases: [
      {
        conversionBenefit: "Higher intent leads because the buyer commits to a direction before the visit.",
        description:
          "Preview a pergola, pavilion, or patio cover at realistic size so customers understand footprint and height.",
        kind: "primary",
        title: "Show scale and placement in the backyard photo",
      },
      {
        conversionBenefit: "Shorter sales cycles and fewer back-and-forth changes after quoting.",
        description:
          "Confirm roof style, post placement, and overall look early so fewer iterations are needed later.",
        kind: "secondary",
        title: "Reduce design revisions during approval",
      },
    ],
  },
  {
    comparison: {
      vsAiGenerators: [
        "Generic AI images create new rooms, but buyers need a preview inside their real space.",
        "Sales visualization focuses on faithful placement and repeatable options, not fantasy staging.",
        "The output supports a purchase decision because it is tied to the customer’s photo.",
      ],
      vsQuoteForms: [
        "A form cannot communicate size and placement, so customers stay uncertain and delay buying.",
        "Visualization answers “will it look right?” before a sales call or installation schedule.",
        "Previews reduce back-and-forth messages and speed up approvals.",
      ],
    },
    definition:
      "AI artwork visualization is a placement workflow that previews art, frames, and wall decor in real photos of a room before purchase, printing, or installation.",
    exampleScenarios: [
      "Preview a 24×36 vs 30×40 print above a sofa.",
      "Compare black vs natural wood frame styles in the same photo.",
      "Show a three-piece gallery layout on a hallway wall.",
    ],
    name: "Artwork & Wall Decor",
    outcome: "how a piece looks on their actual wall before buying or booking installation",
    slug: "artwork-wall-decor",
    useCases: [
      {
        conversionBenefit: "Higher conversion and fewer abandoned carts or quote requests.",
        description:
          "Show multiple sizes, frame styles, and layouts on the customer’s wall so they can commit confidently.",
        kind: "primary",
        title: "Reduce indecision at the point of purchase",
      },
      {
        conversionBenefit: "Lower return rates and fewer “it looked different” complaints.",
        description:
          "Confirm color balance, scale, and placement so what arrives matches what the buyer approved.",
        kind: "secondary",
        title: "Prevent returns by setting expectations",
      },
    ],
  },
  {
    comparison: {
      vsAiGenerators: [
        "Generic AI makes dramatic makeovers but often ignores real cabinet lines and layout constraints.",
        "Sales visualization keeps the preview anchored to the real photo so the direction is actionable.",
        "Captured choices translate directly into a quote and a selection list.",
      ],
      vsQuoteForms: [
        "A quote form produces vague scope and mismatched expectations.",
        "Visualization creates alignment on finishes and direction before pricing, which reduces churn.",
        "Previews improve communication between homeowner, salesperson, and project manager.",
      ],
    },
    definition:
      "AI kitchen remodel visualization is a pre-design workflow that previews layout and finish direction in a homeowner’s kitchen photo before pricing discussions or demolition.",
    exampleScenarios: [
      "Compare white shaker vs modern slab cabinets in one photo.",
      "Preview quartz color options and a backsplash style.",
      "Show an island layout direction before final measurements.",
    ],
    name: "Kitchen Remodeling",
    outcome: "the direction of the remodel before requesting pricing",
    slug: "kitchen-remodeling",
    useCases: [
      {
        conversionBenefit: "Better lead quality and fewer “just curious” consultations.",
        description:
          "Show cabinet style, countertop color, and backsplash direction so you quote against a clear target.",
        kind: "primary",
        title: "Qualify leads by confirming direction early",
      },
      {
        conversionBenefit: "Faster approvals and smoother project kickoff after the contract.",
        description:
          "Visuals make finish selection tangible, which reduces rounds of changes and decision fatigue.",
        kind: "secondary",
        title: "Reduce revisions during selection and approval",
      },
    ],
  },
];

export function getLocalSeoCityBySlug(cityStateSlug: string) {
  const parsed = parseCityStateSlug(cityStateSlug);
  if (!parsed) return null;
  return (
    LOCAL_SEO_CITIES.find((c) => toCityStateSlug(c.city, c.state) === cityStateSlug.toLowerCase()) || null
  );
}

export function getLocalSeoServiceBySlug(serviceSlug: string) {
  const slug = String(serviceSlug || "").trim();
  return LOCAL_SEO_SERVICES.find((s) => s.slug === slug) || null;
}

export function isLocalSeoPageIndexable(serviceSlug: string, cityStateSlug: string) {
  const city = getLocalSeoCityBySlug(cityStateSlug);
  const service = getLocalSeoServiceBySlug(serviceSlug);
  if (!service || !city) return false;
  if (!service.definition || !service.outcome) return false;
  const primary = service.useCases.find((u) => u.kind === "primary");
  const secondary = service.useCases.find((u) => u.kind === "secondary");
  if (!primary || !secondary) return false;
  if (!Array.isArray(city.marketContextSentences) || city.marketContextSentences.length < 1) return false;
  return true;
}

export function getIndexableLocalSeoPagePaths() {
  const out: string[] = [];
  for (const service of LOCAL_SEO_SERVICES) {
    for (const city of LOCAL_SEO_CITIES) {
      const cityState = toCityStateSlug(city.city, city.state);
      if (!isLocalSeoPageIndexable(service.slug, cityState)) continue;
      out.push(`/services/${service.slug}/ai-visualization/${cityState}`);
    }
  }
  return out;
}

export function toAbsoluteUrl(pathname: string) {
  const p = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${SITE_URL}${p}`;
}


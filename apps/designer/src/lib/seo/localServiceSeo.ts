import type { Metadata } from "next";
import {
  type LocalSeoCity,
  type LocalSeoService,
  toAbsoluteUrl,
  toCityStateSlug,
} from "@/config/seo/localServicePages";

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickDistinct<T>(seedKey: string, items: T[], count: number): T[] {
  const list = [...(items || [])];
  const rnd = mulberry32(hashString(seedKey));
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list.slice(0, Math.max(0, Math.min(count, list.length)));
}

export function buildLocalServiceHeroTitle(service: LocalSeoService, city: LocalSeoCity) {
  return `AI ${service.name} Visualization for ${city.city}, ${city.state}`;
}

export function buildLocalServiceHeroSubhead(service: LocalSeoService) {
  return `Let customers preview ${service.outcome} before requesting a quote.`;
}

export function toGenericLocalSeoCity(city: string, state: string): LocalSeoCity {
  const location = `${city}, ${state}`;
  return {
    city,
    state,
    marketContextSentences: [
      `In ${location}, buyers often want a clear visual preview before they commit to an estimate or consultation.`,
      `A pre-design preview reduces uncertainty when final appearance and scope are hard to picture from a form alone.`,
    ],
    pricingFactors: ["scope", "materials", "site conditions", "timeline"],
    buyerObjections: ["uncertainty about final appearance", "unclear scope before pricing", "hesitation to schedule a visit"],
  };
}

export function buildLocalMarketContext(service: LocalSeoService, city: LocalSeoCity) {
  const seedKey = `${service.slug}:${toCityStateSlug(city.city, city.state)}:market`;
  const picked = pickDistinct(seedKey, city.marketContextSentences, 2);
  return picked.length > 0 ? picked : city.marketContextSentences.slice(0, 1);
}

export function pickExampleScenario(service: LocalSeoService, city: LocalSeoCity) {
  const seedKey = `${service.slug}:${toCityStateSlug(city.city, city.state)}:example`;
  const picked = pickDistinct(seedKey, service.exampleScenarios, 1);
  return picked[0] || "";
}

export function buildLocalFaqs(service: LocalSeoService, city: LocalSeoCity) {
  const location = `${city.city}, ${city.state}`;
  const costFactors = city.pricingFactors.slice(0, 4).filter(Boolean);
  const factorsText =
    costFactors.length > 0 ? `Factors that commonly move price in ${location} include ${costFactors.join(", ")}.` : "";
  const objections = pickDistinct(
    `${service.slug}:${toCityStateSlug(city.city, city.state)}:objections`,
    city.buyerObjections,
    2,
  );

  const faqs = [
    {
      question: `What is AI ${service.name.toLowerCase()} visualization?`,
      answer: service.definition,
    },
    {
      question: `Is this an estimate or a final design?`,
      answer:
        "It is a pre-design preview used to align on direction before pricing. The output clarifies what the buyer expects, so an estimate can be more accurate and faster to produce.",
    },
    {
      question: `How much does ${service.name.toLowerCase()} usually cost in ${location}?`,
      answer:
        `Pricing depends on scope and constraints, not just the category name. ${factorsText} A preview helps you narrow choices early so the quote matches what the customer actually wants.`,
    },
    {
      question: `Will this help reduce revisions and indecision?`,
      answer:
        "Yes. When the buyer can see realistic outcomes in their own photo, they make fewer speculative requests and commit to a direction earlier, which reduces back-and-forth changes.",
    },
    {
      question: `Why not just use an AI image generator?`,
      answer:
        "Image generators produce novel images, but sales requires alignment. A sales visualization preview stays anchored to the customer’s real photo and captures the choices you need to quote and deliver consistently.",
    },
    {
      question: `What buyer objections does this address in ${location}?`,
      answer:
        objections.length > 0
          ? `It reduces hesitation caused by ${objections.join(" and ")} by turning abstract options into a clear preview before the customer commits.`
          : `It reduces hesitation by turning abstract options into a clear preview before the customer commits.`,
    },
  ];

  return faqs;
}

export function buildLocalServiceMetadata(args: {
  service: LocalSeoService;
  city: LocalSeoCity;
  indexable?: boolean;
}) {
  const { service, city, indexable = true } = args;
  const title = buildLocalServiceHeroTitle(service, city);
  const description = `${buildLocalServiceHeroSubhead(service)} ${buildLocalMarketContext(service, city)[0] || ""}`.trim();
  const pathname = `/services/${service.slug}/ai-visualization/${toCityStateSlug(city.city, city.state)}`;
  const url = toAbsoluteUrl(pathname);

  const metadata: Metadata = {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      type: "website",
      url,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
    robots: indexable ? { index: true, follow: true } : { index: false, follow: true },
  };

  return metadata;
}

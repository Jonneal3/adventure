import { toSlug } from "@/utils/slug";
import { US_CITIES_20K, type UsCity20k } from "@/config/seo/usCities20k.generated";

const US_CITY_20K_BY_SLUG = new Map<string, UsCity20k>(
  US_CITIES_20K.map((c) => [c.cityStateSlug, c]),
);

export type UsCity20kLookup = Pick<UsCity20k, "city" | "state" | "population" | "geonameId" | "lat" | "lng"> & {
  cityStateSlug: string;
};

const US_STATE_ABBREVIATIONS = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
]);

function titleCaseCitySlug(citySlug: string) {
  return String(citySlug || "")
    .split("-")
    .filter(Boolean)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ")
    .trim();
}

function parseCityStateSlugLoose(cityStateSlug: string) {
  const key = String(cityStateSlug || "").toLowerCase();
  const parts = key.split("-").filter(Boolean);
  if (parts.length < 2) return null;
  const state = parts[parts.length - 1].toUpperCase();
  const citySlug = parts.slice(0, -1).join("-");
  if (!US_STATE_ABBREVIATIONS.has(state)) return null;
  return { citySlug, state };
}

export function getUsCity20kBySlug(cityStateSlug: string): UsCity20kLookup | null {
  const key = String(cityStateSlug || "").toLowerCase();
  const exact = US_CITY_20K_BY_SLUG.get(key) as UsCity20kLookup | undefined;
  if (exact) return exact;

  // Fallback: only when the generated GeoNames list is empty (placeholder file).
  // This keeps dev usable before generation, but avoids rendering nonsense slugs once the list exists.
  if (US_CITIES_20K.length > 0) return null;

  // These fallback cities should be treated as non-indexable (handled by page metadata).
  const parsed = parseCityStateSlugLoose(key);
  if (!parsed) return null;

  return {
    city: titleCaseCitySlug(parsed.citySlug),
    cityStateSlug: key,
    geonameId: 0,
    lat: 0,
    lng: 0,
    population: 0,
    state: parsed.state,
  };
}

export function toUsCity20kSlug(city: string, state: string) {
  return `${toSlug(city)}-${String(state || "").toLowerCase()}`;
}

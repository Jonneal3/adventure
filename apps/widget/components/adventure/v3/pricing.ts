import type { ServiceOption } from "../v2/types";
import type { V3CostDrivers, V3PlanningRange } from "./types";

export type PricingBounds = {
  min: number;
  max: number;
  currency: string;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundPrice(value: number): number {
  const increment = value < 15_000 ? 500 : value < 75_000 ? 1_000 : 2_500;
  return Math.max(increment, Math.round(value / increment) * increment);
}

function scopeMultiplier(scope: string | null): number {
  const value = String(scope || "").toLowerCase();
  if (/luxury|full|complete|primary|layout|plumbing|addition/.test(value)) return 1;
  if (/multiple|shower|tub|patio|walkway|cabinet|vanity|fixture/.test(value)) return 0.76;
  if (/tile|floor|paint|cosmetic|refresh|lighting|hardware|focused|one/.test(value)) return 0.56;
  return 0.72;
}

function serviceMultiplier(service: ServiceOption | null): number {
  const value = `${service?.label || ""} ${service?.serviceSummary || ""}`.toLowerCase();
  if (/luxury|addition|complete|full/.test(value)) return 1.05;
  if (/repair|refresh|paint|prun|lighting/.test(value)) return 0.78;
  return 0.92;
}

function componentLabel(component: string): string {
  return component.replace(/^update\s+/i, "").trim();
}

export function configuredPricingBounds(instance: any): PricingBounds {
  const root = instance?.config && typeof instance.config === "object" ? instance.config : {};
  const legacy = root?.aiFormConfig && typeof root.aiFormConfig === "object" ? root.aiFormConfig : {};
  const configured = root.previewPricing ?? legacy.previewPricing ?? {};
  const rawMin = Number(configured.totalMin);
  const rawMax = Number(configured.totalMax);
  const min = Number.isFinite(rawMin) && rawMin > 0 ? rawMin : 12_000;
  const maxCandidate = Number.isFinite(rawMax) && rawMax > min ? rawMax : 55_000;
  return {
    min,
    max: Math.max(min + 5_000, maxCandidate),
    currency: typeof configured.currency === "string" ? configured.currency : "USD",
  };
}

export function generalServiceRange(
  bounds: PricingBounds,
  service: ServiceOption | null
): V3PlanningRange {
  const multiplier = serviceMultiplier(service);
  const min = roundPrice(bounds.min * multiplier);
  const max = roundPrice(bounds.max * Math.min(1.08, multiplier + 0.08));
  return {
    totalMin: Math.min(min, max),
    totalMax: Math.max(min, max),
    currency: bounds.currency,
    assumptions: ["Typical project scope", "Standard site conditions"],
    increases: ["Structural or layout changes", "Premium custom selections"],
    reductions: ["Keeping the existing layout", "Focused rather than full replacement"],
    source: "configured_planning_range",
  };
}

export function calculatePlanningRange(params: {
  bounds: PricingBounds;
  service: ServiceOption | null;
  scope: string | null;
  costDrivers: V3CostDrivers;
}): V3PlanningRange {
  const { bounds, service, scope, costDrivers } = params;
  const finishMultiplier = {
    standard: 0.88,
    premium: 1,
    luxury: 1.24,
  }[costDrivers.finishLevel];
  const sizeMultiplier = {
    compact: 0.82,
    average: 1,
    large: 1.2,
  }[costDrivers.size];
  const layoutMultiplier = costDrivers.layout === "change" ? 1.22 : 0.94;
  const includedComponentMultiplier = 1 + clamp(costDrivers.components.length - 1, 0, 5) * 0.055;
  const baseMultiplier =
    scopeMultiplier(scope) *
    serviceMultiplier(service) *
    finishMultiplier *
    sizeMultiplier *
    layoutMultiplier *
    includedComponentMultiplier;

  const min = roundPrice(
    clamp(bounds.min * baseMultiplier, bounds.min * 0.38, bounds.max * 1.12)
  );
  const max = roundPrice(
    clamp(bounds.max * baseMultiplier, min + 2_500, bounds.max * 1.42)
  );
  const assumptions = [
    scope || service?.label || "Selected project",
    costDrivers.layout === "keep" ? "Existing layout retained" : "Layout changes included",
    `${costDrivers.finishLevel[0].toUpperCase()}${costDrivers.finishLevel.slice(1)} finish level`,
    `${costDrivers.size[0].toUpperCase()}${costDrivers.size.slice(1)} project size`,
    ...(costDrivers.components.length > 0
      ? [`Includes ${costDrivers.components.map(componentLabel).join(", ")}`]
      : []),
    "Standard access and site conditions",
  ];
  const increases = [
    ...(costDrivers.layout === "keep" ? ["Moving plumbing, walls, or major utilities"] : []),
    ...(costDrivers.finishLevel !== "luxury" ? ["Custom cabinetry, stone, or designer fixtures"] : []),
    "Hidden damage, permit requirements, or difficult access",
  ];
  const reductions = [
    ...(costDrivers.layout === "change" ? ["Keeping the existing layout and utility locations"] : []),
    ...(costDrivers.finishLevel !== "standard" ? ["Choosing standard in-stock finishes"] : []),
    "Reducing the number of replaced components",
  ];

  return {
    totalMin: Math.min(min, max),
    totalMax: Math.max(min, max),
    currency: bounds.currency,
    assumptions,
    increases,
    reductions,
    source: "configured_planning_range",
  };
}

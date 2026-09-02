import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  galleryPricingLabel,
  isReadyGalleryEnrichment,
  localizeGalleryPricing,
  type GalleryPricingResult,
} from "../components/adventure/v8/galleryEnrichment";


const ready = {
  version: 1,
  pipelineSource: "planned",
  provenance: { modelId: "flux-2-pro" },
  qa: { status: "keep" },
  priceableManifest: {
    version: 1,
    source: "planned",
    serviceId: "service-1",
    serviceKey: "landscaping",
    pricingFamily: "landscape_design",
    components: [
      {
        componentKey: "paver_patio",
        tier: "mid",
        quantity: { low: 400, likely: 450, high: 500, unit: "sq_ft" },
        attributes: {},
      },
    ],
    assumptions: [],
    normalizationNotes: [],
  },
  before: {
    status: "success",
    imageId: "before-1",
    url: "https://cdn.example.com/before.jpg",
    attempts: 1,
    disclosure: "ai_generated_illustrative_before",
  },
  verification: { status: "passed", confidence: 0.86 },
  pricing: { status: "complete", confidence: "medium" },
  publish: { status: "ready" },
  stages: {},
};


test("ready gallery guard requires the complete publish contract", () => {
  assert.equal(isReadyGalleryEnrichment(ready), true);
  assert.equal(isReadyGalleryEnrichment({ ...ready, publish: { status: "pending" } }), false);
  assert.equal(isReadyGalleryEnrichment({ ...ready, before: { ...ready.before, status: "failed" } }), false);
  assert.equal(isReadyGalleryEnrichment({ ...ready, pricing: { ...ready.pricing, status: "failed" } }), false);
});


test("ready gallery guard accepts a classified unpaired image", () => {
  assert.equal(isReadyGalleryEnrichment({
    ...ready,
    pipelineSource: "legacy",
    before: { status: "not_available", attempts: 0, disclosure: null },
    pair: { version: 1, status: "unpaired", role: "after" },
    verification: { status: "not_run", confidence: 0 },
  }), true);
});


test("pricing confidence uses the required customer-facing labels", () => {
  assert.equal(galleryPricingLabel("high"), "Typical estimated range");
  assert.equal(galleryPricingLabel("medium"), "Estimated project range");
  assert.equal(galleryPricingLabel("broad"), "Broad illustrative estimate");
});


test("localized totals equal the localized line-item calculation", () => {
  const pricing: GalleryPricingResult = {
    status: "complete",
    confidence: "high",
    family: "landscape_design",
    packVersion: 1,
    baseRange: { low: 1_500, likely: 2_000, high: 2_500, currency: "USD" },
    localizedRange: { low: 1_500, likely: 2_000, high: 2_500, currency: "USD" },
    locationLabel: "National typical range",
    marketFactor: 1,
    breakdown: [
      {
        key: "patio:materials",
        label: "Patio — Materials",
        category: "materials",
        range: { low: 500, likely: 800, high: 1_000, currency: "USD" },
      },
      {
        key: "patio:labor",
        label: "Patio — Labor",
        category: "labor",
        range: { low: 1_000, likely: 1_200, high: 1_500, currency: "USD" },
      },
    ],
    assumptions: [],
    failureReasons: [],
  };
  const localized = localizeGalleryPricing(pricing, { city: "Austin", state: "TX" });
  assert.equal(localized.marketFactor, 1.08);
  assert.equal(localized.locationLabel, "Austin, TX");
  for (const key of ["low", "likely", "high"] as const) {
    assert.equal(
      localized.localizedRange[key],
      localized.breakdown.reduce((sum, item) => sum + Number(item.localizedRange?.[key] || 0), 0),
    );
  }
});


test("visitor gallery paths fail closed and disclose synthetic befores", () => {
  const library = readFileSync("../api-service/src/programs/adventure_pipeline/library.py", "utf8");
  const instanceRoute = readFileSync("./app/api/widget/[instanceId]/route.ts", "utf8");
  const sampleRoute = readFileSync("./app/api/sample-gallery/[instanceId]/route.ts", "utf8");
  const experience = readFileSync("./components/adventure/v8/AdventureV8Experience.tsx", "utf8");

  assert.match(library, /publish\.get\("status"\) != "ready"/);
  assert.match(instanceRoute, /isPublishReadyGalleryMetadata/);
  assert.match(sampleRoute, /publish\?\.status === "ready"/);
  assert.match(experience, /AI-generated illustrative before/);
  assert.match(experience, /selectedProjectBeforeUrl && uiVersion === "v9"/);
  assert.match(experience, /Illustrative breakdown/);
  assert.match(experience, /Not a quote/);
});

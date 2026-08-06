import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  calculatePlanningRange,
  generalServiceRange,
} from "../components/adventure/v3/pricing";
import {
  BUDGET_BANDS,
  adjustedPersonalizedRange,
  buildVisualProjects,
  configuredProjectRange,
  DEFAULT_ESTIMATE_CONFIG,
  personalizedProjectRange,
} from "../components/adventure/v3/visual-pricing";

const widgetRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(relativePath: string): string {
  return readFileSync(resolve(widgetRoot, relativePath), "utf8");
}

test("V3 keeps its pricing-first route after V5 becomes the default", () => {
  const unversioned = read("app/adventure/[instanceId]/page.tsx");
  const v2 = read("app/adventure/v2/[instanceId]/page.tsx");
  const v3 = read("app/adventure/v3/[instanceId]/page.tsx");

  assert.match(unversioned, /AdventureV5Experience/);
  assert.match(v2, /AdventureV2Experience/);
  assert.match(v3, /AdventureV3Experience/);
});

test("planning ranges react only to meaningful cost drivers", () => {
  const bounds = { min: 20_000, max: 50_000, currency: "USD" };
  const service = { value: "bath", label: "Bathroom Remodeling" };
  const broad = generalServiceRange(bounds, service);
  const standard = calculatePlanningRange({
    bounds,
    service,
    scope: "Full bathroom renovation",
    costDrivers: {
      layout: "keep",
      finishLevel: "standard",
      size: "average",
      components: ["Shower", "Vanity"],
    },
  });
  const luxury = calculatePlanningRange({
    bounds,
    service,
    scope: "Full bathroom renovation",
    costDrivers: {
      layout: "change",
      finishLevel: "luxury",
      size: "large",
      components: ["Shower", "Vanity", "Flooring", "Lighting"],
    },
  });

  assert.ok(broad.totalMin > 0);
  assert.ok(standard.totalMin < standard.totalMax);
  assert.ok(luxury.totalMin > standard.totalMin);
  assert.ok(luxury.totalMax > standard.totalMax);
  assert.match(standard.assumptions.join(" "), /Existing layout retained/);
});

test("budget-matched projects stay inside the selected band and personalization narrows the range", () => {
  const budget = BUDGET_BANDS.find((band) => band.id === "25-40");
  assert.ok(budget);
  const [project] = buildVisualProjects({
    rawProjects: [{
      assetId: "project-1",
      imageUrl: "https://example.com/project.png",
      storagePath: "project.png",
      label: "Warm modern",
      scope: "Full bathroom renovation",
      createdAt: Date.now(),
    }],
    service: { value: "bath", label: "Bathroom Remodeling" },
    budgetBand: budget,
    bounds: { min: 12_000, max: 55_000, currency: "USD" },
  });

  assert.ok(project.priceMin >= 25_000);
  assert.ok(project.priceMax <= 40_000);
  assert.equal(project.title, "Warm Modern");
  assert.match(project.fitLabel, /\$25K–\$40K/);
  const personalized = personalizedProjectRange(project, true);
  assert.ok(personalized.totalMax - personalized.totalMin < project.priceMax - project.priceMin);
  const upgradedPersonalized = adjustedPersonalizedRange(personalized, 0.12);
  const valuePersonalized = adjustedPersonalizedRange(personalized, -0.1);
  assert.ok(upgradedPersonalized.totalMin > personalized.totalMin);
  assert.ok(upgradedPersonalized.totalMax > personalized.totalMax);
  assert.ok(valuePersonalized.totalMin < personalized.totalMin);
  assert.ok(valuePersonalized.totalMax < personalized.totalMax);
  const premiumRework = configuredProjectRange(project, {
    ...DEFAULT_ESTIMATE_CONFIG,
    finishLevel: "premium",
    layoutPlan: "rework",
  });
  assert.ok(premiumRework.totalMin > project.priceMin);
  assert.ok(premiumRework.totalMax > project.priceMax);
  const aiRefined = configuredProjectRange(project, DEFAULT_ESTIMATE_CONFIG, {
    suggestions: ["Use warmer materials", "Add more storage"],
    prompt: "Use handmade tile",
  });
  assert.ok(aiRefined.totalMin > project.priceMin);
  assert.ok(aiRefined.refinementMultiplier > 1);
  const libraryPriced = configuredProjectRange(project, DEFAULT_ESTIMATE_CONFIG, {
    suggestions: ["Replace the vanity"],
    priceImpact: 0.08,
  });
  assert.equal(libraryPriced.refinementMultiplier, 1.08);

  const expanded = buildVisualProjects({
    rawProjects: Array.from({ length: 60 }, (_, index) => ({
      assetId: `project-${index}`,
      imageUrl: `https://example.com/project-${index}.png`,
      storagePath: `project-${index}.png`,
      label: `Direction ${index + 1}`,
      scope: "Full bathroom renovation",
      createdAt: Date.now(),
    })),
    service: { value: "bath", label: "Bathroom Remodeling" },
    budgetBand: budget,
    bounds: { min: 12_000, max: 55_000, currency: "USD" },
  });
  assert.equal(expanded.length, 50);

  const duplicateLabels = buildVisualProjects({
    rawProjects: Array.from({ length: 12 }, (_, index) => ({
      assetId: `dup-${index}`,
      imageUrl: `https://example.com/dup-${index}.png`,
      storagePath: `dup-${index}.png`,
      label: index % 2 === 0 ? "Warm contemporary" : "Modern organic",
      scope: "Full outdoor renovation",
      createdAt: Date.now(),
    })),
    service: { value: "landscape", label: "Landscaping" },
    budgetBand: budget,
    bounds: { min: 12_000, max: 55_000, currency: "USD" },
    budgetMode: "lens",
  });
  const titles = duplicateLabels.map((project) => project.title);
  assert.equal(new Set(titles).size, titles.length);
  assert.ok(duplicateLabels.every((project) => project.priceMax - project.priceMin <= 20_000));

  const mixedCatalog = [
    {
      assetId: "cosmetic-1",
      imageUrl: "https://example.com/cosmetic.png",
      storagePath: "cosmetic.png",
      label: "Simple Fresh",
      scope: "Cosmetic refresh (paint, lighting, hardware)",
      priceTier: "$",
      createdAt: Date.now(),
    },
    {
      assetId: "shower-1",
      imageUrl: "https://example.com/shower.png",
      storagePath: "shower.png",
      label: "Warm Contemporary",
      scope: "Shower or tub area only",
      priceTier: "$$",
      createdAt: Date.now(),
    },
    {
      assetId: "full-1",
      imageUrl: "https://example.com/full.png",
      storagePath: "full.png",
      label: "Luxury Spa",
      scope: "Full bathroom renovation",
      priceTier: "$$$$",
      createdAt: Date.now(),
    },
    {
      assetId: "layout-1",
      imageUrl: "https://example.com/layout.png",
      storagePath: "layout.png",
      label: "Premium Elegant",
      scope: "Layout or plumbing changes",
      priceTier: "$$$",
      createdAt: Date.now(),
    },
  ];
  const lowBand = BUDGET_BANDS.find((band) => band.id === "under-15");
  const highBand = BUDGET_BANDS.find((band) => band.id === "60-plus");
  assert.ok(lowBand && highBand);
  const lowGallery = buildVisualProjects({
    rawProjects: mixedCatalog,
    service: { value: "bath", label: "Bathroom Remodeling" },
    budgetBand: lowBand,
    bounds: { min: 12_000, max: 55_000, currency: "USD" },
    budgetMode: "lens",
  });
  const highGallery = buildVisualProjects({
    rawProjects: mixedCatalog,
    service: { value: "bath", label: "Bathroom Remodeling" },
    budgetBand: highBand,
    bounds: { min: 12_000, max: 55_000, currency: "USD" },
    budgetMode: "lens",
  });
  assert.ok(lowGallery.some((project) => /cosmetic|simple/i.test(`${project.scope} ${project.title}`)));
  assert.ok(highGallery.some((project) => /full|layout|luxury|premium/i.test(`${project.scope} ${project.title}`)));
  const lowMids = lowGallery.map((project) => (project.priceMin + project.priceMax) / 2);
  const highMids = highGallery.map((project) => (project.priceMin + project.priceMax) / 2);
  assert.ok(Math.max(...lowMids) < Math.min(...highMids));

  const midGallery = buildVisualProjects({
    rawProjects: mixedCatalog,
    service: { value: "bath", label: "Bathroom Remodeling" },
    budgetBand: budget,
    bounds: { min: 12_000, max: 55_000, currency: "USD" },
    budgetMode: "lens",
  });
  const byAsset = Object.fromEntries(midGallery.map((project) => [project.assetId, project]));
  if (byAsset["cosmetic-1"] && byAsset["full-1"]) {
    const cosmeticMid = (byAsset["cosmetic-1"].priceMin + byAsset["cosmetic-1"].priceMax) / 2;
    const fullMid = (byAsset["full-1"].priceMin + byAsset["full-1"].priceMax) / 2;
    assert.ok(fullMid > cosmeticMid + 3_000, "full reno should price meaningfully above cosmetic in the same band");
  }

  const [landscapeProject] = buildVisualProjects({
    rawProjects: [{
      assetId: "landscape-1",
      imageUrl: "https://example.com/landscape.png",
      storagePath: "landscape.png",
      label: "Classic garden",
      scope: "Full outdoor renovation",
      createdAt: Date.now(),
    }],
    service: {
      value: "landscape",
      label: "Landscaping",
      subcategoryComponents: [
        { key: "patio", label: "Patio", priority: 1 },
        { key: "planting", label: "Planting", priority: 2 },
      ],
    },
    budgetBand: budget,
    bounds: { min: 12_000, max: 55_000, currency: "USD" },
  });
  assert.match(landscapeProject.inclusions.join(" "), /Patio/);
  assert.match(landscapeProject.priceIncreases.join(" "), /grading, drainage, or soil preparation/);
  assert.doesNotMatch(landscapeProject.priceIncreases.join(" "), /Moving walls/);
});

test("V3 implements visual pricing before email and own-room value before phone", () => {
  const experience = read("components/adventure/v3/AdventureV3VisualPricingExperience.tsx");
  const index = read("components/adventure/v3/index.ts");
  const types = read("components/adventure/v3/visual-pricing-types.ts");
  const css = read("components/adventure/v3/visual-pricing-v3.module.css");
  const visualRoute = read("app/api/v3/ai-form/[instanceId]/visual-projects/route.ts");
  const leadRoute = read("app/api/v3/leads/route.ts");
  const canvasRoute = read("app/api/v2/ai-form/[instanceId]/canvas/route.ts");
  const refinementLibrary = read("components/adventure/v3/refinement-component-library.ts");

  assert.match(index, /AdventureV3VisualPricingExperience as AdventureV3Experience/);
  assert.match(types, /"intro"[\s\S]*"project"[\s\S]*"scope"[\s\S]*"budget"[\s\S]*"gallery"[\s\S]*"details"[\s\S]*"personalize"[\s\S]*"personalized-preview"[\s\S]*"personalized-result"/);
  assert.match(experience, /Before we price it, we need a little context\./);
  assert.match(experience, /firstQuestionStage\(selectedService\)/);
  assert.match(experience, /adventure_v3_primer_completed/);
  assert.match(experience, /What’s your budget\?/);
  assert.match(experience, /What are you planning\?/);
  assert.match(experience, /What do you need\?/);
  assert.match(experience, /Choose the closest option\./);
  assert.match(experience, /Choose a range\./);
  assert.doesNotMatch(experience, /What budget are you considering\?/);
  assert.match(read("components/adventure/v3/visual-pricing.ts"), /label: "Not sure yet"/);
  assert.match(experience, /Projects that fit your budget/);
  assert.match(experience, /Choose the look closest to what you have in mind/);
  assert.match(experience, /Estimated price hidden/);
  assert.match(experience, /lockedAmount[\s\S]*aria-hidden="true"/);
  assert.doesNotMatch(experience, /priceLocked[^}]*projectRangeText/);
  assert.match(experience, /Get your pricing/);
  assert.match(experience, /Enter your name and email to see the full price range and what’s included\./);
  assert.match(experience, /modalProjectIcon[\s\S]*<Mail size=\{18\}/);
  assert.match(experience, /No spam—just your pricing\./);
  assert.doesNotMatch(experience, /Terms &amp; Conditions/);
  assert.match(experience, /disabled=\{props\.busy \|\| !email\.trim\(\) \|\| \(!isMinimal && !name\.trim\(\)\)\}/);
  assert.match(experience, /See pricing/);
  assert.match(experience, /Upload a photo/);
  assert.match(experience, /Upload or take a photo/);
  assert.match(experience, /This look, in your space/);
  assert.match(experience, /Keep designing your project/);
  assert.match(experience, /Unlock project tools/);
  assert.match(experience, /Request expert review/);
  assert.doesNotMatch(experience, /Adjust the estimate/);
  assert.match(experience, /Make it yours/);
  assert.match(experience, /Choose how you want to change this design\./);
  assert.match(experience, /Describe a change/);
  assert.match(experience, /Choose a part/);
  assert.match(experience, /refinementMode === "describe"/);
  assert.match(experience, /styles\.refinementModeTabs/);
  assert.match(experience, /refinementComponentsForProject/);
  assert.match(experience, /refinementVisualGrid/);
  assert.match(experience, /Back to all/);
  assert.match(experience, /refinementCategoryHeading\(selectedRefinementCategory\.label\)/);
  assert.match(refinementLibrary, /Preserve the layout, lighting, camera angle, and every unrelated material\./);
  assert.match(refinementLibrary, /RefinementComponentSource = "curated" \| "business" \| "generated"/);
  assert.match(refinementLibrary, /libraryKey/);
  assert.match(refinementLibrary, /priceImpact: number/);
  assert.match(experience, /Every revision updates the image and planning price together/);
  assert.match(experience, /styles\.priceSummaryBar/);
  assert.match(experience, /Estimated project range/);
  assert.match(experience, /className=\{styles\.priceScopeDetails\}/);
  assert.match(experience, /What’s covered/);
  assert.doesNotMatch(experience, /className=\{styles\.sidebarEstimate\}/);
  assert.doesNotMatch(experience, /className=\{styles\.estimateHeader\}/);
  assert.match(css, /\.priceSummaryBar/);
  assert.match(css, /\.refinementPanelBody/);
  assert.match(css, /\.refinementModeTabs/);
  assert.match(experience, /snapshot\.projectRefinementHistory\.length > 0/);
  assert.match(experience, /styles\.projectHistoryPanel/);
  assert.match(experience, /"--v3-accent": design\.primary_color/);
  assert.match(experience, /"--v3-surface": themedSurface/);
  assert.match(experience, /<BrandHeader config=\{design\} compact \/>/);
  assert.doesNotMatch(experience, /budgetStatusForRange/);
  assert.doesNotMatch(experience, /Estimated increase/);
  assert.match(experience, /refinementCostHint/);
  assert.match(experience, /may increase the current estimate by about/);
  assert.match(experience, /refinementPriceImpact: selected \? 0 : option\.priceImpact/);
  assert.match(experience, /Try “Make the vanity floating”/);
  assert.match(experience, /onSubmit=\{\(event\) =>/);
  assert.doesNotMatch(experience, /className=\{styles\.refinementImpact\}/);
  assert.match(experience, /Preview this change/);
  assert.match(experience, /generationIntent: "v3_concept"/);
  assert.doesNotMatch(experience, /Compare price levels/);
  assert.doesNotMatch(experience, /Keep browsing instead/);
  assert.match(experience, /Try another project direction/);
  assert.match(experience, /FREE_PERSONALIZED_REFINEMENTS = 5/);
  assert.match(experience, /function IterationMeter/);
  assert.match(experience, /<IterationMeter count=\{snapshot\.projectRefinementHistory\.length\}/);
  assert.match(experience, /<IterationMeter count=\{snapshot\.personalizedRefinements\.length\}/);
  assert.match(experience, />Refinements<\/span>/);
  assert.match(experience, /refinements used/);
  assert.match(css, /\.iterationMeter/);
  assert.doesNotMatch(css, /\.iterationDots/);
  assert.doesNotMatch(experience, /1 refinement included/);
  assert.match(experience, /adventure_v3_personalized_refinement_ready/);
  assert.match(experience, /personalizedActiveConceptIndex/);
  assert.match(experience, /projectActiveRefinementIndex/);
  assert.match(experience, /Previous design version/);
  assert.match(experience, /Next personalized version/);
  assert.match(experience, /requestImageAction\("download"/);
  assert.match(experience, /requestImageAction\("fullscreen"/);
  assert.match(experience, /className=\{styles\.imageUtilityAction\}/);
  assert.match(experience, /className=\{styles\.imageSaveAction\}/);
  assert.match(css, /\.imageUtilityAction \{ top: 14px; \}/);
  assert.match(css, /\.imageSaveAction \{ bottom: 14px; right: 14px; \}/);
  assert.match(experience, /adventure_v3_project_refinement_gate_viewed/);
  assert.match(experience, /planningRange/);
  assert.match(experience, /refinementCount: pendingPhoneAction\?\.kind === "project-refinement"/);
  assert.doesNotMatch(experience, /rangeDisclosure/);
  assert.match(experience, /PERSONALIZATION_MODEL_ID = "black-forest-labs\/flux-2-pro"/);
  assert.match(experience, /params\.append\("scope", scope\)/);
  assert.match(experience, /for \(let attempt = 0; attempt < 3/);
  assert.match(experience, /VISUAL_CATALOG_REVISION/);
  assert.match(experience, /ideas\. Scroll the gallery to explore more/);
  assert.match(experience, /cache: "no-store"/);
  assert.match(experience, /rootRef\.current\?\.scrollTo\(\{ top: 0/);
  assert.match(visualRoute, /listV2ScopeGalleryOptions/);
  assert.match(visualRoute, /interleaved\.length < 50/);
  assert.match(visualRoute, /stored_scope_catalog/);
  assert.match(leadRoute, /experienceVersion: "v3"/);
  assert.match(leadRoute, /personalizedPlanUnlockedAt/);
  assert.match(leadRoute, /refinementCountAtPhoneGate/);
  assert.match(leadRoute, /consultation_requested/);
  assert.match(canvasRoute, /referenceProjectImageUrl/);
  assert.match(canvasRoute, /v3_personalized_preview/);
  assert.match(canvasRoute, /V3_EDIT_MODEL_ID = "black-forest-labs\/flux-2-pro"/);
  assert.match(canvasRoute, /V3_EDIT_FALLBACK_MODEL_ID = "prunaai\/p-image-edit"/);
  assert.match(canvasRoute, /v3 edit model failed; retrying fallback/);
  assert.match(css, /\.projectGallery \{[\s\S]*display: grid;[\s\S]*grid-auto-flow: dense;[\s\S]*grid-template-columns: repeat\(3/);
  assert.match(css, /\.cardPriceRow/);
  assert.match(css, /\.projectImageFrame \{[\s\S]*height: 100%/);
  assert.match(experience, /data-shape=\{\["wide", "portrait", "square", "portrait", "portrait", "square", "wide"/);
  assert.match(css, /projectCard\[data-shape="portrait"\]/);
  assert.match(css, /\.galleryScroll::\-webkit-scrollbar/);
  assert.match(css, /\.lockedAmount i/);
  assert.match(css, /\.choiceGrid,[\s\S]*\.budgetGrid[\s\S]*grid-template-columns: repeat\(2/);
  assert.match(css, /height: 100dvh;[\s\S]*overflow-y: auto;/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /\.personalizedWorkspace \{[\s\S]*grid-template-columns/);
  assert.match(css, /\.revisionRail/);
  assert.match(css, /\.fullscreenBackdrop/);
  assert.match(css, /\.refinementPrompt input:focus-visible \{ outline: 0; \}/);
  assert.match(css, /\.modalProject img \{[\s\S]*object-fit: contain/);
  assert.match(css, /\.shell\[data-stage="details"\] \.topbar/);
  assert.match(css, /@media \(min-width: 881px\) \{[\s\S]*?\.shell\[data-stage="details"\] \{[\s\S]*?overflow: hidden;/);
  assert.match(css, /grid-template-columns: minmax\(0, 1fr\) minmax\(360px, 390px\)/);
  assert.match(css, /\.detailImage \{[\s\S]*?grid-row: 1 \/ 3/);
  assert.match(css, /\.priceSummaryTopline/);
  assert.match(css, /\.refinementPanel \.refinementVisualGrid \{[\s\S]*?grid-template-columns: repeat\(2/);
  assert.match(experience, /styles\.refinementRoomAction/);
  assert.match(css, /\.refinementVisualCard \{[\s\S]*?color-mix\(in srgb, var\(--v3-accent\) 9%, var\(--v3-surface\)\)/);
  assert.match(css, /\.refinementVisualThumb \{[\s\S]*?color-mix\(in srgb, var\(--v3-accent\) 10%, var\(--v3-soft\)\)/);
});

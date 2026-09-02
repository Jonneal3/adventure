import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildScopeQuestion, isVisualScopePart, lookConflictsWithService, lookFitsSelectedScopes, looksLikeMaterialSwatch, projectMode, verticalKey } from "../components/adventure/v8/scopeRecipes";
import { adventureCopy, languageForIndustry, localityFromInstance } from "../components/adventure/v8/adventureCopy";
import {
  assignDiscoveryModel,
  buildRefinementPlan,
  buildStarterPrompt,
  catalogTags,
  COLOR_MOODS,
  curateGalleryProjectDiversity,
  DISCOVERY_MODELS,
  discoveryRoom,
  interleaveLooks,
  layoutPresets,
  layoutChoicesForProject,
  buildLayoutThumbPrompt,
  buildLayoutCompositePrompt,
  buildMoodStylePrompt,
  LOOK_STYLES,
  buildStyleThumbPrompt,
  pickDiverseLooks,
  pinAspectRatio,
  pinEstimate,
  planGalleryShots,
  projectEstimateForBand,
  proposeClientBudgetBounds,
  roundPriceRangeForDisplay,
  tightenPriceRangeForDisplay,
  scopeLineItemWeight,
  finishTiersForScope,
  adjacentFinishTiers,
  formatChipBand,
  withOpenEndedTop,
  retrievalMix,
  splitMasonryColumns,
  styleSwatches,
  styleSwatchesForProject,
  tooExpensiveForBudget,
  withinBudgetWindow,
  adaptLookToScopes,
  buildDiscoveryPrompt,
} from "../components/adventure/v8/generationRecipes";

test("pricing gallery collapses repeated starter scenes but preserves real projects", () => {
  const rows = [
    { url: "https://example.com/real-a.jpg?w=800", generatedFor: null, primaryScope: "Vanity" },
    { url: "https://example.com/real-a.jpg?w=1200", generatedFor: null, primaryScope: "Vanity" },
    { url: "https://example.com/starter-a.jpg", generatedFor: "v2_scope_starter", primaryScope: "Vanity" },
    { url: "https://example.com/starter-b.jpg", generatedFor: "v2_scope_starter", primaryScope: "Vanity" },
    { url: "https://example.com/real-b.jpg", generatedFor: null, primaryScope: "Vanity" },
  ];

  assert.deepEqual(
    curateGalleryProjectDiversity(rows).map((row) => row.url),
    [
      "https://example.com/real-a.jpg?w=800",
      "https://example.com/starter-a.jpg",
      "https://example.com/real-b.jpg",
    ]
  );
});

test("launch copy swaps only the industry nouns and uses configured locality", () => {
  const bathroom = languageForIndustry({ serviceLabel: "Bathroom Remodel" });
  const landscaping = languageForIndustry({ industry: "Landscaping" });
  const deck = languageForIndustry({ serviceSummary: "Custom deck construction" });
  const locality = localityFromInstance({ city: "Lansing", state: "MI" });

  assert.equal(bathroom.space, "bathroom");
  assert.equal(landscaping.space, "yard");
  assert.equal(landscaping.spaces, "outdoor spaces");
  assert.equal(deck.space, "deck");
  assert.equal(languageForIndustry({ serviceLabel: "Roof replacement" }).photoSubject, "roof");
  assert.equal(languageForIndustry({ serviceLabel: "Rhinoplasty" }).photoSubject, "face/profile");
  assert.equal(languageForIndustry({ serviceLabel: "Nail art" }).photoSubject, "nails");
  assert.equal(languageForIndustry({ serviceLabel: "Furniture selection" }).photoSubject, "room/space");
  assert.equal(
    languageForIndustry({ serviceLabel: "Generic service", photoSubject: "work area" }).photoSubject,
    "work area"
  );
  assert.deepEqual(locality, { label: "Lansing, MI", isNamedPlace: true });
  assert.equal(
    adventureCopy(landscaping, locality).gallery.title,
    "See what yards around Lansing, MI can cost"
  );
  assert.equal(
    adventureCopy(bathroom, locality).photo.body,
    "Upload a quick photo so we can base the estimate on the real thing — not just general assumptions."
  );
  assert.deepEqual(localityFromInstance({}), { label: "your area", isNamedPlace: false });
});

const widgetRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const repoRoot = resolve(widgetRoot, "../..");

function read(relativePath: string): string {
  return readFileSync(resolve(widgetRoot, relativePath), "utf8");
}

test("V9 UI is what /adventure/[instanceId] serves while V8 remains the engine", () => {
  const v8Wrapper = read("components/adventure/v8/index.ts");
  const v9Wrapper = read("components/adventure/v9/index.ts");
  const v9Component = read("components/adventure/v9/AdventureV9Experience.tsx");
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  const unversioned = read("app/adventure/[instanceId]/page.tsx");
  const middleware = read("middleware.ts");

  assert.match(v8Wrapper, /AdventureV8Experience/);
  assert.match(v9Wrapper, /AdventureV9Experience/);
  assert.match(v9Component, /uiVersion="v9"/);
  assert.match(component, /export function AdventureV8Experience/);
  assert.match(component, /uiVersion = "v8"/);
  assert.match(component, /data-adventure-version=\{uiVersion\}/);
  assert.match(component, /data-pricing-project-open=/);

  assert.match(unversioned, /AdventureV9Experience/);
  assert.doesNotMatch(unversioned, /AdventureV8Experience/);
  assert.throws(
    () => read("app/adventure/v9/[instanceId]/page.tsx"),
    /ENOENT/,
    "there should be no versioned V9 route"
  );
  assert.match(middleware, /v\(\?:1\|2\|3\|4\|5\|6\|7\|8\)/);
});

test("V9 styling is isolated from the V8 compatibility stylesheet", () => {
  const legacyStyles = read("components/adventure/v8/configurator-v8.module.css");
  const v9Styles = read("components/adventure/v9/configurator-v9.module.css");
  const nonPriceStyles = v9Styles.replace(
    /\.theme :global\(\[data-adventure-version="v9"\] \[data-adventure-ui="locked-price-digits"\]\) \{[\s\S]*?\n\}/g,
    ""
  );

  assert.doesNotMatch(legacyStyles, /data-adventure-version="v9"/);
  assert.match(v9Styles, /data-adventure-v9-theme|data-adventure-version=\\?"v9\\?"/);
  assert.match(v9Styles, /data-adventure-ui=\\?"pricing-layout\\?"/);
  assert.match(v9Styles, /grid-template-columns:\s*minmax\(0, 1\.7fr\) minmax\(320px, 0\.8fr\)/);
  assert.match(v9Styles, /data-adventure-ui=\\?"media-toolbar\\?"/);
  assert.doesNotMatch(nonPriceStyles, /blur\([1-9]/);
});

test("V8 line-item selection does not dim or mask the project image", () => {
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  const client = read("components/adventure/v8/adventurePipelineClient.ts");
  const styles = read("components/adventure/v8/configurator-v8.module.css");

  assert.throws(
    () => read("app/api/adventure/v8/[instanceId]/focus-mask/route.ts"),
    /ENOENT/
  );
  assert.doesNotMatch(client, /fetchV8FocusMask|\/focus-mask/);
  assert.doesNotMatch(component, /pricingFocusMask|pricingComponentFocus|prefetchPricingProjectMasks/);
  assert.doesNotMatch(styles, /pricingComponentFocus|pricingComponentDim|pricing-focus-mask-in/);
});

test("designer preview defers to V8's container-scoped loader", () => {
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  const styles = read("components/adventure/v8/configurator-v8.module.css");
  const routeLoading = read("app/adventure/[instanceId]/loading.tsx");
  const preview = readFileSync(
    resolve(repoRoot, "apps/designer/src/components/features/IframeWidgetPreview.tsx"),
    "utf8"
  );

  assert.doesNotMatch(preview, /Getting things ready/);
  assert.doesNotMatch(preview, /PreviewIframeLoader/);
  assert.doesNotMatch(preview, /qualityCatalogSeedRequests/);
  assert.doesNotMatch(preview, /requestIdleCallback/);
  assert.doesNotMatch(preview, /subcategory-image-catalog\/seed-instance/);
  assert.match(component, /<main className=/);
  assert.match(component, /<LoadingState phase=/);
  assert.match(component, /<BootstrapStage \/>/);
  assert.match(component, /Loading services and project options…/);
  assert.match(component, /data-adventure-ui="loading-state"/);
  assert.doesNotMatch(component, /Tell us about your project/);
  assert.doesNotMatch(component, /className=\{css\.bootstrapLoader\}/);
  assert.doesNotMatch(component, /className=\{css\.bootstrapSpinner\}/);
  assert.match(styles, /\.loading\s*\{[\s\S]*?justify-content:\s*center/);
  assert.match(styles, /\.loading\s*\{[\s\S]*?height:\s*100%/);
  assert.match(routeLoading, /AdventureV9BootstrapShell/);
});

test("V8 renders intake before optional copy and service covers finish", () => {
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  const widgetRoute = read("app/api/widget/[instanceId]/route.ts");

  assert.match(component, /\?phase=intake/);
  assert.match(component, /const serviceQ = fallbackServiceIntake\(resolved\)/);
  assert.match(component, /first usable step must never wait/);
  assert.match(component, /void requestIntake/);
  assert.match(component, /\?phase=service-covers/);
  assert.match(component, /Service cover images are decorative only/);
  assert.match(component, /Fetch them behind the first/);
  assert.match(widgetRoute, /const intakeOnly = requestUrl\.searchParams\.get\("phase"\) === "intake"/);
  assert.match(widgetRoute, /serviceOptions\.length > 0 && !intakeOnly/);
  assert.match(widgetRoute, /intakeOnly \? \[\] : buildStudioStarterConcepts/);
});

test("V8 no-photo is pricing discovery and never fabricates the visitor's property", () => {
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  const copySource = read("components/adventure/v8/adventureCopy.ts");
  const pipelineClient = read("components/adventure/v8/adventurePipelineClient.ts");
  const styles = read("components/adventure/v8/configurator-v8.module.css");

  assert.match(component, /loadPricingGallery/);
  assert.match(component, /callAdventurePipeline\(\s*"discovery"/);
  assert.match(component, /startPath: "pricing"/);
  assert.match(component, /generatingLabel: cachedRows\.length \? "" : copy\.gallery\.loading/);
  assert.match(component, /photoSkipped: true/);
  assert.doesNotMatch(component, /No photo\? No problem\./);
  assert.match(copySource, /secondary: "Skip for now"/);
  assert.match(copySource, /Pick a look you like to see what it could cost/);
  assert.doesNotMatch(component, /Explore \{brandName\}&apos;s examples/);
  assert.match(component, /copy\.gallery\.title/);
  assert.match(component, /copy\.gallery\.body/);
  assert.doesNotMatch(component, /Open any project/);
  assert.doesNotMatch(component, /filtered using your answers/);
  assert.doesNotMatch(component, /may not match your exact scope/);
  assert.doesNotMatch(component, /pricingGalleryPath/);
  assert.doesNotMatch(component, /className=\{css\.pricingGalleryContext\}/);
  assert.doesNotMatch(component, /className=\{css\.pricingGalleryFilters\}/);
  assert.match(component, /className=\{css\.pricingGalleryScroll\}[\s\S]*?aria-label="Project inspiration gallery"/);
  assert.match(component, /!state\.selectedDesignId &&\s*activeRevisionIndex < 0/);
  assert.match(component, /Boolean\(state\.selectedDesignId\) &&\s*Boolean\(selectedDesign\)/);
  assert.match(component, /studioOpen \|\| pricingProjectOpen \? css\.mainFill/);
  assert.match(component, /saved\.state\.looks\.length === 0 \|\| !saved\.state\.selectedDesignId/);
  assert.match(component, /onError=\{\(\) => dropBrokenPricingProject\(look\.id\)\}/);
  assert.match(component, /PRICING_GALLERY_MAX = 120/);
  assert.match(component, /PRICING_GALLERY_PAGE_SIZE = 8/);
  assert.match(component, /curateGalleryProjectDiversity\(state\.looks, PRICING_GALLERY_MAX\)/);
  assert.doesNotMatch(component, /PRICING_GALLERY_GENERATION_MAX/);
  assert.doesNotMatch(component, /preloadPricingProjectRows/);
  assert.doesNotMatch(component, /shufflePricingProjects/);
  assert.match(component, /const pageRows = requestedPageRows/);
  assert.match(component, /className=\{css\.galleryInitialLoader\} role="status" aria-live="polite"/);
  assert.match(component, /messageOverride=\{copy\.gallery\.loading\}/);
  assert.doesNotMatch(component, /subMessageOverride="Matching examples to your scope and budget\."/);
  assert.match(component, /className=\{css\.galleryLoaderContent\}/);
  assert.doesNotMatch(component, /Load more projects/);
  assert.match(component, /new IntersectionObserver\(/);
  assert.match(component, /rootMargin: "600px 0px"/);
  assert.match(component, /ref=\{pricingGalleryLoadSentinelRef\}/);
  assert.doesNotMatch(styles, /galleryMoreLoader|galleryMoreBar/);
  assert.doesNotMatch(component, /pricing-skeleton-/);
  assert.doesNotMatch(component, /local-pricing-/);
  assert.match(component, /const fallbackRowsForPricingGallery/);
  assert.match(component, /upstreamRows\.length \? upstreamRows : fallbackRowsForPricingGallery\(\)/);
  assert.match(component, /row\.source === "fallback" \? "fallback" : undefined/);
  assert.match(component, /loading="eager"/);
  assert.match(component, /splitMasonryColumns\(/);
  assert.match(component, /new ResizeObserver\(updateColumnCount\)/);
  assert.doesNotMatch(component, /className=\{`\$\{css\.pricingMasonry\} \$\{css\.staggerIn\}`\}/);
  assert.match(component, /lookConflictsWithService/);
  assert.match(component, /lookFitsSelectedScopes/);
  assert.match(component, /tooExpensiveForBudget/);
  assert.match(component, /withinBudgetWindow/);
  assert.match(component, /allowPricingFallback/);
  assert.match(component, /allowBroadFallback/);
  assert.match(component, /complete catalog is already in memory/);
  assert.match(component, /hydrateSelectedProjectManifest/);
  assert.doesNotMatch(component, /shouldReplenish/);
  assert.doesNotMatch(component, /pricing-gallery-replenishment/);
  assert.match(component, /View local price details for/);
  assert.doesNotMatch(component, /className=\{css\.pricingProjectDetails\}/);
  assert.match(component, /className=\{css\.pricingProjectOverlay\}/);
  assert.match(component, /data-adventure-ui="project-title"/);
  assert.doesNotMatch(component, /data-adventure-ui="project-price"/);
  assert.doesNotMatch(component, /data-adventure-ui="project-features"/);
  assert.doesNotMatch(component, /data-adventure-ui="project-locality"/);
  assert.doesNotMatch(component, /className=\{css\.pricingProjectScope\}/);
  assert.doesNotMatch(component, /className=\{css\.pricingProjectDescription\}/);
  assert.doesNotMatch(component, /className=\{css\.pricingProjectProof\}/);
  assert.doesNotMatch(component, /className=\{css\.pricingProjectCardPrice\}/);
  assert.match(component, /\{copy\.gallery\.action\} <ArrowRight/);
  assert.match(styles, /\.pricingProjectAction\s*\{/);
  assert.doesNotMatch(component, /pricingGalleryProofForLook/);
  assert.doesNotMatch(component, /className=\{css\.pricingGalleryBubble\}/);
  assert.doesNotMatch(component, /Refine this project/);
  assert.doesNotMatch(component, /v8-pricing-refinement-prompt/);
  assert.doesNotMatch(component, /Change one simple detail\./);
  assert.doesNotMatch(component, /Explore this project&apos;s price/);
  assert.match(component, /className=\{css\.pricingPhotoDock\}/);
  assert.match(component, /className=\{css\.pricingPhotoButton\}/);
  assert.match(component, /Use my \{industryLanguage\.space\}/);
  assert.doesNotMatch(component, /pricingGallerySuperlative/);
  assert.doesNotMatch(component, /Local price example/);
  assert.match(component, /<span aria-hidden="true">＋<\/span>\s*Add your own photo/);
  assert.doesNotMatch(component, /Top choice locally|Most saved nearby|Trending nearby/);
  assert.doesNotMatch(component, /Add a photo anytime/);
  assert.doesNotMatch(component, /Upload a photo for a personalized concept/);
  assert.doesNotMatch(component, /Compare one detail/);
  assert.doesNotMatch(component, /What do you want priced\?/);
  assert.doesNotMatch(component, /savePricingProject/);
  assert.doesNotMatch(component, /sharePricingProject/);
  assert.match(component, /Estimated local price hidden until unlock/);
  assert.match(component, /className=\{css\.pricingInlineUnlock\}/);
  assert.match(component, /aria-label="Email to unlock pricing"/);
  assert.doesNotMatch(component, /Takes 10 seconds · No spam/);
  assert.match(component, /Get instant pricing/);
  assert.match(component, /We’ll never send you spam\. :\)/);
  assert.match(component, /pricingUnlockSubmitting/);
  assert.match(component, /<form[\s\S]*?className=\{css\.pricingInlineUnlockForm\}/);
  assert.match(component, /new FormData\(event\.currentTarget\)\.get\("email"\)/);
  assert.match(component, /name="email"[\s\S]*?value=\{state\.email\}[\s\S]*?onChange=\{\(event\) => patch\(\{ email: event\.target\.value \}\)\}/);
  assert.match(component, /pricingUnlockSubmitting \? "Unlocking…" : \(/);
  assert.match(component, /<LockOpen aria-hidden="true" \/>[\s\S]*?Unlock/);
  assert.match(component, /selectedDesign\?\.label \|\| estimateHeading/);
  assert.doesNotMatch(component, /Or see similar designs/);
  assert.doesNotMatch(component, /className=\{css\.pricingSimilarProjects\}/);
  assert.doesNotMatch(component, /Email below/);
  assert.doesNotMatch(component, /data-open=\{pricingUnlockOpen/);
  assert.doesNotMatch(styles, /\.pricingUnlockCta/);
  assert.match(styles, /\.pricingInlineUnlockForm button:disabled\s*\{[\s\S]*?cursor:\s*wait/);
  assert.doesNotMatch(component, /onClick=\{\(\) => goToPrice\(\)\}>Unlock price/);
  assert.match(component, /What this \$\{industryLanguage\.space\} could cost/);
  assert.match(component, /An estimated local range based on the scope and finish level/);
  assert.match(component, /Browse more local examples/);
  assert.match(component, /Upload a photo for personalization/);
  assert.match(styles, /\.pricingMasonry\s*\{/);
  assert.match(styles, /\.pricingPhotoDock\s*\{/);
  assert.match(styles, /\.pricingPhotoButton\s*\{/);
  assert.doesNotMatch(styles, /\.pricingDiscoveryStage\s*\{[^}]*border-radius/);
  assert.match(styles, /\.pricingDiscoveryStage \.stageBody\s*\{[^}]*border-radius:\s*18px/);
  assert.match(styles, /\.pricingDiscoveryStage \.stageBody\s*\{[^}]*display:\s*flex;[^}]*overflow:\s*hidden/);
  assert.match(styles, /\.pricingGalleryHeader\s*\{[^}]*flex:\s*0 0 auto/);
  assert.match(styles, /\.pricingGalleryScroll\s*\{[^}]*flex:\s*1 1 auto;[^}]*overflow-y:\s*auto/);
  assert.match(styles, /\.pricingGalleryScroll\s*\{[^}]*overscroll-behavior-y:\s*auto;[^}]*touch-action:\s*pan-y/);
  assert.match(styles, /\.pricingGallerySentinel\s*\{[^}]*height:\s*1px/);
  assert.match(styles, /\.pricingPhotoDock\s*\{[^}]*border-radius:\s*0;[^}]*background:\s*#f7f7f5/);
  assert.doesNotMatch(styles, /\.pricingPhotoDock\s*\{[^}]*linear-gradient/);
  assert.match(styles, /\.pricingPhotoButton\s*\{[\s\S]*?background:\s*transparent/);
  assert.match(styles, /min-height:\s*34px/);
  assert.match(styles, /grid-template-columns:\s*repeat\(var\(--pricing-column-count, 1\)/);
  assert.match(styles, /\.pricingMasonryColumn\s*\{[\s\S]*?flex-direction:\s*column/);
  assert.doesNotMatch(styles, /column-count:/);
  assert.match(styles, /break-inside:\s*avoid/);
  assert.doesNotMatch(styles, /content-visibility:\s*auto/);
  assert.doesNotMatch(styles, /contain-intrinsic-size/);
  assert.match(styles, /\.pricingProjectCard\s*\{[^}]*border:\s*1px solid #deded9;[^}]*border-radius:\s*16px/);
  assert.match(component, /style=\{\{ aspectRatio: look\.pinAspect \|\| "4 \/ 5" \}\}/);
  assert.doesNotMatch(styles, /\.pricingProjectScope\s*\{/);
  assert.doesNotMatch(styles, /\.pricingProjectProof\s*\{/);
  assert.match(styles, /\.pricingProjectOverlay\s*\{[\s\S]*?position:\s*static;[\s\S]*?background:\s*#fff/);
  assert.doesNotMatch(styles, /\.pricingGalleryBubble\s*\{/);
  assert.doesNotMatch(styles, /\.pricingProjectCardPrice\s*\{/);
  assert.doesNotMatch(styles, /\.pricingGalleryLoadMore\s*\{/);
  assert.match(styles, /\.pricingRefinementShell\s*\{[\s\S]*?height:\s*100%/);
  assert.match(styles, /\.pricingCanvasFrame img,[\s\S]*?height:\s*100%/);
  assert.match(component, /selectedProjectBeforeUrl/);
  assert.match(component, /raw\.beforeUrl \|\| raw\.before_url \|\| raw\.beforeImageUrl \|\| raw\.before_image_url/);
  assert.match(component, /raw\.changeSummary \|\| raw\.change_summary \|\| raw\.whatChanged \|\| raw\.what_changed/);
  assert.match(component, /className=\{css\.pricingCanvas\}/);
  assert.match(component, /className=\{css\.pricingCanvasFrame\}/);
  assert.match(component, /pricingCanvasView === "before"/);
  assert.match(component, /aria-label="Show project view"/);
  assert.match(component, /aria-pressed=\{pricingCanvasView === "before"\}/);
  assert.match(component, /aria-pressed=\{pricingCanvasView === "after"\}/);
  assert.match(component, /className=\{css\.pricingBeforePlaceholder\}/);
  assert.match(component, /Before photo placeholder for/);
  assert.doesNotMatch(component, /className=\{css\.pricingComparison\}/);
  assert.doesNotMatch(component, /pricingComparisonArrow/);
  assert.match(component, /className=\{css\.pricingProjectSummary\}/);
  assert.match(component, /className=\{css\.pricingEstimateHeader\}/);
  assert.match(component, /className=\{css\.pricingEstimateCompactPrice\}/);
  assert.match(component, /className=\{css\.pricingRefinementSection\}/);
  assert.match(component, /className=\{css\.pricingRefinementHeader\}/);
  assert.match(component, /className=\{css\.pricingReviewPanel\}/);
  assert.match(component, /className=\{css\.pricingIncludedBreakdown\}/);
  assert.match(component, /className=\{css\.pricingIncludedRows\}/);
  assert.match(component, /className=\{css\.pricingIncludedHeading\}>\{copy\.detail\.breakdownTitle\}/);
  assert.match(component, /data-adventure-ui="project-facts"/);
  assert.doesNotMatch(component, /Based only on items verified in this image/);
  assert.doesNotMatch(component, /What&apos;s included\?/);
  assert.doesNotMatch(component, /Price breakdown preview\. Unlock the exact ranges after entering your email/);
  assert.doesNotMatch(component, /className=\{css\.pricingLockedRows\}/);
  assert.doesNotMatch(component, /lockedPricingTotalLabel/);
  assert.match(component, /className=\{css\.pricingLockedPriceSegment\}/);
  assert.match(component, /className=\{css\.pricingLockedPriceDash\}/);
  assert.doesNotMatch(component, /pricingLockedLineItems/);
  assert.match(component, /prefetchPricingGallery/);
  assert.match(component, /unfiltered: true/);
  assert.match(component, /void prefetchPricingGallery\(\)/);
  assert.match(component, /cachedRows\.length \? cachedRows : await prefetchPricingGallery\(\)/);
  assert.doesNotMatch(component, /loadPricingGallery\(\{ append: true \}\)/);
  assert.doesNotMatch(component, /lineItem\.price \|\| "\$00,000 – \$00,000"/);
  assert.match(component, /PRICING_BREAKDOWN_MAX_ITEMS = 8/);
  assert.match(component, /selectedScopeBreakdownItems/);
  assert.match(component, /fullProjectSelected[\s\S]*?question\?\.choices/);
  assert.match(component, /function pricedItemsForProject/);
  assert.match(component, /if \(fullProjectSelected\)[\s\S]*?return scopedBreakdown/);
  assert.match(component, /selectedProjectPricedItems = pricedItemsForProject/);
  assert.match(component, /selectedProjectLineItemEstimates = selectedProjectPricedItems/);
  assert.match(component, /pricingRefinementLineItemEstimates = pricingAdjustedLineItemEstimates\.filter/);
  assert.doesNotMatch(component, /Based on your full-project scope and this design's finish level/);
  assert.match(component, /copy\.detail\.customizeTitle/);
  assert.match(component, /data-adventure-ui="refinement-references"/);
  assert.match(component, /Add inspiration/);
  assert.match(component, /copy\.detail\.customizeBody/);
  assert.doesNotMatch(component, /Hide breakdown|Open options|Hide options/);
  assert.doesNotMatch(component, /Included in this example/);
  assert.doesNotMatch(component, /Choose what you want priced/);
  assert.doesNotMatch(component, /Select the full project or an individual line item/);
  assert.doesNotMatch(component, /Select the full project or individual items\. Refine the design to update pricing/);
  assert.doesNotMatch(component, /Interested in the whole project or just part of it/);
  assert.doesNotMatch(component, />Whole project</);
  assert.doesNotMatch(component, /Materials &amp; fixtures/);
  assert.doesNotMatch(component, /Labor &amp; installation/);
  assert.match(component, /pricingDetailMode === "review" \? \(/);
  assert.match(component, /data-mode=\{pricingDetailMode\}/);
  assert.match(component, /data-access=\{state\.emailCaptured \? "unlocked" : "locked"\}/);
  assert.match(component, /className=\{css\.pricingLockedDesignName\}[\s\S]*?>\{selectedProjectTitle\}/);
  assert.doesNotMatch(component, /pricingParts: \[lineItem\.item\]/);
  assert.match(component, /selectedProjectLineItemEstimates/);
  assert.match(component, /pricingAdjustedLineItemEstimates/);
  assert.match(component, /pricingAdjustedProjectRange/);
  assert.match(component, /PRICING_WHAT_IF_LEVELS/);
  assert.match(component, /Simpler/);
  assert.match(component, /As shown/);
  assert.match(component, /Upgrade/);
  assert.match(component, /canRemovePricingItem/);
  assert.match(component, /applyPricingWhatIf/);
  assert.match(component, /pendingPricingWhatIf/);
  assert.match(component, /setPricingEstimateUpdated\(false\);\s*setPendingPricingWhatIf/);
  assert.match(component, /const applied = await applyChange/);
  assert.match(component, /if \(applied\) \{\s*setPricingWhatIfSelections[\s\S]*?setPricingEstimateUpdated\(true\)/);
  assert.match(component, /Your estimate was not changed/);
  assert.match(component, /pricingWhatIfPrompt/);
  assert.match(component, /reference: \{ kind: "item", label: item, target: item \}/);
  assert.match(component, /normalizeProjectManifest/);
  assert.match(component, /manifest\.analysisStatus !== "verified"/);
  assert.match(component, /coversSelectedParts/);
  assert.match(component, /projectManifest\.sceneType !== "full-project"/);
  assert.match(component, /loadManifestPricing/);
  assert.match(component, /pricingManifestEstimates/);
  assert.match(component, /callAdventurePipeline\(\s*"estimate"/);
  assert.doesNotMatch(component, /make the vanity higher-end/);
  assert.doesNotMatch(component, /apportionPriceTotal/);
  assert.doesNotMatch(component, /materialCostShare/);
  assert.doesNotMatch(component, /pricingSelectionRange/);
  assert.match(component, /formatTightPriceBand\(lineItem\.min, lineItem\.max\)/);
  assert.doesNotMatch(component, /projectAreaName\(selectedService\?\.label\)/);
  assert.match(component, /estimateHeading\(selectedService\?\.label/);
  assert.match(component, /<span>\{copy\.detail\.priceLabel\}<\/span>/);
  assert.match(component, /className=\{css\.pricingRefinePanel\}/);
  assert.match(component, /aria-expanded=\{pricingDetailMode === "refine"\}/);
  assert.match(component, /className=\{css\.pricingComponentPicker\}/);
  assert.match(component, />\s*Anywhere\s*<\/AdventureButton>/);
  assert.match(component, /Quick ideas/);
  assert.match(component, /A little cheaper/);
  assert.match(component, /A little more premium/);
  assert.match(component, /callAdventurePipeline\(\s*"refinement_suggestions"/);
  assert.match(component, /Describe a change/);
  assert.match(component, /Change anything/);
  assert.doesNotMatch(component, /Overall direction/);
  assert.match(component, /applyPricingPromptRefinement/);
  assert.match(component, /applyPricingOverallDirection/);
  assert.match(component, /aria-label="Download after image"/);
  assert.match(component, /aria-label="View after image full screen"/);
  assert.match(component, /aria-label="Share after image"/);
  assert.doesNotMatch(component, /Choose what you want to change\. Your estimate stays separate/);
  assert.doesNotMatch(component, /Choose a component/);
  assert.match(component, /Estimate updated/);
  assert.match(component, /View updated estimate/);
  assert.doesNotMatch(component, /const optionMin =/);
  assert.doesNotMatch(component, /const optionMax =/);
  assert.doesNotMatch(component, /className=\{css\.pricingRefineBar\}/);
  assert.doesNotMatch(component, />Change design</);
  assert.doesNotMatch(component, /Close editor/);
  assert.doesNotMatch(component, /pricingRefineOpen|setPricingRefineOpen/);
  assert.doesNotMatch(component, /Refine the after image and your estimate updates with it/);
  assert.doesNotMatch(component, /Pricing unlocked/);
  assert.match(component, /Updating \{pendingPricingWhatIf\?\.item \|\| "design"\}/);
  assert.doesNotMatch(component, /focusOutlineForItem/);
  assert.match(component, /normalizeFocusOutlines/);
  assert.doesNotMatch(component, /pricingFocusMask|pricingComponentFocus|prefetchPricingProjectMasks/);
  assert.doesNotMatch(component, /<mask|<polygon/);
  assert.match(component, /raw\.focusRegions \|\| raw\.focus_regions/);
  assert.match(component, /raw\.focusOutlines \|\| raw\.focus_outlines/);
  assert.match(component, /className=\{css\.pricingPricePanel\}/);
  assert.match(component, /state\.emailCaptured \? "Estimated local price"/);
  assert.doesNotMatch(component, /className=\{css\.pricingUnlockCta\}/);
  assert.match(component, /raw\.projectManifest \|\| raw\.project_manifest \|\| raw\.discovery/);
  assert.match(styles, /\.pricingPriceSummary strong\s*\{[\s\S]*?white-space:\s*nowrap/);
  assert.match(styles, /\.pricingPriceSummary strong\[data-locked="true"\]\s*\{[^}]*filter:\s*none/);
  assert.match(component, /className=\{css\.pricingLockedPriceCurrency\}/);
  assert.match(component, /className=\{css\.pricingLockedPriceDigits\}/);
  assert.match(styles, /\.pricingLockedPriceDigits\s*\{[^}]*filter:\s*blur\(6px\)/);
  assert.match(styles, /\.pricingLockedPriceDash\s*\{[^}]*filter:\s*none/);
  assert.match(styles, /\.pricingInlineUnlockForm\s*\{[^}]*border:\s*1px solid #d8d8d3;[^}]*border-radius:\s*11px/);
  assert.match(styles, /\.pricingInlineUnlockForm:focus-within\s*\{/);
  assert.match(styles, /\.pricingCanvas\s*\{[\s\S]*?flex:\s*1 1 auto/);
  assert.match(styles, /\.pricingCanvasToggle\s*\{/);
  assert.match(styles, /\.pricingCanvasToggle\s*\{[\s\S]*?border-radius:\s*999px/);
  assert.match(styles, /\.pricingCanvasToggle button\s*\{[\s\S]*?min-height:\s*28px/);
  assert.match(styles, /\.pricingCanvasToggle button\[aria-pressed="true"\]/);
  assert.match(styles, /\.pricingPromptControl,\s*\.pricingOverallDirection\s*\{/);
  assert.match(styles, /\.pricingCanvasToggle button\[aria-pressed="true"\]\s*\{[^}]*background:\s*rgba\(255, 255, 255, 0\.92\)/);
  assert.doesNotMatch(styles, /\.pricingComparison\s*\{/);
  assert.match(styles, /\.pricingEstimateHeader\s*\{/);
  assert.match(styles, /\.pricingEstimateCompactPrice\s*\{/);
  assert.match(styles, /\.pricingRefinementSection\s*\{/);
  assert.match(styles, /\.pricingRefinementHeader\s*\{/);
  assert.doesNotMatch(styles, /\.pricingAccordionAction/);
  assert.match(styles, /\.pricingBeforePlaceholder\s*\{[\s\S]*?background:\s*#e5e5e0/);
  assert.match(styles, /\.pricingIncludedBreakdown\s*\{/);
  assert.match(styles, /\.pricingIncludedHeading\s*\{/);
  assert.match(styles, /\.pricingIncludedRows\s*\{/);
  assert.match(styles, /\.pricingIncludedRows > div\s*\{/);
  assert.doesNotMatch(styles, /\.pricingEstimateRows/);
  assert.doesNotMatch(styles, /\.pricingLockedBreakdown\s*\{/);
  assert.doesNotMatch(styles, /\.pricingLockedRows\s*\{/);
  assert.match(styles, /\.pricingRefinementShell\[data-access="locked"\]\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/);
  assert.match(styles, /\.pricingRefinementShell\[data-access="locked"\] \.pricingProjectSummary\s*\{[^}]*border-radius:\s*18px;[^}]*background:\s*rgba\(255, 255, 255, 0\.76\);[^}]*backdrop-filter:\s*blur\(24px\)/);
  assert.doesNotMatch(styles, /\.pricingRefinementShell\[data-access="locked"\] \.pricingProjectSummary::before/);
  assert.match(styles, /\.pricingRefinementShell\[data-access="locked"\] \.pricingRefinementPanel\s*\{[^}]*position:\s*absolute;[^}]*top:\s*auto;[^}]*bottom:\s*16px;[^}]*left:\s*16px;[^}]*width:\s*min\(356px, calc\(100% - 32px\)\)/);
  assert.match(styles, /\.pricingRefinementShell\[data-access="locked"\] \.pricingInlineUnlockForm button\s*\{[^}]*background:\s*#16181c/);
  assert.match(styles, /@media \(max-width:\s*600px\)\s*\{[\s\S]*?\.pricingRefinementShell\[data-access="locked"\] \.pricingRefinementPanel\s*\{[^}]*position:\s*static/);
  assert.match(styles, /@media \(max-width:\s*600px\)\s*\{[\s\S]*?\.pricingRefinementShell\[data-access="locked"\] \.pricingInlineUnlock/);
  assert.doesNotMatch(component, /What can change the price/);
  assert.doesNotMatch(styles, /\.pricingValueDetails\s*\{/);
  assert.match(styles, /\.pricingRefinePanel\s*\{/);
  assert.match(styles, /\.pricingComponentPicker button\[data-selected="true"\]/);
  assert.match(styles, /\.pricingSuggestionControl\s*\{/);
  assert.match(styles, /\.pricingCanvasActions\s*\{/);
  assert.match(styles, /\.pricingCanvasFrame:fullscreen\s*\{/);
  assert.match(styles, /\.pricingRefineUpdated\s*\{/);
  assert.doesNotMatch(styles, /\.pricingRefineCtaBlock\s*\{/);
  assert.doesNotMatch(styles, /\.pricingRefineCtaButton\s*\{/);
  assert.match(styles, /\.pricingRefineChoices\s*\{/);
  assert.match(styles, /\.pricingWhatIfOptions button\[aria-checked="true"\]/);
  assert.match(styles, /\.pricingWhatIfOptions button\[data-pending="true"\]/);
  assert.match(styles, /\.pricingWhatIfError\s*\{/);
  assert.match(styles, /\.pricingUpdateStatus\s*\{/);
  assert.doesNotMatch(styles, /\.pricingScopeChoices\s*\{/);
  assert.doesNotMatch(styles, /\.pricingInvoiceHeader\s*\{/);
  assert.doesNotMatch(styles, /\.pricingInvoiceItem\s*\{/);
  assert.doesNotMatch(styles, /\.pricingInvoiceSplit\s*\{/);
  assert.doesNotMatch(styles, /\.pricingRefineBar\s*\{/);
  assert.doesNotMatch(styles, /\.pricingCanvasRefinement\s*\{/);
  assert.doesNotMatch(styles, /\.pricingRefineBridge\s*\{/);
  assert.doesNotMatch(styles, /\.pricingRefineCta\s*\{/);
  assert.doesNotMatch(styles, /\.pricingRefineComposer\s*\{/);
  assert.doesNotMatch(styles, /\.pricingComponentFocus|\.pricingComponentDim|pricing-focus-mask-in/);
  assert.match(styles, /\.pricingEstimateHeaderTitle\s*\{[\s\S]*?font-size:\s*clamp\(19px/);
  assert.match(styles, /\.pricingEstimateHeaderTitle\s*\{[\s\S]*?font-weight:\s*650/);
  assert.match(styles, /\.pricingRefinementStage \.stageBody\s*\{[\s\S]*width:\s*100%;[\s\S]*max-width:\s*none/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0, 2fr\) minmax\(320px, 1fr\)/);
  assert.match(styles, /\.pricingRefinementShell\s*\{[^}]*gap:\s*14px/);
  assert.match(
    styles,
    /@media \(max-width: 959px\)[\s\S]*?\.pricingRefinementShell\s*\{[^}]*display:\s*flex;[^}]*flex:\s*0 0 auto;[^}]*flex-direction:\s*column/,
  );
  assert.match(
    styles,
    /@media \(max-width: 959px\)[\s\S]*?\.pricingCanvas\s*\{[^}]*flex:\s*0 0 auto;[^}]*aspect-ratio:\s*4 \/ 3/,
  );
  assert.match(styles, /\.pricingProjectSummary\s*\{[^}]*padding:\s*15px 16px/);
  assert.doesNotMatch(component, /generateStarterCanvas/);
  assert.doesNotMatch(component, /generateV8StarterImage/);
  assert.doesNotMatch(component, /Create a plain starter image/);
  assert.doesNotMatch(component, /css\.masonryBoard/);
  assert.match(pipelineClient, /\| "discovery"/);
  assert.match(pipelineClient, /\| "refinement_suggestions"/);
});

test("budget bands render instantly and prefetch once per service and scope", () => {
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  const styles = read("components/adventure/v8/configurator-v8.module.css");

  assert.match(component, /callAdventurePipeline\("budget_bands", \{/);
  assert.match(component, /scopes: pricingScopes/);
  assert.match(component, /budgetBandCacheRef/);
  assert.match(component, /budgetBandInflightRef/);
  assert.match(component, /still on scope/);
  assert.match(component, /Local bands remain the instant, never-blocking fallback/);
  assert.match(component, /Never move the choices after the visitor has picked a band/);
  assert.match(component, /finishTierId: null/);
  assert.match(component, /broadBudgetRanges/);
  assert.match(component, /maxChoices = 6/);
  assert.doesNotMatch(component, /budgetBandsLoading/);
  assert.doesNotMatch(component, /Calculating your price ranges…/);
  assert.doesNotMatch(component, /Scope-based pricing/);
  assert.doesNotMatch(component, /Provider pricing/);
  assert.doesNotMatch(component, /We calculate these from your service and scope/);
  assert.doesNotMatch(styles, /\.budgetBandRegion\s*\{/);
  assert.doesNotMatch(styles, /\.budgetBasis\s*\{/);
  assert.match(styles, /\.bandGrid\s*\{/);
  assert.doesNotMatch(styles, /\.budgetBandsLoader\s*\{/);
});

test("designer navbar refresh clears the V8 session for that preview", () => {
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  const preview = readFileSync(
    resolve(repoRoot, "apps/designer/src/components/features/IframeWidgetPreview.tsx"),
    "utf8"
  );
  const designerPage = readFileSync(
    resolve(
      repoRoot,
      "apps/designer/app/(main)/[accountId]/designer-instances/instance/[instanceId]/ClientPage.tsx"
    ),
    "utf8"
  );

  assert.match(designerPage, /detail: \{ resetSession: true, source: 'navbar' \}/);
  assert.match(preview, /setFreshNonce\(\(n\) => n \+ 1\)/);
  assert.match(component, /adventure:v8:fresh-consumed:/);
  assert.match(component, /clearV8Snapshot/);
  assert.match(component, /event\.data\.type === "SIF_RESET_SESSION" \|\| event\.data\.type === "RESET_SESSION"/);
  assert.match(component, /resetExperience\("designer_refresh"\)/);
});

test("V8 implements the branch-aware pricing funnel", () => {
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  const copySource = read("components/adventure/v8/adventureCopy.ts");
  const types = read("components/adventure/v8/types.ts");
  const sequence = component.match(/const STAGE_ORDER: V8Stage\[\] = \[([\s\S]*?)\];/);
  assert.ok(sequence, "STAGE_ORDER should be declared");
  const stages = Array.from(sequence[1].matchAll(/"([a-z]+)"/g)).map((match) => match[1]);
  assert.deepEqual(stages, [
    "service",
    "project",
    "budget",
    "path",
    "style",
    "visual",
    "price",
    "connect",
    "done",
  ]);

  assert.match(component, /requestIntake/);
  assert.match(component, /serviceSkipped/);
  assert.match(component, /selectionType/);
  assert.match(component, /What would you like to include\?/);
  assert.match(component, /scopeIntakeForService/);
  assert.match(component, /buildScopeQuestion/);
  assert.match(component, /projectMode/);
  assert.doesNotMatch(component, /Everything/);
  assert.doesNotMatch(component, /PROJECT_QUESTIONS/);
  assert.doesNotMatch(component, /What would you like to design\?/);
  assert.match(copySource, /secondary: "Skip for now"/);
  assert.match(component, /forwardAction\("Continue"\)/);
  assert.doesNotMatch(component, /Next: budget →/);
  assert.match(component, /What price range works for you\?/);
  assert.match(component, /Pick the closest range/);
  assert.doesNotMatch(component, /What price range fits your project\?/);
  assert.match(component, /finishTiersForScope/);
  assert.match(component, /loadPricingGallery/);
  assert.match(component, /enterStudioWithLook/);
  assert.match(component, /callAdventurePipeline\(\s*"discovery"/);
  assert.doesNotMatch(component, /liveEstimate/);
  assert.match(component, /callAdventurePipeline\(\s*"estimate"/);
  assert.match(component, /generatePhotoConcept/);
  assert.doesNotMatch(component, /applyLookControls/);
  assert.doesNotMatch(component, /Color \/ Mood/);
  assert.match(component, /Describe any other change/);
  assert.match(component, /Built from your \$\{industryLanguage\.space\}/);
  assert.doesNotMatch(component, /Edit service\/scope/);
  assert.doesNotMatch(component, /Couldn’t update that look/);
  assert.match(component, /What&apos;s included/);
  assert.doesNotMatch(component, /scopeTweaks/);
  assert.match(component, /railPriceLocked/);
  assert.match(component, /goToPrice/);
  assert.match(component, /priceUnlockLink/);
  assert.match(component, /generateV8DesignImage/);
  assert.match(component, /className=\{css\.railApply\}/);
  assert.match(component, /Items &amp; materials/);
  assert.match(component, /Full-room styles/);
  assert.match(component, /name="v8-refinement-section"/);
  assert.match(component, /openRefinementSection/);
  assert.match(component, /if \(isStylePreset\) setOpenRefinementSection\("items"\)/);
  assert.match(component, /open=\{openRefinementSection === "styles"\}/);
  assert.match(component, /open=\{openRefinementSection === "items"\}/);
  assert.match(component, /stylesSection/);
  assert.match(component, /itemsSection/);
  assert.match(component, /Boutique hotel/);
  assert.match(component, /CURATED_STYLE_REFERENCES/);
  assert.match(component, /styleReferenceImage/);
  assert.match(component, /mediterranean-clay\.jpg/);
  assert.doesNotMatch(component, /<img src=\{selectedDesign\.url\} alt="" loading="lazy"/);
  assert.match(component, /selectedRefinementReference/);
  assert.match(component, /activeRefinementReference\?\.kind === "item"/);
  assert.doesNotMatch(component, /styleUrls: literalReferenceUrls/);
  assert.doesNotMatch(component, /selectedRefinementReference\.previewUrl/);
  assert.doesNotMatch(component, /Image 2 is the .* full-room style reference/);
  assert.match(component, /STRICT LOCAL IN-PLACE COMPONENT EDIT/);
  assert.match(component, /selector thumbnail is a visual menu preview only/);
  assert.match(component, /exact existing silhouette and immediate material contact edges/);
  assert.match(component, /Pixels and objects outside that boundary are locked/);
  assert.match(component, /target: option\.target \|\| category\.label/);
  assert.match(component, /STYLE FINGERPRINT/);
  assert.match(component, /eucalyptus and sage green the dominant palette/);
  assert.match(component, /Remove conflicting beige marble/);
  assert.doesNotMatch(component, /organic-spa design language: pale limestone and warm mineral neutrals/);
  assert.match(component, /TOTAL, MUTUALLY EXCLUSIVE WHOLE-ROOM STYLE REPLACEMENT/);
  assert.match(component, /revokes every earlier room-style preset/);
  assert.match(component, /Remove all visually conflicting remnants of the prior style/);
  assert.match(component, /Do not paste in another room/);
  assert.match(component, /same room professionally restyled in place/);
  assert.match(component, /stylePrompt: option\.prompt/);
  assert.match(component, /const refinementSourceDesign = isStylePreset/);
  assert.match(component, /look\.direction\?\.family === "global_style"/);
  assert.match(component, /photoUrl: isSpaceReference/);
  assert.match(component, /styleUrls: activeRefinementReference\?\.imageUrl/);
  assert.match(component, /family: plan\.mode/);
  assert.match(component, /View &amp; angle/);
  assert.match(component, /Side view/);
  assert.match(component, /Copper fixtures/);
  assert.match(component, /Higher end/);
  assert.match(component, /Lower cost/);
  assert.match(component, /budgetRefinementStepFor/);
  assert.match(component, /BUDGET_REFINEMENT_MIN_STEP = 500/);
  assert.match(component, /BUDGET_REFINEMENT_MAX_STEP = 2_000/);
  assert.doesNotMatch(component, /BUDGET_REFINEMENT_STEP = 5_000/);
  assert.match(component, /BUDGET CONTROL: Move the current design one small finish-quality step up/);
  assert.match(component, /BUDGET CONTROL: Value engineer the current design by one small finish-quality step/);
  assert.match(component, /void applyChange\(\{ note, budgetDelta, reference: null \}\)/);
  assert.match(component, /const applyChange = async \(override\?/);
  assert.match(component, /activeRefinementReference/);
  assert.match(component, /FORCED WHOLE-DESIGN FINISH-TIER SHIFT/);
  assert.match(component, /do not interpret this as a single-component edit/);
  assert.match(component, /color grading as a substitute/);
  assert.match(component, /downloadDesign/);
  assert.match(component, /viewDesignFullscreen/);
  assert.match(component, /Design revision history/);
  assert.match(component, /Previous design version/);
  assert.match(component, /Next design version/);
  assert.match(component, /looks: history/);
  assert.match(component, /pendingBudgetDelta/);
  assert.match(component, /editable areas/);
  assert.match(component, /loadRefinementCategoryImages/);
  assert.match(component, /Looking at this design/);
  assert.doesNotMatch(component, /fallbackRefinementCatalog/);
  assert.match(component, /fetchV8RefinementCatalog/);
  assert.match(component, /REFINE_LIMIT = 8/);
  assert.match(component, /use warmer finishes/);
  assert.doesNotMatch(component, /enterRefine/);
  assert.match(copySource, /Like this direction\? Make it yours/);
  assert.doesNotMatch(component, /Go with this →/);
  assert.doesNotMatch(component, /You can refine this, or go with it/);
  assert.doesNotMatch(component, /makeDesigns/);
  assert.match(component, /Use this inspiration for the colors, materials, and overall feel/);
  assert.doesNotMatch(component, /None of these\? Try a fresh set/);
  assert.doesNotMatch(component, /LOOK_TARGET/);
  assert.doesNotMatch(component, /Scroll for more/);
  assert.doesNotMatch(component, /Get inspired/);
  assert.match(component, /See what this version of your \$\{industryLanguage\.space\} could cost/);
  assert.match(component, /Unlock my pricing/);
  assert.match(component, /Want a tighter estimate\?/);

  assert.doesNotMatch(component, /tasteTags/);
  assert.doesNotMatch(component, /EXPLORATION_TARGET/);
  assert.doesNotMatch(component, /analyze_photo/);
  assert.doesNotMatch(component, /suggest_scopes/);
  assert.doesNotMatch(component, /scope_covers/);
  assert.doesNotMatch(types, /\| "review"/);
  assert.match(component, /"path"/);
  assert.doesNotMatch(component, /"exploration"/);
  assert.doesNotMatch(component, /"consultation"/);
});

test("V8 asks for a project photo and uses it as the visual foundation", () => {
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  const copySource = read("components/adventure/v8/adventureCopy.ts");
  const types = read("components/adventure/v8/types.ts");
  const serviceTypes = read("components/adventure/v2/types.ts");
  const widgetRoute = read("app/api/widget/[instanceId]/route.ts");
  const photoContextMigration = readFileSync(
    resolve(repoRoot, "supabase/migrations/20260901010000_add_service_photo_context.sql"),
    "utf8"
  );

  assert.match(types, /\| "path"/);
  assert.match(copySource, /Got a photo of your \$\{language\.photoSubject\}\?/);
  assert.match(copySource, /base the estimate on the real thing/);
  assert.match(component, /\{copy\.photo\.primary\}/);
  assert.match(component, /data-adventure-ui="photo-benefit"/);
  assert.match(types, /\| "style"/);
  assert.match(copySource, /secondary: "Skip for now"/);
  assert.match(copySource, /More accurate estimate/);
  assert.match(copySource, /Your photo helps us understand/);
  assert.match(component, /photoInputExample/);
  assert.match(component, /photoResultExample/);
  assert.doesNotMatch(component, /css\.photoBenefitArrow/);
  assert.match(serviceTypes, /photoSubject\?: string \| null/);
  assert.match(serviceTypes, /photoContext\?: string \| null/);
  assert.match(widgetRoute, /photo_subject, photo_context/);
  assert.match(component, /photoSubject: service\?\.photoSubject \?\? service\?\.photo_subject/);
  assert.match(photoContextMigration, /add column if not exists photo_subject text/);
  assert.match(photoContextMigration, /add column if not exists photo_context text/);
  assert.match(component, /\/api\/v2\/assets\//);
  assert.match(component, /capture="environment"/);
  assert.match(component, /stage: "style"/);
  assert.match(component, /Which look feels closest\?/);
  assert.match(component, /FULL_ROOM_STYLES\.slice\(0, 6\)/);
  assert.match(component, /Generate my personalized concept/);
  assert.match(component, /generatePhotoConcept/);
  assert.match(component, /photoUrl: current\.photoUrl/);
  assert.match(component, /styleUrls: absoluteStyleReference \? \[absoluteStyleReference\] : \[\]/);
  assert.match(component, /Preserve the actual spatial structure/);
  assert.match(component, /Focus the transformation on/);
  assert.match(component, /mode: "photo_concept"/);
  assert.match(component, /useCase: "scene-refinement"/);
  assert.match(component, /onClick=\{\(\) => void continueWithoutPhoto\(\)\}/);
  assert.doesNotMatch(component, /Ask me for a photo later/);
  assert.doesNotMatch(component, /photoFollowUp/);
  assert.doesNotMatch(component, /partial: true/);
  assert.match(component, /Apply this design to my actual space/);
  assert.match(component, /photo_application/);
  assert.match(component, /Text me so I can send a photo/);
});

test("V8 pipeline client exposes intake, pricing discovery, and handoff actions", () => {
  const client = read("components/adventure/v8/adventurePipelineClient.ts");
  assert.match(client, /"handoff"/);
  assert.match(client, /"budget_bands"/);
  assert.match(client, /"intake"/);
  assert.doesNotMatch(client, /"library"/);
  assert.match(client, /"discovery"/);
  assert.doesNotMatch(client, /"inspiration"/);
  assert.doesNotMatch(client, /"ideas"/);
  assert.doesNotMatch(client, /"refine"/);
  assert.match(client, /"estimate"/);
  assert.match(client, /"project_manifest"/);
  assert.match(client, /analyzeV8ProjectManifest/);
  assert.doesNotMatch(client, /fetchInstanceCatalogLooks/);
  assert.doesNotMatch(client, /\/api\/sample-gallery\//);
  assert.match(client, /modelId/);
  assert.doesNotMatch(client, /"taste"/);
  assert.doesNotMatch(client, /"analyze_photo"/);
  assert.doesNotMatch(client, /"consult"/);
  assert.doesNotMatch(client, /"suggest_scopes"/);
  assert.doesNotMatch(client, /"scope_covers"/);
  assert.match(client, /\/api\/generate\/scene/);
  assert.match(client, /\/api\/generate\/scene-placement/);
  assert.match(client, /\/api\/generate\/scene-refinement/);
  assert.match(client, /sceneImage/);
  assert.match(client, /generateV8DesignImages/);
  assert.match(client, /\/api\/adventure\/v8\/.*curate/);
});

test("V8 scope options come from the selected service, not a hardcoded pool list", () => {
  const recipes = read("components/adventure/v8/scopeRecipes.ts");
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  assert.match(recipes, /Full Bathroom Remodel/);
  assert.match(recipes, /Full Landscape Project/);
  assert.match(recipes, /Whole House/);
  assert.match(recipes, /Complete Pool Remodel/);
  assert.doesNotMatch(recipes, /Everything/);
  assert.match(recipes, /storedScopeParts/);
  assert.match(recipes, /subcategoryScope|knownParts/);
  assert.match(component, /scopeIntakeForService/);
  assert.match(component, /subcategoryScope/);
  assert.match(component, /What would you like to include\?/);
});

test("V8 branches from scope and budget into photo concepts or pricing discovery", () => {
  const recipes = read("components/adventure/v8/generationRecipes.ts");
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  const copySource = read("components/adventure/v8/adventureCopy.ts");
  assert.match(recipes, /finishTiersForScope/);
  assert.match(recipes, /adjacentFinishTiers/);
  assert.match(component, /generatePhotoConcept/);
  assert.match(component, /loadPricingGallery/);
  assert.match(component, /looks: \[look\]/);
  assert.match(component, /selectedDesignId: look\.id/);
  assert.match(copySource, /secondary: "Skip for now"/);
  assert.match(component, /"discovery"/);
  assert.doesNotMatch(component, /css\.masonryBoard/);
  assert.doesNotMatch(component, /applyLookControls/);
  assert.doesNotMatch(component, /Color \/ Mood/);
  assert.doesNotMatch(component, /See a starter →/);
  assert.match(component, /formatChipBand/);
  assert.match(component, /What price range works for you\?/);
  assert.doesNotMatch(component, /bandLabel/);
  assert.doesNotMatch(component, /tier\.label/);
  assert.doesNotMatch(component, /fetchInstanceCatalogLooks/);
  assert.doesNotMatch(component, /No photos in this catalog yet/);
  assert.doesNotMatch(component, /Try another budget/);
  const client = read("components/adventure/v8/adventurePipelineClient.ts");
  assert.match(client, /AbortSignal\.timeout/);
  assert.match(client, /45000/);
});

test("V8 persists the lead when email unlocks the price", () => {
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  assert.match(component, /\/api\/adventure\/v8\/leads/);
  assert.match(component, /setPricingDetailMode\("review"\);[\s\S]*?emailCaptured: true/);
  assert.match(component, /selectedProjectPricedItems\.map\(\(item\) =>/);
  assert.match(component, /pricingManifestPricingStatus === "failed"[\s\S]*?"Unavailable"[\s\S]*?"Calculating…"/);
  assert.match(component, /data-adventure-ui="estimate-breakdown"/);
  const leads = read("app/api/adventure/v8/leads/route.ts");
  assert.match(leads, /experienceVersion: "v8"/);
  assert.match(leads, /form_submissions/);
});

test("vertical matching uses the service name, not spa/pool substrings in summaries", () => {
  assert.equal(verticalKey("Home services", "Landscaping", "Outdoor living spaces with spa-like seating"), "landscaping");
  assert.equal(verticalKey("Home improvement", "Bathroom Remodeling", "spa-like whirlpool tub"), "bathroom");
  assert.equal(verticalKey("Home services", "Kitchen Remodeling", "open concept spaces"), "kitchen");
  assert.equal(verticalKey(null, "Pool Remodel", null), "pool");
  assert.equal(verticalKey(null, "Spa", null), "pool");
  assert.equal(verticalKey("Outdoor living spaces", "", "sparkling garden spaces"), "landscaping");
  assert.equal(verticalKey(null, "Windows & Doors", null), "windows");
  assert.equal(verticalKey(null, "Window Replacement", null), "windows");
  assert.equal(lookConflictsWithService({
    imageText: "Kitchen island white oak",
    serviceLabel: "Bathroom Remodel",
  }), true);
  assert.equal(lookConflictsWithService({
    imageText: "Warm oak vanity",
    serviceLabel: "Bathroom Remodel",
  }), false);
  assert.equal(lookConflictsWithService({
    imageText: "Windows / Doors",
    serviceLabel: "Bathroom Remodel",
  }), true);
  assert.equal(lookConflictsWithService({
    imageText: "Sliding patio door",
    serviceLabel: "Windows and Doors",
  }), false);
});

test("inspiration board drops tile macros and off-scope catalog shots", () => {
  const showerTub = ["Shower", "Tub"];
  assert.equal(looksLikeMaterialSwatch("close-up of four off-white textured tiles"), true);
  assert.equal(looksLikeMaterialSwatch("patterned tile"), true);
  assert.equal(looksLikeMaterialSwatch("Tile"), true);
  assert.equal(looksLikeMaterialSwatch("Used on local projects Tile"), true);
  assert.equal(
    looksLikeMaterialSwatch("navy subway tile, cream walls, chrome rain head and tub filler"),
    false
  );

  assert.equal(
    lookFitsSelectedScopes({
      imageText: "patterned tile decorative star mosaic",
      scopes: showerTub,
    }),
    false
  );
  assert.equal(
    lookFitsSelectedScopes({
      imageText: "From our work",
      scopes: showerTub,
      generatedFor: "subcategory_catalog",
    }),
    false
  );
  assert.equal(
    lookFitsSelectedScopes({
      imageText: "Warm oak vanity",
      scopes: showerTub,
    }),
    false
  );
  assert.equal(
    lookFitsSelectedScopes({
      imageText: "navy shaker cabinets",
      scopes: showerTub,
    }),
    false
  );
  assert.equal(
    lookFitsSelectedScopes({
      imageText: "navy subway shower with chrome rain head",
      scopes: showerTub,
    }),
    true
  );
  assert.equal(
    lookFitsSelectedScopes({
      imageText: "full bathroom remodel with soaking tub",
      scopes: showerTub,
    }),
    true
  );
  assert.equal(
    lookFitsSelectedScopes({
      imageText: "macro lawn grass and potting soil close-up",
      scopes: ["Patio / terrace"],
    }),
    false
  );
  assert.equal(
    lookFitsSelectedScopes({
      imageText: "finished paver patio terrace with outdoor seating",
      scopes: ["Patio / terrace"],
    }),
    true
  );
});

test("scope step prefers the selected service's stored industry parts", () => {
  const stored = buildScopeQuestion({
    serviceLabel: "Landscaping",
    summary: "Outdoor living spaces",
    knownParts: ["Pavers", "Planting", "Irrigation"],
  });
  assert.equal(stored.source, "service");
  assert.deepEqual(
    stored.choices.map((c) => c.label),
    ["Full Landscape Project", "Pavers", "Planting", "Other"]
  );
  assert.equal(stored.choices.some((c) => /shell|waterline|pool/i.test(c.label)), false);

  const fallback = buildScopeQuestion({ serviceLabel: "Bathroom Remodeling" });
  assert.equal(fallback.source, "recipe");
  assert.equal(fallback.choices[0].label, "Full Bathroom Remodel");
  assert.ok(fallback.choices.some((c) => c.label === "Vanity"));
});

test("scope step only offers visually representable project parts", () => {
  const scope = buildScopeQuestion({
    serviceLabel: "Bathroom Remodel",
    knownParts: [
      "Shower / tub",
      "Vanity",
      "Floor tile",
      "Exhaust fan",
      "Flooring (non-tile)",
      "Layout changes",
      "Plumbing updates",
      "Project management",
    ],
  });

  assert.ok(scope.choices.some((choice) => choice.label === "Shower / tub"));
  assert.ok(scope.choices.some((choice) => choice.label === "Vanity"));
  assert.ok(scope.choices.some((choice) => choice.label === "Floor tile"));
  assert.ok(scope.choices.some((choice) => choice.role === "full"));
  assert.ok(scope.choices.some((choice) => choice.role === "other"));
  assert.ok(!scope.choices.some((choice) => choice.label === "Layout changes"));
  assert.ok(!scope.choices.some((choice) => choice.label === "Plumbing updates"));
  assert.ok(!scope.choices.some((choice) => choice.label === "Project management"));
  assert.ok(!scope.choices.some((choice) => choice.label === "Exhaust fan"));
  assert.ok(!scope.choices.some((choice) => choice.label === "Flooring (non-tile)"));
  assert.equal(isVisualScopePart("Lighting"), true);
  assert.equal(isVisualScopePart("Electrical updates"), false);
  assert.equal(isVisualScopePart("Exhaust fan", "bathroom"), false);
  assert.equal(isVisualScopePart("Flooring (non-tile)", "bathroom"), false);
  assert.equal(isVisualScopePart("Pavers", "landscaping"), true);
  assert.equal(isVisualScopePart("Irrigation", "landscaping"), false);
  assert.equal(isVisualScopePart("Waterline tile", "pool"), true);
  assert.equal(isVisualScopePart("Pool equipment", "pool"), false);
});

test("stored scope parts are filtered through the selected service's visual vocabulary", () => {
  const cases = [
    {
      serviceLabel: "Bathroom Remodeling",
      knownParts: ["Vanity", "Wall tile", "Exhaust fan", "Flooring (non-tile)", "Waterproofing"],
      expected: ["Vanity", "Wall tile"],
    },
    {
      serviceLabel: "Kitchen Remodeling",
      knownParts: ["Cabinets", "Backsplash", "Plumbing", "Electrical updates", "Ventilation"],
      expected: ["Cabinets", "Backsplash"],
    },
    {
      serviceLabel: "Landscaping",
      knownParts: ["Pavers", "Planting", "Irrigation", "Drainage", "Grading"],
      expected: ["Pavers", "Planting"],
    },
    {
      serviceLabel: "Pool Remodeling",
      knownParts: ["Waterline Tile", "Deck", "Equipment", "Pump", "Filter"],
      expected: ["Waterline Tile", "Deck"],
    },
    {
      serviceLabel: "Roofing",
      knownParts: ["Shingles", "Gutters", "Ventilation", "Underlayment"],
      expected: ["Shingles", "Gutters"],
    },
    {
      serviceLabel: "Pergola Installation",
      knownParts: ["Structure", "Ceiling Fan", "Lighting", "Electrical"],
      expected: ["Structure", "Ceiling Fan", "Lighting"],
    },
  ];

  for (const sample of cases) {
    const question = buildScopeQuestion(sample);
    const visibleParts = question.choices
      .filter((choice) => choice.role === "part")
      .map((choice) => choice.label);
    assert.deepEqual(visibleParts, sample.expected, sample.serviceLabel);
  }
});

test("gallery generation is quality-first and cannot be downgraded by the visitor", () => {
  assert.equal(assignDiscoveryModel("session-alpha"), DISCOVERY_MODELS.libraryQuality);
  assert.equal(assignDiscoveryModel("session-beta"), DISCOVERY_MODELS.libraryQuality);
  assert.equal(assignDiscoveryModel("anything", "imagen"), DISCOVERY_MODELS.libraryQuality);
  assert.equal(assignDiscoveryModel("anything", "flux-schnell"), DISCOVERY_MODELS.libraryQuality);
});

test("interactive V8 edits route broad or targeted upgrades through the right model path", () => {
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  assert.match(component, /buildRefinementPlan/);
  assert.match(component, /const primaryModel = DISCOVERY_MODELS\.fastEdit/);
  assert.match(component, /generationIntent: plan\.generationIntent/);
  assert.match(component, /DISCOVERY_MODELS\.fastEdit/);
  assert.doesNotMatch(component, /fallbackModel/);

  const terracotta = buildRefinementPlan({
    note: "give the whole bathroom a total terracotta vibe",
    serviceLabel: "Bathroom Remodel",
    scopeLabel: "Full Bathroom Remodel",
    budget: 12000,
  });
  assert.equal(terracotta.mode, "global_style");
  assert.equal(terracotta.generationIntent, "style_shift");
  assert.equal(terracotta.modelPath, "quality-first");
  assert.match(terracotta.prompt, /whole-canvas style shift/i);
  assert.match(terracotta.prompt, /not a small accent/i);

  const vanity = buildRefinementPlan({
    note: "change the vanity to something higher end",
    serviceLabel: "Bathroom Remodel",
    scopeLabel: "Vanity",
    budget: 6500,
  });
  assert.equal(vanity.mode, "component_tier_shift");
  assert.equal(vanity.target, "vanity");
  assert.equal(vanity.generationIntent, "component_tier_shift");
  assert.equal(vanity.modelPath, "quality-first");
  assert.match(vanity.prompt, /Primary target: vanity/);
  assert.match(vanity.prompt, /tiny color shift is not enough/i);
  assert.equal(vanity.estimatedBudgetDelta, 5000);

  const humaneVanity = buildRefinementPlan({
    note: "make the vanity not look like crap",
    serviceLabel: "Bathroom Remodel",
    scopeLabel: "Vanity",
    budget: 6500,
  });
  assert.equal(humaneVanity.mode, "targeted_component");
  assert.doesNotMatch(humaneVanity.interpretedNote, /crap/i);
  assert.match(humaneVanity.prompt, /professionally designed/i);

  const cofferedCeiling = buildRefinementPlan({
    note: "make a coffered ceiling",
    serviceLabel: "Bathroom Remodel",
    scopeLabel: "Full Bathroom Remodel",
    budget: 15000,
  });
  assert.equal(cofferedCeiling.target, "ceiling");
  assert.match(cofferedCeiling.prompt, /symmetrical ceiling detailing/i);
  assert.match(cofferedCeiling.prompt, /sensible panel spacing/i);

  const mirror = buildRefinementPlan({
    note: "make the mirror round",
    serviceLabel: "Bathroom Remodel",
    scopeLabel: "Mirror",
    budget: 6500,
  });
  assert.equal(mirror.mode, "targeted_component");
  assert.equal(mirror.target, "mirror");
  assert.equal(mirror.modelPath, "fast-first");

  const sideView = buildRefinementPlan({
    note: "show a side view of this same bathroom",
    serviceLabel: "Bathroom Remodel",
    scopeLabel: "Vanity",
    budget: 6500,
  });
  assert.equal(sideView.mode, "camera_shift");
  assert.equal(sideView.generationIntent, "camera_shift");
  assert.match(sideView.prompt, /exact fixture or outdoor-zone inventory/i);
  assert.doesNotMatch(sideView.prompt, /Preserve the same camera/i);

  const valueEngineered = buildRefinementPlan({
    note: "value engineer the complete design to save about $5,000",
    serviceLabel: "Bathroom Remodel",
    scopeLabel: "Vanity and tile",
    budget: 15000,
  });
  assert.equal(valueEngineered.mode, "budget_shift");
  assert.equal(valueEngineered.generationIntent, "value_engineering");
  assert.equal(valueEngineered.estimatedBudgetDelta, -5000);
  assert.match(valueEngineered.prompt, /never cheap or deliberately ugly/i);
});

test("V8 builds an image-aware multi-component refinement subsystem", () => {
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  const client = read("components/adventure/v8/adventurePipelineClient.ts");
  const route = read("app/api/adventure/v8/[instanceId]/refinement-catalog/route.ts");
  const optionImagesRoute = read("app/api/ai-form/[instanceId]/option-images/generate/route.ts");

  assert.match(client, /\/refinement-catalog`/);
  assert.match(client, /imageUrl/);
  assert.match(component, /materialCategoryList/);
  assert.match(component, /name="v8-material-category"/);
  assert.match(component, /categoryOpen \? \(/);
  assert.doesNotMatch(component, /className=\{css\.categoryPicker\}/);
  assert.match(component, /Finding visible items/);
  assert.match(component, /liveRefinementCatalog\.categories\.map/);
  assert.match(component, /loadRefinementCategoryImages\(category\)/);
  assert.match(component, /Generating \{category\.options\.length\}/);
  assert.match(component, /thumbnailBudgetTier/);
  assert.match(route, /Return 6 to 8 useful categories and exactly 5 options per category/);
  assert.match(route, /rawCategories\.slice\(0, 8\)/);
  assert.match(route, /do not stop at four/);
  assert.match(route, /type: "image_url"/);
  assert.match(route, /rawOptions\.slice\(0, 5\)/);
  assert.match(route, /options\.length !== 5/);
  assert.match(route, /budgetDelta/);
  assert.match(route, /imagePrompt/);
  assert.match(route, /product-only description of the exact single item or material selection/);
  assert.match(route, /preserve exact fixture\/zone counts/i);
  assert.match(route, /BATHROOM_ITEM_PREVIEWS/);
  assert.match(route, /toilet-clean-skirted\.jpg/);
  assert.match(route, /toilet-integrated-bidet\.jpg/);
  assert.match(route, /curatedItemPreview/);
  assert.match(route, /canonicalizeCuratedOptions/);
  assert.match(route, /canonical\.options\.map/);
  assert.match(route, /tile\|backsplash/);
  assert.doesNotMatch(route, /optionIndex % options\.length/);
  assert.match(route, /subjectHits > 0 && entry\.choiceHits > 0/);
  assert.match(route, /fallbackImageUrl: curated/);
  assert.doesNotMatch(route, /IMAGE_POOLS/);
  assert.match(component, /item or material reference/);
  assert.match(client, /generateV8RefinementOptionImages/);
  assert.match(client, /v8-refinement-thumbnail/);
  assert.match(client, /Product-only catalog thumbnail/);
  assert.match(client, /Show exactly one isolated/);
  assert.match(client, /No full room/);
  assert.match(client, /options\.slice\(0, 5\)\.map/);
  assert.match(optionImagesRoute, /black-forest-labs\/flux-schnell/);
  assert.match(optionImagesRoute, /isV8RefinementThumbnailRequest/);
  assert.match(optionImagesRoute, /!optionImagesEnabled && !isV8RefinementThumbnailRequest/);
});

test("V8 hydrates local style and item references before fast multi-image edits", () => {
  const route = read("app/api/generate/scene-refinement/route.ts");
  assert.match(route, /LOCAL_REFERENCE_ROOTS/);
  assert.match(route, /adventure\/style-references\//);
  assert.match(route, /adventure\/item-references\//);
  assert.match(route, /localReferenceDataUrl/);
  assert.match(route, /data:\$\{mime\};base64/);
  assert.match(route, /Promise\.all\(rawExtraRefs\.map/);
});

test("discovery prompts keep scope as the hard constraint", () => {
  assert.equal(discoveryRoom({ serviceLabel: "Bathroom Remodel" }), "residential bathroom");
  const prompt = buildDiscoveryPrompt({
    room: "residential bathroom",
    serviceLabel: "Bathroom Remodel",
    scopes: ["Vanity", "Flooring"],
    budget: 15000,
    direction: { label: "warm modern", prompt: "warm wood, pale stone, bright daylight" },
  });
  assert.match(prompt, /Vanity and Flooring must be clearly visible/);
  assert.match(prompt, /do not generate a generic residential bathroom/);
  assert.match(prompt, /warm wood, pale stone, bright daylight/);
  assert.match(prompt, /\$15,000/);
  assert.match(prompt, /do not show a different trade/);
  assert.match(prompt, /all-white builder bathroom/i);
  assert.match(prompt, /typical American residential layout|Match the camera angle/);
  assert.match(prompt, /within 5%/);
  assert.match(prompt, /Priority: realistic layout/);
  assert.equal(discoveryRoom({ serviceLabel: "Windows & Doors" }), "residential windows and exterior doors on a home");

  const room = buildDiscoveryPrompt({
    room: "residential bathroom",
    serviceLabel: "Bathroom Remodel",
    scopes: ["Vanity"],
    budget: 5000,
    direction: { label: "warm modern", prompt: "warm wood, pale stone, bright daylight" },
    focus: "room",
    hero: "Vanity",
  });
  assert.match(room, /Full residential bathroom in limited context/);
  assert.match(room, /The Vanity must still be clearly visible/);
  assert.match(room, /No luxury stone/);
  assert.match(room, /do not default to an all-white room/);
});

test("gallery mix favors selected parts and drops luxury above the budget", () => {
  const mixed = planGalleryShots(12, ["Vanity", "Tile"]);
  assert.ok(mixed.every((s) => s.heroes.includes("Vanity") && s.heroes.includes("Tile")));
  assert.ok(mixed.filter((s) => s.focus === "room").length >= 6);
  const vanityFloor = planGalleryShots(6, ["Vanity", "Flooring"]);
  assert.ok(vanityFloor.every((s) => s.heroes.includes("Vanity") && s.heroes.includes("Flooring")));
  assert.match(
    vanityFloor.map((s) => s.hero).join(" "),
    /Vanity|Flooring/
  );
  assert.equal(tooExpensiveForBudget("$$$$", 5000), true);
  assert.equal(tooExpensiveForBudget("$", 5000), false);
  assert.equal(tooExpensiveForBudget("$$", 5000), true);
  assert.equal(withinBudgetWindow({ budget: 6500, mid: 6500 }), true);
  assert.equal(withinBudgetWindow({ budget: 6500, mid: 8000 }), false);
  const est = pinEstimate(6500, "navy-shower");
  assert.ok(est.min >= Math.round(6500 * 0.95) - 50);
  assert.ok(est.max <= Math.round(6500 * 1.05) + 50);
  assert.ok(est.min <= 6500 && est.max >= 6500);
  const bandEstimates = ["a", "b", "c", "d", "e", "f"].map((seed) =>
    projectEstimateForBand(5000, 10_000, seed)
  );
  assert.ok(bandEstimates.every((range) => range.min >= 5000 && range.max <= 10_000));
  assert.ok(new Set(bandEstimates.map((range) => `${range.min}-${range.max}`)).size >= 3);
  assert.ok(scopeLineItemWeight("Vanity") > scopeLineItemWeight("Toilet"));
  assert.ok(scopeLineItemWeight("Wall tile") > scopeLineItemWeight("Lighting"));
  assert.notEqual(scopeLineItemWeight("Vanity"), scopeLineItemWeight("Faucets & fixtures"));
  assert.deepEqual(roundPriceRangeForDisplay(3800, 4050), { min: 3500, max: 4500 });
  assert.deepEqual(roundPriceRangeForDisplay(4000, 4000), { min: 3500, max: 4500 });
  assert.deepEqual(roundPriceRangeForDisplay(8000, 5000), { min: 5000, max: 8000 });
  assert.deepEqual(tightenPriceRangeForDisplay(10_000, 30_000), { min: 19_000, max: 21_000 });
  assert.deepEqual(tightenPriceRangeForDisplay(5_000, 15_000), { min: 9_500, max: 10_500 });
  const adapted = adaptLookToScopes(
    {
      label: "navy subway",
      prompt: "navy subway tile, cream walls, chrome rain head and tub filler, bright daylight",
      fixtures: "chrome rain shower and wall-mount tub filler",
    },
    ["Vanity", "Flooring"]
  );
  assert.match(adapted.prompt, /Vanity and Flooring/);
  assert.doesNotMatch(adapted.prompt, /rain head|tub filler/i);
  assert.deepEqual(interleaveLooks(["a", "b", "c", "d"], ["x", "y"]), ["a", "b", "x", "c", "d", "y"]);
});

test("finish tiers are scoped to the job and value never includes premium", () => {
  const vanity = finishTiersForScope({ serviceLabel: "Bathroom Remodel", scopes: ["Vanity"] });
  const full = finishTiersForScope({ serviceLabel: "Bathroom Remodel", scopes: ["Full Bathroom Remodel"] });
  assert.ok(vanity.length >= 6 && vanity.length <= 8);
  assert.equal(vanity[0].min, 500);
  assert.equal(vanity[vanity.length - 1].openEnded, true);
  assert.ok(full.length >= 6 && full.length <= 8);
  assert.ok(full[0].min <= 1500);
  assert.equal(full[full.length - 1].openEnded, true);
  assert.ok(full[full.length - 1].min >= 40000);
  const allowed = adjacentFinishTiers("value", vanity);
  assert.ok(allowed.includes("value") && allowed.includes("mid"));
  assert.equal(allowed.includes("premium"), false);
  const paint = finishTiersForScope({ serviceLabel: "Interior Painting", scopes: ["Specific Rooms"] });
  assert.equal(paint[0].min, 250);
  assert.equal(paint[paint.length - 1].openEnded, true);
  const kitchen = finishTiersForScope({ serviceLabel: "Kitchen Remodel", scopes: ["Full Kitchen Remodel"] });
  assert.ok(kitchen.length >= 6 && kitchen.length <= 8);
  assert.ok(kitchen[0].min <= 3000);
  assert.equal(kitchen[kitchen.length - 1].openEnded, true);
  assert.equal(formatChipBand({ min: 500, max: 1500 }), "$500 – $1.5k");
  assert.equal(formatChipBand({ min: 45000, max: 150000, openEnded: true }), "$45k+");
  const sampleTiers: Array<{ min: number; max: number; openEnded?: boolean }> = [
    { min: 1, max: 2 },
    { min: 3, max: 4 },
  ];
  assert.equal(withOpenEndedTop(sampleTiers).at(-1)?.openEnded, true);
});

test("each generated look gets a distinct color family, tile, and fixtures", () => {
  const looks = pickDiverseLooks({ count: 6, seed: "session-bath", vertical: "bathroom" });
  assert.equal(looks.length, 6);
  const families = looks.map((row) => row.family);
  assert.equal(new Set(families).size, 6);
  assert.ok(looks.every((row) => row.palette && row.surfaces && row.fixtures));
  const blob = looks.map((row) => `${row.palette} ${row.surfaces} ${row.prompt}`).join(" ").toLowerCase();
  assert.match(blob, /navy|sage|terracotta|forest|blush|graphite|mint|cobalt|emerald|ochre|plum|cinnamon/);
  assert.doesNotMatch(blob, /all-white builder/);

  const more = pickDiverseLooks({
    count: 6,
    seed: "session-bath-2",
    vertical: "bathroom",
    excludeFamilies: families as string[],
  });
  const overlap = more.filter((row) => families.includes(row.family));
  assert.equal(overlap.length, 0);

  const prompt = buildDiscoveryPrompt({
    room: "residential bathroom",
    serviceLabel: "Bathroom Remodel",
    scopes: ["Shower", "Tub"],
    budget: 6500,
    direction: looks[0],
  });
  assert.match(prompt, /Color scheme:/);
  assert.match(prompt, /Surfaces and tile:/);
  assert.match(prompt, /Fixtures:/);
  assert.match(prompt, /do not wash it out to white or beige/);
});

test("generated looks write reusable service, scope, finish, material, and price-range metadata", () => {
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  const curate = read("app/api/adventure/v8/[instanceId]/curate/route.ts");
  assert.match(component, /generatedWriteBack/);
  assert.match(component, /palette_family/);
  assert.match(component, /visual_prompt/);
  assert.match(component, /catalogTags/);
  assert.match(component, /finish_tier/);
  assert.match(component, /price_range/);
  assert.match(component, /price_relationship/);
  assert.match(component, /materials:/);
  assert.match(curate, /palette_family/);
  assert.match(curate, /visual_prompt/);
  assert.match(curate, /fixtures/);
  assert.match(curate, /surfaces/);
  assert.match(curate, /starter_scope_key/);
  assert.match(curate, /\btags:/);
  assert.match(curate, /price_range/);
  assert.match(curate, /price_relationship/);
  assert.match(curate, /materials/);
  assert.match(curate, /adventure_usage/);
  assert.match(curate, /instance_count/);
  assert.match(curate, /type === "share" \|\| type === "shared"/);
  assert.match(curate, /worth_keeping/);
  assert.match(curate, /reusable_status/);
  assert.match(component, /writeBack: look\.source === "generated"/);
});

test("selection shows a scope+tier price and an optional prompt tweak", () => {
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  const styles = read("components/adventure/v8/configurator-v8.module.css");
  const recipes = read("components/adventure/v8/generationRecipes.ts");
  assert.match(component, /priceForFinishTier/);
  assert.match(component, /const lookTierId = look\?\.finishTier \|\| current\.finishTierId/);
  assert.match(component, /An estimated local range based on the scope and finish level/);
  assert.match(component, /Describe any other change/);
  assert.match(component, /canvasNotice/);
  assert.match(styles, /object-fit:\s*contain/);
  assert.match(component, /use warmer finishes/);
  assert.match(component, /railPriceLocked/);
  assert.match(component, /STARTER_CUE = "Starter canvas"/);
  assert.match(component, /css\.starterBadge/);
  assert.match(recipes, /export function finishTiersForScope/);
  assert.match(component, /saveV8Snapshot/);
  assert.match(component, /loadV8Snapshot/);
  const storage = read("components/adventure/v8/storage.ts");
  assert.match(storage, /adventure:v8:snapshot/);
  assert.match(storage, /context/);
  assert.doesNotMatch(component, /Pick a layout to keep going/);
  assert.doesNotMatch(component, /Edit service\/scope/);
  assert.doesNotMatch(component, /continueRail/);
  assert.doesNotMatch(component, /showLayoutGrid/);
  assert.doesNotMatch(component, /railReady/);
  assert.match(component, /if \(!note \|\| !selectedDesign\) return/);
  assert.match(component, /css\.railInput/);
  assert.match(component, /css\.refinementComposer/);
  assert.match(component, /css\.visualOptionGrid/);
  assert.match(component, /goToPrice/);
  assert.doesNotMatch(component, /enterRefine/);
  assert.doesNotMatch(component, /stage === "refine"/);
  assert.doesNotMatch(component, /scopeTweaks/);
  assert.doesNotMatch(component, /priceGhost/);
  assert.match(styles, /max-width:\s*none/);
  assert.match(styles, /minmax\(280px, 340px\)/);
  assert.match(styles, /position:\s*sticky/);
  assert.match(styles, /bandChip/);
});

test("scope mode is spatial for full rooms and component for single parts", () => {
  assert.equal(projectMode(["Full Bathroom Remodel"]), "spatial");
  assert.equal(projectMode(["Vanity"]), "component");
  assert.equal(projectMode(["Backsplash"]), "component");
  assert.equal(projectMode(["Shower / Tub"]), "spatial");
  assert.equal(projectMode(["Vanity", "Flooring"]), "component");
  assert.equal(projectMode(["Shower", "Tub"]), "spatial");
  const starter = buildStarterPrompt({
    room: "residential bathroom",
    serviceLabel: "Bathroom Remodel",
    scopes: ["Vanity"],
    mode: "component",
    budget: 6500,
  });
  assert.match(starter, /ROUGH STARTER meant to be changed/i);
  assert.match(starter, /focused starter-canvas view of Vanity/);
  assert.match(starter, /newly remodeled and unused/i);
  assert.match(starter, /no shower curtain/i);
  assert.match(starter, /\$6,500|builder-grade/i);
  assert.doesNotMatch(starter, /builder-grade bones only/);
  assert.equal(COLOR_MOODS.length, 6);
  assert.equal(LOOK_STYLES.length, 5);
  assert.ok(LOOK_STYLES.some((row) => row.label === "Modern"));
  assert.ok(LOOK_STYLES.some((row) => row.label === "Transitional"));
  const moodPrompt = buildMoodStylePrompt({
    room: "residential bathroom",
    serviceLabel: "Bathroom Remodel",
    scopes: ["Shower / tub"],
    budget: 18000,
    mood: COLOR_MOODS[0],
    style: LOOK_STYLES[0],
  });
  assert.match(moodPrompt, /Color \/ mood: Navy/);
  assert.match(moodPrompt, /Style: Modern/);
  assert.match(moodPrompt, /Keep the exact camera/);
  assert.equal(layoutPresets("bathroom").length, 4);
  const choices = layoutChoicesForProject("bathroom", ["Shower / tub", "Vanity", "Toilet", "Floor tile"]);
  assert.equal(choices[0].id, "this-view");
  assert.ok(choices.length >= 6 && choices.length <= 8);
  const labels = choices.map((row) => row.label).join(" | ");
  assert.match(labels, /Tub\/shower combo/);
  assert.match(labels, /Walk-in shower/);
  assert.match(labels, /Corner shower/);
  assert.match(labels, /Double vanity/);
  const thumb = buildLayoutThumbPrompt({
    room: "residential bathroom",
    serviceLabel: "Bathroom Remodel",
    scopes: ["Shower / tub", "Vanity"],
    layout: choices.find((row) => row.id === "corner-shower") || choices[1],
  });
  assert.match(thumb, /MAIN FOCAL SCENE/i);
  assert.match(thumb, /Composite this generated/i);
  assert.match(thumb, /looks fine|ordinary|listing photo|STANDARD BUILDER LAYOUT/i);
  assert.match(thumb, /Shower \/ tub and Vanity|Shower \/ tub/);
  assert.match(thumb, /stub tub|second tub/i);
  assert.match(
    buildLayoutCompositePrompt({
      room: "residential bathroom",
      serviceLabel: "Bathroom Remodel",
      scopes: ["Shower / tub"],
      layout: choices.find((row) => row.id === "tub-combo") || choices[1],
    }),
    /Do not add a second tub/
  );
  const spatialStarter = buildStarterPrompt({
    room: "residential bathroom",
    serviceLabel: "Bathroom Remodel",
    scopes: ["Shower / tub", "Vanity"],
    mode: "spatial",
    budget: 4500,
  });
  assert.match(spatialStarter, /5x8 hall bath/);
  assert.match(spatialStarter, /realistic bathroom clearances/i);
  assert.match(spatialStarter, /hotel spa/i);
  assert.match(spatialStarter, /builder-grade/i);
  const expensiveStarter = buildStarterPrompt({
    room: "residential bathroom",
    serviceLabel: "Bathroom Remodel",
    scopes: ["Full Bathroom Remodel"],
    mode: "spatial",
    budget: 45000,
  });
  assert.match(expensiveStarter, /\$45,000/);
  assert.match(expensiveStarter, /nicer tile|Finish quality must match/i);
  assert.doesNotMatch(expensiveStarter, /builder-grade bones only/);
  const vanityBounds = proposeClientBudgetBounds({ serviceLabel: "Bathroom Remodel", scopes: ["Vanity"] });
  const fullBounds = proposeClientBudgetBounds({ serviceLabel: "Bathroom Remodel", scopes: ["Full Bathroom Remodel"] });
  assert.ok(vanityBounds.max <= 20000, `vanity slider should stay small, got ${vanityBounds.max}`);
  assert.ok(fullBounds.max >= 50000, `full bath slider should be a remodel range, got ${fullBounds.max}`);
  assert.ok(vanityBounds.max < fullBounds.max);
  assert.equal(vanityBounds.defaultAmount >= vanityBounds.min, true);
  const bathStyles = styleSwatchesForProject("bathroom", ["Shower", "Tub"], 8000);
  assert.ok(bathStyles.length >= 25);
  assert.ok(bathStyles.every((row) => row.colors.length === 2));
  assert.ok(bathStyles.every((row) => !/cabinet|backsplash|kitchen/i.test(row.prompt)));
  assert.ok(bathStyles.some((row) => /shower|tub|tile|vanity|bath/i.test(row.prompt)));
  assert.ok(bathStyles.every((row) => /8,000|builder-grade|ceramic tile not stone/i.test(row.prompt)));
  assert.ok(!bathStyles.some((row) => / · brass$/i.test(row.label)));
  const richStyles = styleSwatchesForProject("bathroom", ["Shower", "Tub"], 80000);
  assert.ok(richStyles.length >= 25);
  assert.ok(richStyles.some((row) => /brass/i.test(row.label)));
  const kitchenStyles = styleSwatchesForProject("kitchen", ["Cabinets"], 25000);
  assert.ok(kitchenStyles.every((row) => !/shower|tub filler|rain head/i.test(row.prompt)));
  const landscapeStyles = styleSwatchesForProject("landscaping", ["Planting"]);
  assert.ok(landscapeStyles.every((row) => !/subway tile|vanity|cabinet/i.test(row.prompt)));
  const styleThumb = buildStyleThumbPrompt({
    room: "residential bathroom",
    serviceLabel: "Bathroom Remodel",
    scopes: ["Shower", "Tub"],
    style: bathStyles[0],
  });
  assert.match(styleThumb, /Bathroom Remodel/i);
  assert.match(styleThumb, /Shower and Tub/);
  assert.match(styleThumb, /Restyle this generated/i);
  assert.match(styleThumb, /Do not generate a new room/i);
  assert.ok(styleSwatches().length >= 4);
});

test("each inspiration page retrieves by scope and finish quality, then lazily fills thin coverage", () => {
  assert.deepEqual(retrievalMix({ requested: 12, libraryAvailable: 8 }), { library: 8, generate: 4 });
  assert.deepEqual(retrievalMix({ requested: 12, libraryAvailable: 24 }), { library: 12, generate: 0 });
  assert.deepEqual(retrievalMix({ requested: 6, libraryAvailable: 0 }), { library: 0, generate: 6 });
  assert.deepEqual(retrievalMix({ requested: 6, libraryAvailable: 4 }), { library: 4, generate: 2 });
  assert.deepEqual(interleaveLooks(["a", "b", "c", "d"], ["x", "y"]), ["a", "b", "x", "c", "d", "y"]);

  const tags = catalogTags({
    serviceLabel: "Bathroom Remodel",
    scopes: ["Shower", "Tub"],
    scope: "Shower",
    finishTier: "value",
    direction: { family: "navy", label: "navy subway", prompt: "navy subway", palette: "navy and cream" },
  });
  assert.ok(tags.includes("Bathroom Remodel"));
  assert.ok(tags.includes("Shower"));
  assert.ok(tags.includes("Tub"));
  assert.ok(tags.includes("value"));
  assert.ok(!tags.some((tag) => /^\$[\d,]+$/.test(tag)));
  assert.ok(tags.includes("navy"));
});

test("masonry packing appends new pins without moving earlier ones", () => {
  const aspectOf = (item: { id: string }) => pinAspectRatio(item.id);
  const first = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id }));
  const packed = splitMasonryColumns(first, 3, aspectOf);
  const grown = splitMasonryColumns([...first, { id: "g" }, { id: "h" }, { id: "i" }], 3, aspectOf);
  assert.equal(packed.length, 3);
  packed.forEach((col, i) => {
    assert.deepEqual(grown[i].slice(0, col.length), col);
  });
  assert.equal(pinAspectRatio("navy-1"), pinAspectRatio("navy-1"));
  assert.notEqual(pinAspectRatio("navy-1"), pinAspectRatio("sage-2"));
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const widgetRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(relativePath: string): string {
  return readFileSync(resolve(widgetRoot, relativePath), "utf8");
}

const experience = () => read("components/adventure/v6/AdventureV6Experience.tsx");
const v6Css = () => read("components/adventure/v6/visual-pricing-v6.module.css");

test("V6 remains a code module with no versioned public URL", () => {
  const wrapper = read("components/adventure/v6/index.ts");
  const storage = read("components/adventure/v3/visual-storage.ts");
  const component = experience();

  assert.match(wrapper, /AdventureV6Experience/);
  assert.match(component, /export function AdventureV6Experience/);
  assert.match(component, /data-adventure-version="v6"/);
  assert.match(component, /import css from "\.\/visual-pricing-v6\.module\.css"/);
  assert.match(storage, /"v6"/);

  // Version lives in the code, never in the path the customer sees.
  const unversioned = read("app/adventure/[instanceId]/page.tsx");
  assert.match(unversioned, /AdventureV8Experience/);
  assert.doesNotMatch(unversioned, /AdventureV6Experience/);
  assert.throws(
    () => read("app/adventure/v6/[instanceId]/page.tsx"),
    /ENOENT/,
    "there should be no /adventure/v6 route"
  );
});

test("V6 walks service, scope, budget, start point, concepts, refinement, price, consultation", () => {
  const component = experience();
  const sequence = component.match(/const STAGE_SEQUENCE: VisualPricingStage\[\] = \[([\s\S]*?)\];/);
  assert.ok(sequence, "STAGE_SEQUENCE should be declared");

  const stages = Array.from(sequence[1].matchAll(/"([a-z-]+)"/g)).map((match) => match[1]);
  assert.deepEqual(stages, [
    "intro",
    "project",
    "scope",
    "budget",
    "path",
    "personalize",
    "inspiration",
    "concepts",
    "customize",
    "details",
    "consultation",
  ]);

  // Scope hands off to budget, and budget hands off to the start-point fork.
  assert.match(component, /stage: "budget",/);
  assert.match(component, /patchSnapshot\(\{ budgetBandId: bandId, projects: \[\], stage: "path" \}\)/);
});

test("V6 asks for a budget in the shortest wording", () => {
  const component = experience();

  assert.match(component, /title="What.?s your budget\?"/);
  assert.doesNotMatch(component, /What are you hoping to spend\?/);
  assert.doesNotMatch(component, /investment range/i);
  // Ranges depend on the selected service (bath vs landscape, etc.).
  assert.match(component, /Typical ranges for/);
  assert.match(component, /budgetBandsForService\(selectedService\)\.map\(\(band\) => \(/);
});

test("V6 budget bands are narrower for bathrooms than landscape", () => {
  const pricing = read("components/adventure/v3/visual-pricing.ts");
  assert.match(pricing, /BATHROOM_BUDGET_BANDS/);
  assert.match(pricing, /LANDSCAPE_BUDGET_BANDS/);
  assert.match(pricing, /Under \$5,000/);
  assert.match(pricing, /\$50,000–\$100,000/);
  assert.match(pricing, /export function budgetBandsForService/);
  assert.match(pricing, /targetQualityForBand/);
  assert.match(pricing, /window\.mid <= 8_000 && quality >= 0\.6/);
});

test("V6 picks service and scope from pictures, not a text list", () => {
  const component = experience();
  const css = v6Css();
  const route = read("app/api/v6/ai-form/[instanceId]/step-images/route.ts");

  assert.match(component, /function VisualChoiceCard/);
  assert.match(component, /imageUrl=\{stepImages\.services\[service\.value\]\}/);
  assert.match(component, /imageUrl=\{stepImages\.scopes\[scope\]\}/);
  assert.match(css, /\.visualChoices \{/);

  // Thumbnails are batched, so adding options never adds requests.
  assert.match(route, /\.in\("subcategory_id", serviceIds\)/);
  assert.match(route, /SCOPE_SEPARATOR/);
  assert.match(route, /\.in\("metadata->>starter_scope_key", Array\.from\(keyToScope\.keys\(\)\)\)/);
  assert.match(component, /selectedScopes\.map\(\(scope\) => `&scope=\$\{encodeURIComponent\(scope\)\}`\)/);

  // Scope cards use finished catalog heroes (v1), never plain neutral anchors.
  assert.match(route, /V2_SCOPE_STARTER_GENERATED_FOR/);
  assert.doesNotMatch(route, /V2_NEUTRAL_SCOPE_STARTER_GENERATED_FOR/);
  assert.match(route, /scopeThumbRank/);
  assert.match(route, /starter_variant_key/);

  // Project/scope picture grids fit the viewport — no page scroll on step 1.
  assert.match(css, /\.visualChoices \{/);
  assert.match(css, /\.stage\[data-stage="project"\]/);
  assert.match(css, /grid-auto-rows: minmax\(0, 1fr\)/);

  // A missing thumbnail must not break the step or shift the layout.
  assert.match(component, /\{props\.imageUrl \? <img/);
  assert.match(css, /\.visualChoiceFrame:empty::before \{/);
});

test("V6 forks between uploading a room and starting from inspiration", () => {
  const component = experience();
  const css = v6Css();

  assert.match(component, /title="Where should we start\?"/);
  assert.match(component, /choosePath\("upload"\)/);
  assert.match(component, /choosePath\("inspiration"\)/);
  assert.match(component, /Upload my space/);
  assert.match(component, /Start with inspiration/);
  assert.match(component, /stage: path === "upload" \? "personalize" : "inspiration"/);

  // Honest difference: photo is more accurate than inspiration-only concepts.
  assert.match(component, /photo of your (actual )?space|photo of your actual room/i);
  assert.doesNotMatch(component, /Both paths end the same way/);
  assert.doesNotMatch(component, /pathIcon/);
  assert.match(css, /border-bottom: 1px solid var\(--v6-hair\)/);

  // The upload path collects the change request the spec calls for.
  assert.match(component, /What would you like to change\?/);
  assert.match(component, /uploadChangeNote/);
});

test("V6 turns saved inspiration into the input for concept generation", () => {
  const component = experience();

  assert.match(component, /const MIN_SAVED_INSPIRATION = 3;/);
  assert.match(component, /const MAX_SAVED_INSPIRATION = 5;/);
  assert.match(component, /title="Find inspiration you love\."/);

  // Saving is capped, and concepts stay locked until enough signal is collected.
  assert.match(component, /if \(!saved && snapshot\.favoriteProjectIds\.length >= MAX_SAVED_INSPIRATION\) return;/);
  assert.match(component, /const canGenerateConcepts = savedCount >= MIN_SAVED_INSPIRATION;/);
  assert.match(component, /disabled=\{!canGenerateConcepts \|\| conceptsBusy\}/);

  // Inspiration cards are taste signal only — no price chrome at this point.
  assert.match(component, /function InspirationCard/);
  assert.doesNotMatch(component, /function LookCard/);
});

test("V6 generates several concepts from either an upload or saved designs", () => {
  const component = experience();

  assert.match(component, /function conceptVariantsForService/);
  assert.match(component, /const CONCEPT_COUNT = 8/);
  assert.match(component, /isBathroomServiceOption/);
  assert.match(component, /Spa retreat/);
  assert.match(component, /conceptVariantsForService\(selectedService\)\.slice\(0, CONCEPT_COUNT\)/);

  // Each variant rotates which saved look is the primary anchor so we don't
  // redraw the same catalog photo three times.
  assert.match(component, /savedProjects\.slice\(index % savedProjects\.length\)/);
  assert.match(component, /blendMode: fromUpload \? "revise" : "inspire"/);
  assert.match(component, /referenceImageUrls: allRefs/);
  assert.match(component, /Promise\.allSettled\(/);
  // A partial failure still produces something to react to.
  assert.match(component, /result\.status === "fulfilled"/);

  // Generation reads as progress rather than a hang.
  assert.match(component, /const CONCEPT_STATUS_LABELS = \[/);
  assert.match(component, /conceptsBusy \? conceptStatusLabel/);
  assert.match(component, /Usually ready in a few seconds\./);
  // First image paints as soon as any variant returns.
  assert.match(component, /publishReady\(\)/);
  assert.match(component, /prunaai\/p-image-edit/);
});

test("V6 refines before pricing, and keeps the price off the refinement step", () => {
  const component = experience();

  const customize = component.match(/\{snapshot\.stage === "customize"[\s\S]*?\n {8}\) : null\}/);
  assert.ok(customize, "customize stage should render");
  assert.match(customize[0], /title="Make it yours\."/);
  assert.match(customize[0], /What would you change\?/);
  assert.match(customize[0], /I love this—what does it cost\?/);
  assert.match(customize[0], /patchSnapshot\(\{ stage: "details" \}\)/);
  // Desire first: no dollar figures while the visitor is still shaping the design.
  assert.doesNotMatch(customize[0], /PriceBlock/);

  // Refining is free; V6 only asks for a phone number at the consultation step.
  assert.match(component, /type PendingPhoneAction = \{ kind: "consultation" \};/);
  assert.doesNotMatch(component, /PERSONALIZED_REFINEMENT_LIMIT/);
});

test("V6 keeps email as the gate on the price reveal", () => {
  const component = experience();

  const details = component.match(/\{snapshot\.stage === "details"[\s\S]*?\n {8}\) : null\}/);
  assert.ok(details, "details stage should render");
  assert.match(details[0], /title="Your design, and what it costs\."/);
  assert.match(details[0], /snapshot\.lead\.emailCaptured \?/);
  assert.match(details[0], /Save your design and estimate/);
  assert.match(details[0], /setEmailOpen\(true\)/);

  // The estimate itself stays hidden until the email lands.
  assert.match(component, /const displayedEstimateRange = pricingVisible/);
  assert.match(component, /stage: "details",\n {8}lead: \{/);

  // The modal promises an instant on-screen number, not a follow-up email.
  assert.match(component, /Save your design and estimate<\/h2>/);
  assert.match(component, /Your price range appears on this screen straight away\./);
  assert.doesNotMatch(component, /We’ll email your estimate/);
});

test("V6 ends on a consultation that asks for a phone number", () => {
  const component = experience();

  const consultation = component.match(/\{snapshot\.stage === "consultation"[\s\S]*?\n {8}\) : null\}/);
  assert.ok(consultation, "consultation stage should render");
  assert.match(consultation[0], /title="Ready to bring this design to life\?"/);
  assert.match(consultation[0], /Book my consultation/);
  assert.match(consultation[0], /bookConsultation/);

  // Price reveal offers the consultation as the next step.
  assert.match(component, /patchSnapshot\(\{ stage: "consultation" \}\)/);
  assert.match(component, /Mobile number/);
});

test("V6 can walk backwards through both branches of the fork", () => {
  const component = experience();
  const fallback = component.match(/const fallback: Partial<Record<VisualPricingStage, VisualPricingStage>> = \{([\s\S]*?)\};/);
  assert.ok(fallback, "goBack should declare a fallback map");

  assert.match(fallback[1], /budget: beforeBudget,/);
  assert.match(fallback[1], /path: "budget",/);
  assert.match(fallback[1], /personalize: "path",/);
  assert.match(fallback[1], /inspiration: "path",/);
  assert.match(fallback[1], /concepts: snapshot\.startPath === "upload" \? "personalize" : "inspiration",/);
  assert.match(fallback[1], /customize: "concepts",/);
  assert.match(fallback[1], /details: "customize",/);
  assert.match(fallback[1], /consultation: "details",/);
});

test("V6 has exactly one loading state, shared by every wait", () => {
  const component = experience();
  const css = v6Css();

  assert.match(component, /function LoadingState\(props: \{ label: string; hint\?: string \}\)/);
  assert.match(component, /<LoadingState label="Getting things ready" \/>/);
  assert.match(component, /<LoadingState label="Finding designs for your project" \/>/);
  assert.match(component, /Usually ready in a few seconds\./);
  assert.match(css, /\.loading \{/);
  assert.match(css, /\.loadingTrack::after \{/);

  // The states this replaced must not creep back in.
  for (const retired of ["booting", "lookSkeleton", "generating", "v6pulse"]) {
    assert.doesNotMatch(component, new RegExp(retired), `${retired} should be gone`);
    assert.doesNotMatch(css, new RegExp(retired), `${retired} should be gone from the stylesheet`);
  }
  assert.doesNotMatch(component, /Loading visual pricing/);
});

test("V6 styles its own tokens rather than borrowing the V5 stylesheet", () => {
  const css = v6Css();

  assert.doesNotMatch(css, /--v5-/);
  assert.doesNotMatch(css, /v5spin|v5pulse|v5chrome|v5lookIn/);
  assert.match(css, /\.pathChoice \{/);
  assert.match(css, /\.saveBar \{/);
  assert.match(css, /\.conceptGrid \{/);

  // One type scale across the whole funnel, same discipline as V5.
  const weights = new Set(Array.from(css.matchAll(/font-weight: (\d+)/g)).map((match) => match[1]));
  assert.deepEqual([...weights].sort(), ["400", "550", "600"]);
});

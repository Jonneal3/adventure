import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildScopeQuestion, lookConflictsWithService, lookFitsSelectedScopes, looksLikeMaterialSwatch, projectMode, verticalKey } from "../components/adventure/v8/scopeRecipes";
import {
  assignDiscoveryModel,
  buildStarterPrompt,
  catalogTags,
  COLOR_MOODS,
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
  proposeClientBudgetBounds,
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

const widgetRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const repoRoot = resolve(widgetRoot, "../..");

function read(relativePath: string): string {
  return readFileSync(resolve(widgetRoot, relativePath), "utf8");
}

test("V8 is what /adventure/[instanceId] serves, with no version in the URL", () => {
  const wrapper = read("components/adventure/v8/index.ts");
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  const unversioned = read("app/adventure/[instanceId]/page.tsx");
  const middleware = read("middleware.ts");

  assert.match(wrapper, /AdventureV8Experience/);
  assert.match(component, /export function AdventureV8Experience/);
  assert.match(component, /data-adventure-version="v8"/);

  assert.match(unversioned, /AdventureV8Experience/);
  assert.doesNotMatch(unversioned, /AdventureV7Experience/);
  assert.throws(
    () => read("app/adventure/v8/[instanceId]/page.tsx"),
    /ENOENT/,
    "there should be no /adventure/v8 route"
  );
  assert.match(middleware, /v\(\?:1\|2\|3\|4\|5\|6\|7\|8\)/);
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

test("V8 implements the epicenter stages only", () => {
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  const sequence = component.match(/const STAGE_ORDER: V8Stage\[\] = \[([\s\S]*?)\];/);
  assert.ok(sequence, "STAGE_ORDER should be declared");
  const stages = Array.from(sequence[1].matchAll(/"([a-z]+)"/g)).map((match) => match[1]);
  assert.deepEqual(stages, [
    "service",
    "project",
    "budget",
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
  assert.match(component, /Browse looks →/);
  assert.match(component, /Next: budget →/);
  assert.match(component, /About how much do you want to spend\?/);
  assert.match(component, /finishTiersForScope/);
  assert.match(component, /loadDiscovery/);
  assert.match(component, /loadMoreLooks/);
  assert.doesNotMatch(component, /liveEstimate/);
  assert.doesNotMatch(component, /callAdventurePipeline\("estimate"/);
  assert.match(component, /Pick a look you like/);
  assert.doesNotMatch(component, /generateStarter/);
  assert.doesNotMatch(component, /applyLookControls/);
  assert.doesNotMatch(component, /Color \/ Mood/);
  assert.match(component, /Tweak this photo/);
  assert.doesNotMatch(component, /Edit service\/scope/);
  assert.doesNotMatch(component, /Couldn’t update that look/);
  assert.doesNotMatch(component, /What&apos;s included/);
  assert.doesNotMatch(component, /scopeTweaks/);
  assert.match(component, /railPriceLocked/);
  assert.match(component, /goToPrice/);
  assert.match(component, /See my price →/);
  assert.match(component, /generateV8DesignImage/);
  assert.match(component, /Apply this change/);
  assert.match(component, /REFINE_LIMIT = 5/);
  assert.match(component, /Describe a change…/);
  assert.doesNotMatch(component, /enterRefine/);
  assert.doesNotMatch(component, /Make it yours/);
  assert.doesNotMatch(component, /Go with this →/);
  assert.doesNotMatch(component, /You can refine this, or go with it/);
  assert.doesNotMatch(component, /makeDesigns/);
  assert.doesNotMatch(component, /Use this inspiration/);
  assert.doesNotMatch(component, /None of these\? Try a fresh set/);
  assert.doesNotMatch(component, /LOOK_TARGET/);
  assert.doesNotMatch(component, /Scroll for more/);
  assert.doesNotMatch(component, /Get inspired/);
  assert.match(component, /Want to see what this could cost\?/);
  assert.match(component, /Show my price/);
  assert.match(component, /Want help bringing this to life\?/);

  assert.doesNotMatch(component, /tasteTags/);
  assert.doesNotMatch(component, /EXPLORATION_TARGET/);
  assert.doesNotMatch(component, /analyze_photo/);
  assert.doesNotMatch(component, /suggest_scopes/);
  assert.doesNotMatch(component, /scope_covers/);
  assert.doesNotMatch(component, /"review"/);
  assert.doesNotMatch(component, /"path"/);
  assert.doesNotMatch(component, /"exploration"/);
  assert.doesNotMatch(component, /"consultation"/);
});

test("V8 pipeline client only calls epicenter actions", () => {
  const client = read("components/adventure/v8/adventurePipelineClient.ts");
  assert.match(client, /"library"/);
  assert.match(client, /"inspiration"/);
  assert.match(client, /"ideas"/);
  assert.match(client, /"refine"/);
  assert.match(client, /"estimate"/);
  assert.match(client, /"handoff"/);
  assert.match(client, /"budget_bands"/);
  assert.match(client, /"intake"/);
  assert.match(client, /"discovery"/);
  assert.match(client, /fetchInstanceCatalogLooks/);
  assert.match(client, /\/api\/sample-gallery\//);
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

test("V8 goes from scope+budget bands to a filtered photo gallery", () => {
  const recipes = read("components/adventure/v8/generationRecipes.ts");
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  assert.match(recipes, /finishTiersForScope/);
  assert.match(recipes, /adjacentFinishTiers/);
  assert.match(component, /loadDiscovery/);
  assert.match(component, /loadMoreLooks/);
  assert.match(component, /"discovery"/);
  assert.match(component, /css\.masonryBoard/);
  assert.match(component, /Browse looks →/);
  assert.doesNotMatch(component, /generateStarter/);
  assert.doesNotMatch(component, /applyLookControls/);
  assert.doesNotMatch(component, /Color \/ Mood/);
  assert.doesNotMatch(component, /See a starter →/);
  assert.match(component, /formatChipBand/);
  assert.match(component, /Pick a price range/);
  assert.doesNotMatch(component, /bandLabel/);
  assert.doesNotMatch(component, /tier\.label/);
  assert.match(component, /fetchInstanceCatalogLooks/);
  assert.match(component, /No photos in this catalog yet/);
  assert.doesNotMatch(component, /Try another budget/);
  const client = read("components/adventure/v8/adventurePipelineClient.ts");
  assert.match(client, /AbortSignal\.timeout/);
  assert.match(client, /45000/);
});

test("V8 persists the lead when email unlocks the price", () => {
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  assert.match(component, /\/api\/adventure\/v8\/leads/);
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
    ["Full Landscape Project", "Pavers", "Planting", "Irrigation", "Other"]
  );
  assert.equal(stored.choices.some((c) => /shell|waterline|pool/i.test(c.label)), false);

  const fallback = buildScopeQuestion({ serviceLabel: "Bathroom Remodeling" });
  assert.equal(fallback.source, "recipe");
  assert.equal(fallback.choices[0].label, "Full Bathroom Remodel");
  assert.ok(fallback.choices.some((c) => c.label === "Vanity"));
});

test("discovery model split is sticky per session and overridable", () => {
  const a = assignDiscoveryModel("session-alpha");
  const b = assignDiscoveryModel("session-beta");
  assert.ok(a === DISCOVERY_MODELS.schnell || a === DISCOVERY_MODELS.imagen);
  assert.equal(assignDiscoveryModel("session-alpha"), a);
  assert.equal(assignDiscoveryModel("session-beta"), b);
  assert.equal(assignDiscoveryModel("anything", "imagen"), DISCOVERY_MODELS.imagen);
  assert.equal(assignDiscoveryModel("anything", "flux-schnell"), DISCOVERY_MODELS.schnell);
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
  assert.ok(vanity.length >= 5 && vanity.length <= 8);
  assert.equal(vanity[0].min, 500);
  assert.equal(vanity[vanity.length - 1].openEnded, true);
  assert.ok(full.length >= 5 && full.length <= 8);
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
  assert.ok(kitchen.length >= 5 && kitchen.length <= 8);
  assert.ok(kitchen[0].min <= 3000);
  assert.equal(kitchen[kitchen.length - 1].openEnded, true);
  assert.equal(formatChipBand({ min: 500, max: 1500 }), "$500 – $1.5k");
  assert.equal(formatChipBand({ min: 45000, max: 150000, openEnded: true }), "$45k+");
  assert.equal(withOpenEndedTop([{ min: 1, max: 2 }, { min: 3, max: 4 }]).at(-1)?.openEnded, true);
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

test("generated looks write palette, fixtures, prompt, and budget into the catalog", () => {
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  const curate = read("app/api/adventure/v8/[instanceId]/curate/route.ts");
  assert.match(component, /generatedWriteBack/);
  assert.match(component, /palette_family/);
  assert.match(component, /visual_prompt/);
  assert.match(component, /catalogTags/);
  assert.match(curate, /palette_family/);
  assert.match(curate, /visual_prompt/);
  assert.match(curate, /fixtures/);
  assert.match(curate, /surfaces/);
  assert.match(curate, /starter_scope_key/);
  assert.match(curate, /\btags:/);
});

test("selection shows a scope+tier price and an optional prompt tweak", () => {
  const component = read("components/adventure/v8/AdventureV8Experience.tsx");
  const styles = read("components/adventure/v8/configurator-v8.module.css");
  const recipes = read("components/adventure/v8/generationRecipes.ts");
  assert.match(component, /priceForFinishTier/);
  assert.match(component, /Typical range for this project and finish level/);
  assert.match(component, /Tweak this photo/);
  assert.match(component, /Describe a change…/);
  assert.match(component, /railPriceLocked/);
  assert.match(component, /css\.masonryBoard/);
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
  assert.match(component, /goToPrice/);
  assert.doesNotMatch(component, /enterRefine/);
  assert.doesNotMatch(component, /stage === "refine"/);
  assert.doesNotMatch(component, /scopeTweaks/);
  assert.doesNotMatch(component, /priceGhost/);
  assert.match(styles, /max-width:\s*none/);
  assert.match(styles, /minmax\(280px, 340px\)/);
  assert.match(styles, /position:\s*sticky/);
  assert.match(styles, /bandChip/);
  assert.match(styles, /masonryBoard/);
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
  assert.match(starter, /focused view of Vanity/);
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

test("each inspiration page mixes stored scope+price looks with a smaller generated slice", () => {
  assert.deepEqual(retrievalMix({ requested: 12, libraryAvailable: 8 }), { library: 8, generate: 4 });
  assert.deepEqual(retrievalMix({ requested: 12, libraryAvailable: 24 }), { library: 12, generate: 0 });
  assert.deepEqual(retrievalMix({ requested: 6, libraryAvailable: 0 }), { library: 0, generate: 6 });
  assert.deepEqual(retrievalMix({ requested: 6, libraryAvailable: 4 }), { library: 4, generate: 2 });
  assert.deepEqual(interleaveLooks(["a", "b", "c", "d"], ["x", "y"]), ["a", "b", "x", "c", "d", "y"]);

  const tags = catalogTags({
    serviceLabel: "Bathroom Remodel",
    scopes: ["Shower", "Tub"],
    scope: "Shower",
    priceTier: "$",
    budget: 6500,
    direction: { family: "navy", label: "navy subway", prompt: "navy subway", palette: "navy and cream" },
  });
  assert.ok(tags.includes("Bathroom Remodel"));
  assert.ok(tags.includes("Shower"));
  assert.ok(tags.includes("Tub"));
  assert.ok(tags.includes("$"));
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

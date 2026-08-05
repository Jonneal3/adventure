import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  quickChangesForScope,
  resolveServiceProfile,
} from "../components/adventure/v2/capabilities";
import {
  premadeConceptPrompt,
  regionStylePreviewPrompt,
  resolveScopeExperienceConfig,
} from "../components/adventure/v2/refinement-experience";
import {
  buildV2IterativeEditPrompt,
  isStructuralSceneChange,
} from "../lib/adventure-v2/iterative-edit-prompt";
import {
  persistV2Image,
  V2_IMAGE_PERSIST_TIMEOUT_MS,
} from "../lib/adventure-v2/server-assets";
import {
  compatibleSceneScopesForScope,
  V2_NEUTRAL_SCOPE_STARTER_GENERATED_FOR,
} from "../lib/adventure-v2/scope-starter-catalog";
import {
  V2_SERVICE_STARTER_GENERATED_FOR,
} from "../lib/adventure-v2/service-starter-catalog";
import { buildV2StarterPrompt } from "../lib/adventure-v2/starter-prompt";

const widgetRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const repoRoot = resolve(widgetRoot, "../..");

function read(relativePath: string): string {
  return readFileSync(resolve(widgetRoot, relativePath), "utf8");
}

test("unversioned route promotes V5; versioned URLs redirect to canonical latest", () => {
  const unversioned = read("app/adventure/[instanceId]/page.tsx");
  const v1 = read("app/adventure/v1/[instanceId]/page.tsx");
  const v2 = read("app/adventure/v2/[instanceId]/page.tsx");
  const v3 = read("app/adventure/v3/[instanceId]/page.tsx");
  const v4 = read("app/adventure/v4/[instanceId]/page.tsx");
  const middleware = read("middleware.ts");

  assert.match(unversioned, /<AdventureV5Experience/);
  assert.doesNotMatch(unversioned, /<AdventureFormExperience/);
  assert.match(v1, /data-adventure-version="v1"/);
  assert.match(v1, /<AdventureFormExperience/);
  assert.match(v1, /<AdventureWidgetExperience/);
  assert.match(v2, /<AdventureV2Experience/);
  assert.doesNotMatch(v2, /<AdventureFormExperience/);
  assert.match(v3, /<AdventureV3Experience/);
  assert.match(v4, /<AdventureV4Experience/);
  assert.match(read("app/adventure/v5/[instanceId]/page.tsx"), /<AdventureV5Experience/);
  // Public / Launch traffic must never stay on a versioned path.
  assert.match(middleware, /VERSIONED_ADVENTURE/);
  assert.match(middleware, /NextResponse\.redirect/);
  assert.match(middleware, /\/adventure\/\$\{versioned\[1\]\}/);
});

test("capabilities resolve to reusable ordered UI modules with overrides", () => {
  const service = {
    value: "painting",
    label: "House Painting",
    industryName: "Home services",
    subcategoryScope: ["Exterior", "Interior"],
  };
  const profile = resolveServiceProfile(
    {
      config: {
        adventureV2: {
          serviceConfigurations: {
            painting: {
              experienceMode: "scene",
              capabilityKeys: [
                "property_photo",
                "color_selection",
                "surface_regions",
                "finish_selection",
                "budget_required",
                "feature_selection",
                "prompt_editing",
              ],
              moduleOverrides: [
                { moduleKey: "region_selector", enabled: false, order: 1 },
                { moduleKey: "color_swatches", enabled: true, order: 2, config: { options: ["White", "Gray"] } },
              ],
              quickChanges: ["Paint the siding white", "Use black trim", "Try a warmer shade", "Make it brighter"],
            },
          },
        },
      },
    },
    service
  );

  assert.equal(profile.mode, "scene");
  assert.deepEqual(profile.scopeOptions, ["Exterior", "Interior"]);
  assert.equal(profile.quickChanges.length, 4);
  assert.ok(profile.modules.some((module) => module.key === "photo_upload"));
  assert.ok(profile.modules.some((module) => module.key === "color_swatches"));
  assert.ok(!profile.modules.some((module) => module.key === "region_selector"));
  assert.deepEqual(
    profile.modules.find((module) => module.key === "color_swatches")?.config.options,
    ["White", "Gray"]
  );
});

test("try-on and placement modes require real source-photo modules", () => {
  const tryon = resolveServiceProfile(
    { config: { useCase: "try-on" } },
    { value: "fashion", label: "Fashion Try-on" }
  );
  assert.equal(tryon.mode, "tryon");
  assert.ok(tryon.modules.some((module) => module.key === "person_photo_upload"));
  assert.ok(tryon.modules.some((module) => module.key === "product_photo_upload"));
  assert.ok(!tryon.modules.some((module) => module.key === "photo_upload"));

  const placement = resolveServiceProfile(
    { config: { adventure_v2: { experience_mode: "placement" } } },
    { value: "furniture", label: "Furniture Placement" }
  );
  assert.equal(placement.mode, "placement");
  assert.ok(placement.modules.some((module) => module.key === "photo_upload"));
  assert.ok(placement.modules.some((module) => module.key === "product_photo_upload"));
});

test("V2 canvas stages pricing unlock and caps preview edits before email", () => {
  const canvasRoute = read("app/api/v2/ai-form/[instanceId]/canvas/route.ts");
  const assetRoute = read("app/api/v2/assets/[instanceId]/route.ts");
  const assetStorage = read("lib/adventure-v2/server-assets.ts");
  const experience = read("components/adventure/v2/AdventureV2Experience.tsx");
  const experienceCss = read("components/adventure/v2/adventure-v2.module.css");
  const regionRoute = read("app/api/v2/ai-form/[instanceId]/regions/route.ts");

  assert.match(canvasRoute, /black-forest-labs\/flux-2-pro/);
  // V2 generation must never reach for prunaai; only the named V3 edit fallback may.
  const canvasRouteWithoutV3Fallback = canvasRoute.replace(/const V3_EDIT_FALLBACK_MODEL_ID = "[^"]+";/, "");
  assert.match(canvasRoute, /const V3_EDIT_FALLBACK_MODEL_ID = "prunaai\/p-image-edit";/);
  assert.doesNotMatch(canvasRouteWithoutV3Fallback, /prunaai\/p-image(?:-edit)?/);
  assert.match(canvasRoute, /google\/nano-banana/);
  assert.match(canvasRoute, /aspectRatio = "4:3"/);
  assert.match(canvasRoute, /generationBody\.sceneImage = currentCanvasUrl/);
  assert.match(canvasRoute, /generationBody\.referenceImages = \[currentCanvasUrl\]/);
  assert.match(canvasRoute, /persistV2Image/);
  assert.match(canvasRoute, /fetchTimeoutMs: V2_IMAGE_PERSIST_TIMEOUT_MS/);
  assert.match(canvasRoute, /findV2NeutralScopeStarter/);
  assert.match(canvasRoute, /findV2ServiceStarter/);
  assert.match(canvasRoute, /starter catalog hit/);
  assert.match(assetRoute, /image\.startsWith\("data:image\/"\)/);
  assert.match(assetStorage, /"adventure-v2"/);
  assert.equal(V2_IMAGE_PERSIST_TIMEOUT_MS, 60_000);
  assert.match(assetStorage, /isTransientStorageError/);
  assert.match(assetStorage, /upsert: true/);
  assert.match(assetStorage, /bucket\.upload\(storagePath/);
  assert.match(experience, /MINIMUM_PRICING_EDITS = 3/);
  assert.match(experience, /PRE_EMAIL_EDIT_LIMIT = 10/);
  assert.match(experience, /previous\.successfulEditCount \+ 1/);
  assert.match(experience, /activeCanvasIndexFor\(snapshot\)/);
  assert.match(experience, /snapshot\.canvasHistory\[activeCanvasIndex\]/);
  assert.match(experience, /priorChanges: action === "edit" \? snapshot\.promptHistory\.slice\(-6\) : \[\]/);
  assert.match(experience, /resolveScopeExperienceConfig\(profile, snapshot\?\.scope\)/);
  assert.match(experience, /AUTO_CONCEPT_COUNT = 6/);
  assert.match(experience, /REGION_STYLE_PREVIEW_COUNT = 3/);
  assert.match(experience, /FAST_CONCEPT_MODEL_ID = "black-forest-labs\/flux-schnell"/);
  assert.match(experience, /Preparing 6 quick options/);
  assert.match(experience, /Premade concepts/);
  assert.match(experience, /Click any area to change it/);
  assert.match(experience, /Tap an area to change it/);
  assert.match(experience, /Describe another change/);
  assert.doesNotMatch(experience, /Choose a direction/);
  assert.doesNotMatch(experience, /direction\.previewColors/);
  assert.doesNotMatch(experience, /regionSelectionActive/);
  assert.doesNotMatch(experience, /scopeQuickChanges\.map/);
  assert.match(experience, /designInstruction/);
  assert.match(experience, /finishedVersions\.map/);
  assert.match(experience, /selectedRegion\.options\.map/);
  assert.match(experience, /regionStylePreviewPrompt/);
  assert.match(experience, /Describe a change for this item/);
  assert.match(experience, /Preparing quick visual options/);
  assert.match(canvasRoute, /designInstruction\(body\?\.designInstruction\)/);
  assert.match(canvasRoute, /body\?\.action === "concept"/);
  assert.match(canvasRoute, /generationIntent === "concept_preview"/);
  assert.match(canvasRoute, /black-forest-labs\/flux-schnell/);
  assert.match(canvasRoute, /generationBody\.numInferenceSteps = 4/);
  assert.match(regionRoute, /normalizedClickPoint/);
  assert.match(regionRoute, /body\?\.action === "map"/);
  assert.match(regionRoute, /Map every visibly present supported editable semantic region/);
  assert.match(regionRoute, /parseRegionMap/);
  assert.match(regionRoute, /Inspect the image rather than guessing/);
  assert.match(regionRoute, /confidence < 0\.58/);
  assert.match(experienceCss, /\.editorPanel[\s\S]*overflow-y: auto/);
  assert.match(experienceCss, /\.conceptRailScroller[\s\S]*overflow-x: auto/);
  assert.match(experienceCss, /\.regionStyleGrid[\s\S]*grid-template-columns: repeat\(3/);
  assert.doesNotMatch(experience, /Build an accurate estimate|iterationRail|railMilestone/);
  assert.match(experience, /Reveal with email/);
  assert.match(experience, /className=\{styles\.blurredPrice\}/);
  assert.match(experience, /Calculating…/);
  assert.match(experience, /Reviewing your final design and revisions/);
  assert.match(experience, /pricing: null/);
  assert.match(experience, /changedRefinementKeys/);
  assert.match(experience, /step-design-revisions-v2/);
  assert.match(experience, /isFallback = \/\^\(fallback\|configured_preview\)/);
  assert.doesNotMatch(experience, /snapshot\.pricing \|\| fallbackPricing/);
  assert.match(experience, /\{pricingUnlockAvailable \? \(/);
  assert.match(experience, /Estimate status/);
  assert.match(experience, /Not ready yet/);
  assert.ok(
    experience.indexOf("{pricingUnlockAvailable ? (") <
      experience.indexOf("className={styles.blurredPrice}"),
    "the blurred price and email reveal must only render after the revision milestone"
  );
  assert.match(experience, /Budget <Check/);
  assert.doesNotMatch(experience, /data-resolved-module-stack/);
  assert.doesNotMatch(experience, /promptDivider|What should we change\?/);
  assert.match(experience, /successfulEditCount >= PRE_EMAIL_EDIT_LIMIT/);
  assert.match(experience, /openLeadGate\("edit_limit", nextCount\)/);
  assert.doesNotMatch(experience, /disabled=\{!pricingUnlockAvailable\}/);
  assert.match(experience, /replaceCanvasWithUpload/);
  assert.match(experience, /Upload your photo/);
  assert.match(experience, /activeCanvasBranch\(previous\), replacement/);
  assert.match(experience, /goToCanvasRevision/);
  assert.match(experience, /Undo to previous design version/);
  assert.match(experience, /Redo next design version/);
  assert.match(experience, /activeCanvasIndex: nextHistory\.length - 1/);
  assert.match(experience, /promptHistoryForCanvases\(nextHistory\)/);
  assert.match(experience, /requestFullscreen/);
  assert.match(experience, /link\.download = `\$\{fileBase\}-revision-\$\{activeCanvasIndex \+ 1\}\.png`/);
  assert.match(experience, /className=\{styles\.unlockedCanvasTools\}/);
  const unlockedToolsIndex = experience.indexOf("className={styles.unlockedCanvasTools}");
  const unlockedToolsGuard = experience.lastIndexOf(
    "{snapshot.lead.captured ? (",
    unlockedToolsIndex
  );
  assert.ok(
    unlockedToolsGuard >= 0 && unlockedToolsGuard < unlockedToolsIndex,
    "full-screen and download controls must be guarded by lead capture"
  );
  assert.match(experience, /unlock pricing, full-screen viewing, and download/);
  assert.match(experienceCss, /\.canvasUploadButton/);
  assert.match(experienceCss, /\.revisionNav/);
  assert.match(experienceCss, /\.unlockedCanvasTools/);
  assert.match(experienceCss, /\.imageFrame:fullscreen/);
  assert.doesNotMatch(experienceCss, /\.starterChoiceGrid/);
  assert.doesNotMatch(experienceCss, /\.starterChoiceCard/);
  assert.match(experienceCss, /max-height: calc\(100dvh - 36px\)/);
  assert.match(experienceCss, /\.blurredPrice[\s\S]*?filter: blur\(6px\)/);
  assert.match(experienceCss, /\.canvasShell \{[\s\S]*?flex: 1 1 0/);
  assert.match(experienceCss, /\.imageFrame > img \{[^}]*object-fit: contain/);
  assert.doesNotMatch(experienceCss, /\.imageFrame > img \{[^}]*object-fit: cover/);
  assert.match(experienceCss, /@media \(min-width: 861px\)[\s\S]*?\.editorPanel \{[\s\S]*?overflow-y: auto/);
  assert.match(experienceCss, /\.modalBackdrop[\s\S]*?overflow-y: auto/);
});

test("V2 image persistence safely retries a transient storage abort", async () => {
  let uploadAttempts = 0;
  const uploadOptions: Array<Record<string, unknown>> = [];
  const bucket = {
    async upload(
      storagePath: string,
      _bytes: Uint8Array,
      options: Record<string, unknown>
    ) {
      uploadAttempts += 1;
      uploadOptions.push(options);
      if (uploadAttempts === 1) {
        return {
          data: null,
          error: { message: "This operation was aborted" },
        };
      }
      return { data: { path: storagePath }, error: null };
    },
    getPublicUrl(storagePath: string) {
      return {
        data: { publicUrl: `https://assets.example.test/${storagePath}` },
      };
    },
  };
  const supabase = {
    storage: {
      from(bucketName: string) {
        assert.equal(bucketName, "images");
        return bucket;
      },
    },
  };

  const asset = await persistV2Image({
    supabase: supabase as any,
    instanceId: "instance-test",
    sessionId: "session-test",
    imageRef:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
    kind: "generated",
  });

  assert.equal(uploadAttempts, 2);
  assert.ok(uploadOptions.every((options) => options.upsert === true));
  assert.match(asset.url, /^https:\/\/assets\.example\.test\//);
});

test("region style previews stay focused on the clicked item", () => {
  const prompt = regionStylePreviewPrompt(
    "Bathroom Remodeling",
    "Tile & flooring",
    {
      id: "shower_tile",
      label: "Shower tile",
      description: "Visible tile in the shower area.",
      options: [],
    },
    {
      id: "larger-format",
      label: "Larger format",
      prompt: "Use larger-format warm ivory tile with subtle grout.",
    }
  );

  assert.match(prompt, /visual style reference for the shower tile/i);
  assert.match(prompt, /clear, close-framed subject/i);
  assert.match(prompt, /only enough adjacent space/i);
  assert.doesNotMatch(prompt, /complete room|restyle the whole/i);
});

test("scene starters prefer neutral scope imagery and retain a service fallback", () => {
  const scopeCatalog = read("lib/adventure-v2/scope-starter-catalog.ts");
  const neutralSeed = readFileSync(
    resolve(repoRoot, "scripts/seed-v2-neutral-scope-starters.mjs"),
    "utf8"
  );

  assert.equal(
    V2_NEUTRAL_SCOPE_STARTER_GENERATED_FOR,
    "v2_neutral_scope_starter"
  );
  assert.equal(V2_SERVICE_STARTER_GENERATED_FOR, "v2_service_starter");
  assert.match(scopeCatalog, /stableBucket/);
  assert.match(scopeCatalog, /starter_experiment_eligible/);
  assert.match(scopeCatalog, /\.limit\(100\)/);
  assert.match(scopeCatalog, /Math\.min\(50, params\.limit/);
  assert.match(scopeCatalog, /listV2ScopeGalleryOptions/);
  assert.match(scopeCatalog, /Promise\.allSettled/);
  assert.match(neutralSeed, /starter_variant_id: "focused-neutral-control"/);
  assert.doesNotMatch(neutralSeed, /\.from\("images"\)\s*\.delete/);
});

test("V3 gallery supplements each scope only with compatible full scenes", () => {
  const scopeCatalog = read("lib/adventure-v2/scope-starter-catalog.ts");
  assert.doesNotMatch(scopeCatalog, /refinement_option/);
  assert.deepEqual(compatibleSceneScopesForScope("Shower or tub area only"), [
    "Tile & flooring",
    "Full bathroom renovation",
    "Layout or plumbing changes",
  ]);
  assert.ok(!compatibleSceneScopesForScope("Vanity, cabinets & fixtures").includes("Shower or tub area only"));
  assert.ok(compatibleSceneScopesForScope("Patio and walkway upgrade").includes("Full outdoor renovation"));
});

test("scene flow skips style selection and opens one neutral sample space", () => {
  const experience = read("components/adventure/v2/AdventureV2Experience.tsx");
  const canvasRoute = read("app/api/v2/ai-form/[instanceId]/canvas/route.ts");
  const storage = read("components/adventure/v2/storage.ts");

  assert.doesNotMatch(experience, /stage: "starter"/);
  assert.doesNotMatch(experience, /Choose a starter scene|Choose your starting point\./);
  assert.doesNotMatch(experience, /starterOptions|starterAssetId/);
  assert.doesNotMatch(experience, /Use sample space/);
  assert.match(experience, /Opening a plain sample space/);
  assert.match(experience, /This is an intentionally plain sample space—let’s start styling it/);
  assert.match(experience, /starterExperimentKey: canvas\.starterExperimentKey/);
  assert.match(experience, /starterVariantId: canvas\.starterVariantId/);
  assert.match(canvasRoute, /findV2NeutralScopeStarter/);
  assert.match(canvasRoute, /findV2ServiceStarter/);
  assert.match(storage, /legacyStage === "starter"[\s\S]*?\? "inputs"/);
});

test("scope-specific revision suggestions do not leak adjacent bathroom work", () => {
  const vanity = quickChangesForScope(
    { quickChanges: ["Update shower tile"] },
    "Vanity, cabinets & fixtures"
  );
  assert.equal(vanity.length, 4);
  assert.ok(vanity.some((change) => /vanity/i.test(change)));
  assert.ok(vanity.every((change) => !/shower|tub/i.test(change)));

  const wetArea = quickChangesForScope(
    { quickChanges: ["Update vanity"] },
    "Shower or tub area only"
  );
  assert.ok(wetArea.some((change) => /shower/i.test(change)));
  assert.ok(wetArea.every((change) => !/vanity/i.test(change)));
});

test("scope refinement configuration separates complete looks, component directions, and semantic regions", () => {
  const bathroomProfile = resolveServiceProfile(
    {},
    {
      value: "bathroom-remodeling",
      label: "Bathroom Remodeling",
      subcategoryComponents: [
        { key: "tile", label: "Tile", priority: 1 },
        { key: "vanity", label: "Vanity", priority: 2 },
      ],
    }
  );
  const fullBathroom = resolveScopeExperienceConfig(
    bathroomProfile,
    "Full bathroom renovation"
  );
  assert.equal(fullBathroom.directionCardType, "complete_look");
  assert.equal(fullBathroom.directions.length, 3);
  assert.ok(fullBathroom.supportedRegions.some((region) => region.id === "vanity"));
  assert.ok(fullBathroom.supportsFinishedVersions);

  const tileAndFlooring = resolveScopeExperienceConfig(
    bathroomProfile,
    "Tile & flooring"
  );
  assert.equal(tileAndFlooring.directionCardType, "material_palette");
  assert.ok(
    tileAndFlooring.supportedRegions.some((region) => region.id === "shower_tile")
  );
  assert.ok(
    tileAndFlooring.supportedRegions.some((region) => region.id === "flooring")
  );
  assert.ok(
    tileAndFlooring.supportedRegions.every(
      (region) => !/vanity/i.test(region.label)
    )
  );
  assert.match(
    premadeConceptPrompt(
      tileAndFlooring,
      "Bathroom remodeling",
      "Tile & flooring",
      0
    ),
    /clear visual subject/i
  );
});

test("successive V2 edits preserve the current image and recognize architectural requests", () => {
  assert.equal(isStructuralSceneChange("Allow a half wall for the shower"), true);
  assert.equal(isStructuralSceneChange("Use warmer materials"), false);

  const prompt = buildV2IterativeEditPrompt({
    serviceName: "Bathroom remodeling",
    scope: "Cosmetic refresh",
    budget: 24_500,
    mode: "scene",
    requestedChange: "Allow a half wall for the shower",
    priorChanges: ["Use warmer wood on the vanity", "Change the hardware to brushed brass"],
  });

  assert.match(prompt, /supplied image is the single authoritative current design/i);
  assert.match(prompt, /Latest request—highest priority: "Allow a half wall for the shower"/);
  assert.match(prompt, /allowed to expand or override the original pricing scope/i);
  assert.match(prompt, /Previously accepted directions already visible/i);
  assert.match(prompt, /Use warmer wood on the vanity/);
  assert.match(prompt, /precise architectural geometry edit/i);
  assert.match(prompt, /physically buildable/i);
  assert.match(prompt, /exact same camera position, crop, perspective/i);
});

test("structured target-region prompts explicitly preserve everything outside the confirmed object", () => {
  const prompt = buildV2IterativeEditPrompt({
    serviceName: "Bathroom remodeling",
    scope: "Tile & flooring",
    budget: 20_000,
    mode: "scene",
    requestedChange: "Use larger-format warm stone tile.",
    designInstruction: {
      mode: "target_region",
      targetRegion: {
        id: "shower_tile",
        label: "Shower tile",
        confidence: 0.91,
      },
      optionId: "warm-stone",
      optionLabel: "Warm stone",
      affectedRegions: ["Shower tile"],
      preserve: ["flooring", "vanity", "fixtures"],
      readableSummary: "Shower tile · Warm stone",
    },
  });
  assert.match(prompt, /Confirmed semantic target region: Shower tile/i);
  assert.match(prompt, /Change only the confirmed Shower tile region/i);
  assert.match(prompt, /Do not restyle, replace, move, recolor, or regenerate any other part/i);
  assert.match(prompt, /Explicit preservation rules: flooring; vanity; fixtures/i);
});

test("starter canvases are deliberately plain across scene industries", () => {
  const bathroom = buildV2StarterPrompt({
    serviceName: "Bathroom remodeling",
    industryName: "Home improvement",
    serviceSummary: "Renovate bathrooms and showers.",
    scope: "Vanity only",
    budget: 30_000,
    mode: "scene",
    components: ["Vanity", "Counter", "Mirror", "Hardware"],
  });
  assert.match(bathroom, /STARTER CANVAS, NOT A FINISHED DESIGN/);
  assert.match(bathroom, /HARD SCOPE BOUNDARY: create a starter concept for exactly "Vanity only" and nothing broader/);
  assert.match(bathroom, /Scope-relevant components only, each shown in its simplest basic form: Vanity/);
  assert.doesNotMatch(bathroom, /Scope-relevant components only[^.]*Mirror/);
  assert.match(bathroom, /flat-front white vanity/);
  assert.match(bathroom, /Formica-style laminate counter/);
  assert.match(bathroom, /never use it to upgrade finishes or styling/);
  assert.doesNotMatch(bathroom, /\battractive\b/i);

  const tileAndFlooring = buildV2StarterPrompt({
    serviceName: "Bathroom remodeling",
    industryName: "Home improvement",
    serviceSummary: "Renovate bathrooms and showers.",
    scope: "Tile & flooring",
    budget: 22_000,
    mode: "scene",
    components: ["Vanity", "Shower tile", "Floor tile", "Mirror", "Hardware"],
  });
  assert.match(tileAndFlooring, /Scope-relevant components only[^.]*Shower tile, Floor tile/);
  assert.doesNotMatch(tileAndFlooring, /Scope-relevant components only[^.]*Vanity/);
  assert.match(tileAndFlooring, /selected scope the only designed focal area/);
  assert.match(tileAndFlooring, /surrounding context plain, background-only, visually subordinate/);

  const landscaping = buildV2StarterPrompt({
    serviceName: "Landscape design",
    industryName: "Outdoor services",
    serviceSummary: "Plan patios, lawns, and planting.",
    scope: "Patio area",
    budget: 40_000,
    mode: "scene",
    components: ["Patio", "Lawn"],
  });
  assert.match(landscaping, /ordinary, clean residential yard/);
  assert.match(landscaping, /plain wood boundary fence/);
  assert.match(landscaping, /Do not add a pool, pergola, fire feature/);

  const generic = buildV2StarterPrompt({
    serviceName: "Custom service",
    industryName: "Future industry",
    serviceSummary: "A future visual service.",
    scope: "Focused update",
    budget: 10_000,
    mode: "scene",
    components: [],
  });
  assert.match(generic, /most ordinary, entry-level, stock version/);
  assert.match(generic, /white, off-white, and very light neutral gray/);
  assert.match(generic, /Do not introduce décor, luxury finishes/);
});

test("try-on and placement starters stay neutral without altering supplied identity", () => {
  const common = {
    industryName: "",
    serviceSummary: "",
    scope: "Focused preview",
    budget: 5_000,
    components: [],
  };
  const tryon = buildV2StarterPrompt({
    ...common,
    serviceName: "Apparel try-on",
    mode: "tryon",
  });
  assert.match(tryon, /supplied person and exact product/);
  assert.match(tryon, /Keep lighting and background plain and neutral/);
  assert.match(tryon, /Do not add accessories/);

  const placement = buildV2StarterPrompt({
    ...common,
    serviceName: "Furniture placement",
    mode: "placement",
  });
  assert.match(placement, /supplied scene and exact product/);
  assert.match(placement, /Do not redesign the surrounding scene/);
});

test("V2 lead, pricing, email, telemetry, and browser state remain versioned", () => {
  const leadRoute = read("app/api/v2/leads/route.ts");
  const emailRoute = read("app/api/v2/leads/results-email/route.ts");
  const experience = read("components/adventure/v2/AdventureV2Experience.tsx");
  const storage = read("components/adventure/v2/storage.ts");

  assert.match(leadRoute, /experienceVersion: "v2"/);
  assert.match(leadRoute, /idempotent: true/);
  assert.match(emailRoute, /Idempotency-Key/);
  assert.match(emailRoute, /RESEND_API_KEY/);
  assert.match(emailRoute, /emailDelivery/);
  assert.match(experience, /adventure_v2_pricing_revealed/);
  assert.match(experience, /experienceVersion: "v2"/);
  assert.match(experience, /void \(async \(\) =>/);
  assert.match(storage, /adventure:v2:snapshot/);
  assert.match(storage, /adventure:v2:session/);
});

test("designer navbar refresh mirrors the V2 Start over reset", () => {
  const experience = read("components/adventure/v2/AdventureV2Experience.tsx");
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
  assert.match(preview, /const resetSession =[\s\S]*?event\.detail[\s\S]*?resetSession/);
  assert.match(preview, /if \(!resetSession\) return/);
  assert.match(preview, /setFreshNonce\(\(n\) => n \+ 1\)/);
  assert.match(experience, /adventure:v2:fresh-consumed:/);
  assert.match(experience, /event\.data\.type === "SIF_RESET_SESSION" \|\| event\.data\.type === "RESET_SESSION"/);
  assert.match(experience, /resetExperience\("designer_refresh"\)/);
  assert.match(experience, /resetExperience\("in_form"\)/);
});

test("designer launch UI emits one unversioned Adventure URL per surface", () => {
  const launch = readFileSync(
    resolve(repoRoot, "apps/designer/src/components/features/LaunchTab.tsx"),
    "utf8"
  );
  const unversioned = readFileSync(
    resolve(repoRoot, "apps/widget/app/adventure/[instanceId]/page.tsx"),
    "utf8"
  );

  // Launch links no longer pin a version: every surface points at the
  // unversioned route, which serves the current experience.
  assert.match(launch, /`\/adventure\/\$\{encodeURIComponent\(instanceId\)\}`/);
  assert.match(launch, /url\.searchParams\.set\("surface", surface\)/);
  assert.doesNotMatch(launch, /AdventureRouteVersion|adventureVersion/);
  assert.match(unversioned, /AdventureV5Experience/);
});

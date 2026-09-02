import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: resolve(repoRoot, "env/.env.shared.local"), override: false });

const apply = process.argv.includes("--apply");
const imageRoot = resolve(
  repoRoot,
  "output/imagegen/v2-neutral-scope-starters"
);
const imageBucket = "images";
const generatedFor = "v2_neutral_scope_starter";
const catalogRevision = "2026-07-30-focused-neutral-scope-starters";
const bathroomSubcategoryId = "258f4d7f-746f-416b-b617-e1cca25b748f";
const landscapeSubcategoryId = "ee70f353-c48e-4bd9-bfc1-cf1b00291fa9";

const starters = [
  {
    file: "bathroom-full-renovation-neutral.png",
    service: "Bathroom Remodeling",
    subcategoryId: bathroomSubcategoryId,
    scope: "Full bathroom renovation",
    prompt:
      "Intentionally plain builder-grade complete bathroom photographed from the doorway, showing a standard alcove tub-shower, toilet, single vanity, mirror, basic lighting, and simple floor. The entire compact room is the subject. Off-white walls, white fixtures, plain light-gray flooring, ordinary chrome, no decor, premium materials, people, text, logos, or watermark.",
  },
  {
    file: "bathroom-full-renovation-neutral-angle-b.png",
    service: "Bathroom Remodeling",
    subcategoryId: bathroomSubcategoryId,
    scope: "Full bathroom renovation",
    variantId: "doorway-wide-white",
    variantLabel: "Doorway wide · white vanity",
    cameraAngle: "doorway-three-quarter-wide-white-vanity",
    prompt:
      "Intentionally plain, clean, newly installed compact American hall bathroom from a slightly off-center doorway angle. Exactly one white alcove tub-shower, one toilet, and one 30-inch single-sink white vanity are fully visible with plausible clearances. Fresh white ceramic tile, pale-gray floor tile, ordinary chrome, warm-white walls, and neutral daylight. No second wet zone or fixture, curtain, decor, personal items, premium styling, people, text, logos, or watermark.",
  },
  {
    file: "bathroom-full-renovation-neutral-angle-c.png",
    service: "Bathroom Remodeling",
    subcategoryId: bathroomSubcategoryId,
    scope: "Full bathroom renovation",
    variantId: "opposite-corner-oak",
    variantLabel: "Opposite corner · oak vanity",
    cameraAngle: "opposite-doorway-three-quarter-wide-oak-vanity",
    prompt:
      "Intentionally plain, clean, newly installed compact American hall bathroom from the opposite doorway corner. Exactly one white alcove tub-shower, one toilet, and one 30-inch single-sink light-oak vanity are fully visible with plausible clearances. Fresh white ceramic tile, pale-gray floor tile, brushed nickel, off-white walls, and neutral daylight. No second wet zone or fixture, curtain, decor, personal items, premium styling, people, text, logos, or watermark.",
  },
  {
    file: "bathroom-shower-tub-neutral.png",
    service: "Bathroom Remodeling",
    subcategoryId: bathroomSubcategoryId,
    scope: "Shower or tub area only",
    prompt:
      "Intentionally plain builder-grade bathroom wet zone tightly framed on only a standard white alcove bathtub and simple shower above it. Plain white ceramic surround tile, ordinary chrome fixtures, flat neutral daylight. No vanity, sink, toilet, freestanding tub, decor, premium materials, people, text, logos, or watermark.",
  },
  {
    file: "bathroom-vanity-fixtures-neutral.png",
    service: "Bathroom Remodeling",
    subcategoryId: bathroomSubcategoryId,
    scope: "Vanity, cabinets & fixtures",
    prompt:
      "Intentionally plain builder-grade bathroom vanity wall tightly framed on one ordinary stock vanity cabinet, countertop, sink, frameless mirror, faucet, hardware, and basic light bar. Plain white or light-gray cabinetry and ordinary chrome. No shower, bathtub, toilet, decor, luxury finishes, people, text, logos, or watermark.",
  },
  {
    file: "bathroom-tile-flooring-neutral.png",
    service: "Bathroom Remodeling",
    subcategoryId: bathroomSubcategoryId,
    scope: "Tile & flooring",
    prompt:
      "Intentionally plain builder-grade bathroom scene focused almost entirely on a basic white subway-tile tub-shower surround and a large visible area of simple light-gray ceramic floor tile. Landscape framing angled slightly downward, with floor in the lower half and shower tile in the upper half. No vanity, cabinets, sink, toilet, decor, luxury finishes, people, text, logos, or watermark.",
  },
  {
    file: "bathroom-cosmetic-refresh-neutral.png",
    service: "Bathroom Remodeling",
    subcategoryId: bathroomSubcategoryId,
    scope: "Cosmetic refresh (paint, lighting, hardware)",
    prompt:
      "Intentionally plain dated-but-clean bathroom wall focused on editable cosmetic elements: flat beige paint, a basic stock vanity, ordinary cabinet hardware, chrome faucet, frameless mirror, and simple builder light bar. No shower, bathtub, toilet, decor, luxury finishes, people, text, logos, or watermark.",
  },
  {
    file: "bathroom-layout-plumbing-neutral.png",
    service: "Bathroom Remodeling",
    subcategoryId: bathroomSubcategoryId,
    scope: "Layout or plumbing changes",
    prompt:
      "Intentionally plain builder-grade full bathroom seen from the doorway, with the spatial relationship between a standard tub-shower, toilet, small vanity, walking clearances, and plumbing walls clearly visible. Physically plausible compact-room geometry, no decor, premium materials, people, text, logos, or watermark.",
  },
  {
    file: "landscape-full-outdoor-renovation-neutral.png",
    service: "Landscaping",
    subcategoryId: landscapeSubcategoryId,
    scope: "Full outdoor renovation",
    prompt:
      "Intentionally plain suburban backyard showing the basic zones a full outdoor renovation can transform: broad lawn, small plain concrete pad, simple walkway, sparse foundation bed, fence, and house edge. Wide realistic property photo, no pool, pergola, firepit, outdoor kitchen, luxury furniture, elaborate planting, people, text, logos, or watermark.",
  },
  {
    file: "landscape-outdoor-kitchen-dining-neutral.png",
    service: "Landscaping",
    subcategoryId: landscapeSubcategoryId,
    scope: "Outdoor kitchen",
    variantId: "kitchen-dining-seating-wide",
    variantLabel: "Outdoor kitchen · dining · seating",
    prompt:
      "Intentionally plain suburban patio with exactly one modest straight outdoor kitchen and grill, one simple outdoor dining table, and one separate two-chair seating zone. Wide house-to-yard view with ordinary concrete, lawn, realistic clearances, and neutral daylight. No duplicate zones, pergola, fire pit, pool, elaborate planting, luxury styling, people, text, logos, or watermark.",
  },
  {
    file: "landscape-pergola-fire-pit-neutral.png",
    service: "Landscaping",
    subcategoryId: landscapeSubcategoryId,
    scope: "Pergola",
    variantId: "pergola-fire-pit-seating-wide",
    variantLabel: "Pergola · fire pit · seating",
    prompt:
      "Intentionally plain suburban patio with exactly one simple rectangular wood pergola, one small round built-in fire pit, and one seating group of four ordinary chairs. Wide three-quarter view with complete structure and realistic clearances. No duplicate zones, outdoor kitchen, dining table, pool, luxury styling, people, text, logos, or watermark.",
  },
  {
    file: "landscape-retaining-fence-drainage-neutral.png",
    service: "Landscaping",
    subcategoryId: landscapeSubcategoryId,
    scope: "Retaining walls",
    variantId: "retaining-fence-drainage-wide",
    variantLabel: "Retaining wall · fence · drainage",
    prompt:
      "Intentionally plain residential side yard with exactly one low block retaining wall, one wood privacy fence and gate, one shallow drainage swale, and one catch basin. Wide view showing grade and clearances. No duplicate structures, diagrams, arrows, luxury landscaping, people, text, logos, or watermark.",
  },
  {
    file: "landscape-water-feature-neutral.png",
    service: "Landscaping",
    subcategoryId: landscapeSubcategoryId,
    scope: "Water feature",
    variantId: "single-basin-wide",
    variantLabel: "Single basin water feature",
    prompt:
      "Intentionally plain suburban garden bed with exactly one small rectangular recirculating water basin and one low spillway. Wide view includes lawn, bed boundaries, fence, and house context. No second pond, fountain, waterfall, pool, luxury styling, people, text, logos, or watermark.",
  },
  {
    file: "landscape-patio-walkway-neutral.png",
    service: "Landscaping",
    subcategoryId: landscapeSubcategoryId,
    scope: "Patio and walkway upgrade",
    prompt:
      "Intentionally plain residential backyard tightly focused on a basic rectangular broom-finished concrete patio and simple connecting concrete walkway. Hardscape surfaces, joints, borders, and transitions dominate the frame. No decorative pavers, elaborate gardens, furniture, luxury features, people, text, logos, or watermark.",
  },
  {
    file: "landscape-lawn-garden-neutral.png",
    service: "Landscaping",
    subcategoryId: landscapeSubcategoryId,
    scope: "New lawn and garden installation",
    prompt:
      "Intentionally plain suburban backyard focused on a broad basic lawn and one simple mostly empty mulch bed. Lawn and garden-bed boundaries dominate the wide frame. No patio focus, elaborate mature planting, flowers, furniture, luxury features, people, text, logos, or watermark.",
  },
  {
    file: "landscape-driveway-neutral.png",
    service: "Landscaping",
    subcategoryId: landscapeSubcategoryId,
    scope: "Driveway resurfacing and repair",
    prompt:
      "Intentionally plain residential driveway scene tightly focused on a standard two-car asphalt driveway with mild fading and a few small repairable cracks. The driveway surface, slope, borders, and garage transition dominate the frame. No vehicles, decorative paving, elaborate landscaping, people, text, logos, or watermark.",
  },
  {
    file: "landscape-hardscape-color-neutral.png",
    service: "Landscaping",
    subcategoryId: landscapeSubcategoryId,
    scope: "Hardscape color scheme refresh",
    prompt:
      "Intentionally plain residential hardscape scene tightly focused on a large expanse of uniform light-gray concrete slabs, connected steps, and walkway. Hardscape color, joints, borders, and transitions dominate the frame. No furniture, multicolor pavers, elaborate gardens, luxury features, people, text, logos, or watermark.",
  },
  {
    file: "landscape-outdoor-lighting-neutral.png",
    service: "Landscaping",
    subcategoryId: landscapeSubcategoryId,
    scope: "Outdoor lighting installation",
    prompt:
      "Intentionally plain suburban yard at early blue hour with no installed landscape lighting. A simple unlit path, lawn, small tree, plain house wall, and planting bed are clearly visible as potential lighting targets. No glowing lights, luxury features, people, text, logos, or watermark.",
  },
  {
    file: "landscape-irrigation-neutral.png",
    service: "Landscaping",
    subcategoryId: landscapeSubcategoryId,
    scope: "Irrigation system installation",
    prompt:
      "Intentionally plain residential yard focused on a broad lawn and simple perimeter planting bed, with no irrigation equipment visible. Lawn coverage zones and bed boundaries are clearly legible in a wide view. No sprinklers, spraying water, diagrams, luxury features, people, text, logos, or watermark.",
  },
  {
    file: "landscape-pruning-neutral.png",
    service: "Landscaping",
    subcategoryId: landscapeSubcategoryId,
    scope: "Tree and shrub pruning service",
    prompt:
      "Ordinary residential yard tightly focused on one healthy but overgrown small tree and several overgrown foundation shrubs encroaching slightly on a simple walkway and house windows. Natural branch density and clearances are the service subjects. No workers, tools, luxury features, people, text, logos, or watermark.",
  },
].map((starter) => ({
  ...starter,
  scopeKey: slug(starter.scope),
  variantId: starter.variantId || "focused-neutral-control",
  variantLabel: starter.variantLabel || "Focused neutral control",
}));

function slug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "scope";
}

const starterProfileDetails = {
  "full-bathroom-renovation": {
    visible: ["shower-tub", "vanity", "cabinets-storage", "cabinets-and-storage", "countertop", "toilet", "floor-tile", "wall-tile", "faucets-fixtures", "faucets-and-fixtures", "lighting", "mirror-medicine", "mirror-medicine-cabinet", "paint-trim", "paint-and-trim", "hardware", "exhaust-fan", "flooring-non-tile", "layout-changes", "plumbing-updates"],
    layout: "compact-hall-bath",
    camera: "doorway-three-quarter-wide",
    inventory: { wet_zone_type: "tub-shower-combo", wet_zone_count: 1, vanity_count: 1, toilet_count: 1 },
  },
  "shower-or-tub-area-only": {
    visible: ["shower-tub", "floor-tile", "wall-tile", "faucets-fixtures", "faucets-and-fixtures"],
    layout: "alcove-wet-zone",
    camera: "wet-zone-front-three-quarter",
    inventory: { wet_zone_type: "tub-shower-combo", wet_zone_count: 1, vanity_count: 0, toilet_count: 0 },
  },
  "vanity-cabinets-and-fixtures": {
    visible: ["vanity", "cabinets-storage", "cabinets-and-storage", "countertop", "faucets-fixtures", "faucets-and-fixtures", "lighting", "mirror-medicine", "mirror-medicine-cabinet", "hardware"],
    layout: "single-vanity-wall",
    camera: "vanity-front-three-quarter",
    inventory: { wet_zone_count: 0, vanity_count: 1, toilet_count: 0 },
  },
  "tile-and-flooring": {
    visible: ["shower-tub", "floor-tile", "wall-tile"],
    layout: "bathroom-surface-study",
    camera: "wide-downward-three-quarter",
    inventory: { wet_zone_count: 1, vanity_count: 0, toilet_count: 0 },
  },
  "cosmetic-refresh-paint-lighting-hardware": {
    visible: ["vanity", "cabinets-storage", "cabinets-and-storage", "countertop", "faucets-fixtures", "faucets-and-fixtures", "lighting", "mirror-medicine", "mirror-medicine-cabinet", "paint-trim", "paint-and-trim", "hardware"],
    layout: "single-vanity-wall",
    camera: "vanity-wall-wide",
    inventory: { wet_zone_count: 0, vanity_count: 1, toilet_count: 0 },
  },
  "layout-or-plumbing-changes": {
    visible: ["layout-changes", "plumbing-updates", "shower-tub", "vanity", "toilet"],
    layout: "compact-hall-bath",
    camera: "doorway-layout-wide",
    inventory: { wet_zone_type: "tub-shower-combo", wet_zone_count: 1, vanity_count: 1, toilet_count: 1 },
  },
  "full-outdoor-renovation": {
    visible: ["patio", "patio-terrace", "walkways", "walkways-and-paths", "lawn", "planting-beds", "trees-shrubs", "trees-and-shrubs", "privacy", "privacy-screening", "lighting", "outdoor-lighting", "irrigation", "drainage"],
    layout: "suburban-backyard-wide",
    camera: "house-to-yard-wide",
    inventory: { lawn_zones: 1, patio_zones: 1, walkway_zones: 1, planting_zones: 1 },
  },
  "outdoor-kitchen": {
    visible: ["outdoor-kitchen", "outdoor-grill-kitchen", "outdoor-dining", "outdoor-dining-area", "seating", "outdoor-seating-and-furniture", "patio", "patio-terrace", "walkways", "walkways-and-paths", "lawn"],
    layout: "patio-kitchen-dining-seating",
    camera: "house-to-yard-wide",
    inventory: { outdoor_kitchen_zones: 1, grill_count: 1, dining_zones: 1, seating_zones: 1, patio_zones: 1 },
  },
  "pergola": {
    visible: ["pergola", "pergola-shade-structure", "fire-pit", "fire-pit-fireplace", "seating", "outdoor-seating-and-furniture", "patio", "patio-terrace", "lawn"],
    layout: "pergola-fire-pit-patio",
    camera: "yard-three-quarter-wide",
    inventory: { pergola_count: 1, fire_feature_count: 1, seating_zones: 1, patio_zones: 1 },
  },
  "retaining-walls": {
    visible: ["retaining-walls", "privacy", "privacy-screening", "fence-gate", "drainage", "walkways", "walkways-and-paths", "planting-beds"],
    layout: "graded-side-yard",
    camera: "side-yard-depth-wide",
    inventory: { retaining_wall_count: 1, fence_zones: 1, gate_count: 1, drainage_zones: 1, catch_basin_count: 1 },
  },
  "water-feature": {
    visible: ["water-feature", "planting-beds", "lawn", "privacy"],
    layout: "garden-bed-water-basin",
    camera: "garden-corner-three-quarter-wide",
    inventory: { water_feature_count: 1, spillway_count: 1, planting_zones: 1, lawn_zones: 1 },
  },
  "patio-and-walkway-upgrade": {
    visible: ["patio", "patio-terrace", "walkways", "walkways-and-paths"],
    layout: "patio-walkway-connection",
    camera: "hardscape-wide-three-quarter",
    inventory: { patio_zones: 1, walkway_zones: 1 },
  },
  "new-lawn-and-garden-installation": {
    visible: ["lawn", "planting-beds", "trees-shrubs", "trees-and-shrubs"],
    layout: "lawn-perimeter-bed",
    camera: "yard-wide",
    inventory: { lawn_zones: 1, planting_zones: 1 },
  },
  "driveway-resurfacing-and-repair": {
    visible: ["driveway"],
    layout: "two-car-driveway",
    camera: "street-to-garage-wide",
    inventory: { driveway_zones: 1 },
  },
  "hardscape-color-scheme-refresh": {
    visible: ["patio", "patio-terrace", "walkways", "walkways-and-paths", "retaining-walls"],
    layout: "connected-hardscape",
    camera: "hardscape-wide",
    inventory: { hardscape_zones: 1 },
  },
  "outdoor-lighting-installation": {
    visible: ["lighting", "outdoor-lighting", "walkways", "walkways-and-paths"],
    layout: "path-and-foundation-bed",
    camera: "blue-hour-yard-wide",
    inventory: { walkway_zones: 1, lighting_zones: 0 },
  },
  "irrigation-system-installation": {
    visible: ["irrigation", "lawn", "planting-beds"],
    layout: "lawn-perimeter-bed",
    camera: "coverage-zone-wide",
    inventory: { lawn_zones: 1, planting_zones: 1, irrigation_zones: 0 },
  },
  "tree-and-shrub-pruning-service": {
    visible: ["trees-shrubs", "trees-and-shrubs", "privacy", "privacy-screening"],
    layout: "foundation-planting-edge",
    camera: "tree-shrub-wide",
    inventory: { tree_zones: 1, shrub_zones: 1 },
  },
};

function buildStarterProfile(starter) {
  const details = starterProfileDetails[starter.scopeKey];
  if (!details) throw new Error(`Missing starter profile for ${starter.scopeKey}`);
  const visible = Array.from(new Set([starter.scopeKey, ...details.visible]));
  return {
    version: 1,
    eligible: true,
    review_status: "approved",
    service_id: starter.subcategoryId,
    visible_scope_keys: visible,
    hero_scope_keys: starter.scopeKey.startsWith("full-") ? visible : [starter.scopeKey, ...details.visible.slice(0, 3)],
    finish_tier: "value",
    layout_family: details.layout,
    camera_angle: starter.cameraAngle || details.camera,
    fixture_inventory: details.inventory,
    plainness_score: 0.95,
    editability_score: 0.9,
    structural_valid: true,
    defects: [],
  };
}

function requireCredentials() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required"
    );
  }
  return { url, key };
}

async function validateLocalFiles() {
  for (const starter of starters) {
    const bytes = await readFile(resolve(imageRoot, starter.file));
    if (bytes.length < 100_000) {
      throw new Error(
        `Neutral scope starter is missing or unexpectedly small: ${starter.file}`
      );
    }
  }
}

async function validatePublishedScopes(db) {
  const activeSubcategoryIds = [
    bathroomSubcategoryId,
    landscapeSubcategoryId,
  ];
  const result = await db
    .from("categories_subcategories")
    .select("id, subcategory, subcategory_scope")
    .in("id", activeSubcategoryIds);
  if (result.error) throw result.error;

  const byId = new Map((result.data || []).map((row) => [row.id, row]));
  for (const subcategoryId of activeSubcategoryIds) {
    const row = byId.get(subcategoryId);
    if (!row) throw new Error(`Active subcategory is missing: ${subcategoryId}`);
    const actual = Array.isArray(row.subcategory_scope)
      ? row.subcategory_scope
      : [];
    const covered = new Set(
      starters
        .filter((starter) => starter.subcategoryId === subcategoryId)
        .flatMap((starter) => buildStarterProfile(starter).visible_scope_keys)
    );
    const missing = actual
      .map((scope) => slug(scope))
      .filter((scopeKey) => scopeKey !== "other" && !covered.has(scopeKey));
    if (missing.length > 0) {
      throw new Error(
        `Neutral starter manifest does not cover published scopes for ${row.subcategory}: ${missing.join(", ")}`
      );
    }
  }
}

async function currentStarter(db, starter) {
  const result = await db
    .from("images")
    .select("id, image_url, metadata")
    .eq("subcategory_id", starter.subcategoryId)
    .is("account_id", null)
    .eq("status", "completed")
    .eq("metadata->>generated_for", generatedFor)
    .eq("metadata->>catalog_revision", catalogRevision)
    .eq("metadata->>starter_scope_key", starter.scopeKey)
    .eq("metadata->>starter_variant_id", starter.variantId)
    .limit(1)
    .maybeSingle();
  if (result.error) throw result.error;
  return result.data || null;
}

async function uploadStarter(db, starter) {
  const bytes = await readFile(resolve(imageRoot, starter.file));
  const storagePath = [
    "subcategory",
    starter.subcategoryId,
    "v2-neutral-scope-starters",
    `${starter.scopeKey}-${randomUUID()}.png`,
  ].join("/");
  const upload = await db.storage.from(imageBucket).upload(storagePath, bytes, {
    cacheControl: "31536000",
    contentType: "image/png",
    upsert: false,
  });
  if (upload.error) throw upload.error;

  const publicUrl = String(
    db.storage.from(imageBucket).getPublicUrl(upload.data.path)?.data
      ?.publicUrl || ""
  );
  const experimentKey = `${starter.subcategoryId}:${starter.scopeKey}`;
  let promptId = null;
  try {
    const promptInsert = await db
      .from("prompts")
      .insert({
        account_id: null,
        prompt: starter.prompt,
        subcategory_id: starter.subcategoryId,
        suggestion_label: `${starter.scope} · focused neutral`,
        variables: {
          catalog_revision: catalogRevision,
          generated_for: generatedFor,
          starter_experiment_key: experimentKey,
          starter_scope_key: starter.scopeKey,
          starter_variant_id: starter.variantId,
        },
      })
      .select("id")
      .single();
    if (promptInsert.error) throw promptInsert.error;
    promptId = promptInsert.data.id;

    const imageInsert = await db
      .from("images")
      .insert({
        account_id: null,
        image_url: publicUrl,
        instance_id: null,
        metadata: {
          ai_model: "openai-imagegen",
          catalog_revision: catalogRevision,
          generated_for: generatedFor,
          model_name: "OpenAI ImageGen",
          model_provider: "OpenAI",
          prompt_text: starter.prompt,
          s3_path: upload.data.path,
          service_name: starter.service,
          starter_experiment_eligible: true,
          starter_experiment_key: experimentKey,
          starter_role: "focused_neutral_sample_space",
          starter_scope: starter.scope,
          starter_scope_key: starter.scopeKey,
          starter_variant_id: starter.variantId,
          starter_variant_label: starter.variantLabel,
          starter_profile: buildStarterProfile(starter),
          subcategory_id: starter.subcategoryId,
        },
        model_id: null,
        negative_prompt: null,
        prompt_id: promptId,
        replicate_prediction_id: null,
        status: "completed",
        subcategory_id: starter.subcategoryId,
        user_id: null,
      })
      .select("id")
      .single();
    if (imageInsert.error) throw imageInsert.error;
    return imageInsert.data.id;
  } catch (error) {
    if (promptId) await db.from("prompts").delete().eq("id", promptId);
    await db.storage.from(imageBucket).remove([upload.data.path]);
    throw error;
  }
}

async function main() {
  await validateLocalFiles();
  const credentials = requireCredentials();
  const db = createClient(credentials.url, credentials.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await validatePublishedScopes(db);

  const results = [];
  for (const starter of starters) {
    const existing = await currentStarter(db, starter);
    if (existing) {
      const currentVersion = Number(existing.metadata?.starter_profile?.version || 0);
      if (currentVersion !== 1) {
        if (apply) {
          const metadata = {
            ...(existing.metadata || {}),
            starter_profile: buildStarterProfile(starter),
          };
          const update = await db.from("images").update({ metadata }).eq("id", existing.id);
          if (update.error) throw update.error;
        }
        results.push({
          action: apply ? "updated-profile" : "would-update-profile",
          imageId: existing.id,
          scope: starter.scope,
          service: starter.service,
          url: existing.image_url,
        });
        continue;
      }
      results.push({
        action: "existing",
        imageId: existing.id,
        scope: starter.scope,
        service: starter.service,
        url: existing.image_url,
      });
      continue;
    }
    if (!apply) {
      results.push({
        action: "would-create",
        scope: starter.scope,
        service: starter.service,
      });
      continue;
    }
    const imageId = await uploadStarter(db, starter);
    results.push({
      action: "created",
      imageId,
      scope: starter.scope,
      service: starter.service,
    });
  }

  const retainedCatalogs = {};
  for (const catalog of [
    "v2_scope_starter",
    "v2_service_starter",
    generatedFor,
  ]) {
    const countResult = await db
      .from("images")
      .select("id", { count: "exact", head: true })
      .in("subcategory_id", [bathroomSubcategoryId, landscapeSubcategoryId])
      .eq("metadata->>generated_for", catalog);
    if (countResult.error) throw countResult.error;
    retainedCatalogs[catalog] = countResult.count || 0;
  }

  console.log(
    JSON.stringify(
      { apply, catalogRevision, retainedCatalogs, results },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

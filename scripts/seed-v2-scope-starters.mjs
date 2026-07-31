import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: resolve(repoRoot, "env/.env.shared.local"), override: false });

const apply = process.argv.includes("--apply");
const cleanupObsolete = process.argv.includes("--cleanup-obsolete");
const imageRoot = resolve(repoRoot, "output/imagegen/v2-scope-starters");
const imageBucket = "images";
const generatedFor = "v2_scope_starter";
const bathroomSubcategoryId = "258f4d7f-746f-416b-b617-e1cca25b748f";
const landscapeSubcategoryId = "ee70f353-c48e-4bd9-bfc1-cf1b00291fa9";
const activeSubcategoryIds = [bathroomSubcategoryId, landscapeSubcategoryId];
const invalidBathroomRefinementKeys = new Set([
  "outdoor_lighting",
  "pavers",
  "walkway",
]);

const starters = [
  {
    file: "bathroom-full-renovation.png",
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    service: "Bathroom Remodels",
    subcategoryId: bathroomSubcategoryId,
    scope: "Full bathroom renovation",
    prompt:
      "Premium photorealistic full bathroom renovation starter: one coherent warm-contemporary room showing a double vanity, walk-in shower, toilet and freestanding tub, buildable proportions, refined natural materials, soft daylight, no people or text.",
  },
  {
    file: "bathroom-shower-tub.png",
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    service: "Bathroom Remodels",
    subcategoryId: bathroomSubcategoryId,
    scope: "Shower or tub area only",
    prompt:
      "Premium photorealistic bathroom wet-zone starter tightly framed on only a coordinated walk-in shower and freestanding tub, realistic plumbing and waterproofing, high-end natural tile, no vanity or toilet, no people or text.",
  },
  {
    file: "bathroom-vanity-fixtures.png",
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    service: "Bathroom Remodels",
    subcategoryId: bathroomSubcategoryId,
    scope: "Vanity, cabinets & fixtures",
    prompt:
      "Premium photorealistic bathroom vanity starter tightly framed on a high-end double vanity, cabinetry, countertop, mirrors, sconces, faucets and hardware, accurate joinery and reflections, no shower, tub or toilet, no people or text.",
  },
  {
    file: "bathroom-tile-flooring.png",
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    service: "Bathroom Remodels",
    subcategoryId: bathroomSubcategoryId,
    scope: "Tile & flooring",
    prompt:
      "Reference-preserving premium bathroom edit focused on a coherent high-end floor and shower-wall tile system with believable grout, transitions and installation details; preserve the room geometry, fixtures and camera; no people or text.",
  },
  {
    file: "bathroom-cosmetic-refresh.png",
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    service: "Bathroom Remodels",
    subcategoryId: bathroomSubcategoryId,
    scope: "Cosmetic refresh (paint, lighting, hardware)",
    prompt:
      "Reference-preserving premium cosmetic bathroom refresh changing only paint, lighting, faucets and cabinet hardware to a polished warm-brass direction; retain all room geometry, cabinetry, tile and plumbing locations; no people or text.",
  },
  {
    file: "bathroom-layout-plumbing.png",
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    service: "Bathroom Remodels",
    subcategoryId: bathroomSubcategoryId,
    scope: "Layout or plumbing changes",
    prompt:
      "Reference-preserving premium structural bathroom concept with a physically buildable tiled shower half-wall and clear glass above plus coherent plumbing placement; preserve camera and unrelated finishes; accurate geometry, no people or text.",
  },
  {
    file: "landscape-full-outdoor-renovation.png",
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    service: "Landscape Design",
    subcategoryId: landscapeSubcategoryId,
    scope: "Full outdoor renovation",
    prompt:
      "Premium photorealistic full backyard renovation starter showing one coherent patio, curving walkway, lawn, layered garden beds, mature trees, retaining detail and restrained path lighting, high-end but buildable, no people or text.",
  },
  {
    file: "landscape-patio-walkway.png",
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    service: "Landscape Design",
    subcategoryId: landscapeSubcategoryId,
    scope: "Patio and walkway upgrade",
    prompt:
      "Premium photorealistic landscape starter isolated on a professionally installed stone patio and connected curved walkway, crisp drainage and edge details, restrained planting context, no unrelated outdoor features, people or text.",
  },
  {
    file: "landscape-lawn-garden.png",
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    service: "Landscape Design",
    subcategoryId: landscapeSubcategoryId,
    scope: "New lawn and garden installation",
    prompt:
      "Premium photorealistic lawn-and-garden starter focused on a healthy new lawn with clean organic edges and layered climate-plausible beds of trees, shrubs, grasses and perennials, no patio focus, people or text.",
  },
  {
    file: "landscape-driveway.png",
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    service: "Landscape Design",
    subcategoryId: landscapeSubcategoryId,
    scope: "Driveway resurfacing and repair",
    prompt:
      "Premium photorealistic residential driveway resurfacing starter tightly focused on a pristine repaired two-car driveway with correct slope, joints and clean borders, restrained house and planting context, no vehicles, people or text.",
  },
  {
    file: "landscape-hardscape-color.png",
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    service: "Landscape Design",
    subcategoryId: landscapeSubcategoryId,
    scope: "Hardscape color scheme refresh",
    prompt:
      "Reference-preserving hardscape color edit: warm greige patio field with restrained charcoal walkway and step borders; preserve paver geometry, joint pattern, furniture, house and planting; realistic premium material variation, no people or text.",
  },
  {
    file: "landscape-outdoor-lighting.png",
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    service: "Landscape Design",
    subcategoryId: landscapeSubcategoryId,
    scope: "Outdoor lighting installation",
    prompt:
      "Reference-preserving blue-hour landscape lighting concept with discreet warm path lights, tree uplights, planting grazers and retaining-wall under-cap light; preserve all yard geometry and materials; realistic falloff, no people or text.",
  },
  {
    file: "landscape-irrigation.png",
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    service: "Landscape Design",
    subcategoryId: landscapeSubcategoryId,
    scope: "Irrigation system installation",
    prompt:
      "Reference-preserving irrigation starter showing subtle flush pop-up heads with realistic overlapping lawn coverage and a discreet bed drip line; preserve every landscape element and camera; polished photography, no diagram labels or text.",
  },
  {
    file: "landscape-pruning.png",
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    service: "Landscape Design",
    subcategoryId: landscapeSubcategoryId,
    scope: "Tree and shrub pruning service",
    prompt:
      "Reference-preserving professional pruning outcome with healthy open tree canopies, organically shaped shrubs, cleared walkway growth and crisp clean beds; preserve species, mature scale and yard layout; no people or text.",
  },
].map((starter) => ({
  ...starter,
  scopeKey: slug(starter.scope),
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

function requireCredentials() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  }
  return { url, key };
}

async function validateLocalFiles() {
  for (const starter of starters) {
    const bytes = await readFile(resolve(imageRoot, starter.file));
    if (bytes.length < 100_000) {
      throw new Error(`Starter image is missing or unexpectedly small: ${starter.file}`);
    }
  }
}

async function validatePublishedScopes(db) {
  const result = await db
    .from("categories_subcategories")
    .select("id, subcategory, subcategory_scope")
    .in("id", activeSubcategoryIds);
  if (result.error) throw result.error;
  const byId = new Map((result.data || []).map((row) => [row.id, row]));
  for (const subcategoryId of activeSubcategoryIds) {
    const row = byId.get(subcategoryId);
    if (!row) throw new Error(`Active subcategory is missing: ${subcategoryId}`);
    const expected = starters
      .filter((starter) => starter.subcategoryId === subcategoryId)
      .map((starter) => starter.scope);
    const actual = Array.isArray(row.subcategory_scope) ? row.subcategory_scope : [];
    if (
      expected.length !== actual.length ||
      expected.some((scope) => !actual.includes(scope))
    ) {
      throw new Error(
        `Starter manifest does not exactly cover published scopes for ${row.subcategory}`
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
    .eq("metadata->>starter_scope_key", starter.scopeKey)
    .order("created_at", { ascending: false })
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
    "v2-scope-starters",
    `${starter.scopeKey}-${randomUUID()}.png`,
  ].join("/");
  const upload = await db.storage.from(imageBucket).upload(storagePath, bytes, {
    cacheControl: "31536000",
    contentType: "image/png",
    upsert: false,
  });
  if (upload.error) throw upload.error;

  const publicUrl = String(
    db.storage.from(imageBucket).getPublicUrl(upload.data.path)?.data?.publicUrl || ""
  );
  let promptId = null;
  try {
    const promptInsert = await db
      .from("prompts")
      .insert({
        account_id: null,
        prompt: starter.prompt,
        subcategory_id: starter.subcategoryId,
        suggestion_label: starter.scope,
        variables: {
          generated_for: generatedFor,
          starter_scope_key: starter.scopeKey,
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
          generated_for: generatedFor,
          model_name: "OpenAI ImageGen",
          model_provider: "OpenAI",
          origin_instance_id: starter.instanceId,
          prompt_text: starter.prompt,
          s3_path: upload.data.path,
          source: "v2_active_scope_seed_2026_07_29",
          starter_scope: starter.scope,
          starter_scope_key: starter.scopeKey,
          subcategory_id: starter.subcategoryId,
          service_name: starter.service,
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

async function cleanupObsoleteRows(db) {
  const obsoleteResult = await db
    .from("images")
    .select("id, prompt_id, metadata")
    .in("subcategory_id", activeSubcategoryIds)
    .in("metadata->>generated_for", ["style_seed", "subcategory_catalog"]);
  if (obsoleteResult.error) throw obsoleteResult.error;

  const invalidResult = await db
    .from("images")
    .select("id, prompt_id, metadata")
    .eq("subcategory_id", bathroomSubcategoryId)
    .eq("metadata->>generated_for", "refinement_option")
    .in("metadata->>refinement_category_key", [
      "outdoor_lighting",
      "pavers",
      "walkway",
    ]);
  if (invalidResult.error) throw invalidResult.error;

  const targets = [...(obsoleteResult.data || []), ...(invalidResult.data || [])];
  const targetIds = [...new Set(targets.map((row) => row.id).filter(Boolean))];
  const promptIds = [...new Set(targets.map((row) => row.prompt_id).filter(Boolean))];
  const storagePaths = [
    ...new Set(
      targets
        .map((row) =>
          row.metadata && typeof row.metadata === "object"
            ? row.metadata.s3_path
            : null
        )
        .filter((value) => typeof value === "string" && value)
    ),
  ];

  if (targetIds.length > 0) {
    const references = await db
      .from("instance_sample_gallery")
      .select("id, image_id")
      .in("image_id", targetIds);
    if (references.error) throw references.error;
    if ((references.data || []).length > 0) {
      throw new Error("Cleanup target is still referenced by an instance sample gallery");
    }
    const deletion = await db.from("images").delete().in("id", targetIds);
    if (deletion.error) throw deletion.error;
  }

  let deletedPrompts = 0;
  if (promptIds.length > 0) {
    const remaining = await db
      .from("images")
      .select("prompt_id")
      .in("prompt_id", promptIds);
    if (remaining.error) throw remaining.error;
    const retained = new Set((remaining.data || []).map((row) => row.prompt_id));
    const orphanPromptIds = promptIds.filter((id) => !retained.has(id));
    if (orphanPromptIds.length > 0) {
      const deletion = await db.from("prompts").delete().in("id", orphanPromptIds);
      if (deletion.error) throw deletion.error;
      deletedPrompts = orphanPromptIds.length;
    }
  }

  const subcategory = await db
    .from("categories_subcategories")
    .select("subcategory_components")
    .eq("id", bathroomSubcategoryId)
    .single();
  if (subcategory.error) throw subcategory.error;
  const components = Array.isArray(subcategory.data.subcategory_components)
    ? subcategory.data.subcategory_components
    : [];
  const cleanedComponents = components.filter(
    (component) =>
      !invalidBathroomRefinementKeys.has(
        String(component?.key || "").trim().toLowerCase()
      )
  );
  if (cleanedComponents.length !== components.length) {
    const update = await db
      .from("categories_subcategories")
      .update({
        subcategory_components: cleanedComponents,
        updated_at: new Date().toISOString(),
      })
      .eq("id", bathroomSubcategoryId);
    if (update.error) throw update.error;
  }

  let storageWarning = null;
  if (storagePaths.length > 0) {
    const removal = await db.storage.from(imageBucket).remove(storagePaths);
    if (removal.error) storageWarning = removal.error.message;
  }

  return {
    deletedImages: targetIds.length,
    deletedObsoleteStyleImages: (obsoleteResult.data || []).length,
    deletedInvalidBathroomRefinementImages: (invalidResult.data || []).length,
    deletedPrompts,
    deletedStorageObjects: storageWarning ? 0 : storagePaths.length,
    removedBathroomComponents: components.length - cleanedComponents.length,
    storageWarning,
  };
}

async function verify(db) {
  const starterResult = await db
    .from("images")
    .select("id, subcategory_id, image_url, metadata")
    .in("subcategory_id", activeSubcategoryIds)
    .eq("status", "completed")
    .eq("metadata->>generated_for", generatedFor);
  if (starterResult.error) throw starterResult.error;

  const keys = new Set(
    (starterResult.data || []).map(
      (row) => `${row.subcategory_id}:${row.metadata?.starter_scope_key || ""}`
    )
  );
  const missing = starters.filter(
    (starter) => !keys.has(`${starter.subcategoryId}:${starter.scopeKey}`)
  );
  if (missing.length > 0) {
    throw new Error(`Missing ${missing.length} scope starter rows after seed`);
  }

  const obsolete = await db
    .from("images")
    .select("id", { count: "exact", head: true })
    .in("subcategory_id", activeSubcategoryIds)
    .in("metadata->>generated_for", ["style_seed", "subcategory_catalog"]);
  if (obsolete.error) throw obsolete.error;

  const invalid = await db
    .from("images")
    .select("id", { count: "exact", head: true })
    .eq("subcategory_id", bathroomSubcategoryId)
    .eq("metadata->>generated_for", "refinement_option")
    .in("metadata->>refinement_category_key", [
      "outdoor_lighting",
      "pavers",
      "walkway",
    ]);
  if (invalid.error) throw invalid.error;

  return {
    catalogRows: (starterResult.data || []).length,
    missingScopes: missing.length,
    obsoleteRows: obsolete.count || 0,
    invalidBathroomRefinementRows: invalid.count || 0,
  };
}

async function main() {
  await validateLocalFiles();
  const { url, key } = requireCredentials();
  const db = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  await validatePublishedScopes(db);

  const existing = [];
  const missing = [];
  for (const starter of starters) {
    const row = await currentStarter(db, starter);
    if (row) existing.push({ starter, row });
    else missing.push(starter);
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        activeServices: [...new Set(starters.map((starter) => starter.service))],
        totalScopes: starters.length,
        existingScopes: existing.length,
        missingScopes: missing.map((starter) => `${starter.service}: ${starter.scope}`),
        cleanupObsolete,
      },
      null,
      2
    )
  );
  if (!apply) return;

  for (const starter of missing) {
    const imageId = await uploadStarter(db, starter);
    console.log(`stored ${starter.service} / ${starter.scope}: ${imageId}`);
  }

  const cleanup = cleanupObsolete
    ? await cleanupObsoleteRows(db)
    : { skipped: true };
  const verification = await verify(db);
  console.log(JSON.stringify({ cleanup, verification }, null, 2));
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.stack || error.message
      : JSON.stringify(error, null, 2)
  );
  process.exitCode = 1;
});

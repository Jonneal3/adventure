import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: resolve(repoRoot, "env/.env.shared.local"), override: false });

const apply = process.argv.includes("--apply");
const imageRoot = resolve(repoRoot, "output/imagegen/v2-scope-starters");
const imageBucket = "images";
const generatedFor = "v2_scope_starter";
const catalogRevision = "2026-07-29-six-choice-catalog";
const bathroomSubcategoryId = "258f4d7f-746f-416b-b617-e1cca25b748f";
const landscapeSubcategoryId = "ee70f353-c48e-4bd9-bfc1-cf1b00291fa9";

const directionLabels = {
  bathroom: [
    "Warm contemporary",
    "Modern organic",
    "Light transitional",
    "Boutique contrast",
    "Soft Scandinavian",
    "Coastal natural",
  ],
  landscape: [
    "Warm contemporary",
    "Modern organic",
    "Classic garden",
    "Architectural contemporary",
    "Woodland retreat",
    "Drought-smart Mediterranean",
  ],
};

const scopeDefinitions = [
  {
    family: "bathroom",
    fileBase: "bathroom-full-renovation",
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    service: "Bathroom Remodels",
    subcategoryId: bathroomSubcategoryId,
    scope: "Full bathroom renovation",
  },
  {
    family: "bathroom",
    fileBase: "bathroom-shower-tub",
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    service: "Bathroom Remodels",
    subcategoryId: bathroomSubcategoryId,
    scope: "Shower or tub area only",
  },
  {
    family: "bathroom",
    fileBase: "bathroom-vanity-fixtures",
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    replaceV1: true,
    service: "Bathroom Remodels",
    subcategoryId: bathroomSubcategoryId,
    scope: "Vanity, cabinets & fixtures",
  },
  {
    family: "bathroom",
    fileBase: "bathroom-tile-flooring",
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    service: "Bathroom Remodels",
    subcategoryId: bathroomSubcategoryId,
    scope: "Tile & flooring",
  },
  {
    family: "bathroom",
    fileBase: "bathroom-cosmetic-refresh",
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    service: "Bathroom Remodels",
    subcategoryId: bathroomSubcategoryId,
    scope: "Cosmetic refresh (paint, lighting, hardware)",
  },
  {
    family: "bathroom",
    fileBase: "bathroom-layout-plumbing",
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    service: "Bathroom Remodels",
    subcategoryId: bathroomSubcategoryId,
    scope: "Layout or plumbing changes",
  },
  {
    family: "landscape",
    fileBase: "landscape-full-outdoor-renovation",
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    service: "Landscape Design",
    subcategoryId: landscapeSubcategoryId,
    scope: "Full outdoor renovation",
  },
  {
    family: "landscape",
    fileBase: "landscape-patio-walkway",
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    service: "Landscape Design",
    subcategoryId: landscapeSubcategoryId,
    scope: "Patio and walkway upgrade",
  },
  {
    family: "landscape",
    fileBase: "landscape-lawn-garden",
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    service: "Landscape Design",
    subcategoryId: landscapeSubcategoryId,
    scope: "New lawn and garden installation",
  },
  {
    family: "landscape",
    fileBase: "landscape-driveway",
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    service: "Landscape Design",
    subcategoryId: landscapeSubcategoryId,
    scope: "Driveway resurfacing and repair",
  },
  {
    family: "landscape",
    fileBase: "landscape-hardscape-color",
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    service: "Landscape Design",
    subcategoryId: landscapeSubcategoryId,
    scope: "Hardscape color scheme refresh",
  },
  {
    family: "landscape",
    fileBase: "landscape-outdoor-lighting",
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    service: "Landscape Design",
    subcategoryId: landscapeSubcategoryId,
    scope: "Outdoor lighting installation",
  },
  {
    family: "landscape",
    fileBase: "landscape-irrigation",
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    service: "Landscape Design",
    subcategoryId: landscapeSubcategoryId,
    scope: "Irrigation system installation",
  },
  {
    family: "landscape",
    fileBase: "landscape-pruning",
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    service: "Landscape Design",
    subcategoryId: landscapeSubcategoryId,
    scope: "Tree and shrub pruning service",
  },
];

function slug(value) {
  return (
    String(value || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "scope"
  );
}

const starters = scopeDefinitions.flatMap((scopeDefinition) =>
  directionLabels[scopeDefinition.family].map((label, index) => {
    const variantIndex = index + 1;
    const file =
      variantIndex === 1
        ? scopeDefinition.replaceV1
          ? `${scopeDefinition.fileBase}-v1.png`
          : `${scopeDefinition.fileBase}.png`
        : `${scopeDefinition.fileBase}-v${variantIndex}.png`;
    return {
      ...scopeDefinition,
      file,
      label,
      scopeKey: slug(scopeDefinition.scope),
      variantIndex,
      variantKey: `v${variantIndex}`,
      prompt:
        `High-end photorealistic ${scopeDefinition.service} starter concept for the exact scope ` +
        `"${scopeDefinition.scope}", visual direction "${label}". Keep the selected scope as the ` +
        "unmistakable subject with realistic, buildable geometry and no people, text, logos, or unrelated service areas.",
    };
  })
);

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
  const subcategoryIds = [
    bathroomSubcategoryId,
    landscapeSubcategoryId,
  ];
  const result = await db
    .from("categories_subcategories")
    .select("id, subcategory, subcategory_scope")
    .in("id", subcategoryIds);
  if (result.error) throw result.error;
  const byId = new Map((result.data || []).map((row) => [row.id, row]));
  for (const subcategoryId of subcategoryIds) {
    const row = byId.get(subcategoryId);
    if (!row) throw new Error(`Active subcategory is missing: ${subcategoryId}`);
    const expected = scopeDefinitions
      .filter((definition) => definition.subcategoryId === subcategoryId)
      .map((definition) => definition.scope);
    const actual = Array.isArray(row.subcategory_scope)
      ? row.subcategory_scope
      : [];
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

async function rowsForScope(db, starter) {
  const result = await db
    .from("images")
    .select("id, image_url, metadata, prompt_id, created_at")
    .eq("subcategory_id", starter.subcategoryId)
    .is("account_id", null)
    .eq("status", "completed")
    .eq("metadata->>generated_for", generatedFor)
    .eq("metadata->>starter_scope_key", starter.scopeKey)
    .order("created_at", { ascending: false })
    .limit(20);
  if (result.error) throw result.error;
  return result.data || [];
}

function matchingVariant(rows, starter) {
  if (starter.variantIndex === 1) {
    return (
      rows.find((row) => row.metadata?.starter_variant_key === "v1") ||
      rows.find((row) => !row.metadata?.starter_variant_key) ||
      null
    );
  }
  return (
    rows.find(
      (row) => row.metadata?.starter_variant_key === starter.variantKey
    ) || null
  );
}

async function uploadObject(db, starter) {
  const bytes = await readFile(resolve(imageRoot, starter.file));
  const storagePath = [
    "subcategory",
    starter.subcategoryId,
    "v2-scope-starters",
    `${starter.scopeKey}-${starter.variantKey}-${randomUUID()}.png`,
  ].join("/");
  const upload = await db.storage.from(imageBucket).upload(storagePath, bytes, {
    cacheControl: "31536000",
    contentType: "image/png",
    upsert: false,
  });
  if (upload.error) throw upload.error;
  const imageUrl = String(
    db.storage.from(imageBucket).getPublicUrl(upload.data.path)?.data
      ?.publicUrl || ""
  );
  if (!imageUrl) {
    await db.storage.from(imageBucket).remove([upload.data.path]);
    throw new Error(`Unable to resolve public URL for ${starter.file}`);
  }
  return { imageUrl, storagePath: upload.data.path };
}

function metadataFor(starter, storagePath, previous = {}) {
  return {
    ...previous,
    ai_model: "openai-imagegen",
    generated_for: generatedFor,
    model_name: "OpenAI ImageGen",
    model_provider: "OpenAI",
    origin_instance_id: starter.instanceId,
    prompt_text: starter.prompt,
    s3_path: storagePath,
    service_name: starter.service,
    source: "v2_active_scope_variants_2026_07_29",
    starter_scope: starter.scope,
    starter_scope_key: starter.scopeKey,
    starter_asset_revision: catalogRevision,
    starter_variant_index: starter.variantIndex,
    starter_variant_key: starter.variantKey,
    starter_variant_label: starter.label,
    subcategory_id: starter.subcategoryId,
  };
}

async function updateExistingV1(db, starter, row) {
  let nextImageUrl = row.image_url;
  let nextStoragePath = row.metadata?.s3_path || "";
  let replacement = null;

  if (
    starter.replaceV1 &&
    row.metadata?.starter_asset_revision !== catalogRevision
  ) {
    replacement = await uploadObject(db, starter);
    nextImageUrl = replacement.imageUrl;
    nextStoragePath = replacement.storagePath;
  }

  const update = await db
    .from("images")
    .update({
      image_url: nextImageUrl,
      metadata: metadataFor(starter, nextStoragePath, row.metadata || {}),
    })
    .eq("id", row.id);
  if (update.error) {
    if (replacement) {
      await db.storage.from(imageBucket).remove([replacement.storagePath]);
    }
    throw update.error;
  }

  if (
    replacement &&
    typeof row.metadata?.s3_path === "string" &&
    row.metadata.s3_path &&
    row.metadata.s3_path !== replacement.storagePath
  ) {
    const removal = await db.storage
      .from(imageBucket)
      .remove([row.metadata.s3_path]);
    if (removal.error) {
      console.warn(
        `Updated the vanity row but could not remove the old object: ${removal.error.message}`
      );
    }
  }
  return row.id;
}

async function insertVariant(db, starter) {
  const uploaded = await uploadObject(db, starter);
  let promptId = null;
  try {
    const promptInsert = await db
      .from("prompts")
      .insert({
        account_id: null,
        prompt: starter.prompt,
        subcategory_id: starter.subcategoryId,
        suggestion_label: `${starter.scope} · ${starter.label}`,
        variables: {
          generated_for: generatedFor,
          starter_scope_key: starter.scopeKey,
          starter_variant_key: starter.variantKey,
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
        image_url: uploaded.imageUrl,
        instance_id: null,
        metadata: metadataFor(starter, uploaded.storagePath),
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
    await db.storage.from(imageBucket).remove([uploaded.storagePath]);
    throw error;
  }
}

async function verify(db) {
  const result = await db
    .from("images")
    .select("id, subcategory_id, image_url, metadata")
    .in("subcategory_id", [
      bathroomSubcategoryId,
      landscapeSubcategoryId,
    ])
    .eq("status", "completed")
    .eq("metadata->>generated_for", generatedFor);
  if (result.error) throw result.error;

  const scopeVariants = new Map();
  for (const row of result.data || []) {
    const key = `${row.subcategory_id}:${row.metadata?.starter_scope_key || ""}`;
    if (!scopeVariants.has(key)) scopeVariants.set(key, new Set());
    scopeVariants.get(key).add(row.metadata?.starter_variant_key || "");
  }

  const invalidScopes = [];
  for (const definition of scopeDefinitions) {
    const key = `${definition.subcategoryId}:${slug(definition.scope)}`;
    const variants = scopeVariants.get(key) || new Set();
    const expected = ["v1", "v2", "v3", "v4", "v5", "v6"];
    if (
      variants.size !== expected.length ||
      expected.some((variant) => !variants.has(variant))
    ) {
      invalidScopes.push({ scope: definition.scope, variants: [...variants] });
    }
  }
  if (invalidScopes.length > 0) {
    throw new Error(
      `Variant verification failed: ${JSON.stringify(invalidScopes)}`
    );
  }

  const urls = (result.data || [])
    .map((row) => row.image_url)
    .filter((url) => typeof url === "string" && url);
  const checks = await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, { method: "HEAD" });
        return response.ok;
      } catch {
        return false;
      }
    })
  );
  const unavailableUrls = checks.filter((ok) => !ok).length;
  if (unavailableUrls > 0) {
    throw new Error(`${unavailableUrls} starter image URLs are unavailable`);
  }

  return {
    activeScopes: scopeDefinitions.length,
    catalogRows: (result.data || []).length,
    expectedCatalogRows: starters.length,
    unavailableUrls,
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
  const rowsByScope = new Map();
  for (const definition of scopeDefinitions) {
    const probe = {
      ...definition,
      scopeKey: slug(definition.scope),
    };
    rowsByScope.set(
      `${probe.subcategoryId}:${probe.scopeKey}`,
      await rowsForScope(db, probe)
    );
  }
  for (const starter of starters) {
    const rows =
      rowsByScope.get(`${starter.subcategoryId}:${starter.scopeKey}`) || [];
    const row = matchingVariant(rows, starter);
    if (row) existing.push({ starter, row });
    else missing.push(starter);
  }

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        activeServices: [...new Set(starters.map((starter) => starter.service))],
        totalScopes: scopeDefinitions.length,
        totalVariants: starters.length,
        existingVariants: existing.length,
        missingVariants: missing.length,
        replacingBadVanityV1: existing.some(
          ({ starter }) => starter.replaceV1 && starter.variantIndex === 1
        ),
      },
      null,
      2
    )
  );
  if (!apply) return;

  for (const { starter, row } of existing) {
    if (starter.variantIndex !== 1) continue;
    const imageId = await updateExistingV1(db, starter, row);
    console.log(
      `updated ${starter.service} / ${starter.scope} / ${starter.label}: ${imageId}`
    );
  }

  for (const starter of missing) {
    const imageId = await insertVariant(db, starter);
    console.log(
      `stored ${starter.service} / ${starter.scope} / ${starter.label}: ${imageId}`
    );
  }

  console.log(JSON.stringify({ verification: await verify(db) }, null, 2));
}

main().catch((error) => {
  console.error(
    error instanceof Error
      ? error.stack || error.message
      : JSON.stringify(error, null, 2)
  );
  process.exitCode = 1;
});

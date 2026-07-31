import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: resolve(repoRoot, "env/.env.shared.local"), override: false });

const apply = process.argv.includes("--apply");
const imageRoot = resolve(repoRoot, "output/imagegen/v2-service-starters");
const imageBucket = "images";
const generatedFor = "v2_service_starter";
const catalogRevision = "2026-07-30-neutral-service-starters";

const starters = [
  {
    file: "bathroom-remodeling-neutral.png",
    service: "Bathroom Remodeling",
    subcategoryId: "258f4d7f-746f-416b-b617-e1cca25b748f",
    prompt:
      "Deliberately plain, clean builder-grade full bathroom starter with an ordinary tub-shower, toilet, double vanity, off-white walls and pale gray tile. Neutral daylight, no styling, decor, luxury materials, people, text or logos.",
  },
  {
    file: "landscaping-neutral.png",
    service: "Landscaping",
    subcategoryId: "ee70f353-c48e-4bd9-bfc1-cf1b00291fa9",
    prompt:
      "Deliberately plain residential exterior starter with a modest suburban house, asphalt driveway, straight concrete walk, basic lawn and minimal foundation shrubs. Neutral daylight, no finished landscape design, luxury features, people, vehicles, text or logos.",
  },
];

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
      throw new Error(`Neutral starter image is missing or unexpectedly small: ${starter.file}`);
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
    "v2-service-starters",
    `neutral-${randomUUID()}.png`,
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
        suggestion_label: "Neutral sample space",
        variables: {
          catalog_revision: catalogRevision,
          generated_for: generatedFor,
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
          starter_role: "neutral_sample_space",
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

  const results = [];
  for (const starter of starters) {
    const existing = await currentStarter(db, starter);
    if (existing) {
      results.push({
        action: "existing",
        imageId: existing.id,
        service: starter.service,
        url: existing.image_url,
      });
      continue;
    }
    if (!apply) {
      results.push({ action: "would-create", service: starter.service });
      continue;
    }
    const imageId = await uploadStarter(db, starter);
    results.push({ action: "created", imageId, service: starter.service });
  }

  console.log(JSON.stringify({ apply, catalogRevision, results }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

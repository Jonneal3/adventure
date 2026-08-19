/**
 * Generate missing v2 scope-starter PNGs via local DSPY scene API (Replicate).
 *
 * Usage:
 *   node scripts/generate-v2-scope-starter-variants.mjs
 *   node scripts/generate-v2-scope-starter-variants.mjs --scope="Shower or tub area only"
 *   node scripts/generate-v2-scope-starter-variants.mjs --concurrency=3
 */
import { createWriteStream } from "node:fs";
import { access, mkdir, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { Readable } from "node:stream";

import { config as loadEnv } from "dotenv";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadEnv({ path: resolve(repoRoot, "env/.env.shared.local"), override: false });

const imageRoot = resolve(repoRoot, "output/imagegen/v2-scope-starters");
const dspyBase =
  process.env.DSPY_BASE_URL ||
  process.env.NEXT_PUBLIC_DSPY_BASE_URL ||
  "http://127.0.0.1:8008";

const scopeFilter = (() => {
  const raw = process.argv.find((arg) => arg.startsWith("--scope="));
  return raw ? raw.slice("--scope=".length).trim().toLowerCase() : "";
})();
const concurrency = Math.max(
  1,
  Math.min(
    6,
    Number(
      (process.argv.find((arg) => arg.startsWith("--concurrency=")) || "").slice(
        "--concurrency=".length
      )
    ) || 3
  )
);
const force = process.argv.includes("--force");

// Keep in sync with scripts/seed-v2-scope-starter-variants.mjs shower directions.
const showerTubDirections = [
  "Warm contemporary",
  "Modern organic",
  "Light transitional",
  "Boutique contrast",
  "Soft Scandinavian",
  "Coastal natural",
  "Japanese spa",
  "Boutique bronze",
  "Coastal blue",
  "Warm Mediterranean",
  "Graphic monochrome",
  "Scandinavian wet room",
  "Spa hotel calm",
  "Black marble drama",
  "Soft clay plaster",
  "Forest green tile",
  "Ivory herringbone",
  "Brushed nickel loft",
  "Desert stone oasis",
  "Soft blush spa",
  "Charcoal and oak",
  "Sky blue ceramic",
  "Travertine quiet",
  "Art deco gold",
  "Concrete minimal",
  "Sage and brass",
  "White zellige glow",
  "Walnut wet room",
  "Slate canyon",
  "Pearl and chrome",
  "Terracotta alcove",
  "Midnight indigo",
  "Honey limestone",
  "Matte black spa",
  "Pale oak Nordic",
  "Sea glass mosaic",
  "Cream fluted stone",
  "Copper and clay",
  "Fog gray glass",
  "Warm ivory mosaic",
  "Espresso stone niche",
  "Alpine white spa",
  "Moss green wet room",
  "Champagne marble",
  "Ink and linen",
  "Sunlit sand tile",
  "Porcelain gallery",
  "Cedar and stone",
  "Soft graphite spa",
  "Cloud white alcove",
];

const jobs = showerTubDirections.map((label, index) => {
  const variantIndex = index + 1;
  const file = `bathroom-shower-tub-v${variantIndex}.png`;
  return {
    file,
    label,
    scope: "Shower or tub area only",
    variantIndex,
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    prompt:
      `Premium photorealistic bathroom wet-zone starter, visual direction "${label}". ` +
      "Tightly frame ONLY a coordinated walk-in shower and bathtub (alcove or freestanding) with realistic plumbing, waterproofing, and high-end tile. " +
      "No vanity, sink, toilet, mirrors, cabinetry, or full-room view. No people, text, logos, or watermarks. Soft natural daylight, buildable geometry.",
  };
});

async function fileLooksReady(path) {
  try {
    await access(path);
    const info = await stat(path);
    return info.size >= 100_000;
  } catch {
    return false;
  }
}

async function downloadToFile(url, dest) {
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Download failed (${response.status}) for ${url}`);
  }
  await mkdir(dirname(dest), { recursive: true });
  await pipeline(Readable.fromWeb(response.body), createWriteStream(dest));
}

async function generateOne(job) {
  const dest = resolve(imageRoot, job.file);
  if (!force && (await fileLooksReady(dest))) {
    return { file: job.file, status: "skipped" };
  }

  const endpoint = new URL("/api/generate/scene", dspyBase).toString();
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      instanceId: job.instanceId,
      useCase: "scene",
      generationIntent: "initial",
      prompt: job.prompt,
      modelId: "black-forest-labs/flux-1.1-pro",
      aspectRatio: "4:3",
      numOutputs: 1,
      outputFormat: "png",
      guidanceScale: 6,
      numInferenceSteps: 18,
    }),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!response.ok) {
    throw new Error(
      `DSPY generate failed for ${job.file}: ${response.status} ${text.slice(0, 400)}`
    );
  }
  const imageUrl =
    (Array.isArray(json?.images) && json.images[0]) ||
    json?.imageUrl ||
    json?.output?.[0] ||
    null;
  if (typeof imageUrl !== "string" || !imageUrl) {
    throw new Error(`No image URL returned for ${job.file}: ${text.slice(0, 400)}`);
  }
  await downloadToFile(imageUrl, dest);
  if (!(await fileLooksReady(dest))) {
    throw new Error(`Generated file too small: ${job.file}`);
  }
  return { file: job.file, status: "generated", imageUrl };
}

async function mapPool(items, size, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => run()));
  return results;
}

async function main() {
  const selected = jobs.filter((job) => {
    if (!scopeFilter) return true;
    return job.scope.toLowerCase().includes(scopeFilter);
  });
  if (selected.length === 0) {
    throw new Error(`No jobs matched --scope=${scopeFilter}`);
  }

  console.log(
    JSON.stringify(
      {
        dspyBase,
        concurrency,
        force,
        scopeFilter: scopeFilter || null,
        total: selected.length,
      },
      null,
      2
    )
  );

  const results = await mapPool(selected, concurrency, async (job) => {
    try {
      const result = await generateOne(job);
      console.log(`${result.status}: ${job.file} (${job.label})`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`failed: ${job.file} — ${message}`);
      return { file: job.file, status: "failed", error: message };
    }
  });

  const summary = {
    generated: results.filter((r) => r.status === "generated").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
  };
  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  process.exitCode = 1;
});

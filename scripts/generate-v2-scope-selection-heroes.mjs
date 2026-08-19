/**
 * Regenerate tightly cropped scope-selection heroes (v1) via DSPY scene API.
 *
 * Usage:
 *   node scripts/generate-v2-scope-selection-heroes.mjs --force
 *   node scripts/generate-v2-scope-selection-heroes.mjs --family=bathroom --force
 */
import { createWriteStream } from "node:fs";
import { access, copyFile, mkdir, stat } from "node:fs/promises";
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

const familyFilter = (() => {
  const raw = process.argv.find((arg) => arg.startsWith("--family="));
  return raw ? raw.slice("--family=".length).trim().toLowerCase() : "";
})();
const concurrency = Math.max(
  1,
  Math.min(
    4,
    Number(
      (process.argv.find((arg) => arg.startsWith("--concurrency=")) || "").slice(
        "--concurrency=".length
      )
    ) || 3
  )
);
const force = process.argv.includes("--force");

/** Selection-card heroes: zoomed on the scope subject, not a full-room lookalike. */
const heroes = [
  {
    family: "bathroom",
    file: "bathroom-full-renovation-v1.png",
    alsoWrite: ["bathroom-full-renovation.png"],
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    scope: "Full bathroom renovation",
    prompt:
      "Premium photorealistic FULL bathroom renovation hero, warm contemporary. Doorway-wide view of one finished room that clearly includes double vanity, glass walk-in shower, toilet, and soaking tub together. Soft daylight, buildable proportions, no people, text, logos, or watermark.",
  },
  {
    family: "bathroom",
    file: "bathroom-shower-tub-v1.png",
    alsoWrite: ["bathroom-shower-tub.png"],
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    scope: "Shower or tub area only",
    prompt:
      "Premium photorealistic bathroom WET ZONE close-up. Tightly crop so ONLY a glass walk-in shower beside a freestanding or alcove bathtub fill the frame. Zoomed detail on tile, glass, fixtures, waterproofing. No vanity, sink, toilet, mirrors, or cabinetry. No people, text, logos, or watermark.",
  },
  {
    family: "bathroom",
    file: "bathroom-vanity-fixtures-v1.png",
    alsoWrite: ["bathroom-vanity-fixtures.png"],
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    scope: "Vanity, cabinets & fixtures",
    prompt:
      "Premium photorealistic bathroom VANITY close-up. Tightly frame a double vanity wall: cabinetry, stone countertop, sinks, faucets, mirrors, sconces, and hardware filling the frame. Extreme subject focus, slight zoom. No shower, tub, toilet, or full-room view. No people, text, logos, or watermark.",
  },
  {
    family: "bathroom",
    file: "bathroom-tile-flooring-v1.png",
    alsoWrite: ["bathroom-tile-flooring.png"],
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    scope: "Tile & flooring",
    prompt:
      "Premium photorealistic bathroom TILE AND FLOORING close-up. Camera angled downward so large-format floor tile and matching wall tile dominate the frame with clear grout lines and transitions. Show only a sliver of a tub or vanity edge for scale. Zoomed on materials, not the whole room. No people, text, logos, or watermark.",
  },
  {
    family: "bathroom",
    file: "bathroom-cosmetic-refresh-v1.png",
    alsoWrite: ["bathroom-cosmetic-refresh.png"],
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    scope: "Cosmetic refresh (paint, lighting, hardware)",
    prompt:
      "Premium photorealistic bathroom COSMETIC refresh close-up. Tight crop on freshly painted wall, updated wall sconces, new faucet, and new cabinet hardware on a vanity — the paint, lighting, and metal finishes are the unmistakable subject. Soft daylight. No shower glass, tub, toilet, or wide room shot. No people, text, logos, or watermark.",
  },
  {
    family: "bathroom",
    file: "bathroom-layout-plumbing-v1.png",
    alsoWrite: ["bathroom-layout-plumbing.png"],
    instanceId: "41766ba1-88b6-41c7-af1f-0a14ec4224e0",
    scope: "Layout or plumbing changes",
    prompt:
      "Extreme close-up of a bathroom LAYOUT change: a newly built tiled shower half-wall with clear glass above, visible plumbing valve and shower arm, drain at floor, and walking clearance. Half-wall, glass, and plumbing dominate the frame. No vanity, toilet, or full bathroom beauty shot. Photorealistic soft daylight, no people, text, logos, or watermark.",
  },
  {
    family: "landscape",
    file: "landscape-full-outdoor-renovation-v1.png",
    alsoWrite: ["landscape-full-outdoor-renovation.png"],
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    scope: "Full outdoor renovation",
    prompt:
      "Premium photorealistic FULL backyard renovation hero: patio, curved walkway, lush lawn, layered garden beds, and path lighting in one finished scene. Soft golden hour. No people, vehicles, text, logos, or watermark.",
  },
  {
    family: "landscape",
    file: "landscape-patio-walkway-v1.png",
    alsoWrite: ["landscape-patio-walkway.png"],
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    scope: "Patio and walkway upgrade",
    prompt:
      "Premium photorealistic PATIO AND WALKWAY close-up. Tightly frame professional stone paver patio with a connected curved walkway — hardscape joints and edges dominate. Minimal planting context only. No driveway, lawn-wide view, or outdoor kitchen. No people, text, logos, or watermark.",
  },
  {
    family: "landscape",
    file: "landscape-lawn-garden-v1.png",
    alsoWrite: ["landscape-lawn-garden.png"],
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    scope: "New lawn and garden installation",
    prompt:
      "Premium photorealistic NEW LAWN AND GARDEN close-up. Healthy striped lawn with crisp curved edges and layered planting beds of shrubs, grasses, and perennials filling the frame. No patio furniture focus, driveway, or hardscape-dominant view. No people, text, logos, or watermark.",
  },
  {
    family: "landscape",
    file: "landscape-driveway-v1.png",
    alsoWrite: ["landscape-driveway.png"],
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    scope: "Driveway resurfacing and repair",
    prompt:
      "Premium photorealistic DRIVEWAY resurfacing close-up. Tightly frame a pristine two-car asphalt or paver driveway with clean borders and correct slope toward the garage. Driveway surface is the subject. No backyard patio, people, vehicles, text, logos, or watermark.",
  },
  {
    family: "landscape",
    file: "landscape-hardscape-color-v1.png",
    alsoWrite: ["landscape-hardscape-color.png"],
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    scope: "Hardscape color scheme refresh",
    prompt:
      "Premium photorealistic HARDSCAPE COLOR close-up. Zoomed overhead-angle view of patio pavers showing a coordinated warm greige field with charcoal border banding and crisp joints. Material color is the subject. No wide yard, people, text, logos, or watermark.",
  },
  {
    family: "landscape",
    file: "landscape-outdoor-lighting-v1.png",
    alsoWrite: ["landscape-outdoor-lighting.png"],
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    scope: "Outdoor lighting installation",
    prompt:
      "Premium photorealistic OUTDOOR LIGHTING close-up at blue hour. Path lights, tree uplights, and planting grazers with warm realistic falloff are the unmistakable subject along a walkway edge. No daytime empty yard. No people, text, logos, or watermark.",
  },
  {
    family: "landscape",
    file: "landscape-irrigation-v1.png",
    alsoWrite: ["landscape-irrigation.png"],
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    scope: "Irrigation system installation",
    prompt:
      "Premium photorealistic IRRIGATION close-up. Flush pop-up sprinkler heads with overlapping water arcs on a lawn plus a discreet drip line in a bed — irrigation hardware in action is the subject. No patio furniture focus. No people, diagram labels, text, logos, or watermark.",
  },
  {
    family: "landscape",
    file: "landscape-pruning-v1.png",
    alsoWrite: ["landscape-pruning.png"],
    instanceId: "d8ecc6fb-fd4e-40d5-acdd-40ff3a4b4d11",
    scope: "Tree and shrub pruning service",
    prompt:
      "Premium photorealistic TREE AND SHRUB PRUNING result close-up. Freshly pruned open tree canopy and organically shaped shrubs with cleared beds dominate the frame. Pruned plant structure is the subject. No hardscape-only view, people, text, logos, or watermark.",
  },
];

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
      guidanceScale: 7,
      numInferenceSteps: 22,
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
  for (const extra of job.alsoWrite || []) {
    await copyFile(dest, resolve(imageRoot, extra));
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
  const selected = heroes.filter((job) => {
    if (!familyFilter) return true;
    return job.family === familyFilter;
  });
  if (selected.length === 0) {
    throw new Error(`No heroes matched --family=${familyFilter}`);
  }

  console.log(
    JSON.stringify(
      { dspyBase, concurrency, force, familyFilter: familyFilter || null, total: selected.length },
      null,
      2
    )
  );

  const results = await mapPool(selected, concurrency, async (job) => {
    try {
      const result = await generateOne(job);
      console.log(`${result.status}: ${job.file} (${job.scope})`);
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

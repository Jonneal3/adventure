import { and, eq, sql } from "drizzle-orm";
import { db, pool } from "./database/client.js";
import { storage } from "./storage.js";
import { accountBilling, assets, jobs, projects, walletEntries } from "./database/schema.js";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const allowedHosts = (process.env.ADVENTURE_PROVIDER_IMAGE_HOSTS || "replicate.delivery,*.replicate.delivery,replicate.com,*.replicate.com").split(",").map(value => value.trim()).filter(Boolean);
function allowedImageUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || !allowedHosts.some(pattern => pattern.startsWith("*.") ? url.hostname.endsWith(pattern.slice(1)) : url.hostname === pattern)) throw new Error("Provider returned an unapproved image URL");
  return url;
}
async function claim() {
  const result = await db.execute(sql`UPDATE adventure_jobs SET status='processing', attempts=attempts+1, updated_at=now()
    WHERE id=(SELECT id FROM adventure_jobs WHERE status='queued' OR (status='processing' AND updated_at<now()-interval '5 minutes' AND attempts<3)
      ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id`);
  return (result.rows[0] as { id?: string } | undefined)?.id;
}
async function failExpired() {
  const result = await db.execute(sql`SELECT id FROM adventure_jobs WHERE status='processing' AND updated_at<now()-interval '5 minutes' AND attempts>=3 LIMIT 20`);
  for (const row of result.rows) if (typeof row.id === 'string') await fail(row.id);
}
async function providerImages(jobId: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  if (!job) throw new Error("Job disappeared");
  const [project] = await db.select().from(projects).where(eq(projects.id, job.projectId)).limit(1);
  if (!project) throw new Error("Project disappeared");
  const input = job.input as { referenceAssetIds: string[]; brief: string };
  const assetRows = await db.select().from(assets).where(eq(assets.projectId, project.id));
  const references = [];
  for (const id of input.referenceAssetIds) {
    const asset = assetRows.find(row => row.id === id);
    if (!asset) throw new Error("Reference asset disappeared");
    references.push({ purpose: asset.purpose, url: await storage.signedDownload("adventure-assets", asset.objectKey, 3600) });
  }
  const origin = process.env.ADVENTURE_IMAGE_API_URL;
  if (!origin) throw new Error("ADVENTURE_IMAGE_API_URL is required");
  const endpoint = job.kind === "tryon" ? "/v1/api/generate/try-on" : "/v1/api/generate/scene";
  const body = {
    instanceId: project.instanceId, numOutputs: 1, stepDataSoFar: project.answers,
    prompt: input.brief, referenceImages: references.map(ref => ref.url),
    userImage: references.find(ref => ref.purpose === "tryon_person")?.url,
    productImage: references.find(ref => ref.purpose === "tryon_item")?.url,
    sceneImage: references.find(ref => ref.purpose === "scene")?.url,
  };
  const response = await fetch(new URL(endpoint, origin), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw new Error(`Image API failed (${response.status})`);
  const result = await response.json() as { ok?: boolean; images?: string[] };
  if (!result.ok || !Array.isArray(result.images) || !result.images.length) throw new Error("Image API returned no completed image");
  const outputIds = [];
  for (const image of result.images.slice(0, 5)) {
    const imageResponse = await fetch(allowedImageUrl(image), { signal: AbortSignal.timeout(30000) });
    if (!imageResponse.ok) throw new Error("Provider image download failed");
    const contentType = imageResponse.headers.get("content-type")?.split(";")[0] || "";
    if (!["image/png", "image/jpeg", "image/webp"].includes(contentType)) throw new Error("Provider returned an unsupported image type");
    if (Number(imageResponse.headers.get("content-length") || 0) > 20_000_000) throw new Error("Provider image is too large");
    const bytes = new Uint8Array(await imageResponse.arrayBuffer());
    if (!bytes.length || bytes.length > 20_000_000) throw new Error("Provider image is too large");
    const id = crypto.randomUUID();
    const key = `${project.accountId}/${project.id}/generated/${id}.${contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg"}`;
    await storage.upload("adventure-assets", key, bytes, contentType);
    await db.insert(assets).values({ id, accountId: project.accountId, projectId: project.id, objectKey: key, contentType, purpose: "generated" });
    outputIds.push(id);
  }
  return outputIds;
}
async function fail(jobId: string) {
  await db.transaction(async tx => {
    const [job] = await tx.select().from(jobs).where(eq(jobs.id, jobId)).for("update").limit(1);
    if (!job || job.status === "complete" || job.status === "failed") return;
    const [billing] = await tx.select().from(accountBilling).where(eq(accountBilling.accountId, job.accountId)).for("update").limit(1);
    if (billing && job.chargeSource === "monthly") await tx.update(accountBilling).set({ aiDesignsUsed: Math.max(0, billing.aiDesignsUsed - 1) }).where(eq(accountBilling.accountId, job.accountId));
    if (billing && job.chargeSource === "wallet") {
      await tx.update(accountBilling).set({ walletBalanceCents: billing.walletBalanceCents + job.chargeCents }).where(eq(accountBilling.accountId, job.accountId));
      await tx.insert(walletEntries).values({ accountId: job.accountId, projectId: job.projectId, operationKey: `job:${job.id}:refund`, kind: "ai_refund", amountCents: job.chargeCents }).onConflictDoNothing();
    }
    await tx.update(jobs).set({ status: "failed", updatedAt: new Date() }).where(eq(jobs.id, jobId));
  });
}
async function work(jobId: string) {
  try {
    const assetIds = await providerImages(jobId);
    await db.update(jobs).set({ status: "complete", output: { assetIds }, updatedAt: new Date() }).where(eq(jobs.id, jobId));
  } catch (error) {
    console.error(JSON.stringify({ event: "visual_job_failed", jobId, message: error instanceof Error ? error.message : "unknown" }));
    await fail(jobId);
  }
}

async function main() {
  const once = process.argv.includes("--once");
  try {
    do {
      await failExpired();
      const id = await claim();
      if (id) await work(id);
      else if (!once) await wait(2000);
    } while (!once);
  } finally { await pool.end(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });

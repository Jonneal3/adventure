import { BadRequestException, Body, ConflictException, Controller, Get, HttpException, NotFoundException, Param, Post, Req, UnauthorizedException } from "@nestjs/common";
import { and, eq, ne, sql } from "drizzle-orm";
import type { Request } from "express";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { experienceSchema, type Experience } from "@adventure/experience";
import { db } from "./database/client.js";
import { storage } from "./storage.js";
import { accountBilling, assets, engagements, jobs, plans, projects, walletEntries } from "./database/schema.js";

const uuid = z.string().uuid();
const uploadInput = z.object({ purpose: z.enum(["scene", "tryon_person", "tryon_item"]), contentType: z.enum(["image/jpeg", "image/png", "image/webp"]) });
const visualInput = z.object({ requestKey: uuid, referenceAssetIds: z.array(uuid).max(5), brief: z.string().trim().max(2000).default("") });
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException(result.error.flatten());
  return result.data;
}

@Controller("api/adventure/:instanceId/projects/:projectId")
export class VisualController {
  private async project(request: Request, instanceId: string, projectId: string) {
    parse(uuid, instanceId); parse(uuid, projectId);
    const token = request.header("x-adventure-project-token") || "";
    if (token.length < 32) throw new UnauthorizedException("Project token required");
    const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.instanceId, instanceId))).limit(1);
    if (!project || project.visitorTokenHash !== hash(token)) throw new NotFoundException("Project not found");
    return project;
  }

  @Post("assets")
  async createUpload(@Req() request: Request, @Param("instanceId") instanceId: string, @Param("projectId") projectId: string, @Body() body: unknown) {
    const project = await this.project(request, instanceId, projectId);
    const input = parse(uploadInput, body);
    const id = randomUUID();
    const extension = input.contentType === "image/png" ? "png" : input.contentType === "image/webp" ? "webp" : "jpg";
    const objectKey = `${project.accountId}/${project.id}/uploads/${id}.${extension}`;
    await db.insert(assets).values({ id, accountId: project.accountId, projectId: project.id, objectKey, contentType: input.contentType, purpose: input.purpose });
    return { assetId: id, uploadUrl: await storage.signedUpload("adventure-assets", objectKey, input.contentType), contentType: input.contentType };
  }

  @Get("assets/:assetId")
  async asset(@Req() request: Request, @Param("instanceId") instanceId: string, @Param("projectId") projectId: string, @Param("assetId") assetId: string) {
    const project = await this.project(request, instanceId, projectId);
    parse(uuid, assetId);
    const [asset] = await db.select().from(assets).where(and(eq(assets.id, assetId), eq(assets.projectId, project.id))).limit(1);
    if (!asset || !await storage.exists("adventure-assets", asset.objectKey)) throw new NotFoundException("Asset not found");
    return { url: await storage.signedDownload("adventure-assets", asset.objectKey), contentType: asset.contentType };
  }

  @Post("visual")
  async generate(@Req() request: Request, @Param("instanceId") instanceId: string, @Param("projectId") projectId: string, @Body() body: unknown) {
    const project = await this.project(request, instanceId, projectId);
    const input = parse(visualInput, body);
    if (!project.serviceId) throw new ConflictException("Complete the first step first");
    const snapshot = parse(experienceSchema, project.experienceSnapshot) as Experience;
    const visual = snapshot.elements.find(element => element.kind === "visual" && element.serviceIds.includes(project.serviceId!));
    const kind = visual?.visualJob;
    if (!kind || kind === "none") throw new BadRequestException("This service has no visual step");
    const references = input.referenceAssetIds.length ? await db.select().from(assets).where(eq(assets.projectId, project.id)) : [];
    if (input.referenceAssetIds.some(id => !references.some(asset => asset.id === id))) throw new BadRequestException("Reference asset is unavailable");
    if (kind === "tryon" && !input.referenceAssetIds.length) throw new BadRequestException("Try-on needs a reference image");
    for (const id of input.referenceAssetIds) {
      const asset = references.find(value => value.id === id)!;
      if (!await storage.exists("adventure-assets", asset.objectKey)) throw new BadRequestException("Finish uploading reference images first");
    }
    return db.transaction(async tx => {
      const [existing] = await tx.select().from(jobs).where(and(eq(jobs.projectId, project.id), eq(jobs.requestKey, input.requestKey))).limit(1);
      if (existing) {
        if (JSON.stringify(existing.input) !== JSON.stringify(input)) throw new ConflictException("Request key was used for different inputs");
        return { jobId: existing.id, status: existing.status };
      }
      const [engagement] = await tx.select().from(engagements).where(eq(engagements.projectId, project.id)).limit(1);
      if (!engagement && !project.isPreview) throw new ConflictException("Complete the first step first");
      const [billing] = await tx.select().from(accountBilling).where(eq(accountBilling.accountId, project.accountId)).for("update").limit(1);
      const [plan] = await tx.select().from(plans).where(eq(plans.code, billing?.planCode || "usage")).limit(1);
      if (!billing || !plan) throw new HttpException("Billing is unavailable", 503);
      const [raced] = await tx.select().from(jobs).where(and(eq(jobs.projectId, project.id), eq(jobs.requestKey, input.requestKey))).limit(1);
      if (raced) {
        if (JSON.stringify(raced.input) !== JSON.stringify(input)) throw new ConflictException("Request key was used for different inputs");
        return { jobId: raced.id, status: raced.status };
      }
      const [count] = await tx.select({ total: sql<number>`count(*)::integer` }).from(jobs).where(and(eq(jobs.projectId, project.id), ne(jobs.status, "failed")));
      const prior = count?.total || 0;
      if (prior >= 3 && !project.isPreview && (!project.contactEmail || !project.contactPhone)) throw new ConflictException("Contact details are required for more designs");
      const trial = billing.status === "trialing" && !!billing.trialEndsAt && billing.trialEndsAt > new Date();
      const [trialCount] = trial ? await tx.select({ total: sql<number>`count(*)::integer` }).from(jobs).where(and(eq(jobs.accountId, project.accountId), eq(jobs.chargeSource, "trial"), ne(jobs.status, "failed"))) : [{ total: 0 }];
      const trialAvailable = trial && (trialCount?.total || 0) < 50;
      if (trial && !trialAvailable && !billing.stripeSubscriptionId && billing.walletBalanceCents <= 0 && !project.isPreview) throw new HttpException("Trial AI design allowance has been used", 402);
      const source = project.isPreview ? "preview" : trialAvailable ? "trial" : prior < 3 ? "engagement" : billing.aiDesignsUsed < plan.includedAiDesigns ? "monthly" : "wallet";
      const chargeCents = source === "wallet" ? plan.extraAiDesignPriceCents : 0;
      if (chargeCents > billing.walletBalanceCents) throw new HttpException("No AI design allowance remains", 402);
      const jobId = randomUUID();
      await tx.insert(jobs).values({ id: jobId, projectId: project.id, accountId: project.accountId, requestKey: input.requestKey, kind, status: "queued", chargeSource: source, chargeCents, input });
      if (source === "monthly" || source === "wallet") await tx.update(accountBilling).set({ aiDesignsUsed: billing.aiDesignsUsed + (source === "monthly" ? 1 : 0), walletBalanceCents: billing.walletBalanceCents - chargeCents }).where(eq(accountBilling.accountId, project.accountId));
      if (chargeCents) await tx.insert(walletEntries).values({ accountId: project.accountId, projectId: project.id, operationKey: `job:${jobId}:debit`, kind: "ai_design", amountCents: -chargeCents });
      return { jobId, status: "queued" };
    });
  }

  @Get("visual/:jobId")
  async job(@Req() request: Request, @Param("instanceId") instanceId: string, @Param("projectId") projectId: string, @Param("jobId") jobId: string) {
    const project = await this.project(request, instanceId, projectId);
    parse(uuid, jobId);
    const [job] = await db.select().from(jobs).where(and(eq(jobs.id, jobId), eq(jobs.projectId, project.id))).limit(1);
    if (!job) throw new NotFoundException("Job not found");
    const ids = Array.isArray((job.output as { assetIds?: unknown })?.assetIds) ? (job.output as { assetIds: string[] }).assetIds : [];
    const output = [];
    for (const id of ids) {
      const [asset] = await db.select().from(assets).where(and(eq(assets.id, id), eq(assets.projectId, project.id))).limit(1);
      if (asset) output.push({ assetId: id, url: await storage.signedDownload("adventure-assets", asset.objectKey) });
    }
    return { jobId, status: job.status, assets: output };
  }
}

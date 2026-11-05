import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpException, NotFoundException, Param, Patch, Post, Req, UnauthorizedException } from "@nestjs/common";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { Request } from "express";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { composeExperience, elementsForService, experienceSchema, formElementSchema, revealedPrice, validateForPublication, visualJobSchema, priceRangeSchema, type Experience, type ServicePreset } from "@adventure/experience";
import { auth } from "./auth.js";
import { db, pool } from "./database/client.js";
import { storage } from "./storage.js";
import { scanWebsite } from "./site-scan.js";
import { accountBilling, accounts, assets, categories, engagements, experiences, instances, plans, projects, servicePresets, services, userAccounts, walletEntries } from "./database/schema.js";

const uuid = z.string().uuid();
const createAccountInput = z.object({ name: z.string().trim().min(2).max(120) });
const createInstanceInput = z.object({ name: z.string().trim().min(2).max(120), industryId: uuid, serviceIds: z.array(uuid).min(1).max(30) });
const createServiceInput = z.object({ industryId: uuid, name: z.string().trim().min(2).max(120), description: z.string().trim().max(1000).default(""), range: priceRangeSchema });
const contactInput = z.object({ email: z.string().email().max(254), phone: z.string().trim().min(7).max(32) });
const answerInput = z.object({ serviceId: uuid, answers: z.record(z.string(), z.unknown()).default({}) });
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55);

function parse<S extends z.ZodTypeAny>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) throw new BadRequestException(result.error.flatten());
  return result.data;
}
function requestHeaders(request: Request): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) {
    if (typeof value === "string") headers.set(key, value);
    else if (Array.isArray(value)) value.forEach(item => headers.append(key, item));
  }
  return headers;
}
function publicExperience(experience: Experience) {
  const { priceRanges: _hidden, ...publicConfig } = experience;
  return publicConfig;
}

@Controller("api")
export class ExperienceController {
  private async user(request: Request) {
    const session = await auth.api.getSession({ headers: requestHeaders(request) });
    if (!session) throw new UnauthorizedException("Please sign in");
    return session.user;
  }
  private async membership(request: Request, accountId: string, manage = false) {
    const user = await this.user(request);
    const [membership] = await db.select().from(userAccounts).where(and(eq(userAccounts.accountId, accountId), eq(userAccounts.userId, user.id), eq(userAccounts.status, "accepted"))).limit(1);
    if (!membership || (manage && !["owner", "admin"].includes(membership.userStatus))) throw new ForbiddenException("Account access denied");
    return user;
  }
  private async ownedInstance(request: Request, instanceId: string, manage = false) {
    parse(uuid, instanceId);
    const [instance] = await db.select().from(instances).where(eq(instances.id, instanceId)).limit(1);
    if (!instance?.accountId) throw new NotFoundException("Instance not found");
    await this.membership(request, instance.accountId, manage);
    return instance;
  }
  private async visitorProject(request: Request, instanceId: string, projectId: string) {
    parse(uuid, instanceId); parse(uuid, projectId);
    const token = request.header("x-adventure-project-token") || "";
    if (token.length < 32) throw new UnauthorizedException("Project token required");
    const [project] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.instanceId, instanceId))).limit(1);
    if (!project || project.visitorTokenHash !== hash(token)) throw new NotFoundException("Project not found");
    return project;
  }
  private previewSignature(instanceId: string, expires: number) {
    const secret = process.env.ADVENTURE_PREVIEW_SECRET;
    if (!secret || secret.length < 32) throw new HttpException("Preview access is unavailable", 503);
    return createHmac("sha256", secret).update(`${instanceId}:${expires}`).digest("hex");
  }
  private validPreview(instanceId: string, token: string | undefined) {
    if (!token) return false;
    const [expiryText, signature] = token.split(".");
    const expires = Number(expiryText);
    if (!Number.isSafeInteger(expires) || expires < Date.now() || expires > Date.now() + 15 * 60_000 || !/^[0-9a-f]{64}$/.test(signature || "")) throw new ForbiddenException("Preview link has expired");
    if (!timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(this.previewSignature(instanceId, expires), "hex"))) throw new ForbiddenException("Invalid preview link");
    return true;
  }

  @Get("instances/:instanceId/preview-link")
  async previewLink(@Req() request: Request, @Param("instanceId") instanceId: string) {
    await this.ownedInstance(request, instanceId, true);
    const expires = Date.now() + 15 * 60_000;
    const signature = this.previewSignature(instanceId, expires);
    const origin = process.env.NEXT_PUBLIC_WIDGET_URL || "http://localhost:3001";
    return { url: `${origin}/adventure/${instanceId}?preview=${expires}.${signature}` };
  }

  @Post("accounts")
  async createAccount(@Req() request: Request, @Body() body: unknown) {
    const user = await this.user(request);
    const input = parse(createAccountInput, body);
    const id = randomUUID();
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + 30 * 86400_000);
    await db.transaction(async tx => {
      await tx.insert(accounts).values({ id, name: input.name, slug: `${slug(input.name)}-${id.slice(0, 8)}` });
      await tx.insert(userAccounts).values({ id: randomUUID(), accountId: id, userId: user.id, userStatus: "owner", status: "accepted" });
      await tx.insert(accountBilling).values({ accountId: id, planCode: "usage", status: "trialing", periodStart: now, periodEnd: trialEndsAt, trialEndsAt });
    });
    return { id, name: input.name, trialEndsAt: trialEndsAt.toISOString() };
  }

  @Post("accounts/:accountId/instances")
  async createInstance(@Req() request: Request, @Param("accountId") accountId: string, @Body() body: unknown) {
    parse(uuid, accountId);
    await this.membership(request, accountId, true);
    const input = parse(createInstanceInput, body);
    const selected = await db.select({ id: services.id, name: services.name, categoryId: services.categoryId, status: services.status }).from(services).where(and(eq(services.categoryId, input.industryId), or(isNull(services.accountId), eq(services.accountId, accountId))));
    const byId = new Map(selected.filter(row => row.status === "active").map(row => [row.id, row]));
    if (new Set(input.serviceIds).size !== input.serviceIds.length || input.serviceIds.some(id => !byId.has(id))) throw new BadRequestException("Select active services from the chosen industry");
    const presetRows = await db.select().from(servicePresets).where(eq(servicePresets.industryId, input.industryId));
    const presetById = new Map(presetRows.map(row => [row.serviceId, row]));
    const presets: ServicePreset[] = input.serviceIds.map(id => {
      const row = presetById.get(id);
      return { id, industryId: input.industryId, name: byId.get(id)!.name,
        visualJob: row ? parse(visualJobSchema, row.visualJob) : "none",
        defaultRange: row?.defaultRange ? parse(priceRangeSchema, row.defaultRange) : null,
        elements: row ? parse(formElementSchema.array(), row.elements) : [] };
    });
    const draft = composeExperience(input.industryId, presets);
    let publishable = false;
    try { validateForPublication(draft); publishable = true; } catch { /* Owner must enter missing service ranges. */ }
    const instanceId = randomUUID();
    await db.transaction(async tx => {
      const [billing] = await tx.select().from(accountBilling).where(eq(accountBilling.accountId, accountId)).for("update").limit(1);
      const [plan] = await tx.select().from(plans).where(eq(plans.code, billing?.planCode || "usage")).limit(1);
      const [count] = await tx.select({ total: sql<number>`count(*)::integer` }).from(instances).where(eq(instances.accountId, accountId));
      if (!billing || !plan) throw new ConflictException("Billing setup is incomplete");
      if ((count?.total || 0) >= plan.includedInstances) throw new HttpException("Instance capacity reached", 402);
      await tx.insert(instances).values({ id: instanceId, accountId, name: input.name, slug: `${slug(input.name)}-${instanceId.slice(0, 8)}`, instanceType: "service", demoInstance: false, isPublic: publishable, config: {}, useCase: "scene" });
      await tx.insert(experiences).values({ instanceId, accountId, draft, published: publishable ? draft : null, publishedAt: publishable ? new Date() : null, legacyConfig: null });
    });
    return { instanceId, draft, publishable };
  }

  @Post("accounts/:accountId/services")
  async createService(@Req() request: Request, @Param("accountId") accountId: string, @Body() body: unknown) {
    parse(uuid, accountId);
    const user = await this.membership(request, accountId, true);
    const input = parse(createServiceInput, body);
    const [industry] = await db.select({ id: categories.id }).from(categories).where(and(eq(categories.id, input.industryId), eq(categories.instanceType, "service"))).limit(1);
    if (!industry) throw new BadRequestException("Choose an existing service industry");
    const id = randomUUID();
    await db.transaction(async tx => {
      await tx.insert(services).values({ id, accountId, userId: user.id, categoryId: input.industryId, name: input.name, description: input.description, instanceType: "service", status: "active", scope: [] });
      await tx.insert(servicePresets).values({ serviceId: id, industryId: input.industryId, visualJob: "none", defaultRange: { ...input.range, source: "owner" }, elements: [] });
    });
    return { id, name: input.name };
  }

  @Post("accounts/:accountId/scan-site")
  async suggestWebsite(@Req() request: Request, @Param("accountId") accountId: string, @Body() body: unknown) {
    parse(uuid, accountId);
    await this.membership(request, accountId, true);
    const input = parse(z.object({ websiteUrl: z.string().url().max(2048) }), body);
    try { return await scanWebsite(input.websiteUrl); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : "Website scan failed"); }
  }

  @Get("accounts/:accountId/industries/:industryId/services")
  async accountServices(@Req() request: Request, @Param("accountId") accountId: string, @Param("industryId") industryId: string) {
    parse(uuid, accountId); parse(uuid, industryId);
    await this.membership(request, accountId);
    const rows = await db.select({ id: services.id, name: services.name, description: services.description, defaultRange: servicePresets.defaultRange }).from(services)
      .leftJoin(servicePresets, eq(servicePresets.serviceId, services.id))
      .where(and(eq(services.categoryId, industryId), eq(services.status, "active"), eq(services.instanceType, "service"), or(isNull(services.accountId), eq(services.accountId, accountId))));
    return rows.map(({ defaultRange, ...row }) => ({ ...row, hasDefaultRange: !!defaultRange }));
  }

  @Get("accounts/:accountId/instances")
  async listInstances(@Req() request: Request, @Param("accountId") accountId: string) {
    parse(uuid, accountId);
    await this.membership(request, accountId);
    const rows = await db.select({ id: instances.id, name: instances.name, isPublic: instances.isPublic, revision: experiences.revision, publishedAt: experiences.publishedAt })
      .from(instances).leftJoin(experiences, eq(experiences.instanceId, instances.id)).where(eq(instances.accountId, accountId));
    return { instances: rows };
  }

  @Get("accounts/:accountId/projects")
  async listProjects(@Req() request: Request, @Param("accountId") accountId: string) {
    parse(uuid, accountId);
    await this.membership(request, accountId);
    const rows = await db.select({ id: projects.id, instanceId: projects.instanceId, serviceId: projects.serviceId, contactEmail: projects.contactEmail, contactPhone: projects.contactPhone, revealedRange: projects.revealedRange, quoteRequestedAt: projects.quoteRequestedAt, createdAt: projects.createdAt })
      .from(projects).where(and(eq(projects.accountId, accountId), eq(projects.isPreview, false))).orderBy(desc(projects.createdAt)).limit(100);
    return { projects: rows };
  }

  @Get("accounts/:accountId/history/:table")
  async history(@Req() request: Request, @Param("accountId") accountId: string, @Param("table") table: string) {
    parse(uuid, accountId);
    await this.membership(request, accountId);
    const direct = new Set(["form_submissions", "images", "prompts", "prospects", "telemetry_events", "account_credit_transactions", "user_subscriptions", "categories_subcategories", "categories", "user_accounts"]);
    const related = new Set(["instance_config_versions", "instance_sample_gallery"]);
    if (!direct.has(table) && !related.has(table)) throw new NotFoundException("Historical table is unavailable");
    const page = Math.min(100000, Math.max(0, Number(request.query.page || 0) || 0));
    const selection = direct.has(table)
      ? `SELECT t.* FROM public."${table}" t WHERE t.account_id=$1 ORDER BY t.created_at DESC LIMIT 100 OFFSET $2`
      : `SELECT t.* FROM public."${table}" t JOIN public.instances i ON i.id=t.instance_id WHERE i.account_id=$1 ORDER BY t.created_at DESC LIMIT 100 OFFSET $2`;
    const result = await pool.query(selection, [accountId, page * 100]);
    const rows = table === "images" ? await Promise.all(result.rows.map(async row => {
      try {
        const image = new URL(row.image_url);
        const match = image.pathname.match(/^\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
        if (match && image.hostname.endsWith(".supabase.co")) return { ...row, migrated_url: await storage.signedDownload("adventure-assets", `legacy/${match[1]}/${decodeURIComponent(match[2])}`) };
      } catch { /* Historical remote URL is retained for audit. */ }
      return row;
    })) : result.rows;
    return { table, page, rows };
  }

  @Get("instances/:instanceId/experience")
  async getExperience(@Req() request: Request, @Param("instanceId") instanceId: string) {
    await this.ownedInstance(request, instanceId);
    const [row] = await db.select().from(experiences).where(eq(experiences.instanceId, instanceId)).limit(1);
    if (!row) throw new NotFoundException("Experience not found");
    return { revision: row.revision, draft: row.draft, published: row.published, publishedAt: row.publishedAt };
  }

  @Patch("instances/:instanceId/experience")
  async saveExperience(@Req() request: Request, @Param("instanceId") instanceId: string, @Body() body: unknown) {
    await this.ownedInstance(request, instanceId, true);
    const draft = parse(experienceSchema, body);
    await db.transaction(async tx => {
      const [row] = await tx.select().from(experiences).where(eq(experiences.instanceId, instanceId)).for("update").limit(1);
      if (!row) throw new NotFoundException("Experience not found");
      const original = parse(experienceSchema, row.draft);
      if (draft.industryId !== original.industryId || JSON.stringify([...draft.serviceIds].sort()) !== JSON.stringify([...original.serviceIds].sort())) throw new BadRequestException("Industry and offered services cannot be changed in this editor");
      const actual = await tx.select({ id: services.id }).from(services).where(and(eq(services.categoryId, draft.industryId), inArray(services.id, draft.serviceIds), or(isNull(services.accountId), eq(services.accountId, row.accountId))));
      if (actual.length !== draft.serviceIds.length) throw new BadRequestException("Services must belong to the selected industry");
      await tx.update(experiences).set({ draft, updatedAt: new Date() }).where(eq(experiences.id, row.id));
    });
    return { saved: true };
  }

  @Post("instances/:instanceId/publish")
  async publish(@Req() request: Request, @Param("instanceId") instanceId: string) {
    await this.ownedInstance(request, instanceId, true);
    return db.transaction(async tx => {
      const [row] = await tx.select().from(experiences).where(eq(experiences.instanceId, instanceId)).for("update").limit(1);
      if (!row) throw new NotFoundException("Experience not found");
      let published: Experience;
      try { published = validateForPublication(row.draft); }
      catch (error) { throw new BadRequestException(error instanceof Error ? error.message : "Invalid experience"); }
      const revision = row.revision + 1;
      await tx.update(experiences).set({ published, revision, publishedAt: new Date(), updatedAt: new Date() }).where(eq(experiences.id, row.id));
      await tx.update(instances).set({ isPublic: true }).where(eq(instances.id, instanceId));
      return { published: true, revision };
    });
  }

  @Get("adventure/:instanceId")
  async publicConfig(@Req() request: Request, @Param("instanceId") instanceId: string) {
    parse(uuid, instanceId);
    const preview = this.validPreview(instanceId, typeof request.query.preview === "string" ? request.query.preview : undefined);
    const [instance] = await db.select().from(instances).where(eq(instances.id, instanceId)).limit(1);
    const [row] = await db.select().from(experiences).where(eq(experiences.instanceId, instanceId)).limit(1);
    if (!instance || !row || (!preview && (!instance.isPublic || !row.published))) throw new NotFoundException("Experience not found");
    return { instanceId, name: instance.name, revision: row.revision, experience: publicExperience(parse(experienceSchema, preview ? row.draft : row.published)) };
  }

  @Post("adventure/:instanceId/projects")
  async startProject(@Param("instanceId") instanceId: string, @Body() body: unknown) {
    parse(uuid, instanceId);
    const [instance] = await db.select().from(instances).where(eq(instances.id, instanceId)).limit(1);
    const [row] = await db.select().from(experiences).where(eq(experiences.instanceId, instanceId)).limit(1);
    const previewToken = z.object({ previewToken: z.string().optional() }).parse(body || {}).previewToken;
    const isPreview = this.validPreview(instanceId, previewToken) || !!instance?.demoInstance;
    if (!instance?.accountId || !row || (!isPreview && (!instance.isPublic || !row.published))) throw new NotFoundException("Experience not found");
    const snapshot = isPreview ? row.draft : row.published;
    const token = randomBytes(32).toString("base64url");
    const [project] = await db.insert(projects).values({ accountId: instance.accountId, instanceId, visitorTokenHash: hash(token), experienceRevision: row.revision, experienceSnapshot: snapshot, isPreview, answers: {} }).returning({ id: projects.id });
    return { projectId: project.id, token, experience: publicExperience(parse(experienceSchema, snapshot)) };
  }

  @Get("adventure/:instanceId/projects/:projectId")
  async resumeProject(@Req() request: Request, @Param("instanceId") instanceId: string, @Param("projectId") projectId: string) {
    const project = await this.visitorProject(request, instanceId, projectId);
    return { projectId, serviceId: project.serviceId, answers: project.answers, contactComplete: !!project.contactEmail && !!project.contactPhone, revealedRange: project.revealedRange, quoteRequested: !!project.quoteRequestedAt, experience: publicExperience(parse(experienceSchema, project.experienceSnapshot)) };
  }

  @Patch("adventure/:instanceId/projects/:projectId/answers")
  async answer(@Req() request: Request, @Param("instanceId") instanceId: string, @Param("projectId") projectId: string, @Body() body: unknown) {
    const project = await this.visitorProject(request, instanceId, projectId);
    const input = parse(answerInput, body);
    const snapshot = parse(experienceSchema, project.experienceSnapshot);
    if (!snapshot.serviceIds.includes(input.serviceId)) throw new BadRequestException("Service is unavailable");
    const allowed = new Map(snapshot.elements.filter(e => ["single_choice", "multi_choice", "text", "number", "measurement", "upload"].includes(e.kind) && (!e.serviceIds.length || e.serviceIds.includes(input.serviceId))).map(e => [e.id, e]));
    for (const [key, value] of Object.entries(input.answers)) {
      const element = allowed.get(key);
      if (!element) throw new BadRequestException("Unknown form answer");
      if (element.kind === "text" && typeof value !== "string") throw new BadRequestException("Text answer is invalid");
      if (["number", "measurement"].includes(element.kind) && typeof value !== "number") throw new BadRequestException("Number answer is invalid");
      if (element.kind === "single_choice" && !element.options.some(option => option.value === value)) throw new BadRequestException("Choice is invalid");
      if (element.kind === "multi_choice" && (!Array.isArray(value) || value.some(choice => !element.options.some(option => option.value === choice)))) throw new BadRequestException("Choices are invalid");
      if (element.kind === "upload") {
        if (typeof value !== "string" || !uuid.safeParse(value).success) throw new BadRequestException("Upload is invalid");
        const [asset] = await db.select({ id: assets.id }).from(assets).where(and(eq(assets.id, value), eq(assets.projectId, project.id))).limit(1);
        if (!asset) throw new BadRequestException("Upload is unavailable");
      }
    }
    await db.transaction(async tx => {
      const [locked] = await tx.select().from(projects).where(eq(projects.id, projectId)).for("update").limit(1);
      if (!locked || locked.visitorTokenHash !== project.visitorTokenHash) throw new NotFoundException("Project not found");
      if (locked.serviceId && locked.serviceId !== input.serviceId) throw new ConflictException("Start another project to change services");
      if (!locked.serviceId && !locked.isPreview) {
        const [billing] = await tx.select().from(accountBilling).where(eq(accountBilling.accountId, locked.accountId)).for("update").limit(1);
        const [plan] = await tx.select().from(plans).where(eq(plans.code, billing?.planCode || "usage")).limit(1);
        if (!billing || !plan) throw new HttpException("Experience billing is unavailable", 503);
        const trial = billing.status === "trialing" && !!billing.trialEndsAt && billing.trialEndsAt > new Date();
        const included = trial || billing.engagementsUsed < plan.includedEngagements;
        const charge = included ? 0 : plan.overageEngagementPriceCents;
        if (charge > billing.walletBalanceCents) throw new HttpException("This experience cannot start a new project right now", 402);
        await tx.insert(engagements).values({ projectId, accountId: locked.accountId, source: trial ? "trial" : included ? "monthly" : "wallet", chargeCents: charge });
        await tx.update(accountBilling).set({ engagementsUsed: billing.engagementsUsed + 1, walletBalanceCents: billing.walletBalanceCents - charge }).where(eq(accountBilling.accountId, locked.accountId));
        if (charge) await tx.insert(walletEntries).values({ accountId: locked.accountId, projectId, operationKey: `engagement:${projectId}:debit`, kind: "engagement", amountCents: -charge });
      }
      await tx.update(projects).set({ serviceId: input.serviceId, answers: { ...(locked.answers as object), ...input.answers }, updatedAt: new Date() }).where(eq(projects.id, projectId));
    });
    return { saved: true };
  }

  @Post("adventure/:instanceId/projects/:projectId/contact")
  async contact(@Req() request: Request, @Param("instanceId") instanceId: string, @Param("projectId") projectId: string, @Body() body: unknown) {
    const project = await this.visitorProject(request, instanceId, projectId);
    const input = parse(contactInput, body);
    if (!project.serviceId) throw new ConflictException("Complete the first step before revealing pricing");
    const snapshot = parse(experienceSchema, project.experienceSnapshot);
    for (const element of elementsForService(snapshot, project.serviceId)) {
      if (!element.required || !["single_choice", "multi_choice", "text", "number", "measurement", "upload"].includes(element.kind)) continue;
      const value = (project.answers as Record<string, unknown>)[element.id];
      if (value == null || value === "" || Array.isArray(value) && !value.length) throw new ConflictException(`Complete ${element.label} before revealing pricing`);
    }
    const range = project.revealedRange || revealedPrice(snapshot, project.serviceId);
    await db.update(projects).set({ contactEmail: input.email, contactPhone: input.phone, revealedRange: range, updatedAt: new Date() }).where(eq(projects.id, projectId));
    return { range };
  }

  @Post("adventure/:instanceId/projects/:projectId/quote")
  async requestQuote(@Req() request: Request, @Param("instanceId") instanceId: string, @Param("projectId") projectId: string, @Body() body: unknown) {
    const project = await this.visitorProject(request, instanceId, projectId);
    if (!project.contactEmail || !project.contactPhone || !project.revealedRange) throw new ConflictException("Reveal your range first");
    const note = parse(z.object({ note: z.string().trim().max(2000).default("") }), body).note;
    await db.update(projects).set({ quoteRequestedAt: project.quoteRequestedAt || new Date(), answers: { ...(project.answers as object), quote_note: note }, updatedAt: new Date() }).where(eq(projects.id, projectId));
    return { requested: true };
  }
}

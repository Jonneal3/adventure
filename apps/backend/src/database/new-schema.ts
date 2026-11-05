import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
export const experiences = pgTable("adventure_experiences", {
  id: uuid("id").primaryKey().defaultRandom(), instanceId: uuid("instance_id").notNull(), accountId: uuid("account_id").notNull(),
  revision: integer("revision").notNull().default(1), draft: jsonb("draft").notNull(), published: jsonb("published"),
  legacyConfig: jsonb("legacy_config"), publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("adventure_experiences_instance_unique").on(table.instanceId)]);
export const servicePresets = pgTable("adventure_service_presets", {
  serviceId: uuid("service_id").primaryKey(), industryId: uuid("industry_id").notNull(),
  visualJob: text("visual_job").notNull().default("none"), defaultRange: jsonb("default_range"), elements: jsonb("elements").notNull().default([]),
  curatedAt: timestamp("curated_at", { withTimezone: true }),
});
export const projects = pgTable("adventure_projects", {
  id: uuid("id").primaryKey().defaultRandom(), accountId: uuid("account_id").notNull(), instanceId: uuid("instance_id").notNull(),
  visitorTokenHash: text("visitor_token_hash").notNull(),
  isPreview: boolean("is_preview").notNull().default(false),
  experienceRevision: integer("experience_revision").notNull(), experienceSnapshot: jsonb("experience_snapshot").notNull(),
  serviceId: uuid("service_id"), answers: jsonb("answers").notNull().default({}), contactEmail: text("contact_email"), contactPhone: text("contact_phone"),
  revealedRange: jsonb("revealed_range"), quoteRequestedAt: timestamp("quote_requested_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
export const plans = pgTable("adventure_plans", {
  code: text("code").primaryKey(), name: text("name").notNull(), monthlyPriceCents: integer("monthly_price_cents").notNull(),
  includedEngagements: integer("included_engagements").notNull(), overageEngagementPriceCents: integer("overage_engagement_price_cents").notNull(),
  includedAiDesigns: integer("included_ai_designs").notNull(), extraAiDesignPriceCents: integer("extra_ai_design_price_cents").notNull(),
  includedInstances: integer("included_instances").notNull(), active: boolean("active").notNull().default(true),
});
export const accountBilling = pgTable("adventure_account_billing", {
  accountId: uuid("account_id").primaryKey(), planCode: text("plan_code").notNull().default("usage"),
  status: text("status").notNull().default("trialing"), periodStart: timestamp("period_start", { withTimezone: true }).notNull().defaultNow(),
  periodEnd: timestamp("period_end", { withTimezone: true }).notNull(), trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
  engagementsUsed: integer("engagements_used").notNull().default(0), aiDesignsUsed: integer("ai_designs_used").notNull().default(0),
  walletBalanceCents: integer("wallet_balance_cents").notNull().default(0), stripeCustomerId: text("stripe_customer_id"), stripeSubscriptionId: text("stripe_subscription_id"),
});
export const engagements = pgTable("adventure_engagements", {
  id: uuid("id").primaryKey().defaultRandom(), projectId: uuid("project_id").notNull(), accountId: uuid("account_id").notNull(),
  source: text("source").notNull(), chargeCents: integer("charge_cents").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("adventure_engagements_project_unique").on(table.projectId)]);
export const walletEntries = pgTable("adventure_wallet_entries", {
  id: uuid("id").primaryKey().defaultRandom(), accountId: uuid("account_id").notNull(), operationKey: text("operation_key").notNull(),
  amountCents: integer("amount_cents").notNull(), kind: text("kind").notNull(), projectId: uuid("project_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("adventure_wallet_operation_unique").on(table.operationKey)]);
export const stripeEvents = pgTable("adventure_stripe_events", {
  id: text("id").primaryKey(), type: text("type").notNull(), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
export const jobs = pgTable("adventure_jobs", {
  id: uuid("id").primaryKey().defaultRandom(), projectId: uuid("project_id").notNull(), accountId: uuid("account_id").notNull(),
  requestKey: uuid("request_key").notNull(), kind: text("kind").notNull(), status: text("status").notNull().default("queued"),
  chargeSource: text("charge_source").notNull(), chargeCents: integer("charge_cents").notNull().default(0),
  attempts: integer("attempts").notNull().default(0),
  input: jsonb("input").notNull(), output: jsonb("output"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("adventure_jobs_request_unique").on(table.projectId, table.requestKey)]);
export const assets = pgTable("adventure_assets", {
  id: uuid("id").primaryKey().defaultRandom(), accountId: uuid("account_id").notNull(), projectId: uuid("project_id"),
  objectKey: text("object_key").notNull(), contentType: text("content_type").notNull(), purpose: text("purpose").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, table => [uniqueIndex("adventure_assets_key_unique").on(table.objectKey)]);

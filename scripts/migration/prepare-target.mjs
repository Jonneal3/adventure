#!/usr/bin/env node
// Apply only the Better Auth scaffold before restoring Adventure's public schema.
// Apply the new adventure_* tables after parity verification.
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import pg from "pg";

const phase = process.argv[2];
if (!["auth", "application"].includes(phase)) throw new Error("Usage: node scripts/migration/prepare-target.mjs auth|application");
const envFile = "env/.env.migration.local";
const env = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};
const url = process.env.ADVENTURE_TARGET_DATABASE_URL || env.ADVENTURE_TARGET_DATABASE_URL;
if (!url) throw new Error("ADVENTURE_TARGET_DATABASE_URL is required");
if (new URL(url).hostname.endsWith(".supabase.co")) throw new Error("Target must not be Supabase");
const file = fs.readdirSync(path.resolve("apps/backend/drizzle")).find(name => /^0000_.*\.sql$/.test(name));
if (!file) throw new Error("Generated baseline migration is missing");
const migration = fs.readFileSync(path.resolve("apps/backend/drizzle", file), "utf8");
const statements = migration.split("--> statement-breakpoint").map(value => value.trim()).filter(Boolean);
const selected = statements.filter(statement => phase === "auth"
  ? /^CREATE SCHEMA "app_auth"|^CREATE TABLE "app_auth"|^ALTER TABLE "app_auth"|^CREATE UNIQUE INDEX "app_auth_/.test(statement)
  : /^CREATE TABLE "adventure_|^CREATE UNIQUE INDEX "adventure_/.test(statement));
if (selected.length < (phase === "auth" ? 9 : 11)) throw new Error("Generated migration is incomplete");
const client = new pg.Client({ connectionString: url, ssl: ["localhost", "127.0.0.1"].includes(new URL(url).hostname) ? undefined : { rejectUnauthorized: true } });
try {
  await client.connect();
  await client.query("BEGIN");
  if (phase === "auth") {
    const existing = await client.query("SELECT to_regnamespace('app_auth') IS NOT NULL AS present");
    if (existing.rows[0].present) throw new Error("Auth target must be empty");
  } else {
    const existing = await client.query("SELECT to_regclass('public.adventure_experiences') IS NOT NULL AS present");
    if (existing.rows[0].present) throw new Error("Adventure application tables already exist");
  }
  for (const statement of selected) await client.query(statement);
  if (phase === "application") {
    for (const [table, column, parent, parentColumn] of [
      ["adventure_account_billing", "account_id", "accounts", "id"],
      ["adventure_experiences", "account_id", "accounts", "id"], ["adventure_experiences", "instance_id", "instances", "id"],
      ["adventure_service_presets", "service_id", "categories_subcategories", "id"], ["adventure_service_presets", "industry_id", "categories", "id"],
      ["adventure_projects", "account_id", "accounts", "id"], ["adventure_projects", "instance_id", "instances", "id"],
      ["adventure_engagements", "project_id", "adventure_projects", "id"], ["adventure_engagements", "account_id", "accounts", "id"],
      ["adventure_wallet_entries", "account_id", "accounts", "id"], ["adventure_wallet_entries", "project_id", "adventure_projects", "id"],
      ["adventure_jobs", "project_id", "adventure_projects", "id"], ["adventure_jobs", "account_id", "accounts", "id"],
      ["adventure_assets", "project_id", "adventure_projects", "id"], ["adventure_assets", "account_id", "accounts", "id"],
    ]) await client.query(`ALTER TABLE "${table}" ADD CONSTRAINT "${table}_${column}_fk" FOREIGN KEY ("${column}") REFERENCES "${parent}"("${parentColumn}")`);
    await client.query(`ALTER TABLE adventure_account_billing ADD CONSTRAINT adventure_billing_plan_fk FOREIGN KEY (plan_code) REFERENCES adventure_plans(code)`);
    await client.query(`INSERT INTO adventure_plans
      (code,name,monthly_price_cents,included_engagements,overage_engagement_price_cents,included_ai_designs,extra_ai_design_price_cents,included_instances)
      VALUES ('usage','Pay As You Go',0,0,750,0,10,1),('basic','Basic',9900,25,500,50,8,5),('pro','Pro',29900,100,250,500,6,25)`);
  }
  await client.query("COMMIT");
  console.log(JSON.stringify({ phase, statements: selected.length }));
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(`Target preparation failed: ${error.message}`);
  process.exitCode = 1;
} finally { await client.end().catch(() => {}); }

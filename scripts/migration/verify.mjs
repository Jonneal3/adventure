#!/usr/bin/env node
// Compare every application row and auth identity after a restore. Emits hashes only.
import fs from "node:fs";
import { createHash } from "node:crypto";
import dotenv from "dotenv";
import pg from "pg";

const env = dotenv.parse(fs.readFileSync("env/.env.migration.local"));
const sourceUrl = process.env.ADVENTURE_DATABASE_URL || env.ADVENTURE_DATABASE_URL;
const targetUrl = process.env.ADVENTURE_TARGET_DATABASE_URL || env.ADVENTURE_TARGET_DATABASE_URL;
if (!sourceUrl || !targetUrl || new URL(sourceUrl).host === new URL(targetUrl).host)
  throw new Error("Distinct ADVENTURE_DATABASE_URL and ADVENTURE_TARGET_DATABASE_URL are required");
const connect = (url, verifyCertificate = true) => new pg.Client({ connectionString: url, ssl: ["127.0.0.1", "localhost"].includes(new URL(url).hostname) ? undefined : { rejectUnauthorized: verifyCertificate }, connectionTimeoutMillis: 15000 });
const source = connect(sourceUrl, false), target = connect(targetUrl);
const quote = (name) => `"${name.replaceAll('"', '""')}"`;

async function digest(client, table) {
  const result = await client.query(`SELECT to_jsonb(t) AS row FROM public.${quote(table)} t`);
  const hash = createHash("sha256");
  for (const row of result.rows.map((item) => JSON.stringify(item.row)).sort()) hash.update(row).update("\n");
  return { count: result.rowCount, sha256: hash.digest("hex") };
}

// PostgreSQL versions render the same varchar-array CHECK with casts either
// around the array or around each element. Normalize only that known form.
function normalizeConstraintDefinition(value) {
  return value.replace(/\(\(ARRAY\[([^\]]+)\]\)::text\[\]\)/g, '(ARRAY[$1])')
    .replace(/\('([^']*)'::character varying\)::text/g, "'$1'")
    .replace(/'([^']*)'::character varying/g, "'$1'");
}

async function catalogDigest(client, query, name) {
  const result = await client.query(query);
  const hash = createHash("sha256");
  for (const row of result.rows.map((item) => JSON.stringify(name === "constraints"
    ? { ...item, definition: normalizeConstraintDefinition(item.definition) } : item)).sort()) hash.update(row).update("\n");
  return { count: result.rowCount, sha256: hash.digest("hex") };
}

const catalogChecks = {
  columns: `SELECT table_name,column_name,data_type,udt_name,is_nullable,column_default,
    character_maximum_length,numeric_precision,numeric_scale
    FROM information_schema.columns WHERE table_schema='public'`,
  functions: `SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public'`,
  indexes: `SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public'`,
  constraints: `SELECT c.conname,r.relname AS table_name,c.contype,c.convalidated,
    pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c JOIN pg_class r ON r.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=r.relnamespace WHERE n.nspname='public' AND c.contype <> 'n'`,
  triggers: `SELECT r.relname AS table_name,t.tgname,pg_get_triggerdef(t.oid) AS definition
    FROM pg_trigger t JOIN pg_class r ON r.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=r.relnamespace
    WHERE n.nspname='public' AND NOT t.tgisinternal`,
  policies: `SELECT tablename,policyname,permissive,roles,cmd,qual,with_check
    FROM pg_policies WHERE schemaname='public' AND policyname<>'portable_service_all'`,
  rls: `SELECT r.relname,r.relrowsecurity,r.relforcerowsecurity
    FROM pg_class r JOIN pg_namespace n ON n.oid=r.relnamespace
    WHERE n.nspname='public' AND r.relkind IN ('r','p')`,
};

try {
  await source.connect(); await target.connect();
  await source.query("BEGIN READ ONLY"); await target.query("BEGIN READ ONLY");
  await source.query("SET LOCAL TIME ZONE 'UTC'"); await target.query("SET LOCAL TIME ZONE 'UTC'");
  // pg_get_* qualifies names according to the session search_path. Use the same
  // path on both providers so equivalent definitions produce the same text.
  await source.query("SET LOCAL search_path TO public, pg_catalog");
  await target.query("SET LOCAL search_path TO public, pg_catalog");
  const sourceTables = (await source.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map((r) => r.tablename);
  const targetTables = (await target.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows.map((r) => r.tablename);
  if (JSON.stringify(sourceTables) !== JSON.stringify(targetTables)) throw new Error("Application table lists differ");
  const mismatches = [];
  let totalRows = 0;
  for (const table of sourceTables) {
    const a = await digest(source, table), b = await digest(target, table);
    totalRows += a.count;
    if (a.count !== b.count || a.sha256 !== b.sha256) mismatches.push({ table, sourceCount: a.count, targetCount: b.count });
  }
  const schemaMismatches = [];
  const schemaCounts = {};
  for (const [name, query] of Object.entries(catalogChecks)) {
    const a = await catalogDigest(source, query, name), b = await catalogDigest(target, query, name);
    schemaCounts[name] = a.count;
    if (a.count !== b.count || a.sha256 !== b.sha256)
      schemaMismatches.push({ catalog: name, sourceCount: a.count, targetCount: b.count });
  }
  const sourceUsers = await source.query("SELECT id,email,email_confirmed_at IS NOT NULL AS verified,encrypted_password ~ '^\\$2[aby]\\$' AS transferable FROM auth.users ORDER BY id");
  const targetUsers = await target.query('SELECT id,email,email_verified AS verified FROM app_auth."user" ORDER BY id');
  const authMatches = JSON.stringify(sourceUsers.rows.map(({ transferable, ...row }) => row)) === JSON.stringify(targetUsers.rows);
  const sourceLegacyUsers = await source.query("SELECT u.id,to_jsonb(u) AS payload FROM auth.users u ORDER BY u.id");
  const targetLegacyUsers = await target.query("SELECT id,payload FROM app_auth.legacy_user ORDER BY id");
  const legacyUsersMatch = JSON.stringify(sourceLegacyUsers.rows) === JSON.stringify(targetLegacyUsers.rows);
  const sourceIdentities = await source.query("SELECT i.id::text AS id,i.user_id,to_jsonb(i) AS payload FROM auth.identities i ORDER BY i.id");
  const targetIdentities = await target.query("SELECT id,user_id,payload FROM app_auth.legacy_identity ORDER BY id");
  const identitiesMatch = JSON.stringify(sourceIdentities.rows) === JSON.stringify(targetIdentities.rows);
  const targetAccounts = await target.query(`SELECT user_id FROM app_auth.account WHERE provider_id='credential' ORDER BY user_id`);
  const credentialMatches = JSON.stringify(sourceUsers.rows.filter((user) => user.transferable).map((user) => user.id)) === JSON.stringify(targetAccounts.rows.map((row) => row.user_id));
  console.log(JSON.stringify({ tables: sourceTables.length, rows: totalRows, mismatches, schemaCounts, schemaMismatches,
    sourceUsers: sourceUsers.rowCount, targetUsers: targetUsers.rowCount, authMatches, credentialMatches,
    sourceIdentities: sourceIdentities.rowCount, targetIdentities: targetIdentities.rowCount, legacyUsersMatch, identitiesMatch }));
  if (mismatches.length || schemaMismatches.length || !authMatches || !credentialMatches || !legacyUsersMatch || !identitiesMatch) process.exitCode = 1;
  await source.query("ROLLBACK"); await target.query("ROLLBACK");
} catch (error) {
  console.error(`Migration verification failed: ${error.message}`);
  process.exitCode = 1;
} finally { await source.end().catch(() => {}); await target.end().catch(() => {}); }

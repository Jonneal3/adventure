#!/usr/bin/env node
// Restore the application-only public schema from a private pg_dump archive.
// Requires an empty target public schema and completed migrate-auth.mjs --apply.
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";
import pg from "pg";

const env = dotenv.parse(fs.readFileSync("env/.env.migration.local"));
const sourceUrl = process.env.ADVENTURE_DATABASE_URL || env.ADVENTURE_DATABASE_URL;
const targetUrl = process.env.ADVENTURE_TARGET_DATABASE_URL || env.ADVENTURE_TARGET_DATABASE_URL;
const archive = process.argv[2];
if (!archive || !fs.existsSync(archive) || !targetUrl || !sourceUrl) throw new Error("Usage: node scripts/migration/restore-public.mjs <private-backup.dump>");
if (new URL(sourceUrl).host === new URL(targetUrl).host) throw new Error("Source and target hosts must differ");
const parsed = new URL(targetUrl);
if (!["postgres:", "postgresql:"].includes(parsed.protocol)) throw new Error("Expected PostgreSQL target URL");
const pgEnv = {
  ...process.env,
  PGHOST: parsed.hostname,
  PGPORT: parsed.port || "5432",
  PGDATABASE: parsed.pathname.slice(1) || "postgres",
  PGUSER: decodeURIComponent(parsed.username),
  PGPASSWORD: decodeURIComponent(parsed.password),
  PGSSLMODE: parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" ? "disable" : "require",
};
const target = new pg.Client({ connectionString: targetUrl, ssl: pgEnv.PGSSLMODE === "disable" ? undefined : { rejectUnauthorized: true } });
const run = (args) => {
  const result = spawnSync("pg_restore", args, { env: pgEnv, encoding: "utf8", timeout: 300000, maxBuffer: 5_000_000 });
  if (result.status !== 0) throw new Error(`pg_restore failed: ${(result.stderr || "unknown error").slice(0, 1200)}`);
  return result.stdout;
};

try {
  await target.connect();
  const preflight = await target.query(`SELECT
    (SELECT count(*)::int FROM pg_tables WHERE schemaname='public') AS tables,
    (SELECT count(*)::int FROM app_auth."user") AS users,
    to_regclass('auth.users') IS NOT NULL AS identity_bridge`);
  if (preflight.rows[0].tables !== 0 || !preflight.rows[0].identity_bridge)
    throw new Error("Target must have no public tables and must have imported auth users");
  for (const role of ["anon", "authenticated", "service_role"]) {
    const present = await target.query("SELECT 1 FROM pg_roles WHERE rolname=$1", [role]);
    if (!present.rowCount) await target.query(`CREATE ROLE ${role} NOLOGIN`);
  }
  await target.query("CREATE SCHEMA IF NOT EXISTS public");
  run(["--dbname", pgEnv.PGDATABASE, "--schema=public", "--no-owner", "--no-acl", "--single-transaction", "--exit-on-error", archive]);

  // Copy only application-role ACLs from the source dump. Supabase's internal roles
  // and default-privilege owners do not exist on the portable target.
  const schemaSql = run(["--schema=public", "--schema-only", "--no-owner", "--file=-", archive]);
  const acl = schemaSql.split("\n").filter((line) =>
    /^(GRANT|REVOKE)\s/.test(line) && /;\s*$/.test(line) &&
    (/(?:TO|FROM) (?:anon|authenticated|service_role|PUBLIC);/.test(line))
  );
  await target.query("BEGIN");
  await target.query("GRANT USAGE ON SCHEMA public,auth TO anon,authenticated,service_role");
  await target.query("GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated,service_role");
  for (const statement of acl) await target.query(statement);
  const role = pgEnv.PGUSER.replaceAll('"', '""');
  await target.query(`GRANT anon,authenticated,service_role TO "${role}"`);
  // Neon's project owner may default row_security=off. PostgREST connects as
  // this role and switches to authenticated/anon for each request; leave RLS
  // enabled when it does so.
  await target.query(`ALTER ROLE "${role}" SET row_security = on`);
  // The portable service role needs the same database reach as Supabase's
  // service key, without requiring Neon to grant the BYPASSRLS attribute.
  await target.query("GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role");
  await target.query("GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role");
  await target.query("GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role");
  await target.query(`DO $$ DECLARE item record; BEGIN
    FOR item IN SELECT schemaname,tablename FROM pg_tables t
      JOIN pg_class c ON c.oid=to_regclass(format('%I.%I',t.schemaname,t.tablename))
      WHERE t.schemaname='public' AND c.relrowsecurity
    LOOP
      EXECUTE format('CREATE POLICY portable_service_all ON %I.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',item.schemaname,item.tablename);
    END LOOP;
  END $$`);
  await target.query("COMMIT");
  const count = await target.query("SELECT count(*)::int AS count FROM pg_tables WHERE schemaname='public'");
  console.log(JSON.stringify({ restoredTables: count.rows[0].count, aclStatements: acl.length }));
} catch (error) {
  await target.query("ROLLBACK").catch(() => {});
  console.error(`Restore failed: ${error.message}`);
  process.exitCode = 1;
} finally { await target.end().catch(() => {}); }

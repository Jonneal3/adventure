#!/usr/bin/env node
// Imports Supabase email identities into Better Auth while preserving UUIDs and bcrypt hashes.
// Dry-run by default. Requires an already-migrated app_auth schema on the target.
import fs from "node:fs";
import path from "node:path";
import pg from "pg";
import dotenv from "dotenv";

const file = "env/.env.migration.local";
const env = fs.existsSync(file) ? dotenv.parse(fs.readFileSync(file)) : {};
const sourceUrl = process.env.ADVENTURE_DATABASE_URL || env.ADVENTURE_DATABASE_URL;
const targetUrl = process.env.ADVENTURE_TARGET_DATABASE_URL || env.ADVENTURE_TARGET_DATABASE_URL;
const apply = process.argv.includes("--apply");
const snapshotFlag = process.argv.indexOf("--snapshot");
const snapshotOutFlag = process.argv.indexOf("--snapshot-out");
const snapshotPath = snapshotFlag >= 0 ? process.argv[snapshotFlag + 1] : null;
const snapshotOutPath = snapshotOutFlag >= 0 ? process.argv[snapshotOutFlag + 1] : null;

if (!sourceUrl && !snapshotPath) throw new Error("ADVENTURE_DATABASE_URL or --snapshot is required");
if (apply && !targetUrl) throw new Error("ADVENTURE_TARGET_DATABASE_URL is required for --apply");
if (sourceUrl && targetUrl && new URL(sourceUrl).host === new URL(targetUrl).host) throw new Error("Source and target hosts must differ");
if (snapshotPath && snapshotOutPath) throw new Error("Choose either --snapshot or --snapshot-out");

function connection(url, verifyCertificate = true) {
  const parsed = new URL(url);
  if (!["postgres:", "postgresql:"].includes(parsed.protocol)) throw new Error("Expected PostgreSQL URL");
  return new pg.Client({ connectionString: url, ssl: parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" ? undefined : { rejectUnauthorized: verifyCertificate }, connectionTimeoutMillis: 15000 });
}

const source = snapshotPath ? null : connection(sourceUrl, false);
let target;
try {
  let users, identities;
  if (snapshotPath) {
    ({ users, identities } = JSON.parse(fs.readFileSync(snapshotPath, "utf8")));
    if (!Array.isArray(users) || !Array.isArray(identities)) throw new Error("Auth snapshot is malformed");
  } else {
    await source.connect();
    await source.query("BEGIN READ ONLY");
    ({ rows: users } = await source.query(`
    SELECT u.id,u.email,u.encrypted_password,u.email_confirmed_at,u.created_at,u.updated_at,
           u.raw_user_meta_data,to_jsonb(u) AS legacy_payload
      FROM auth.users u ORDER BY u.id`));
    ({ rows: identities } = await source.query("SELECT i.id::text AS id,i.user_id,i.provider,i.provider_id,to_jsonb(i) AS legacy_payload FROM auth.identities i ORDER BY i.user_id,i.provider"));
    if (snapshotOutPath) {
      const output = path.resolve(snapshotOutPath);
      fs.mkdirSync(path.dirname(output), { recursive: true, mode: 0o700 });
      const temporary = `${output}.partial-${process.pid}`;
      try {
        fs.writeFileSync(temporary, JSON.stringify({ users, identities }), { mode: 0o600 });
        fs.renameSync(temporary, output);
      } finally { fs.rmSync(temporary, { force: true }); }
    }
  }
  const providers = [...new Set(identities.map((row) => row.provider))];
  if (users.some((row) => !row.email)) throw new Error("An auth user has no email; manual identity recovery is needed");
  const transferable = users.filter((row) => /^\$2[aby]\$/.test(row.encrypted_password || ""));
  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", users: users.length, identities: identities.length, providers, transferablePasswords: transferable.length, resetRequired: users.length - transferable.length }));
  if (!apply) { await source?.query("ROLLBACK"); process.exit(0); }

  target = connection(targetUrl);
  await target.connect();
  const targetCheck = await target.query("SELECT to_regclass('app_auth.user') IS NOT NULL AS ready, (SELECT count(*)::int FROM app_auth.user) AS count");
  if (!targetCheck.rows[0].ready || targetCheck.rows[0].count) throw new Error("Target app_auth schema must exist and contain no users");
  await target.query("BEGIN");
  await target.query("CREATE SCHEMA IF NOT EXISTS auth");
  await target.query(`CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY, email text, email_confirmed_at timestamptz
  )`);
  await target.query(`CREATE TABLE IF NOT EXISTS app_auth.legacy_user (
    id uuid PRIMARY KEY REFERENCES app_auth."user"(id) ON DELETE CASCADE,
    payload jsonb NOT NULL
  )`);
  await target.query(`CREATE TABLE IF NOT EXISTS app_auth.legacy_identity (
    id text PRIMARY KEY, user_id uuid NOT NULL REFERENCES app_auth."user"(id) ON DELETE CASCADE,
    payload jsonb NOT NULL
  )`);
  await target.query(`CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
    $$ SELECT COALESCE(nullif(current_setting('app.user_id', true), ''),
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid $$`);
  await target.query(`CREATE OR REPLACE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS
    $$ SELECT COALESCE(nullif(current_setting('request.jwt.claim.role', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role') $$`);
  for (const user of users) {
    const name = String(user.raw_user_meta_data?.full_name || user.raw_user_meta_data?.name || user.email.split("@")[0]);
    await target.query(`INSERT INTO app_auth."user" (id,name,email,email_verified,created_at,updated_at)
      VALUES ($1,$2,$3,$4,$5,$6)`, [user.id, name, user.email, !!user.email_confirmed_at, user.created_at, user.updated_at]);
    if (/^\$2[aby]\$/.test(user.encrypted_password || "")) await target.query(`INSERT INTO app_auth.account
      (id,account_id,provider_id,user_id,password,created_at,updated_at)
      VALUES (gen_random_uuid(),$1::text,'credential',$1::uuid,$2,$3,$4)`, [user.id, user.encrypted_password, user.created_at, user.updated_at]);
    await target.query("INSERT INTO auth.users (id,email,email_confirmed_at) VALUES ($1,$2,$3)", [user.id, user.email, user.email_confirmed_at]);
    await target.query("INSERT INTO app_auth.legacy_user (id,payload) VALUES ($1,$2::jsonb)", [user.id, JSON.stringify(user.legacy_payload)]);
  }
  for (const identity of identities) {
    await target.query("INSERT INTO app_auth.legacy_identity (id,user_id,payload) VALUES ($1,$2,$3::jsonb)",
      [identity.id, identity.user_id, JSON.stringify(identity.legacy_payload)]);
    if (identity.provider !== "email") await target.query(`INSERT INTO app_auth.account (id,account_id,provider_id,user_id)
      VALUES (gen_random_uuid(),$1,$2,$3) ON CONFLICT (provider_id,account_id) DO NOTHING`,
      [identity.provider_id || identity.id, identity.provider, identity.user_id]);
  }
  await target.query(`CREATE OR REPLACE FUNCTION auth.sync_better_auth_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path=auth,pg_temp AS $$
    BEGIN
      IF TG_OP = 'DELETE' THEN DELETE FROM auth.users WHERE id=OLD.id; RETURN OLD; END IF;
      INSERT INTO auth.users(id,email,email_confirmed_at)
      VALUES (NEW.id,NEW.email,CASE WHEN NEW.email_verified THEN now() ELSE NULL END)
      ON CONFLICT(id) DO UPDATE SET email=excluded.email,
        email_confirmed_at=CASE WHEN NEW.email_verified THEN COALESCE(auth.users.email_confirmed_at,now()) ELSE NULL END;
      RETURN NEW;
    END $$`);
  await target.query("DROP TRIGGER IF EXISTS sync_better_auth_user ON app_auth.\"user\"");
  await target.query(`CREATE TRIGGER sync_better_auth_user AFTER INSERT OR UPDATE OR DELETE ON app_auth."user"
    FOR EACH ROW EXECUTE FUNCTION auth.sync_better_auth_user()`);
  await target.query("COMMIT");
  await source?.query("ROLLBACK");
  console.log(JSON.stringify({ importedUsers: users.length, importedIdentities: identities.length }));
} catch (error) {
  if (target) await target.query("ROLLBACK").catch(() => {});
  await source?.query("ROLLBACK").catch(() => {});
  console.error(`Auth migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await target?.end().catch(() => {});
  await source?.end().catch(() => {});
}

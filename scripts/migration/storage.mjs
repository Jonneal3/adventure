#!/usr/bin/env node
// Back up Supabase objects and, with --upload, copy and verify them in S3-compatible storage.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { PutObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import pg from "pg";

const runtime = dotenv.parse(fs.readFileSync("env/.env.shared.local"));
const migration = dotenv.parse(fs.readFileSync("env/.env.migration.local"));
const offline = process.argv.includes("--offline");
const sourceUrl = runtime.NEXT_PUBLIC_SUPABASE_URL;
const sourceKey = runtime.SUPABASE_SECRET_KEY || runtime.SUPABASE_SERVICE_ROLE_KEY;
const projectRef = runtime.ADVENTURE_SUPABASE_PROJECT_REF || new URL(runtime.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
if (!offline && (!sourceUrl || !sourceKey || !projectRef || new URL(sourceUrl).hostname !== `${projectRef}.supabase.co`))
  throw new Error("Source Supabase configuration is incomplete or mismatched");
const sourceDbUrl = migration.ADVENTURE_DATABASE_URL;
if (!offline && (!sourceDbUrl || !(
  new URL(sourceDbUrl).hostname === `db.${projectRef}.supabase.co` ||
  (new URL(sourceDbUrl).hostname.endsWith(".pooler.supabase.com") && decodeURIComponent(new URL(sourceDbUrl).username) === `postgres.${projectRef}`)
)))
  throw new Error("Source database does not match the configured Supabase project");

const root = path.resolve(".local/backups/storage");
fs.mkdirSync(root, { recursive: true, mode: 0o700 });
const source = offline ? null : createClient(sourceUrl, sourceKey, { auth: { persistSession: false } });
const db = offline ? null : new pg.Client({ connectionString: sourceDbUrl, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 15000 });
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const allowedBuckets = new Set((migration.ADVENTURE_STORAGE_BUCKETS || "").split(",").map(value => value.trim()).filter(Boolean));
const target = process.argv.includes("--upload");
if (offline && !target) throw new Error("--offline requires --upload");

let s3;
if (target) {
  const endpoint = process.env.S3_ENDPOINT || migration.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID || migration.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY || migration.S3_SECRET_ACCESS_KEY;
  if (!endpoint || !accessKeyId || !secretAccessKey) throw new Error("S3 target configuration is missing");
  s3 = new S3Client({ endpoint, region: process.env.S3_REGION || migration.S3_REGION || "auto", forcePathStyle: (process.env.S3_FORCE_PATH_STYLE || migration.S3_FORCE_PATH_STYLE) !== "false", credentials: { accessKeyId, secretAccessKey } });
}

try {
  let rows;
  if (offline) {
    const saved = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
    if (!Array.isArray(saved.objects)) throw new Error("Storage manifest is malformed");
    rows = saved.objects.map((object) => ({ bucket_id: object.bucket, name: object.key, mime: object.mime, size: object.bytes, expectedHash: object.sha256 }));
  } else {
    await db.connect();
    await db.query("BEGIN READ ONLY");
    ({ rows } = await db.query("SELECT bucket_id,name,metadata->>'mimetype' AS mime,metadata->>'size' AS size FROM storage.objects ORDER BY bucket_id,name"));
  }
  if (allowedBuckets.size && rows.some((row) => !allowedBuckets.has(row.bucket_id))) throw new Error("An unknown storage bucket needs a migration rule");
  const manifest = [];
  for (const row of rows) {
    const parts = row.name.split("/");
    if (parts.some((part) => !part || part === "." || part === "..")) throw new Error("Unsafe source object key");
    const file = path.join(root, row.bucket_id, ...parts);
    fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
    let bytes;
    if (offline) {
      bytes = fs.readFileSync(file);
    } else {
      // Refresh every object on each pass. A cached file with the same byte length
      // could otherwise hide a source overwrite just before the final cutover.
      const response = await source.storage.from(row.bucket_id).download(row.name);
      if (response.error || !response.data) throw new Error(`Storage download failed for ${row.bucket_id}/${row.name}: ${response.error?.message || "empty response"}`);
      bytes = Buffer.from(await response.data.arrayBuffer());
    }
    if (row.size && bytes.length !== Number(row.size)) throw new Error(`Size mismatch for ${row.bucket_id}/${row.name}`);
    const hash = sha256(bytes);
    if (offline && hash !== row.expectedHash) throw new Error(`Backup checksum mismatch for ${row.bucket_id}/${row.name}`);
    if (!offline) {
      const temporary = `${file}.partial-${process.pid}`;
      try {
        fs.writeFileSync(temporary, bytes, { mode: 0o600 });
        fs.renameSync(temporary, file);
      } finally { fs.rmSync(temporary, { force: true }); }
    }
    if (target) {
      const bucket = process.env.S3_ASSET_BUCKET || migration.S3_ASSET_BUCKET || "adventure-assets";
      const targetKey = `legacy/${row.bucket_id}/${row.name}`;
      await s3.send(new PutObjectCommand({ Bucket: bucket, Key: targetKey, Body: bytes, ContentType: row.mime || "application/octet-stream" }));
      const verified = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: targetKey }));
      if (!verified.Body || sha256(Buffer.from(await verified.Body.transformToByteArray())) !== hash)
        throw new Error(`S3 checksum mismatch for ${row.bucket_id}/${row.name}`);
    }
    manifest.push({ bucket: row.bucket_id, key: row.name, targetKey: `legacy/${row.bucket_id}/${row.name}`, bytes: bytes.length, sha256: hash, mime: row.mime });
  }
  if (!offline) fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify({ projectRef, checkedAt: new Date().toISOString(), objects: manifest }, null, 2), { mode: 0o600 });
  await db?.query("ROLLBACK");
  console.log(JSON.stringify({ mode: target ? "uploaded-and-verified" : "backed-up", objects: manifest.length, bytes: manifest.reduce((sum, item) => sum + item.bytes, 0), manifest: path.join(root, "manifest.json") }));
} catch (error) {
  await db?.query("ROLLBACK").catch(() => {});
  console.error(`Storage migration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await db?.end().catch(() => {});
  s3?.destroy();
}

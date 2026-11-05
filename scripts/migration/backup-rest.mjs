#!/usr/bin/env node
// Interim read-only source snapshot. A pg_dump remains required for schema and password hashes.
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import dotenv from "dotenv";

const env = dotenv.parse(fs.readFileSync("env/.env.shared.local"));
const base = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!base || !key) throw new Error("Source Supabase credentials are required");
const root = path.resolve(".local/backups/rest");
fs.mkdirSync(root, { recursive: true, mode: 0o700 });
const headers = { apikey: key, authorization: `Bearer ${key}` };
const digest = bytes => createHash("sha256").update(bytes).digest("hex");
function save(name, data) {
  const bytes = Buffer.from(JSON.stringify(data));
  const file = path.join(root, name);
  fs.writeFileSync(file, bytes, { mode: 0o600 });
  return { count: data.length, bytes: bytes.length, sha256: digest(bytes) };
}

async function json(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...headers, ...options.headers } });
  if (!response.ok) throw new Error(`Source request failed (${response.status})`);
  return { data: await response.json(), response };
}

const auth = [];
for (let page = 1; ; page++) {
  const { data } = await json(new URL(`/auth/v1/admin/users?page=${page}&per_page=1000`, base));
  if (!Array.isArray(data.users)) throw new Error("Auth user list is malformed");
  auth.push(...data.users);
  if (data.users.length < 1000) break;
}
const manifest = { projectRef: new URL(base).hostname.split(".")[0], capturedAt: new Date().toISOString(), authUsers: save("auth-users.json", auth), tables: {} };
const { data: api } = await json(new URL("/rest/v1/", base), { headers: { accept: "application/openapi+json" } });
const definitions = api.definitions || {};
for (const table of Object.keys(definitions).sort()) {
  const rows = [];
  const ordered = Boolean(definitions[table].properties?.id);
  let expected;
  for (let offset = 0; ; offset += 1000) {
    const url = new URL(`/rest/v1/${encodeURIComponent(table)}?select=*${ordered ? "&order=id.asc" : ""}`, base);
    const { data, response } = await json(url, { headers: { range: `${offset}-${offset + 999}`, prefer: "count=exact" } });
    if (!Array.isArray(data)) throw new Error(`Malformed rows in ${table}`);
    expected = Number(response.headers.get("content-range")?.split("/")[1]);
    if (!Number.isFinite(expected)) throw new Error(`Missing exact count for ${table}`);
    rows.push(...data);
    if (rows.length >= expected || data.length < 1000) break;
  }
  if (rows.length !== expected) throw new Error(`Row count changed during backup for ${table}: ${rows.length}/${expected}`);
  manifest.tables[table] = save(`${table}.json`, rows);
}
fs.writeFileSync(path.join(root, "manifest.json"), JSON.stringify(manifest, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ authUsers: manifest.authUsers.count, tables: Object.keys(manifest.tables).length, rows: Object.values(manifest.tables).reduce((sum, item) => sum + item.count, 0), manifest: path.join(root, "manifest.json") }));

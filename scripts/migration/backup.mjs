#!/usr/bin/env node
// Read-only source backup for the Adventure migration. Archive files are ignored by Git.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

const envFile = "env/.env.migration.local";
const env = fs.existsSync(envFile) ? dotenv.parse(fs.readFileSync(envFile)) : {};
const url = process.env.ADVENTURE_DATABASE_URL || env.ADVENTURE_DATABASE_URL;
if (!url) throw new Error("ADVENTURE_DATABASE_URL is required");
const parsed = new URL(url);
if (!["postgres:", "postgresql:"].includes(parsed.protocol)) throw new Error("Expected PostgreSQL source URL");
const dir = path.resolve(".local/backups");
fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const output = path.join(dir, `adventure-${stamp}.dump`);
const pgEnv = {
  ...process.env,
  PGHOST: parsed.hostname,
  PGPORT: parsed.port || "5432",
  PGDATABASE: parsed.pathname.slice(1) || "postgres",
  PGUSER: decodeURIComponent(parsed.username),
  PGPASSWORD: decodeURIComponent(parsed.password),
  PGSSLMODE: "require",
  PGCONNECT_TIMEOUT: "15",
  PGOPTIONS: "-c default_transaction_read_only=on",
};
const result = spawnSync("pg_dump", ["--format=custom", "--no-owner", "--schema=public", "--schema=auth", "--schema=storage", "--file", output], {
  env: pgEnv, stdio: ["ignore", "ignore", "pipe"], encoding: "utf8", timeout: 300000,
});
if (result.status !== 0) {
  fs.rmSync(output, { force: true });
  throw new Error(`pg_dump failed: ${(result.stderr || "unknown error").slice(0, 500)}`);
}
fs.chmodSync(output, 0o600);
console.log(JSON.stringify({ backup: output, bytes: fs.statSync(output).size, includes: ["public", "auth", "storage metadata"] }));

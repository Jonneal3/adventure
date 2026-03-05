#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { createClient } = require("@supabase/supabase-js");

function parseArgs(argv) {
  const args = {
    instanceId: null,
    accountId: null,
    all: false,
    apply: false,
    limit: 1000,
  };

  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--instance") {
      args.instanceId = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (a === "--account") {
      args.accountId = argv[i + 1] || null;
      i += 1;
      continue;
    }
    if (a === "--all") {
      args.all = true;
      continue;
    }
    if (a === "--apply") {
      args.apply = true;
      continue;
    }
    if (a === "--limit") {
      const n = Number(argv[i + 1]);
      if (!Number.isFinite(n) || n <= 0) throw new Error(`Invalid --limit: ${argv[i + 1]}`);
      args.limit = n;
      i += 1;
      continue;
    }
    if (a === "-h" || a === "--help") {
      return { ...args, help: true };
    }
    throw new Error(`Unknown arg: ${a}`);
  }

  return args;
}

function usage() {
  return `
Compacts \`instances.config\` to the minimal V2 schema (drops deprecated keys).

Usage:
  node scripts/compact-instance-configs-to-v2.js --instance <instanceId> [--apply]
  node scripts/compact-instance-configs-to-v2.js --account <accountId> [--limit 1000] [--apply]
  node scripts/compact-instance-configs-to-v2.js --all [--limit 1000] [--apply]

Options:
  --apply     Actually write updates (default: dry-run)
  --limit N   Max rows to scan (default: 1000)
`.trim();
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function loadTemplate() {
  const templatePath = path.join(process.cwd(), "DESIGN_CONFIG_TEMPLATE_V2.json");
  const raw = fs.readFileSync(templatePath, "utf8");
  const template = JSON.parse(raw);
  if (!isPlainObject(template)) throw new Error("DESIGN_CONFIG_TEMPLATE_V2.json must be a JSON object");
  const keyOrder = Object.keys(template);
  return { template, keyOrder, templatePath };
}

function compactToV2(config, template, keyOrder) {
  const src = isPlainObject(config) ? config : {};
  const out = {};
  for (const k of keyOrder) {
    if (Object.prototype.hasOwnProperty.call(src, k) && src[k] !== undefined) {
      out[k] = src[k];
    } else {
      out[k] = template[k];
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  if (!args.instanceId && !args.accountId && !args.all) {
    console.error("Error: pass one of --instance, --account, or --all\n");
    console.error(usage());
    process.exit(1);
  }

  dotenv.config({ path: path.join(process.cwd(), ".env.local") });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Missing env vars. Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
    process.exit(1);
  }

  const { template, keyOrder, templatePath } = loadTemplate();
  console.log(`Template: ${templatePath}`);
  console.log(`Keys kept: ${keyOrder.length}`);
  console.log(args.apply ? "Mode: APPLY (will write updates)" : "Mode: DRY-RUN (no writes)");

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  let query = supabase.from("instances").select("id, account_id, config");
  if (args.instanceId) query = query.eq("id", args.instanceId);
  if (args.accountId) query = query.eq("account_id", args.accountId);
  query = query.limit(args.limit);

  const { data: rows, error } = await query;
  if (error) {
    console.error("Failed to load instances:", error.message || error);
    process.exit(1);
  }

  const instances = rows || [];
  if (instances.length === 0) {
    console.log("No instances matched.");
    return;
  }

  let changed = 0;
  let written = 0;

  for (const row of instances) {
    const before = row.config;
    const after = compactToV2(before, template, keyOrder);
    const beforeStr = JSON.stringify(before || {});
    const afterStr = JSON.stringify(after);

    if (beforeStr === afterStr) continue;
    changed += 1;

    console.log(`Would compact instance ${row.id} (account ${row.account_id || "null"})`);

    if (!args.apply) continue;

    const { error: updateError } = await supabase
      .from("instances")
      .update({ config: after, updated_at: new Date().toISOString() })
      .eq("id", row.id);

    if (updateError) {
      console.error(`Failed to update ${row.id}:`, updateError.message || updateError);
      continue;
    }

    written += 1;
  }

  console.log(`\nMatched: ${instances.length}`);
  console.log(`Would change: ${changed}`);
  if (args.apply) console.log(`Updated: ${written}`);
  if (!args.apply && changed > 0) {
    console.log("\nRe-run with --apply to write changes.");
  }
}

main().catch((e) => {
  console.error(e?.stack || e?.message || e);
  process.exit(1);
});


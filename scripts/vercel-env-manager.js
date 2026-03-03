#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const REPO_ROOT = path.resolve(__dirname, "..");
const ENV_DIR = path.join(REPO_ROOT, "env");
const SCHEMA_PATH = path.join(ENV_DIR, "schema.json");
const SOURCE_ENV_PATH = path.join(ENV_DIR, ".env.shared.local");
const GENERATED_DIR = path.join(ENV_DIR, "generated");

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function parseArgs(argv) {
  const [, , command, ...rest] = argv;
  if (!command) {
    fail("Missing command. Use one of: doctor, diff, push, pull");
  }

  const options = {};
  for (let i = 0; i < rest.length; i += 1) {
    const token = rest[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = rest[i + 1];
    if (!next || next.startsWith("--")) {
      options[key] = true;
    } else {
      options[key] = next;
      i += 1;
    }
  }
  return { command, options };
}

function loadSchema() {
  if (!fs.existsSync(SCHEMA_PATH)) {
    fail(`Missing schema file at ${SCHEMA_PATH}`);
  }
  return JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const text = fs.readFileSync(filePath, "utf8");
  const out = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function toList(value, fallback) {
  if (!value) return fallback;
  return String(value)
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function selectedApps(schema, options) {
  const all = Object.keys(schema.apps);
  const requested = toList(options.app, all);
  const invalid = requested.filter((app) => !schema.apps[app]);
  if (invalid.length) {
    fail(`Invalid --app value(s): ${invalid.join(", ")}`);
  }
  return requested;
}

function selectedTargets(schema, options) {
  const requested = toList(options.target, schema.targets);
  const invalid = requested.filter((t) => !schema.targets.includes(t));
  if (invalid.length) {
    fail(`Invalid --target value(s): ${invalid.join(", ")}`);
  }
  return requested;
}

function resolveValue(variable, sourceMap) {
  if (Object.prototype.hasOwnProperty.call(sourceMap, variable.name)) {
    return sourceMap[variable.name];
  }
  if (variable.valueFrom && Object.prototype.hasOwnProperty.call(sourceMap, variable.valueFrom)) {
    return sourceMap[variable.valueFrom];
  }
  if (variable.default !== undefined) return String(variable.default);
  return "";
}

function resolveVarsFor(schema, appName, target, sourceMap) {
  const rows = schema.variables.filter(
    (v) => v.apps.includes(appName) && v.targets.includes(target)
  );
  const resolved = [];
  for (const v of rows) {
    const value = resolveValue(v, sourceMap);
    resolved.push({ ...v, value });
  }
  return resolved;
}

function buildFlatLocalMap(sourceMap) {
  const out = {};
  for (const [key, value] of Object.entries(sourceMap)) {
    const normalized = String(value ?? "").trim();
    if (!normalized) continue;
    out[key] = normalized;
  }
  return out;
}

function assertPublicSecretRules(rows) {
  const bad = rows.filter((r) => r.name.startsWith("NEXT_PUBLIC_") && r.secret);
  if (bad.length) {
    fail(`Schema has NEXT_PUBLIC_ vars marked secret: ${bad.map((b) => b.name).join(", ")}`);
  }
}

function getScope(schema, options) {
  return String(options.scope || process.env.VERCEL_SCOPE || schema.teamScope || "").trim();
}

function runVercel(args, cwd, input) {
  const result = spawnSync("vercel", args, {
    cwd,
    input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"]
  });
  return result;
}

function ensureVercelAvailable() {
  const result = spawnSync("vercel", ["--version"], { encoding: "utf8" });
  if (result.status !== 0) {
    fail("Vercel CLI is not available. Install with `npm i -g vercel`.");
  }
}

function appWorkingDirectory(schema, appName) {
  return path.join(REPO_ROOT, schema.apps[appName].directory);
}

function pullRemoteFile(schema, appName, target, scope) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const outPath = path.join(GENERATED_DIR, `${appName}.${target}.env`);
  const cwd = appWorkingDirectory(schema, appName);
  const args = [
    "env",
    "pull",
    outPath,
    "--environment",
    target,
    "--scope",
    scope,
    "--yes"
  ];
  const result = runVercel(args, cwd);
  if (result.status !== 0) {
    fail(
      `Failed to pull env for ${appName}/${target}: ${result.stderr || result.stdout || "unknown error"}`
    );
  }
  return outPath;
}

function commandDoctor(schema, sourceMap, options) {
  const apps = selectedApps(schema, options);
  const targets = selectedTargets(schema, options);
  let missingCount = 0;

  for (const app of apps) {
    for (const target of targets) {
      const rows = resolveVarsFor(schema, app, target, sourceMap);
      assertPublicSecretRules(rows);
      const missing = rows.filter((r) => r.required && !String(r.value || "").trim());
      if (missing.length > 0) {
        missingCount += missing.length;
        console.log(`MISSING ${app}/${target}: ${missing.map((m) => m.name).join(", ")}`);
      }
    }
  }

  if (missingCount > 0) {
    fail(`Doctor found ${missingCount} missing required variable(s).`);
  }
  console.log("Doctor OK: all required variables are present.");
}

function commandDiff(schema, sourceMap, options) {
  const scope = getScope(schema, options);
  if (!scope) fail("Missing scope. Pass --scope or set VERCEL_SCOPE.");
  ensureVercelAvailable();

  const apps = selectedApps(schema, options);
  const targets = selectedTargets(schema, options);

  for (const app of apps) {
    for (const target of targets) {
      const localMap = buildFlatLocalMap(sourceMap);
      const pulledPath = pullRemoteFile(schema, app, target, scope);
      const remoteMap = parseEnvFile(pulledPath);

      const localKeys = Object.keys(localMap);
      const remoteKeys = Object.keys(remoteMap);
      const missingRemote = localKeys.filter((k) => !remoteKeys.includes(k));
      const extraRemote = remoteKeys.filter((k) => !localKeys.includes(k));
      const valueMismatch = localKeys.filter(
        (k) => remoteKeys.includes(k) && String(localMap[k]) !== String(remoteMap[k] || "")
      );

      console.log(`\n=== ${app} / ${target} ===`);
      console.log(`missing_remote: ${missingRemote.length}`);
      if (missingRemote.length) console.log(`  ${missingRemote.join(", ")}`);
      console.log(`extra_remote: ${extraRemote.length}`);
      if (extraRemote.length) console.log(`  ${extraRemote.join(", ")}`);
      console.log(`value_mismatch: ${valueMismatch.length}`);
      if (valueMismatch.length) console.log(`  ${valueMismatch.join(", ")}`);
    }
  }
}

function commandPull(schema, options) {
  const scope = getScope(schema, options);
  if (!scope) fail("Missing scope. Pass --scope or set VERCEL_SCOPE.");
  ensureVercelAvailable();

  const apps = selectedApps(schema, options);
  const targets = selectedTargets(schema, options);
  fs.mkdirSync(GENERATED_DIR, { recursive: true });

  for (const app of apps) {
    for (const target of targets) {
      const outPath = pullRemoteFile(schema, app, target, scope);
      console.log(`Pulled ${app}/${target} -> ${path.relative(REPO_ROOT, outPath)}`);
    }
  }
}

function upsertEnvVar(schema, app, target, scope, name, value, dryRun) {
  const cwd = appWorkingDirectory(schema, app);
  if (dryRun) {
    console.log(`[dry-run] ${app}/${target}: set ${name}`);
    return;
  }

  runVercel(["env", "rm", name, target, "--scope", scope, "--yes"], cwd);
  const addRes = runVercel(
    ["env", "add", name, target, "--value", value, "--scope", scope, "--yes"],
    cwd
  );
  if (addRes.status !== 0) {
    fail(`Failed to set ${name} for ${app}/${target}: ${addRes.stderr || addRes.stdout}`);
  }
}

function removeEnvVar(schema, app, target, scope, name, dryRun) {
  const cwd = appWorkingDirectory(schema, app);
  if (dryRun) {
    console.log(`[dry-run] ${app}/${target}: remove ${name}`);
    return;
  }
  runVercel(["env", "rm", name, target, "--scope", scope, "--yes"], cwd);
}

function commandPush(schema, sourceMap, options) {
  const scope = getScope(schema, options);
  if (!scope) fail("Missing scope. Pass --scope or set VERCEL_SCOPE.");
  ensureVercelAvailable();

  const prune = Boolean(options.prune);
  const dryRun = Boolean(options["dry-run"]);
  const apps = selectedApps(schema, options);
  const targets = selectedTargets(schema, options);

  for (const app of apps) {
    for (const target of targets) {
      const localRows = resolveVarsFor(schema, app, target, sourceMap);
      assertPublicSecretRules(localRows);
      const missingRequired = localRows.filter((r) => r.required && !String(r.value || "").trim());
      if (missingRequired.length) {
        fail(
          `Cannot push ${app}/${target}. Missing required: ${missingRequired
            .map((x) => x.name)
            .join(", ")}`
        );
      }

      const localMap = buildFlatLocalMap(sourceMap);
      const pulledPath = pullRemoteFile(schema, app, target, scope);
      const remoteMap = parseEnvFile(pulledPath);

      console.log(`\n=== pushing ${app} / ${target} ===`);
      for (const [name, value] of Object.entries(localMap)) {
        upsertEnvVar(schema, app, target, scope, name, value, dryRun);
      }

      if (prune) {
        for (const remoteKey of Object.keys(remoteMap)) {
          if (!Object.prototype.hasOwnProperty.call(localMap, remoteKey)) {
            removeEnvVar(schema, app, target, scope, remoteKey, dryRun);
          }
        }
      }

      console.log(
        `Done ${app}/${target} (set ${Object.keys(localMap).length} vars${prune ? ", prune enabled" : ""}).`
      );
    }
  }
}

function loadSourceMap() {
  const master = parseEnvFile(SOURCE_ENV_PATH);
  if (Object.keys(master).length === 0) {
    fail(
      `Missing ${SOURCE_ENV_PATH}. Create it and add your env values before running env commands.`
    );
  }
  return master;
}

function printHelp() {
  console.log(`Usage:
  node scripts/vercel-env-manager.js doctor [--app app1,app2] [--target production] [--scope team]
  node scripts/vercel-env-manager.js diff   [--app app1,app2] [--target production] [--scope team]
  node scripts/vercel-env-manager.js pull   [--app app1,app2] [--target production] [--scope team]
  node scripts/vercel-env-manager.js push   [--app app1,app2] [--target production] [--scope team] [--prune] [--dry-run]
`);
}

function main() {
  const { command, options } = parseArgs(process.argv);
  if (command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  const schema = loadSchema();
  const sourceMap = command === "pull" ? {} : loadSourceMap();

  switch (command) {
    case "doctor":
      commandDoctor(schema, sourceMap, options);
      return;
    case "diff":
      commandDiff(schema, sourceMap, options);
      return;
    case "pull":
      commandPull(schema, options);
      return;
    case "push":
      commandPush(schema, sourceMap, options);
      return;
    default:
      fail(`Unknown command: ${command}`);
  }
}

if (require.main === module) {
  main();
}

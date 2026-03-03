#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const REPO_ROOT = path.resolve(__dirname, "..");
const FILES_TO_DELETE = [
  "adv-designer/.env.local",
  "adv-designer/.env.preview.local",
  "adv-designer/.env.production.local",
  "adv-ai-form-service/.env.example",
  "adv-ai-form-service/.env.local",
  "adv-ai-form-service/.env.local.bak",
  "adv-widget/.env.local"
];

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function main() {
  const sharedEnv = path.join(REPO_ROOT, "env", ".env.shared.local");
  if (!fs.existsSync(sharedEnv)) {
    fail(`Missing ${sharedEnv}. Create it first.`);
  }

  for (const relPath of FILES_TO_DELETE) {
    const absPath = path.join(REPO_ROOT, relPath);
    if (!fs.existsSync(absPath)) {
      console.log(`Already absent: ${relPath}`);
      continue;
    }
    fs.unlinkSync(absPath);
    console.log(`Deleted ${relPath}`);
  }

  console.log("Local app env files removed. Apps now read from env/.env.shared.local directly.");
}

if (require.main === module) {
  main();
}

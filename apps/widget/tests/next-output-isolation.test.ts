import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  PHASE_DEVELOPMENT_SERVER,
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} = require("next/constants") as Record<string, string>;

test("development and production compilers cannot overwrite each other's output", () => {
  const createNextConfig = require("../next.config.js") as (phase: string) => {
    distDir?: string;
  };

  assert.equal(createNextConfig(PHASE_DEVELOPMENT_SERVER).distDir, ".next-dev");
  assert.equal(createNextConfig(PHASE_PRODUCTION_BUILD).distDir, ".next");
  assert.equal(createNextConfig(PHASE_PRODUCTION_SERVER).distDir, ".next");
});

test("development recovery and cleanup scripts target the isolated output", () => {
  const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
    scripts: Record<string, string>;
  };
  const runtimeFix = readFileSync(
    new URL("../scripts/next-runtime-chunk-fix.cjs", import.meta.url),
    "utf8",
  );

  assert.match(packageJson.scripts.predev, /WIDGET_NEXT_DIST_DIR=\.next-dev/);
  assert.match(packageJson.scripts["dev:raw"], /WIDGET_NEXT_DIST_DIR=\.next-dev/);
  assert.match(packageJson.scripts["clean:next"], /['"]\.next-dev['"]/);
  assert.match(runtimeFix, /\/\.next-dev\/server\/webpack-runtime\.js/);
});

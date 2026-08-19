import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const widgetRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

function read(relativePath: string): string {
  return readFileSync(resolve(widgetRoot, relativePath), "utf8");
}

test("V7 remains a code module with no versioned public URL", () => {
  const wrapper = read("components/adventure/v7/index.ts");
  const component = read("components/adventure/v7/AdventureV7Experience.tsx");
  const unversioned = read("app/adventure/[instanceId]/page.tsx");
  const middleware = read("middleware.ts");

  assert.match(wrapper, /AdventureV7Experience/);
  assert.match(component, /export function AdventureV7Experience/);
  assert.match(component, /data-adventure-version="v7"/);

  // Version lives in the code, never in the path the customer sees.
  assert.match(unversioned, /AdventureV8Experience/);
  assert.doesNotMatch(unversioned, /AdventureV7Experience/);
  assert.throws(
    () => read("app/adventure/v7/[instanceId]/page.tsx"),
    /ENOENT/,
    "there should be no /adventure/v7 route"
  );
  assert.match(middleware, /v\(\?:1\|2\|3\|4\|5\|6\|7\|8\)/);
});

test("V7 implements the core configurator stages", () => {
  const component = read("components/adventure/v7/AdventureV7Experience.tsx");
  for (const stage of [
    "service",
    "project",
    "budget",
    "path",
    "inspiration",
    "likes",
    "exploration",
    "refine",
    "email_gate",
    "final",
    "consultation",
    "connect",
  ]) {
    assert.match(component, new RegExp(`"${stage}"`));
  }
  assert.match(component, /What would you like to design today\?/);
  assert.match(component, /These feel right/);
  assert.match(component, /show me some ideas/i);
  assert.match(component, /gate === "a"|gate === "b"|V7GateExperiment/);
});

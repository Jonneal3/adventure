#!/usr/bin/env node
/**
 * Minimal loop tester for the pricing API route.
 *
 * Usage:
 *   node scripts/test-pricing-route.mjs --instanceId <id> --sessionId <sid> [--count 5] [--delayMs 800] [--port 3001]
 */

function getArg(name, fallback = null) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const v = process.argv[idx + 1];
  if (!v || v.startsWith("--")) return fallback;
  return v;
}

const instanceId = getArg("instanceId");
const sessionId = getArg("sessionId");
const count = Number(getArg("count", "5"));
const delayMs = Number(getArg("delayMs", "800"));
const port = Number(getArg("port", "3001"));

if (!instanceId || !sessionId) {
  console.error("Missing required args: --instanceId and --sessionId");
  process.exit(2);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const url = `http://127.0.0.1:${port}/api/ai-form/${encodeURIComponent(instanceId)}/pricing`;

for (let i = 0; i < count; i++) {
  const startedAt = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId,
        useCase: "scene",
        stepDataSoFar: {},
        answeredQA: [],
        askedStepIds: [],
        formState: { schemaVersion: "v1" },
        instanceContext: {},
      }),
    });
    const text = await res.text().catch(() => "");
    const ms = Date.now() - startedAt;

    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {}

    const summary =
      res.ok && json?.estimate
        ? { ok: true, status: res.status, ms, estimate: json.estimate }
        : { ok: res.ok, status: res.status, ms, bodyPreview: text.slice(0, 300) };
    console.log(JSON.stringify({ i: i + 1, ...summary }, null, 2));
  } catch (e) {
    const ms = Date.now() - startedAt;
    console.log(JSON.stringify({ i: i + 1, ok: false, ms, error: e instanceof Error ? e.message : String(e) }, null, 2));
  }

  if (i < count - 1) await sleep(delayMs);
}


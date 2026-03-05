/**
 * Backfill categories_subcategories.service_summary by generating summaries via OpenAI.
 *
 * Usage:
 *   node scripts/backfill-service-summaries-ai.js
 *   node scripts/backfill-service-summaries-ai.js --limit 200 --concurrency 2
 *   node scripts/backfill-service-summaries-ai.js --dry-run
 *   node scripts/backfill-service-summaries-ai.js --force
 *
 * Required env:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 * - OPENAI_API_KEY
 *
 * Optional env:
 * - SERVICE_SUMMARY_MODEL (default: gpt-4o-mini)
 */
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");

require("dotenv").config({ path: ".env.local" });

function parseArgs(argv) {
  const out = {
    limit: 500,
    concurrency: 2,
    dryRun: false,
    force: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--limit") out.limit = Number(argv[++i] || out.limit);
    else if (a === "--concurrency") out.concurrency = Number(argv[++i] || out.concurrency);
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--force") out.force = true;
  }
  return out;
}

function clean(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function makePrompt(serviceName, categoryName, instanceType) {
  const system = [
    "You write short service descriptions in third person.",
    "Output MUST be 2 sentences (max 3). Plain text only.",
    "Tone: overview, simple, complete (not verbose).",
    "",
    "Include these elements:",
    "- What the service is (as a provider offering).",
    "- What types of places it applies to (a few examples).",
    "- What the provider typically provides (high-level deliverables).",
    "- The outcome/goal (why someone buys it).",
    "",
    "Do NOT describe steps/process/logistics.",
    'Avoid words/phrases like: "site visit", "installation", "licensed", "workflow", "assessment", "quote", "scheduling".',
    "Do not mention AI, prompts, SEO, or these instructions.",
  ].join("\n");

  const exampleUser = "SERVICE NAME: Fireplace Design";
  const exampleAssistant =
    "Fireplace design is a service where a provider develops an overall fireplace concept for residential or commercial spaces—such as living rooms, great rooms, bedrooms, patios/outdoor lounges, hotel lobbies, restaurants, and office reception areas. It typically includes recommendations for the fireplace style and placement plus surround/mantel design and materials/finishes so the fireplace fits the space and functions as a cohesive focal point.";

  const user = [
    `SERVICE NAME: ${serviceName}`,
    categoryName ? `CATEGORY: ${categoryName}` : "",
    instanceType ? `TYPE: ${instanceType}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    system,
    messages: [
      { role: "user", content: exampleUser },
      { role: "assistant", content: exampleAssistant },
      { role: "user", content: user },
    ],
  };
}

async function runWithConcurrency(items, concurrency, fn) {
  const queue = items.slice();
  const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift();
      if (!item) return;
      // eslint-disable-next-line no-await-in-loop
      await fn(item);
    }
  });
  await Promise.all(workers);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const provider = (process.env.SERVICE_SUMMARY_PROVIDER || "openai").toLowerCase();
  const model =
    process.env.SERVICE_SUMMARY_MODEL ||
    (provider === "groq" ? "llama-3.1-8b-instant" : "gpt-4o-mini");
  const openaiKey = process.env.OPENAI_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  if (!supabaseUrl || !supabaseKey) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  if (provider === "openai" && !openaiKey) throw new Error("Missing OPENAI_API_KEY");
  if (provider === "groq" && !groqKey) throw new Error("Missing GROQ_API_KEY");

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const openai =
    provider === "groq"
      ? new OpenAI({ apiKey: groqKey, baseURL: "https://api.groq.com/openai/v1" })
      : new OpenAI({ apiKey: openaiKey });

  // Pull candidates (service/both), where summary is null/empty, unless --force.
  let query = supabase
    .from("categories_subcategories")
    .select("id,subcategory,category_id,instance_type,service_summary")
    .in("instance_type", ["service", "both"])
    .limit(args.limit)
    .order("updated_at", { ascending: false });

  if (!args.force) {
    // service_summary is NULL OR empty string
    query = query.or('service_summary.is.null,service_summary.eq.""');
  }

  const { data: rows, error } = await query;
  if (error) throw error;

  const items = (rows || []).filter((r) => r?.id && r?.subcategory);
  const categoryIds = Array.from(new Set(items.map((r) => r.category_id).filter(Boolean)));

  const categoryNameById = new Map();
  if (categoryIds.length > 0) {
    const { data: cats, error: catErr } = await supabase
      .from("categories")
      .select("id,name")
      .in("id", categoryIds);
    if (catErr) throw catErr;
    for (const c of cats || []) {
      categoryNameById.set(c.id, c.name);
    }
  }

  console.log(`🔎 Found ${items.length} subcategories to generate (limit=${args.limit}, force=${args.force})`);
  if (args.dryRun) {
    console.log("🧪 Dry run enabled. No rows will be updated.");
  }

  let done = 0;
  let updated = 0;
  let failed = 0;

  await runWithConcurrency(items, args.concurrency, async (row) => {
    const serviceName = clean(row.subcategory);
    const categoryName = clean(categoryNameById.get(row.category_id) || "");
    const instanceType = clean(row.instance_type || "service");

    try {
      const { system, messages } = makePrompt(serviceName, categoryName, instanceType);
      const completion = await openai.chat.completions.create({
        model,
        messages: [{ role: "system", content: system }, ...messages],
        temperature: 0.2,
        max_tokens: 170,
      });
      const text = clean(completion.choices?.[0]?.message?.content || "").slice(0, 600);
      if (!text) throw new Error("empty completion");

      if (!args.dryRun) {
        // If not force, avoid overwriting something that got filled concurrently.
        let upd = supabase.from("categories_subcategories").update({ service_summary: text }).eq("id", row.id);
        if (!args.force) {
          upd = upd.or('service_summary.is.null,service_summary.eq.""');
        }
        const { error: updErr } = await upd;
        if (updErr) throw updErr;
        updated += 1;
      }
    } catch (e) {
      failed += 1;
      const msg = e?.message || String(e);
      console.error(`❌ Failed for "${serviceName}" (${row.id}): ${msg}`);
    } finally {
      done += 1;
      if (done % 10 === 0 || done === items.length) {
        console.log(`✅ Progress ${done}/${items.length} | updated=${updated} failed=${failed}`);
      }
      // gentle pacing to avoid rate spikes when concurrency > 1
      await sleep(150);
    }
  });

  console.log(`🎉 Complete. updated=${updated} failed=${failed}`);
}

run().catch((err) => {
  console.error("❌ Backfill failed:", err);
  process.exit(1);
});


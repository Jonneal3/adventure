/**
 * Update categories_subcategories.service_summary using an LLM + a custom prompt.
 *
 * Typical usage (line-by-line, no local cache) from the root CSV (writes directly to Supabase):
 *   node scripts/update-service-summaries-from-prompt.js \
 *     --input "categories_subcategories_rows (7).csv" \
 *     --system-file scripts/service-summary.prompt.txt \
 *     --provider openrouter \
 *     --model openai/gpt-oss-120b \
 *     --limit 200
 *
 * Update a single row:
 *   node scripts/update-service-summaries-from-prompt.js --id <uuid> --prompt "Rewrite this summary..."
 *
 * Required env:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY
 *
 * Provider API keys:
 * - openai:      OPENAI_API_KEY (or SERVICE_SUMMARY_API_KEY)
 * - groq:        GROQ_API_KEY (or SERVICE_SUMMARY_API_KEY)
 * - openrouter:  OPENROUTER_API_KEY (or SERVICE_SUMMARY_API_KEY)
 *
 * Notes:
 * - CSV mode uses the CSV as an ID list; it fetches current rows from Supabase and updates Supabase directly.
 * - Supabase mode (no --input) queries Supabase and updates rows directly.
 * - By default it only fills missing summaries (NULL/empty). Use --force to overwrite.
 * - Default concurrency is 1 to process rows line-by-line.
 */

const fs = require("fs");
const path = require("path");
const OpenAI = require("openai");
const { createClient } = require("@supabase/supabase-js");
const csv = require("csv-parser");

require("dotenv").config({ path: ".env.local" });

function parseArgs(argv) {
  const out = {
    id: null,
    slug: null,
    limit: 200,
    concurrency: 1,
    dryRun: false,
    force: false,
    provider: null,
    model: null,
    input: null,
    output: null,
    system: null,
    systemFile: null,
    updateSupabase: false,
    noOutput: false,
    report: false,
    instanceTypes: "service,both",
    sentencesMin: 3,
    sentencesMax: 4,
    temperature: 0.35,
    presencePenalty: 0.35,
    frequencyPenalty: 0.55,
    maxAttempts: 5,
    maxChars: 900,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--id") out.id = argv[++i] || out.id;
    else if (a === "--slug") out.slug = argv[++i] || out.slug;
    else if (a === "--limit") out.limit = Number(argv[++i] || out.limit);
    else if (a === "--concurrency") out.concurrency = Number(argv[++i] || out.concurrency);
    else if (a === "--max-chars") out.maxChars = Number(argv[++i] || out.maxChars);
    else if (a === "--provider") out.provider = argv[++i] || out.provider;
    else if (a === "--model") out.model = argv[++i] || out.model;
    else if (a === "--input") out.input = argv[++i] || out.input;
    else if (a === "--output") out.output = argv[++i] || out.output;
    else if (a === "--system") out.system = argv[++i] || out.system;
    else if (a === "--system-file") out.systemFile = argv[++i] || out.systemFile;
    else if (a === "--update-supabase") out.updateSupabase = true;
    else if (a === "--no-output") out.noOutput = true;
    else if (a === "--report") out.report = true;
    else if (a === "--instance-types") out.instanceTypes = argv[++i] || out.instanceTypes;
    else if (a === "--sentences-min") out.sentencesMin = Number(argv[++i] || out.sentencesMin);
    else if (a === "--sentences-max") out.sentencesMax = Number(argv[++i] || out.sentencesMax);
    else if (a === "--temperature") out.temperature = Number(argv[++i] || out.temperature);
    else if (a === "--presence-penalty") out.presencePenalty = Number(argv[++i] || out.presencePenalty);
    else if (a === "--frequency-penalty") out.frequencyPenalty = Number(argv[++i] || out.frequencyPenalty);
    else if (a === "--max-attempts") out.maxAttempts = Number(argv[++i] || out.maxAttempts);
    else if (a === "--dry-run") out.dryRun = true;
    else if (a === "--force") out.force = true;
  }
  return out;
}

function clean(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function parseInstanceTypes(flag) {
  const raw = clean(flag || "");
  if (!raw) return { all: false, list: ["service", "both"] };
  if (raw.toLowerCase() === "all") return { all: true, list: [] };
  const list = raw
    .split(",")
    .map((s) => clean(s).toLowerCase())
    .filter(Boolean);
  return { all: false, list };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function renderTemplate(tpl, ctx) {
  return String(tpl || "").replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = ctx?.[key];
    return v == null ? "" : String(v);
  });
}

function loadSystemPrompt(args) {
  if (args.system && clean(args.system)) return String(args.system);
  if (args.systemFile) {
    const p = String(args.systemFile);
    if (!fs.existsSync(p)) throw new Error(`Prompt file not found: ${p}`);
    return fs.readFileSync(p, "utf8");
  }
  // Default system prompt (matches the "reverse engineered" instructions).
  return [
    "Write a short, clear description of what a [SERVICE NAME] is as a provider offering.",
    "Output must be 3–4 sentences, third person, plain text.",
    "Include: (1) what the service is, (2) what types of places it applies to (give a few examples), (3) what the provider typically provides (high‑level deliverables), and (4) the outcome/goal.",
    "Do NOT describe steps/process/logistics.",
    'Avoid “site visit”, “installation”, “licensed”, “workflow”, “assessment”, “quote”, “scheduling”.',
    "",
    "Uniqueness requirement:",
    "- Do not reuse stock phrasing across services (vary sentence structure and openings).",
    "- Use specific, service-relevant deliverables and examples; avoid generic filler.",
  ].join("\n");
}

function getProviderConfig(args) {
  const provider = (args.provider || process.env.SERVICE_SUMMARY_PROVIDER || "openrouter").toLowerCase();
  const model =
    args.model ||
    process.env.SERVICE_SUMMARY_MODEL ||
    (provider === "groq" ? "llama-3.1-8b-instant" : provider === "openai" ? "gpt-4o-mini" : "openai/gpt-oss-120b");

  const apiKey =
    process.env.SERVICE_SUMMARY_API_KEY ||
    (provider === "openai"
      ? process.env.OPENAI_API_KEY
      : provider === "groq"
        ? process.env.GROQ_API_KEY
        : provider === "openrouter"
          ? process.env.OPENROUTER_API_KEY
          : null);

  const baseURL =
    process.env.SERVICE_SUMMARY_BASE_URL ||
    (provider === "groq"
      ? "https://api.groq.com/openai/v1"
      : provider === "openrouter"
        ? "https://openrouter.ai/api/v1"
        : null);

  if (!apiKey) {
    throw new Error(
      `Missing API key for provider "${provider}". Set SERVICE_SUMMARY_API_KEY or the provider-specific key.`,
    );
  }

  return { provider, model, apiKey, baseURL };
}

function hash32(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickStyleHint(serviceName) {
  const hints = [
    "Vary phrasing; do not start with “X is a service that…”.",
    "Prefer a concise definition, then examples, then deliverables + outcome.",
    "Use an active, provider-offering framing (avoid marketing fluff).",
    "Use domain-appropriate deliverables (documents, plans, designs, campaigns, etc.).",
    "Avoid repeating the word “helps” multiple times.",
    "Use examples of places that fit the service (residential + commercial when relevant).",
    "Keep sentences crisp; avoid long lists or run-ons.",
  ];
  const idx = hash32(serviceName || "") % hints.length;
  return hints[idx];
}

function countSentences(text) {
  const s = String(text || "")
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean);
  return s.length;
}

function pickExactSentenceCount(serviceName, sentencesMin, sentencesMax) {
  const min = Math.max(1, Number(sentencesMin || 1));
  const max = Math.max(min, Number(sentencesMax || min));
  const span = max - min + 1;
  if (span <= 1) return min;
  return min + (hash32(serviceName || "") % span);
}

function makeMessages({ systemPrompt, row, categoryName, sentencesMin, sentencesMax }) {
  const serviceName = clean(row.subcategory || row.service || row.name);
  const instanceType = clean(row.instance_type || "service");
  const currentSummary = clean(row.service_summary || "");
  const ctx = {
    id: row.id,
    slug: row.slug,
    serviceName,
    subcategory: serviceName,
    categoryName: clean(categoryName || ""),
    instanceType,
    currentSummary,
  };

  const targetSentences = pickExactSentenceCount(serviceName, sentencesMin, sentencesMax);
  const system = [
    String(systemPrompt || "").trim(),
    "",
    `Sentence count MUST be exactly ${targetSentences} sentences.`,
    `Style hint: ${pickStyleHint(serviceName)}`,
    "",
    "Output ONLY the service_summary text (plain text, no markdown, no quotes).",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    system,
    messages: [
      {
        role: "user",
        content: "SERVICE NAME: Fireplace Design",
      },
      {
        role: "assistant",
        content:
          "Fireplace design is a service where a provider develops an overall fireplace concept for residential or commercial spaces—such as living rooms, great rooms, bedrooms, patios/outdoor lounges, hotel lobbies, restaurants, and office reception areas. It typically includes recommendations for the fireplace style and placement plus surround/mantel design and materials/finishes so the fireplace fits the space and functions as a cohesive focal point.",
      },
      {
        role: "user",
        content: [
          `SERVICE NAME: ${serviceName || "(unknown)"}`,
          ctx.categoryName ? `CATEGORY: ${ctx.categoryName}` : null,
          ctx.instanceType ? `TYPE: ${ctx.instanceType}` : null,
          ctx.currentSummary ? `CURRENT SUMMARY (may be empty): ${ctx.currentSummary}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    targetSentences,
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

function q(s) {
  const v = String(s ?? "");
  return `"${v.replace(/"/g, '""')}"`;
}

async function readCsvRows(inputPath) {
  if (!fs.existsSync(inputPath)) throw new Error(`Input not found: ${inputPath}`);

  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(inputPath)
      .pipe(csv())
      .on("data", (r) => rows.push(r))
      .on("end", resolve)
      .on("error", reject);
  });
  return rows;
}

function normalizeCsvRow(r) {
  const id = r.id || r.subcategory_id || r.uuid || null;
  const slug = r.slug || null;
  const instanceType = (r.instance_type || r.type || "").trim();
  const subcategory = r.subcategory || r.service || r.name || "";
  const categoryId = r.category_id || r.categoryId || null;
  const serviceSummary = r.service_summary || r.serviceSummary || "";
  return {
    id,
    slug,
    instance_type: instanceType,
    subcategory,
    category_id: categoryId,
    service_summary: serviceSummary,
  };
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  const systemPrompt = loadSystemPrompt(args);
  const { provider, model, apiKey, baseURL } = getProviderConfig(args);
  const instanceTypeFilter = parseInstanceTypes(args.instanceTypes);

  const client = new OpenAI({
    apiKey,
    baseURL: baseURL || undefined,
    defaultHeaders: {
      "Cache-Control": "no-store",
      Pragma: "no-cache",
    },
  });

  const isCsvMode = !!args.input;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const hasSupabaseEnv = !!(supabaseUrl && supabaseKey);

  if (!hasSupabaseEnv) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  let items = [];
  if (isCsvMode) {
    const inputPath = String(args.input);
    const rawRows = await readCsvRows(inputPath);
    const normalized = rawRows.map(normalizeCsvRow).filter((r) => !!r.id);
    const ids = Array.from(new Set(normalized.map((r) => String(r.id))));
    const limitedIds = ids.slice(0, args.limit);

    // Fetch current rows from Supabase by id (CSV is only a guide).
    const fetched = [];
    for (const batch of chunk(limitedIds, 250)) {
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await supabase
        .from("categories_subcategories")
        .select("id,slug,subcategory,category_id,instance_type,service_summary")
        .in("id", batch);
      if (error) throw error;
      for (const r of data || []) fetched.push(r);
    }

    if (args.report) {
      const fetchedIds = new Set((fetched || []).map((r) => String(r.id)));
      const missingIds = limitedIds.filter((id) => !fetchedIds.has(String(id)));
      const byType = new Map();
      for (const r of fetched) {
        const t = clean(r.instance_type || "(null)");
        byType.set(t, (byType.get(t) || 0) + 1);
      }
      const blankCount = fetched.filter((r) => clean(r.service_summary).length === 0).length;
      console.log(`🧾 Report (CSV → Supabase)`);
      console.log(`- CSV rows: ${rawRows.length}`);
      console.log(`- CSV IDs (non-empty): ${normalized.length}`);
      console.log(`- CSV IDs (unique, limited): ${limitedIds.length}`);
      console.log(`- Found in Supabase: ${fetched.length}`);
      console.log(`- Missing in Supabase: ${missingIds.length}`);
      console.log(`- Blank service_summary (found rows): ${blankCount}`);
      console.log(`- instance_type breakdown:`);
      for (const [t, c] of Array.from(byType.entries()).sort((a, b) => b[1] - a[1])) {
        console.log(`  - ${t}: ${c}`);
      }
      console.log(
        `- Filter: instance_types=${instanceTypeFilter.all ? "all" : instanceTypeFilter.list.join(",")} force=${args.force}`,
      );
      return;
    }

    const filtered = fetched
      .filter((r) => r?.id && clean(r.subcategory))
      .filter((r) => {
        if (instanceTypeFilter.all) return true;
        const t = clean(r.instance_type || "").toLowerCase();
        return instanceTypeFilter.list.includes(t);
      });

    items = filtered.filter((r) => (args.force ? true : clean(r.service_summary).length === 0));
  } else {
    let query = supabase
      .from("categories_subcategories")
      .select("id,slug,subcategory,category_id,instance_type,service_summary")
      .order("updated_at", { ascending: false })
      .limit(args.limit);

    if (!instanceTypeFilter.all) {
      query = query.in("instance_type", instanceTypeFilter.list);
    }

    if (args.id) query = query.eq("id", args.id).limit(1);
    if (args.slug) query = query.eq("slug", args.slug).limit(1);

    if (!args.force) {
      query = query.or('service_summary.is.null,service_summary.eq.""');
    }

    const { data: rows, error } = await query;
    if (error) throw error;
    items = (rows || []).filter((r) => r?.id && r?.subcategory);
  }

  const categoryIds = Array.from(new Set(items.map((r) => r.category_id).filter(Boolean)));
  const categoryNameById = new Map();
  if (categoryIds.length > 0) {
    const { data: cats, error: catErr } = await supabase.from("categories").select("id,name").in("id", categoryIds);
    if (catErr) throw catErr;
    for (const c of cats || []) categoryNameById.set(c.id, c.name);
  }

  console.log(
    `🔎 Found ${items.length} row(s) to update (mode=${isCsvMode ? "csv→supabase" : "supabase"}, provider=${provider}, model=${model}, concurrency=${args.concurrency}, force=${args.force})`,
  );
  if (args.dryRun) console.log("🧪 Dry run enabled. No rows will be updated.");
  if (isCsvMode) {
    console.log(`🧾 CSV input: ${args.input}`);
    console.log("🗄️  Updating Supabase directly (CSV is used only for IDs).");
  }

  let done = 0;
  let updated = 0;
  let failed = 0;

  const generatedById = new Map();

  await runWithConcurrency(items, args.concurrency, async (row) => {
    const serviceName = clean(row.subcategory);
    const categoryName = categoryNameById.get(row.category_id) || "";

    try {
      const { system, messages, targetSentences } = makeMessages({
        systemPrompt,
        row,
        categoryName,
        sentencesMin: args.sentencesMin,
        sentencesMax: args.sentencesMax,
      });
      const maxAttempts = Math.max(1, Number(args.maxAttempts || 1));
      let text = "";
      let lastSc = 0;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const nudge =
          attempt <= 1
            ? null
            : attempt === 2
              ? `Try again. Output MUST be exactly ${targetSentences} sentences. Plain text only.`
              : `Try again. You must output exactly ${targetSentences} sentences, each ending with a period. If you're short on sentences, add another sentence that states a typical deliverable and/or outcome for this service. Plain text only.`;
        // eslint-disable-next-line no-await-in-loop
        const completion = await client.chat.completions.create({
          model,
          messages: [
            { role: "system", content: system },
            ...messages,
            ...(nudge ? [{ role: "user", content: nudge }] : []),
          ],
          temperature: args.temperature,
          max_tokens: 340,
          presence_penalty: args.presencePenalty,
          frequency_penalty: args.frequencyPenalty,
        });

        text = clean(completion.choices?.[0]?.message?.content || "").slice(0, Math.max(1, args.maxChars));
        if (!text) {
          // eslint-disable-next-line no-continue
          continue;
        }
        lastSc = countSentences(text);
        if (lastSc === targetSentences) break;
      }

      if (!text) throw new Error("empty completion");
      if (lastSc !== targetSentences) {
        throw new Error(`unexpected sentence count (${lastSc}), expected ${targetSentences}`);
      }

      if (row.id) generatedById.set(String(row.id), text);

      if (!args.dryRun) {
        let upd = supabase.from("categories_subcategories").update({ service_summary: text }).eq("id", row.id);
        if (!args.force) {
          upd = upd.or('service_summary.is.null,service_summary.eq.""');
        }
        const { error: updErr } = await upd;
        if (updErr) throw updErr;
      }

      updated += 1;
      console.log(`✅ ${serviceName}${row.id ? ` (${row.id})` : ""}`);
    } catch (e) {
      failed += 1;
      const msg = e?.message || String(e);
      console.error(`❌ Failed for "${serviceName}"${row.id ? ` (${row.id})` : ""}: ${msg}`);
    } finally {
      done += 1;
      if (done % 10 === 0 || done === items.length) {
        console.log(`📈 Progress ${done}/${items.length} | updated=${updated} failed=${failed}`);
      }
      await sleep(160);
    }
  });

  if (isCsvMode && !args.dryRun && !args.noOutput && args.output) {
    const outPath = String(args.output);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    const header = "id,subcategory,service_summary\n";
    const lines = items
      .filter((r) => clean(r.subcategory))
      .map((r) => [q(r.id || ""), q(r.subcategory || ""), q(generatedById.get(String(r.id)) || "")].join(","))
      .join("\n");
    fs.writeFileSync(outPath, header + lines + "\n", "utf8");
    console.log(`🧾 Wrote generated output to ${outPath}`);
  }

  console.log(`🎉 Complete. updated=${updated} failed=${failed}`);
}

run().catch((err) => {
  console.error("❌ Update failed:", err);
  process.exit(1);
});

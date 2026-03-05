/**
 * Backfill categories_subcategories.service_summary from a generated CSV.
 *
 * Default input: scripts/service_summaries.generated.csv
 *
 * Usage:
 *   node scripts/backfill-service-summaries-to-supabase.js \
 *     --input "scripts/service_summaries.generated.csv" \
 *     --force
 *
 * Notes:
 * - Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 * - Loads `.env.local` automatically for local runs.
 */
const fs = require('fs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseArgs(argv) {
  const out = { input: 'scripts/service_summaries.generated.csv', force: false, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input') out.input = argv[++i];
    else if (a === '--force') out.force = true;
    else if (a === '--dry-run') out.dryRun = true;
  }
  return out;
}

function isBlank(v) {
  return v == null || String(v).trim() === '';
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

async function loadSummaries(inputPath) {
  if (!fs.existsSync(inputPath)) {
    throw new Error(`Input not found: ${inputPath}`);
  }

  const map = new Map();
  await new Promise((resolve, reject) => {
    fs.createReadStream(inputPath)
      .pipe(csv())
      .on('data', (row) => {
        const id = String(row.id || '').trim();
        const summary = String(row.service_summary || '').trim();
        if (id && summary) map.set(id, summary);
      })
      .on('end', resolve)
      .on('error', reject);
  });

  return map;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const map = await loadSummaries(args.input);
  const ids = Array.from(map.keys());

  console.log(`📥 Loaded ${ids.length} service summaries from ${args.input}`);

  const batchSize = 100;
  let scanned = 0;
  let toUpdate = 0;
  let updated = 0;

  for (let i = 0; i < ids.length; i += batchSize) {
    const idBatch = ids.slice(i, i + batchSize);
    const { data: existingRows, error: selectError } = await supabase
      .from('categories_subcategories')
      .select('id,service_summary')
      .in('id', idBatch);

    if (selectError) {
      throw selectError;
    }

    scanned += idBatch.length;

    const updates = (existingRows || [])
      .filter((r) => {
        if (!r?.id) return false;
        if (args.force) return true;
        return isBlank(r.service_summary);
      })
      .map((r) => ({
        id: r.id,
        service_summary: map.get(r.id),
      }))
      .filter((r) => !!r.id && !isBlank(r.service_summary));

    toUpdate += updates.length;

    if (updates.length === 0) continue;
    if (args.dryRun) continue;

    // Use UPDATE (not upsert) so we never accidentally INSERT an incomplete row.
    await runWithConcurrency(updates, 10, async (u) => {
      const { error: updateError } = await supabase
        .from('categories_subcategories')
        .update({ service_summary: u.service_summary })
        .eq('id', u.id);
      if (updateError) throw updateError;
    });

    updated += updates.length;
    console.log(`✅ Updated ${updated}/${toUpdate} (scanned ${scanned}/${ids.length})`);
  }

  if (args.dryRun) {
    console.log(`🧪 Dry run complete. Would update ${toUpdate} rows.`);
  } else {
    console.log(`🎉 Backfill complete. Updated ${updated} rows.`);
  }
}

run().catch((err) => {
  console.error('❌ Backfill failed:', err);
  process.exit(1);
});


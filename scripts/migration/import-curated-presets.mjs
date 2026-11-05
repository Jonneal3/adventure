#!/usr/bin/env node
// Imports explicitly approved service ranges; never fabricates defaults.
import fs from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';
import { servicePresetSchema } from '@adventure/experience';

const path = process.argv[2];
if (!path) throw new Error('Usage: node scripts/migration/import-curated-presets.mjs <approved-presets.json>');
const presets = servicePresetSchema.array().parse(JSON.parse(fs.readFileSync(path, 'utf8')));
if (new Set(presets.map(preset => preset.id)).size !== presets.length) throw new Error('Duplicate curated service ID');
if (presets.some(preset => !preset.defaultRange || preset.defaultRange.source !== 'curated')) throw new Error('Every curated preset needs an approved curated USD range');
const env = fs.existsSync('env/.env.migration.local') ? dotenv.parse(fs.readFileSync('env/.env.migration.local')) : {};
const url = process.env.ADVENTURE_TARGET_DATABASE_URL || env.ADVENTURE_TARGET_DATABASE_URL;
if (!url || new URL(url).hostname.endsWith('.supabase.co')) throw new Error('A separate Adventure target database is required');
const client = new pg.Client({ connectionString: url, ssl: ['localhost','127.0.0.1'].includes(new URL(url).hostname) ? undefined : { rejectUnauthorized: true } });
try {
  await client.connect(); await client.query('BEGIN');
  for (const preset of presets) {
    const service = await client.query(`SELECT id FROM public.categories_subcategories WHERE id=$1 AND category_id=$2 AND account_id IS NULL AND instance_type='service'`, [preset.id, preset.industryId]);
    if (service.rowCount !== 1) throw new Error(`Curated service ${preset.id} is missing or account-owned`);
    await client.query(`INSERT INTO adventure_service_presets (service_id,industry_id,visual_job,default_range,elements,curated_at)
      VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,now()) ON CONFLICT (service_id) DO UPDATE SET
      industry_id=excluded.industry_id,visual_job=excluded.visual_job,default_range=excluded.default_range,elements=excluded.elements,curated_at=now()`,
      [preset.id, preset.industryId, preset.visualJob, JSON.stringify(preset.defaultRange), JSON.stringify(preset.elements)]);
  }
  await client.query('COMMIT');
  console.log(JSON.stringify({ imported: presets.length }));
} catch (error) { await client.query('ROLLBACK').catch(() => {}); console.error(`Preset import failed: ${error.message}`); process.exitCode = 1; }
finally { await client.end().catch(() => {}); }

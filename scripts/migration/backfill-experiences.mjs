#!/usr/bin/env node
// Run only after source parity checks and Adventure application tables are installed.
// Legacy flow JSON stays immutable in public.instances and is copied into audit data.
import fs from 'node:fs';
import dotenv from 'dotenv';
import pg from 'pg';
import { composeExperience } from '@adventure/experience';

const local = fs.existsSync('env/.env.migration.local') ? dotenv.parse(fs.readFileSync('env/.env.migration.local')) : {};
const url = process.env.ADVENTURE_TARGET_DATABASE_URL || local.ADVENTURE_TARGET_DATABASE_URL;
if (!url || new URL(url).hostname.endsWith('.supabase.co')) throw new Error('A separate Adventure target database is required');
const client = new pg.Client({ connectionString: url, ssl: ['localhost','127.0.0.1'].includes(new URL(url).hostname) ? undefined : { rejectUnauthorized: true } });
const report = { accounts: 0, converted: 0, skipped: [] };
try {
  await client.connect();
  const accounts = await client.query('SELECT id FROM public.accounts ORDER BY id');
  for (const account of accounts.rows) {
    await client.query(`INSERT INTO adventure_account_billing (account_id,plan_code,status,period_end,trial_ends_at)
      VALUES ($1,'usage','trialing',now()+interval '30 days',now()+interval '30 days') ON CONFLICT (account_id) DO NOTHING`, [account.id]);
    report.accounts++;
  }
  const instances = await client.query(`SELECT i.id,i.account_id,i.config,i.instance_type,i.use_case,
    jsonb_agg(jsonb_build_object('id',s.id,'industryId',s.category_id,'name',s.subcategory,'instanceType',s.instance_type)
      ORDER BY s.subcategory) FILTER (WHERE s.id IS NOT NULL) AS services
    FROM public.instances i LEFT JOIN public.instance_subcategories link ON link.instance_id=i.id
    LEFT JOIN public.categories_subcategories s ON s.id=link.category_subcategory_id
    GROUP BY i.id ORDER BY i.id`);
  for (const item of instances.rows) {
    if (!item.account_id || item.instance_type === 'ecomm') { report.skipped.push({ id: item.id, reason: 'No owner account or ecommerce' }); continue; }
    const services = item.services || [];
    const industryId = services[0]?.industryId;
    if (!industryId || services.some(service => service.industryId !== industryId || service.instanceType === 'ecomm')) { report.skipped.push({ id: item.id, reason: 'Services cannot be mapped to one service industry' }); continue; }
    const kind = /try.?on/i.test(String(item.use_case)) ? 'tryon' : /scene/i.test(String(item.use_case)) ? 'scene' : 'none';
    const presets = services.map(service => ({ id: service.id, industryId, name: service.name, visualJob: kind, defaultRange: null, elements: [] }));
    const draft = composeExperience(industryId, presets);
    await client.query(`INSERT INTO adventure_experiences (instance_id,account_id,draft,legacy_config)
      VALUES ($1,$2,$3::jsonb,$4::jsonb) ON CONFLICT (instance_id) DO NOTHING`,
      [item.id, item.account_id, JSON.stringify(draft), JSON.stringify({ config: item.config, instanceType: item.instance_type, useCase: item.use_case })]);
    report.converted++;
  }
  console.log(JSON.stringify(report));
} catch (error) { console.error(`Experience backfill failed: ${error.message}`); process.exitCode = 1; }
finally { await client.end().catch(() => {}); }

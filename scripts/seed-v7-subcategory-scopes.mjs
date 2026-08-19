#!/usr/bin/env node
/**
 * Seed / repair categories_subcategories.subcategory_scope for Adventure V7 Focus.
 * Focus = parts checklist (10–20 elements) + Other. "Full renovation" is a UI
 * select-all control, not a stored row (unless already present as a part label).
 *
 * Usage:
 *   node scripts/seed-v7-subcategory-scopes.mjs           # dry-run
 *   node scripts/seed-v7-subcategory-scopes.mjs --apply   # write
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  for (const rel of ["env/.env.shared.local", ".env", "apps/widget/.env.local"]) {
    const p = resolve(process.cwd(), rel);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split("\n")) {
      if (!line || line.trim().startsWith("#") || !line.includes("=")) continue;
      const i = line.indexOf("=");
      const k = line.slice(0, i).trim();
      let v = line.slice(i + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      if (!(k in process.env)) process.env[k] = v;
    }
  }
}

loadEnv();

const APPLY = process.argv.includes("--apply");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

/** Element-level parts customers can multi-select (not coarse area buckets). */
const DEFAULTS_BY_HINT = [
  {
    hints: [/bathroom|bath remodel|powder/i],
    scopes: [
      "Shower / tub",
      "Vanity",
      "Cabinets & storage",
      "Countertop",
      "Toilet",
      "Floor tile",
      "Wall tile",
      "Faucets & fixtures",
      "Lighting",
      "Mirror / medicine cabinet",
      "Paint & trim",
      "Hardware",
      "Exhaust fan",
      "Flooring (non-tile)",
      "Layout changes",
      "Plumbing updates",
    ],
  },
  {
    hints: [/outdoor kitchen/i],
    scopes: [
      "Grill / cooking station",
      "Outdoor counters",
      "Bar / seating",
      "Sink & faucet",
      "Fridge / storage",
      "Pizza oven",
      "Shade / cover",
      "Lighting",
      "Utilities (gas / electric)",
      "Flooring / pavers",
    ],
  },
  {
    hints: [/kitchen/i],
    scopes: [
      "Cabinets",
      "Countertops",
      "Backsplash",
      "Island",
      "Sink & faucet",
      "Appliances",
      "Lighting",
      "Flooring",
      "Hardware",
      "Paint",
      "Pantry",
      "Layout changes",
      "Plumbing updates",
      "Electrical updates",
    ],
  },
  {
    hints: [/flooring|floor /i],
    scopes: [
      "Living areas",
      "Kitchen",
      "Bathrooms",
      "Bedrooms",
      "Hallways",
      "Stairs",
      "Basement",
      "Entry / mudroom",
      "Transitions & trim",
    ],
  },
  {
    hints: [/garden design/i],
    scopes: [
      "Patio / terrace",
      "Walkways & paths",
      "Lawn",
      "Planting beds",
      "Trees & shrubs",
      "Privacy planting",
      "Outdoor seating areas",
      "Lighting",
      "Water feature",
      "Edible garden",
      "Native / low-maintenance planting",
      "Irrigation",
    ],
  },
  {
    hints: [/outdoor furniture/i],
    scopes: [
      "Dining set",
      "Lounge seating",
      "Sectional / conversation set",
      "Shade / umbrellas",
      "Fire feature seating",
      "Outdoor rugs",
      "Side tables",
      "Bar stools",
      "Accessories & planters",
    ],
  },
  {
    hints: [/landscap|outdoor living|hardscap|lawn|yard/i],
    scopes: [
      "Patio / terrace",
      "Walkways & paths",
      "Outdoor grill / kitchen",
      "Outdoor seating & furniture",
      "Fire pit / fireplace",
      "Pergola / shade structure",
      "Outdoor lighting",
      "Lawn",
      "Planting beds",
      "Trees & shrubs",
      "Privacy screening",
      "Retaining walls",
      "Driveway",
      "Fence / gate",
      "Water feature",
      "Irrigation",
      "Drainage",
      "Outdoor dining area",
    ],
  },
  {
    hints: [/pergola|patio cover|gazebo/i],
    scopes: [
      "Attached structure",
      "Freestanding structure",
      "Roof / shade canopy",
      "Posts & beams",
      "Lighting",
      "Fans",
      "Outdoor kitchen tie-in",
      "Seating area",
      "Deck / patio base",
    ],
  },
  {
    hints: [/interior design|home remodel|whole home/i],
    scopes: [
      "Living room",
      "Dining room",
      "Kitchen",
      "Primary bedroom",
      "Bathrooms",
      "Hallways",
      "Basement",
      "Entry",
      "Paint",
      "Flooring",
      "Lighting",
      "Built-ins",
    ],
  },
];

function withOther(scopes) {
  const cleaned = [...new Set((scopes || []).map((s) => String(s || "").trim()).filter(Boolean))];
  // Drop coarse "full renovation" rows — UI owns select-all.
  const without = cleaned.filter(
    (s) =>
      !/^other$/i.test(s) &&
      !/multiple\s*\/\s*other/i.test(s) &&
      !/^full\b/i.test(s) &&
      !/^whole\b/i.test(s) &&
      !/master plan/i.test(s)
  );
  return [...without, "Other"];
}

function defaultsForName(name) {
  const text = String(name || "");
  for (const row of DEFAULTS_BY_HINT) {
    if (row.hints.some((re) => re.test(text))) return [...row.scopes];
  }
  return null;
}

/** Force-replace when still on coarse buckets or too few parts. */
function shouldForceReplace(name, existing) {
  const text = String(name || "");
  if (!defaultsForName(text)) return false;
  if (!existing.length) return true;
  if (existing.length < 10) return true;
  // Coarse bucket lists look like "X only" / "upgrade" phrasing.
  const coarse = existing.filter((s) =>
    /\bonly\b|upgrade|renovation|refresh|installation|entertaining/i.test(s)
  ).length;
  if (coarse >= Math.ceil(existing.length * 0.4)) return true;
  return false;
}

async function fetchAllSubcats() {
  const out = [];
  let from = 0;
  for (;;) {
    const { data, error } = await sb
      .from("categories_subcategories")
      .select("id, subcategory, subcategory_scope, status")
      .range(from, from + 999);
    if (error) throw error;
    const batch = data || [];
    out.push(...batch);
    if (batch.length < 1000) break;
    from += 1000;
  }
  return out;
}

async function main() {
  const rows = await fetchAllSubcats();
  const updates = [];

  for (const row of rows) {
    const name = String(row.subcategory || "");
    const existing = Array.isArray(row.subcategory_scope)
      ? row.subcategory_scope.map((s) => String(s || "").trim()).filter(Boolean)
      : [];

    const defaults = defaultsForName(name);
    let next = null;
    if (shouldForceReplace(name, existing) && defaults) {
      next = [...defaults];
    } else if (existing.length) {
      next = [...existing];
    } else if (defaults) {
      next = [...defaults];
    }
    if (!next) continue;

    next = withOther(next);
    const same = next.length === existing.length && next.every((s, i) => s === existing[i]);
    if (same) continue;

    updates.push({
      id: row.id,
      name,
      before: existing,
      after: next,
    });
  }

  console.log(`${APPLY ? "APPLY" : "DRY-RUN"}: ${updates.length} subcategory_scope updates\n`);
  for (const u of updates.slice(0, 40)) {
    console.log(`• ${u.name}`);
    console.log(`    before: ${JSON.stringify(u.before)}`);
    console.log(`    after:  ${JSON.stringify(u.after)}`);
  }
  if (updates.length > 40) console.log(`… +${updates.length - 40} more`);

  if (!APPLY) {
    console.log("\nRe-run with --apply to write.");
    return;
  }

  let ok = 0;
  for (const u of updates) {
    const { error } = await sb
      .from("categories_subcategories")
      .update({ subcategory_scope: u.after })
      .eq("id", u.id);
    if (error) {
      console.error(`FAIL ${u.name}:`, error.message);
    } else {
      ok += 1;
    }
  }
  console.log(`\nUpdated ${ok}/${updates.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

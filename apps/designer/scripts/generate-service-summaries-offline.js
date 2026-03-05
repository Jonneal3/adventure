/**
 * Offline service-summary generator (no API calls).
 *
 * Reads `categories_subcategories_rows (7).csv`, filters rows where `instance_type === "service"`,
 * and writes a CSV with columns: id, subcategory, service_summary.
 *
 * Usage:
 *   node scripts/generate-service-summaries-offline.js \
 *     --input "categories_subcategories_rows (7).csv" \
 *     --output "scripts/service_summaries.generated.csv"
 */

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--input") out.input = argv[++i];
    else if (a === "--output") out.output = argv[++i];
  }
  return out;
}

function cleanName(s) {
  return String(s || "")
    .replace(/\s*\((Service|E-commerce)\)\s*$/i, "")
    .trim();
}

function q(s) {
  const v = String(s ?? "");
  return `"${v.replace(/"/g, '""')}"`;
}

function summaryFor(subcat) {
  const name = cleanName(subcat);
  const n = name.toLowerCase();
  const has = (re) => re.test(n);

  // 2–3 sentences max. Only answer:
  // 1) what it is, 2) who it's for, 3) what outcome it delivers.
  // Avoid workflow/process/logistics language ("site visit", "licensed", "installation", etc.).

  const make = ({ what, who, outcome, examples }) => {
    const s1 = `${name} is ${what} that helps ${who} ${outcome}.`;
    const s2 = examples ? `It’s commonly used for ${examples}.` : '';
    return [s1, s2].filter(Boolean).join(' ');
  };

  // Fabrication / manufacturing (treat as a service) — do this FIRST so "electric", "architectural", etc.
  // don't steal these rows.
  const isManufacturing = has(/\bmanufacturing\b/);
  const isFabricationLike = has(
    /\bfabrication\b|\bmillwork\b|\bwoodwork\b|\bmetal\s*work\b|\bmetalwork\b|\btanning\b|\bcut and sew\b|\bapparel\b|\bpallet\b|\bcontainer\b|\bprefabricated\b/
  );
  const isContractorWord = has(/\bcontractors?\b/);

  if (isManufacturing || (isFabricationLike && !isContractorWord)) {
    return make({
      what: 'a fabrication or contract manufacturing service',
      who: 'brands, builders, and businesses',
      outcome:
        'produce specialized components or finished goods to spec without building their own production capability',
      examples: has(/\bmillwork\b|\bwoodwork\b/)
        ? 'custom woodwork, millwork, and architectural components'
        : 'made‑to‑spec parts, production runs, and finished goods',
    });
  }

  // Design / planning / staging
  if (has(/design|designer|layout|planning|staging|interior|architecture|architectural|\bliving room\b|\bbedroom\b|\bkitchen\b|\bbathroom\b|\bnursery\b/)) {
    return make({
      what: 'a design and planning service',
      who: 'homeowners, builders, and businesses',
      outcome: 'turn an idea into a space or plan that looks good, fits the budget, and works for how it will be used',
      examples: has(/outdoor|patio|deck|courtyard|rooftop|garden/)
        ? 'patios, decks, courtyards, and other outdoor areas'
        : 'rooms like living rooms, kitchens, bathrooms, and nurseries',
    });
  }

  // Marketing / advertising
  if (has(/marketing|advertising|seo|ppc|social|brand|pr\b|content|outdoor advertising/)) {
    return make({
      what: 'a marketing service',
      who: 'businesses',
      outcome: 'reach the right customers, communicate value clearly, and drive more leads or sales',
      examples: has(/outdoor advertising/) ? 'billboards, signage, and location‑based campaigns' : 'search, social, and creative campaigns',
    });
  }

  // Legal
  if (has(/attorney|law|legal|litigation|estate planning|immigration|bankruptcy/)) {
    return make({
      what: 'a legal service',
      who: 'individuals and businesses',
      outcome: 'handle legal matters, reduce risk, and make confident decisions with contracts, filings, and disputes',
      examples: 'contracts, compliance, disputes, and planning',
    });
  }

  // Accounting / tax / payroll
  if (has(/accounting|bookkeeping|cpa|tax|payroll|audit/)) {
    return make({
      what: 'an accounting and tax service',
      who: 'businesses and self‑employed professionals',
      outcome: 'keep finances organized, stay compliant, and understand performance through accurate records and reporting',
      examples: 'bookkeeping, payroll, tax filing, and financial reporting',
    });
  }

  // Insurance
  if (has(/insurance|broker|claims|adjust/)) {
    return make({
      what: 'an insurance service',
      who: 'individuals and businesses',
      outcome: 'protect against financial risk by choosing coverage that matches real‑world needs',
      examples: 'policy selection, renewals, and claims support',
    });
  }

  // Healthcare / medical / dental
  if (has(/dentist|dental|orthodont|periodont|optomet|clinic|medical|physician|surgery|rhinoplasty|breast|implants?|prosthetics/)) {
    return make({
      what: 'a healthcare service',
      who: 'patients',
      outcome: 'address a health or cosmetic concern with professional evaluation and treatment',
      examples: has(/dental|dentist|orthodont|periodont/) ? 'cleanings, restorative work, and orthodontic care' : 'consultations, procedures, and ongoing care',
    });
  }

  // Beauty / personal care
  if (has(/hair|lashes|makeup|microblading|nail|tattoo|barber|salon|spa|massage|aesthetic/)) {
    return make({
      what: 'a personal care service',
      who: 'individuals',
      outcome: 'improve appearance or wellbeing through grooming, cosmetic services, or relaxation',
      examples: 'hair, nails, lashes, skincare, and bodywork services',
    });
  }

  // Property management / real estate
  if (has(/property manager|property management|residential property managers?/)) {
    return make({
      what: 'a property management service',
      who: 'property owners and landlords',
      outcome: 'keep rentals operating smoothly while protecting the property and improving tenant experience',
      examples: 'tenant support, maintenance coordination, and owner reporting',
    });
  }
  if (has(/real estate|realtor|brokerage|leasing|lessor/)) {
    return make({
      what: 'a real estate service',
      who: 'buyers, sellers, and landlords',
      outcome: 'price, market, and transact property with clearer decisions and better outcomes',
      examples: 'sales, leasing, and property marketing',
    });
  }

  // Home services / trades (keep outcome-focused, not procedural)
  if (has(/plumb|drain|sewer/)) {
    return make({
      what: 'a plumbing service',
      who: 'homeowners and property operators',
      outcome: 'restore safe, reliable water and drainage and prevent recurring problems',
      examples: 'repairs, replacements, and upgrades for fixtures and lines',
    });
  }
  if (has(/heating|air-?conditioning|hvac|furnace|boiler|\bducts?\b/)) {
    return make({
      what: 'an HVAC service',
      who: 'homeowners and businesses',
      outcome: 'keep indoor spaces comfortable, efficient, and well‑ventilated',
      examples: 'heating/cooling repair, maintenance, and system upgrades',
    });
  }
  if (has(/\belectric(al)?\b|\blighting fixture\b|\blighting\b|\bsmart lighting\b/)) {
    return make({
      what: 'an electrical and lighting service',
      who: 'homeowners and businesses',
      outcome: 'power spaces safely and support lighting, devices, and modern electrical needs',
      examples: has(/smart lighting/) ? 'lighting automation and smart home upgrades' : 'repairs, upgrades, and new electrical work',
    });
  }
  if (has(/painting/)) {
    return make({
      what: 'a painting and finishing service',
      who: 'homeowners, landlords, and businesses',
      outcome: 'refresh and protect surfaces while improving the look of interiors and exteriors',
      examples: 'interior repainting, exterior refreshes, and surface finishing',
    });
  }
  if (has(/floor|flooring|carpet|tile|floor covering/)) {
    return make({
      what: 'a flooring service',
      who: 'homeowners and commercial property operators',
      outcome: 'choose and fit floor surfaces that match durability, comfort, and style goals',
      examples: 'hardwood, tile, carpet, and resilient flooring projects',
    });
  }
  if (has(/window treatment|blinds|shades|draper/)) {
    return make({
      what: 'a window treatment service',
      who: 'homeowners and businesses',
      outcome: 'control light, privacy, and style with window coverings that fit the space',
      examples: 'blinds, shades, drapery, and custom treatments',
    });
  }
  if (has(/glass replacement|auto glass|windshield/)) {
    return make({
      what: 'an automotive glass service',
      who: 'drivers and fleet operators',
      outcome: 'restore visibility and safety by replacing damaged glass and seals',
      examples: 'windshield replacement and chip/crack repair',
    });
  }
  if (
    has(
      /contractor|construction|remodel|masonry|concrete|drywall|insulation|carpentry|glazing|paving|stonework|fence|roof|siding|gutter|window\b|door\b|site preparation|irrigation|landscap|garden|deck|patio|pergola|gazebo|fire pit|water feature|sauna|hot tub|pool|greenhouse|shed/
    )
  ) {
    return make({
      what: 'a home improvement service',
      who: 'homeowners and property managers',
      outcome: 'improve function, durability, and curb appeal across indoor and outdoor spaces',
      examples: 'remodeling, outdoor builds, repairs, and upgrades',
    });
  }

  // House flips / renovation-for-resale
  if (has(/\bhouse flips?\b|\bflip\b/)) {
    return make({
      what: 'a renovation and resale planning service',
      who: 'investors, homeowners, and real estate operators',
      outcome: 'prioritize upgrades that improve livability and resale value while keeping the budget focused',
      examples: 'before/after concepts, finish selections, and room refresh plans',
    });
  }

  // Wholesale / distribution
  if (has(/merchant wholesal|wholesaler|distribution|supply/)) {
    return make({
      what: 'a wholesale supply service',
      who: 'retailers, contractors, and businesses',
      outcome: 'source the right products reliably and keep projects or shelves stocked',
      examples: 'materials, inventory, and fulfillment for ongoing needs',
    });
  }

  // Food services (catering, mobile)
  if (has(/restaurant|food|mobile food|cater/)) {
    return make({
      what: 'a food and catering service',
      who: 'individuals, event organizers, and businesses',
      outcome: 'provide meals and hospitality that match dietary needs, budgets, and the occasion',
      examples: has(/mobile/) ? 'food trucks and pop‑up service' : 'catering and prepared food',
    });
  }

  // Default
  return make({
    what: 'a specialized service',
    who: 'people and businesses',
    outcome: 'get a specific outcome delivered by an expert in this category',
    examples: null,
  });
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const input = args.input || "categories_subcategories_rows (7).csv";
  const output = args.output || path.join("scripts", "service_summaries.generated.csv");

  if (!fs.existsSync(input)) {
    throw new Error(`Input not found: ${input}`);
  }

  const rows = [];
  await new Promise((resolve, reject) => {
    fs.createReadStream(input)
      .pipe(csv())
      .on("data", (r) => {
        if ((r.instance_type || "").trim() === "service") {
          rows.push({ id: r.id, subcategory: r.subcategory });
        }
      })
      .on("end", resolve)
      .on("error", reject);
  });

  const header = "id,subcategory,service_summary\n";
  const lines = rows
    .map((r) => [q(r.id), q(r.subcategory), q(summaryFor(r.subcategory))].join(","))
    .join("\n");

  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, header + lines + "\n", "utf8");
  console.log(`✅ Wrote ${rows.length} service summaries to ${output}`);
}

run().catch((err) => {
  console.error("❌ Failed to generate service summaries:", err);
  process.exit(1);
});


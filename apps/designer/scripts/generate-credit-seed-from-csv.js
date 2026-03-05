const fs = require('fs');
const path = require('path');

function toInt(val) {
  if (val === undefined || val === null) return undefined;
  const n = parseInt(String(val).trim(), 10);
  return Number.isNaN(n) ? undefined : n;
}

function normalize(str) {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function classifyCreditPrice(row) {
  const instanceType = (row.instance_type || '').trim().toLowerCase();
  const sub = normalize(row.subcategory);

  // Explicit CSV credit_price wins if valid integer
  const csvCredit = toInt(row.credit_price);
  if (typeof csvCredit === 'number' && csvCredit >= 0) {
    return csvCredit;
  }

  // E-commerce default: 1-2 credits (affordable)
  if (instanceType === 'ecomm') {
    // Heuristic: luxury/premium keywords -> 2, else 1
    const premiumHints = ['luxury', 'premium', 'high-end', 'fine', 'designer'];
    if (premiumHints.some((k) => sub.includes(k))) return 2;
    return 1;
  }

  // Services default: 2-5 credits based on value
  if (instanceType === 'service' || instanceType === 'services') {
    // Top-tier (5)
    const tier5 = [
      'roof', 'roofing', 'solar', 'foundation', 'structural', 'masonry', 'excavation',
      'commercial construction', 'industrial construction', 'commercial roofing', 'industrial roofing',
      'orthodont', 'surgery', 'cosmetic surgery', 'implant', 'law', 'attorney', 'litigation'
    ];
    if (tier5.some((k) => sub.includes(k))) return 5;

    // High (4)
    const tier4 = [
      'hvac', 'full remodel', 'full renovation', 'kitchen remodel', 'bathroom remodel',
      'remodel', 'renovation', 'additions', 'solar installation', 'generator install', 'electrical panel',
      'tree removal', 'stump removal', 'sprinkler system install', 'security system', 'automation'
    ];
    if (tier4.some((k) => sub.includes(k))) return 4;

    // Medium (3)
    const tier3 = [
      'window', 'door', 'siding', 'driveway', 'paving', 'fence', 'deck', 'floor', 'flooring', 'water heater',
      'furnace', 'air conditioning', 'ac repair', 'garage door', 'pool install', 'landscaping design',
      'pest control', 'real estate', 'photography', 'videography', 'web design', 'seo', 'marketing'
    ];
    if (tier3.some((k) => sub.includes(k))) return 3;

    // Default/low (2)
    return 2;
  }

  // Both or unknown: pick conservative defaults by keyword, else 2
  const bothOrUnknown = ['both', ''];
  if (bothOrUnknown.includes(instanceType)) {
    const highSignals = ['roof', 'roofing', 'solar', 'hvac'];
    if (highSignals.some((k) => sub.includes(k))) return 4;
    const ecommSignals = ['product', 'photography', 'ecommerce'];
    if (ecommSignals.some((k) => sub.includes(k))) return 1;
    return 2;
  }

  return 2;
}

function parseCsvLine(line) {
  // Minimal CSV parsing that respects quotes
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function main() {
  const csvPathCandidates = [
    path.resolve(__dirname, '..', 'categories_subcategories_rows.csv'),
    path.resolve(__dirname, '..', 'public', 'categories_subcategories_rows.csv'),
    path.resolve(process.cwd(), 'categories_subcategories_rows.csv'),
    path.resolve(process.cwd(), 'public', 'categories_subcategories_rows.csv'),
  ];

  const csvPath = csvPathCandidates.find((p) => fs.existsSync(p));
  if (!csvPath) {
    console.error('CSV not found. Looked in:', csvPathCandidates.join(' | '));
    process.exit(1);
  }

  const csv = fs.readFileSync(csvPath, 'utf8');
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) {
    console.error('CSV appears empty.');
    process.exit(1);
  }

  const header = parseCsvLine(lines[0]);
  const colIndex = (name) => header.indexOf(name);
  const idx = {
    id: colIndex('id'),
    subcategory: colIndex('subcategory'),
    instance_type: colIndex('instance_type'),
    email_lead_price: colIndex('email_lead_price'),
    credit_price: colIndex('credit_price'),
  };

  for (const [key, value] of Object.entries(idx)) {
    if (value === -1) {
      console.error(`Missing column in CSV: ${key}`);
      process.exit(1);
    }
  }

  const updates = [];
  for (let r = 1; r < lines.length; r++) {
    const fields = parseCsvLine(lines[r]);
    if (fields.length !== header.length) {
      // Skip malformed line
      continue;
    }
    const row = {
      id: fields[idx.id],
      subcategory: fields[idx.subcategory],
      instance_type: fields[idx.instance_type],
      email_lead_price: fields[idx.email_lead_price],
      credit_price: fields[idx.credit_price],
    };

    if (!row.id) continue;
    const credit = classifyCreditPrice(row);
    updates.push({ id: row.id, credit });
  }

  const outDir = path.resolve(process.cwd(), 'supabase', 'migrations');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${new Date().toISOString().slice(0,10).replace(/-/g,'')}_seed_credit_pricing_from_csv.sql`);

  let sql = '';
  sql += '-- Seed credit pricing from CSV export\n';
  sql += '-- Generated automatically from categories_subcategories_rows.csv\n\n';
  sql += 'BEGIN;\n\n';
  for (const u of updates) {
    sql += `UPDATE categories_subcategories SET credit_price = ${u.credit} WHERE id = '${u.id}';\n`;
  }
  sql += '\nCOMMIT;\n';

  fs.writeFileSync(outPath, sql, 'utf8');
  console.log('Generated seed file:', path.relative(process.cwd(), outPath));
  console.log('Total updates:', updates.length);
}

main();



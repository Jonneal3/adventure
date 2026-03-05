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

function classifyLeadPricing(row) {
  const instanceType = (row.instance_type || '').trim().toLowerCase();
  const sub = normalize(row.subcategory);

  // E-commerce pricing (lower)
  if (instanceType === 'ecomm') {
    // Basic e-commerce: $2-4 email, $3-6 phone
    const premiumHints = ['luxury', 'premium', 'high-end', 'fine', 'designer'];
    if (premiumHints.some((k) => sub.includes(k))) {
      return { email: 4, phone: 6 };
    }
    return { email: 2, phone: 3 };
  }

  // Services pricing (higher, based on value)
  if (instanceType === 'service' || instanceType === 'services') {
    // Top-tier services (roofing, solar, etc.): $8-12 email, $12-18 phone
    const tier5 = [
      'roof', 'roofing', 'solar', 'foundation', 'structural', 'masonry', 'excavation',
      'commercial construction', 'industrial construction', 'commercial roofing', 'industrial roofing',
      'orthodont', 'surgery', 'cosmetic surgery', 'implant', 'law', 'attorney', 'litigation'
    ];
    if (tier5.some((k) => sub.includes(k))) {
      return { email: 12, phone: 18 };
    }

    // High-value services: $6-10 email, $9-15 phone
    const tier4 = [
      'hvac', 'full remodel', 'full renovation', 'kitchen remodel', 'bathroom remodel',
      'remodel', 'renovation', 'additions', 'solar installation', 'generator install', 'electrical panel',
      'tree removal', 'stump removal', 'sprinkler system install', 'security system', 'automation'
    ];
    if (tier4.some((k) => sub.includes(k))) {
      return { email: 10, phone: 15 };
    }

    // Medium-value services: $4-8 email, $6-12 phone
    const tier3 = [
      'window', 'door', 'siding', 'driveway', 'paving', 'fence', 'deck', 'floor', 'flooring', 'water heater',
      'furnace', 'air conditioning', 'ac repair', 'garage door', 'pool install', 'landscaping design',
      'pest control', 'real estate', 'photography', 'videography', 'web design', 'seo', 'marketing'
    ];
    if (tier3.some((k) => sub.includes(k))) {
      return { email: 8, phone: 12 };
    }

    // Default/low services: $3-6 email, $5-9 phone
    return { email: 6, phone: 9 };
  }

  // Both or unknown: pick based on keywords
  const bothOrUnknown = ['both', ''];
  if (bothOrUnknown.includes(instanceType)) {
    const highSignals = ['roof', 'roofing', 'solar', 'hvac', 'remodel', 'renovation'];
    if (highSignals.some((k) => sub.includes(k))) {
      return { email: 8, phone: 12 };
    }
    const ecommSignals = ['product', 'photography', 'ecommerce', 'furniture', 'fashion'];
    if (ecommSignals.some((k) => sub.includes(k))) {
      return { email: 3, phone: 5 };
    }
    return { email: 5, phone: 8 };
  }

  return { email: 5, phone: 8 };
}

function parseCsvLine(line) {
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
    phone_lead_price: colIndex('phone_lead_price'),
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
      continue;
    }
    const row = {
      id: fields[idx.id],
      subcategory: fields[idx.subcategory],
      instance_type: fields[idx.instance_type],
      email_lead_price: fields[idx.email_lead_price],
      phone_lead_price: fields[idx.phone_lead_price],
    };

    if (!row.id) continue;
    
    // Only update if prices are empty
    const hasEmailPrice = row.email_lead_price && row.email_lead_price.trim() !== '';
    const hasPhonePrice = row.phone_lead_price && row.phone_lead_price.trim() !== '';
    
    if (!hasEmailPrice || !hasPhonePrice) {
      const pricing = classifyLeadPricing(row);
      updates.push({ 
        id: row.id, 
        email: pricing.email, 
        phone: pricing.phone,
        subcategory: row.subcategory,
        instance_type: row.instance_type
      });
    }
  }

  const outDir = path.resolve(process.cwd(), 'supabase', 'migrations');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${new Date().toISOString().slice(0,10).replace(/-/g,'')}_seed_lead_pricing_from_csv.sql`);

  let sql = '';
  sql += '-- Seed lead pricing from CSV export\n';
  sql += '-- Generated automatically from categories_subcategories_rows.csv\n\n';
  sql += 'BEGIN;\n\n';
  
  for (const u of updates) {
    sql += `UPDATE categories_subcategories SET email_lead_price = ${u.email}, phone_lead_price = ${u.phone} WHERE id = '${u.id}';\n`;
  }
  
  sql += '\nCOMMIT;\n';

  fs.writeFileSync(outPath, sql, 'utf8');
  console.log('Generated lead pricing seed file:', path.relative(process.cwd(), outPath));
  console.log('Total updates:', updates.length);
  
  // Show some examples
  console.log('\nSample pricing assignments:');
  updates.slice(0, 10).forEach(u => {
    console.log(`${u.subcategory} (${u.instance_type}): Email $${u.email}, Phone $${u.phone}`);
  });
}

main();

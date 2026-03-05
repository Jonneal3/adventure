const fs = require('fs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

// Load local env for scripts (safe no-op in CI).
require('dotenv').config({ path: '.env.local' });

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--input') out.input = argv[++i];
    else if (a === '--service-summaries') out.serviceSummaries = argv[++i];
  }
  return out;
}

function fileExists(p) {
  try {
    fs.accessSync(p, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function loadServiceSummariesMap(filePath) {
  if (!filePath || !fileExists(filePath)) return new Map();

  const map = new Map();
  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const id = (row.id || '').trim();
        const serviceSummary = (row.service_summary || '').trim();
        if (id && serviceSummary) {
          map.set(id, serviceSummary);
        }
      })
      .on('end', resolve)
      .on('error', reject);
  });

  return map;
}

// Function to fix numeric fields (convert empty strings to null or default values)
function fixNumericFields(row) {
  const numericFields = ['email_lead_price', 'phone_lead_price', 'credit_price', 'priority'];
  
  numericFields.forEach(field => {
    if (row[field] === '' || row[field] === '""' || row[field] === '') {
      // Only set defaults for fields that have NOT NULL constraints
      if (field === 'email_lead_price') {
        row[field] = 30; // Use your correct default value
      } else if (field === 'phone_lead_price') {
        row[field] = 40; // Use your correct default value
      } else if (field === 'credit_price') {
        row[field] = 1; // Set to 1 to satisfy positive constraint
      } else {
        row[field] = null;
      }
    } else if (row[field] && !isNaN(row[field])) {
      row[field] = parseFloat(row[field]);
      // Ensure positive values for fields with positive constraints
      if (field === 'email_lead_price' && row[field] <= 0) {
        row[field] = 30; // Use your correct default value
      } else if (field === 'phone_lead_price' && row[field] <= 0) {
        row[field] = 40; // Use your correct default value
      } else if (field === 'credit_price' && row[field] <= 0) {
        row[field] = 1;
      }
    }
  });
  
  return row;
}

// Function to fix UUID fields (convert empty strings to null)
function fixUuidFields(row) {
  const uuidFields = ['user_id', 'account_id', 'demo_prompt_id'];
  
  uuidFields.forEach(field => {
    if (row[field] === '' || row[field] === '""' || row[field] === '' || row[field] === null) {
      row[field] = null; // Keep as null for optional UUID fields
    }
  });
  
  return row;
}

// Function to fix timestamp fields (convert empty strings to current timestamp)
function fixTimestampFields(row) {
  const timestampFields = ['last_reviewed_at'];
  
  timestampFields.forEach(field => {
    if (row[field] === '' || row[field] === '""' || row[field] === '' || row[field] === null) {
      row[field] = new Date().toISOString();
    }
  });
  
  return row;
}

// Function to fix boolean fields
function fixBooleanFields(row) {
  const booleanFields = ['noindex'];
  
  booleanFields.forEach(field => {
    if (row[field] === '' || row[field] === '""' || row[field] === '') {
      row[field] = null;
    } else if (row[field] === 'false' || row[field] === false) {
      row[field] = false;
    } else if (row[field] === 'true' || row[field] === true) {
      row[field] = true;
    }
  });
  
  return row;
}

// Function to fix JSON fields
function fixJsonFields(row) {
  const jsonFields = ['seo_keywords', 'faq', 'sample_images', 'schema_props', 'use_cases', 'demo_template_config'];
  
  jsonFields.forEach(field => {
    if (row[field] === '' || row[field] === '""' || row[field] === '') {
      row[field] = null;
    } else if (row[field] && typeof row[field] === 'string') {
      try {
        // Try to parse as JSON
        row[field] = JSON.parse(row[field]);
      } catch (e) {
        // If it's not valid JSON, keep as string
        console.log(`Warning: ${field} is not valid JSON, keeping as string`);
      }
    }
  });
  
  return row;
}

// Function to fix ALL empty fields with appropriate defaults
function fixAllEmptyFields(row) {
  // Fix empty string fields
  const stringFields = ['canonical_path', 'og_title', 'og_description', 'og_image_url', 'twitter_image_url', 'service_summary'];
  
  stringFields.forEach(field => {
    if (row[field] === '' || row[field] === '""' || row[field] === null || row[field] === undefined) {
      if (field === 'canonical_path') {
        row[field] = `/${row.slug || 'default-path'}`;
      } else if (field === 'og_title') {
        row[field] = row.seo_title || row.subcategory || 'Default Title';
      } else if (field === 'og_description') {
        row[field] = row.seo_description || row.description || 'Default Description';
      } else if (field === 'og_image_url') {
        row[field] = '/default-og-image.jpg';
      } else if (field === 'twitter_image_url') {
        row[field] = '/default-twitter-image.jpg';
      } else if (field === 'service_summary') {
        row[field] = null;
      }
    }
  });
  
  // Fix priority field
  if (row.priority === '' || row.priority === '""' || row.priority === null || row.priority === undefined) {
    row.priority = 1; // Default priority
  }
  
  // Fix content fields that are empty
  if (row.h1 === '' || row.h1 === null || row.h1 === undefined) {
    row.h1 = row.subcategory || 'Default H1';
  }
  
  if (row.hero_tagline === '' || row.hero_tagline === null || row.hero_tagline === undefined) {
    row.hero_tagline = `Show realistic ${row.subcategory || 'Default'} results on your site with our AI visualization tool.`;
  }
  
  if (row.slug === '' || row.slug === null || row.slug === undefined) {
    row.slug = (row.subcategory || 'default').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  
  if (row.content === '' || row.content === null || row.content === undefined) {
    row.content = `Use our AI ${row.subcategory || 'Default'} design widget on your site for instant visuals and previews.`;
  }
  
  if (row.hero_cta_text === '' || row.hero_cta_text === null || row.hero_cta_text === undefined) {
    row.hero_cta_text = 'Start Free Trial';
  }
  
  if (row.hero_cta_url === '' || row.hero_cta_url === null || row.hero_cta_url === undefined) {
    row.hero_cta_url = '/auth';
  }
  
  if (row.seo_title === '' || row.seo_title === null || row.seo_title === undefined) {
    row.seo_title = `${row.subcategory || 'Default'} | Adventure`;
  }
  
  if (row.seo_description === '' || row.seo_description === null || row.seo_description === undefined) {
    row.seo_description = `Adventure AI visualization for ${row.subcategory || 'Default'} across e-commerce and services.`;
  }
  
  if (row.seo_keywords === null || row.seo_keywords === undefined || (Array.isArray(row.seo_keywords) && row.seo_keywords.length === 0)) {
    row.seo_keywords = [`${row.subcategory || 'Default'} visualization`, `${row.subcategory || 'Default'} AI`, `${row.subcategory || 'Default'} preview`];
  }
  
  if (row.faq === null || row.faq === undefined || (Array.isArray(row.faq) && row.faq.length === 0)) {
    row.faq = [
      {
        "question": `How does ${row.subcategory || 'Default'} preview work?`,
        "answer": "Customers upload images or select templates and instantly see realistic previews to guide decisions."
      },
      {
        "question": "Does this support mobile?",
        "answer": "Yes. The widget is responsive and optimized for modern mobile browsers."
      }
    ];
  }
  
  if (row.sample_images === null || row.sample_images === undefined || (Array.isArray(row.sample_images) && row.sample_images.length === 0)) {
    row.sample_images = [
      {
        "alt": `${row.subcategory || 'Default'} example 1`,
        "url": "/public/example.png"
      },
      {
        "alt": `${row.subcategory || 'Default'} example 2`,
        "url": "/public/example1.png"
      }
    ];
  }
  
      if (row.use_cases === null || row.use_cases === undefined || (Array.isArray(row.use_cases) && row.use_cases.length === 0)) {
        row.use_cases = [
          {
            "title": "Instant Previews",
            "desc": `Visitors see before/after visuals for ${row.subcategory || 'Default'} in seconds.`
          },
          {
            "title": "Lead Capture",
            "desc": "Collect emails/phones on export or share to qualify demand."
          }
        ];
      }

      // Fill demo fields
      if (row.demo_theme_key === '' || row.demo_theme_key === null || row.demo_theme_key === undefined) {
        row.demo_theme_key = 'default';
      }

      if (row.demo_template_config === '' || row.demo_template_config === null || row.demo_template_config === undefined) {
        row.demo_template_config = {
          "theme": "default",
          "style": "modern",
          "layout": "grid"
        };
      }

      // UUID fields must remain null due to foreign key constraints
      // These reference tables that don't exist, so they stay null

      return row;
}

async function uploadCsvToSupabase() {
  const args = parseArgs(process.argv.slice(2));

  // Try a few sensible defaults, but allow override via --input.
  const defaultInput = fileExists('categories_subcategories_rows_fixed.csv')
    ? 'categories_subcategories_rows_fixed.csv'
    : (fileExists('categories_subcategories_rows (7).csv') ? 'categories_subcategories_rows (7).csv' : undefined);

  const inputFile = args.input || defaultInput;
  if (!inputFile) {
    throw new Error('No input CSV found. Pass --input "<path-to-csv>".');
  }

  const serviceSummariesFile = args.serviceSummaries || 'scripts/service_summaries.generated.csv';
  const serviceSummariesMap = await loadServiceSummariesMap(serviceSummariesFile);

  const rows = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(inputFile)
      .pipe(csv())
      .on('data', (row) => {
        // Fix the data types
        let fixedRow = fixNumericFields(row);
        fixedRow = fixUuidFields(fixedRow);
        fixedRow = fixTimestampFields(fixedRow);
        fixedRow = fixBooleanFields(fixedRow);
        fixedRow = fixJsonFields(fixedRow);
        fixedRow = fixAllEmptyFields(fixedRow);

        // Merge in generated service summaries (if present), without overwriting a non-empty value.
        const id = (fixedRow.id || '').trim();
        const existing = (fixedRow.service_summary || '').trim();
        const generated = id ? serviceSummariesMap.get(id) : undefined;
        if ((!existing || existing === '""') && generated) {
          fixedRow.service_summary = generated;
        }
        
        rows.push(fixedRow);
      })
      .on('end', async () => {
        console.log(`📊 Processed ${rows.length} rows`);
        
        try {
          // Clear existing data first
          console.log('🗑️  Clearing existing data...');
          const { error: deleteError } = await supabase
            .from('categories_subcategories')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
          
          if (deleteError) {
            console.error('❌ Error clearing data:', deleteError);
            reject(deleteError);
            return;
          }
          
          console.log('✅ Data cleared successfully');
          
          // Upload in batches
          const batchSize = 100;
          let uploaded = 0;
          
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            
            console.log(`📤 Uploading batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(rows.length / batchSize)} (${batch.length} rows)`);

            // Split base vs SEO fields (SEO moved to category_subcategory_seo).
            const baseBatch = batch.map((row) => {
              const out = { ...row };
              // SEO / marketing fields now live in category_subcategory_seo
              delete out.canonical_path;
              delete out.content;
              delete out.faq;
              delete out.h1;
              delete out.hero_cta_text;
              delete out.hero_cta_url;
              delete out.hero_tagline;
              delete out.last_reviewed_at;
              delete out.noindex;
              delete out.og_description;
              delete out.og_image_url;
              delete out.og_title;
              delete out.priority;
              delete out.sample_images;
              delete out.schema_props;
              delete out.schema_type;
              delete out.seo_description;
              delete out.seo_keywords;
              delete out.seo_title;
              delete out.twitter_image_url;
              return out;
            });

            const seoBatch = batch.map((row) => ({
              category_subcategory_id: row.id, // Prefer explicit IDs from CSV
              canonical_path: row.canonical_path ?? null,
              content: row.content ?? null,
              faq: row.faq ?? null,
              h1: row.h1 ?? null,
              hero_cta_text: row.hero_cta_text ?? null,
              hero_cta_url: row.hero_cta_url ?? null,
              hero_tagline: row.hero_tagline ?? null,
              last_reviewed_at: row.last_reviewed_at ?? null,
              noindex: row.noindex ?? null,
              og_description: row.og_description ?? null,
              og_image_url: row.og_image_url ?? null,
              og_title: row.og_title ?? null,
              priority: row.priority ?? null,
              sample_images: row.sample_images ?? null,
              schema_props: row.schema_props ?? null,
              schema_type: row.schema_type ?? null,
              seo_description: row.seo_description ?? null,
              seo_keywords: row.seo_keywords ?? null,
              seo_title: row.seo_title ?? null,
              twitter_image_url: row.twitter_image_url ?? null,
            }));

            const { data, error } = await supabase
              .from('categories_subcategories')
              .insert(baseBatch)
              .select('id');
            
            if (error) {
              console.error('❌ Error uploading batch:', error);
              reject(error);
              return;
            }

            // If IDs were generated server-side, backfill them into SEO batch.
            if (Array.isArray(data)) {
              for (let j = 0; j < data.length; j++) {
                if (!seoBatch[j].category_subcategory_id) {
                  seoBatch[j].category_subcategory_id = data[j]?.id;
                }
              }
            }

            const seoBatchFiltered = seoBatch.filter((r) => !!r.category_subcategory_id);
            if (seoBatchFiltered.length > 0) {
              const { error: seoError } = await supabase
                .from('category_subcategory_seo')
                .insert(seoBatchFiltered);
              if (seoError) {
                console.error('❌ Error uploading SEO batch:', seoError);
                reject(seoError);
                return;
              }
            }
            
            uploaded += batch.length;
            console.log(`✅ Uploaded ${uploaded}/${rows.length} rows`);
          }
          
          console.log('🎉 Successfully uploaded all data to Supabase!');
          console.log(`📊 Summary:`);
          console.log(`   - Total rows: ${rows.length}`);
          console.log(`   - Service rows: ${rows.filter(r => r.instance_type === 'service').length}`);
          console.log(`   - Ecomm rows: ${rows.filter(r => r.instance_type === 'ecomm').length}`);
          
          resolve();
        } catch (error) {
          console.error('❌ Error:', error);
          reject(error);
        }
      })
      .on('error', reject);
  });
}

// Run the upload
uploadCsvToSupabase()
  .then(() => {
    console.log('✅ Upload completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Upload failed:', error);
    process.exit(1);
  });

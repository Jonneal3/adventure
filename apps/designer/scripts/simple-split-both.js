const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// Simple script to split "both" rows into "service" and "ecomm"
async function splitBothRows() {
  const { v4: uuidv4 } = await import('uuid');
  const rows = [];
  const newRows = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream('categories_subcategories_rows (2).csv')
      .pipe(csv())
      .on('data', (row) => {
        rows.push(row);
      })
      .on('end', () => {
        console.log(`Total rows read: ${rows.length}`);
        
        // Process each row
        rows.forEach((row, index) => {
          if (row.instance_type === 'both') {
            console.log(`Processing both row ${index + 1}: ${row.subcategory}`);
            
            // Create service version - keep everything the same, just change instance_type and generate new ID
            const serviceRow = { ...row };
            serviceRow.id = uuidv4();
            serviceRow.instance_type = 'service';
            serviceRow.subcategory = `${row.subcategory} (Service)`; // Make subcategory unique
            
            // Create ecomm version - keep everything the same, just change instance_type and generate new ID
            const ecommRow = { ...row };
            ecommRow.id = uuidv4();
            ecommRow.instance_type = 'ecomm';
            ecommRow.subcategory = `${row.subcategory} (E-commerce)`; // Make subcategory unique
            
            newRows.push(serviceRow);
            newRows.push(ecommRow);
          } else {
            // Keep non-both rows as is
            newRows.push(row);
          }
        });
        
        console.log(`Total rows after processing: ${newRows.length}`);
        console.log(`Both rows split: ${rows.filter(r => r.instance_type === 'both').length}`);
        console.log(`New rows created: ${newRows.length - rows.length}`);
        
        resolve(newRows);
      })
      .on('error', reject);
  });
}

// Write the new CSV file
function writeNewCsv(rows) {
  const csvWriter = createCsvWriter({
    path: 'categories_subcategories_rows_fixed.csv',
    header: [
      {id: 'id', title: 'id'},
      {id: 'category_id', title: 'category_id'},
      {id: 'subcategory', title: 'subcategory'},
      {id: 'status', title: 'status'},
      {id: 'created_at', title: 'created_at'},
      {id: 'updated_at', title: 'updated_at'},
      {id: 'user_id', title: 'user_id'},
      {id: 'description', title: 'description'},
      {id: 'account_id', title: 'account_id'},
      {id: 'email_lead_price', title: 'email_lead_price'},
      {id: 'phone_lead_price', title: 'phone_lead_price'},
      {id: 'instance_type', title: 'instance_type'},
      {id: 'seo_title', title: 'seo_title'},
      {id: 'seo_description', title: 'seo_description'},
      {id: 'seo_keywords', title: 'seo_keywords'},
      {id: 'canonical_path', title: 'canonical_path'},
      {id: 'noindex', title: 'noindex'},
      {id: 'og_title', title: 'og_title'},
      {id: 'og_description', title: 'og_description'},
      {id: 'og_image_url', title: 'og_image_url'},
      {id: 'twitter_image_url', title: 'twitter_image_url'},
      {id: 'h1', title: 'h1'},
      {id: 'hero_cta_text', title: 'hero_cta_text'},
      {id: 'hero_cta_url', title: 'hero_cta_url'},
      {id: 'faq', title: 'faq'},
      {id: 'sample_images', title: 'sample_images'},
      {id: 'schema_type', title: 'schema_type'},
      {id: 'schema_props', title: 'schema_props'},
      {id: 'priority', title: 'priority'},
      {id: 'last_reviewed_at', title: 'last_reviewed_at'},
      {id: 'use_cases', title: 'use_cases'},
      {id: 'hero_tagline', title: 'hero_tagline'},
      {id: 'slug', title: 'slug'},
      {id: 'content', title: 'content'},
      {id: 'demo_prompt_id', title: 'demo_prompt_id'},
      {id: 'demo_theme_key', title: 'demo_theme_key'},
      {id: 'demo_template_config', title: 'demo_template_config'},
      {id: 'credit_price', title: 'credit_price'}
    ]
  });

  return csvWriter.writeRecords(rows);
}

// Main execution
async function main() {
  try {
    console.log('Starting to split both rows...');
    const newRows = await splitBothRows();
    console.log('Writing new CSV file...');
    await writeNewCsv(newRows);
    console.log('✅ Successfully created categories_subcategories_rows_fixed.csv');
    console.log(`📊 Summary:`);
    const bothRows = newRows.filter(r => r.instance_type === 'both').length;
    const serviceRows = newRows.filter(r => r.instance_type === 'service').length;
    const ecommRows = newRows.filter(r => r.instance_type === 'ecomm').length;
    const originalRows = newRows.length - bothRows - serviceRows - ecommRows;
    console.log(`   - Original rows: ${originalRows}`);
    console.log(`   - Both rows split: ${bothRows}`);
    console.log(`   - Service rows: ${serviceRows}`);
    console.log(`   - Ecomm rows: ${ecommRows}`);
    console.log(`   - Total new rows: ${newRows.length}`);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

main();

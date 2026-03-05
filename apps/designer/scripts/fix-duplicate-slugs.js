const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixDuplicateSlugs() {
  try {
    console.log('🔍 Fetching all rows to check for duplicate slugs...');
    
    const { data: rows, error } = await supabase
      .from('categories_subcategories')
      .select('id, subcategory, slug, instance_type')
      .order('subcategory');

    if (error) {
      throw error;
    }

    console.log(`📊 Total rows: ${rows.length}`);

    // Group by slug to find duplicates
    const slugGroups = {};
    rows.forEach(row => {
      if (!slugGroups[row.slug]) {
        slugGroups[row.slug] = [];
      }
      slugGroups[row.slug].push(row);
    });

    // Find duplicates
    const duplicates = Object.entries(slugGroups).filter(([slug, rows]) => rows.length > 1);
    
    console.log(`\n🔍 Found ${duplicates.length} duplicate slugs`);

    if (duplicates.length === 0) {
      console.log('✅ All slugs are already unique!');
      return;
    }

    // Fix duplicates
    const updates = [];
    
    duplicates.forEach(([slug, duplicateRows]) => {
      console.log(`\n🔧 Fixing slug: "${slug}" (${duplicateRows.length} duplicates)`);
      
      duplicateRows.forEach((row, index) => {
        let newSlug = slug;
        
        if (index > 0) {
          // For duplicates, append instance type or index
          if (row.instance_type === 'service') {
            newSlug = `${slug}-service`;
          } else if (row.instance_type === 'ecomm') {
            newSlug = `${slug}-ecomm`;
          } else {
            newSlug = `${slug}-${index + 1}`;
          }
        }
        
        console.log(`  ${row.subcategory} (${row.instance_type}) -> ${newSlug}`);
        
        updates.push({
          id: row.id,
          slug: newSlug
        });
      });
    });

    // Update in batches
    console.log(`\n📤 Updating ${updates.length} rows...`);
    
    const batchSize = 100;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      // Update each row individually since we only need to update the slug
      for (const update of batch) {
        const { error: updateError } = await supabase
          .from('categories_subcategories')
          .update({ slug: update.slug })
          .eq('id', update.id);
        
        if (updateError) {
          throw updateError;
        }
      }
      
      console.log(`✅ Updated batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(updates.length / batchSize)}`);
    }

    // Verify all slugs are now unique
    console.log('\n🔍 Verifying all slugs are now unique...');
    
    const { data: verifyRows } = await supabase
      .from('categories_subcategories')
      .select('slug');

    const slugs = verifyRows.map(row => row.slug);
    const uniqueSlugs = [...new Set(slugs)];
    
    console.log(`📊 Total rows: ${slugs.length}`);
    console.log(`📊 Unique slugs: ${uniqueSlugs.length}`);
    
    if (slugs.length === uniqueSlugs.length) {
      console.log('✅ SUCCESS! All slugs are now unique!');
    } else {
      console.log('❌ Still have duplicate slugs!');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the script
fixDuplicateSlugs();

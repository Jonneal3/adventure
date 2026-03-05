#!/usr/bin/env node

/**
 * Script to fix sample images to be global (account_id = null) so they show up for all instances
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixSampleImages() {
  console.log('🔧 Fixing sample images to be global...\n');

  try {
    // Update all sample images to have account_id = null (global)
    const { data, error } = await supabase
      .from('images')
      .update({ account_id: null })
      .eq('metadata->sample_data', true)
      .select('id, metadata');

    if (error) {
      console.error('❌ Error updating sample images:', error);
      return;
    }

    console.log(`✅ Updated ${data.length} sample images to be global`);
    console.log('🎉 Sample images should now appear in all instances!');

  } catch (error) {
    console.error('❌ Error during fix:', error);
  }
}

fixSampleImages()
  .then(() => {
    console.log('\n✅ Fix completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fix failed:', error);
    process.exit(1);
  });

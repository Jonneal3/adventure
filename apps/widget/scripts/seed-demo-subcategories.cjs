const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY)');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { schema: 'public' }
  });

  const seedPath = path.resolve(process.cwd(), 'scripts', 'demo-subcategories.seed.json');
  const raw = fs.readFileSync(seedPath, 'utf-8');
  const items = JSON.parse(raw);

  for (const item of items) {
    const slug = item.slug;
    const { data: found, error } = await supabase
      .from('categories_subcategories')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !found) {
      console.warn(`Skipping slug ${slug}: not found`);
      continue;
    }

    const updatePayload = {
      demo_template_config: item.demo_template_config || null
    };

    const { error: upErr } = await supabase
      .from('categories_subcategories')
      .update(updatePayload)
      .eq('id', found.id);

    if (upErr) {
      console.error(`Failed to update ${slug}:`, upErr.message);
    } else {
      console.log(`Updated demo config for ${slug}`);
    }
  }

  console.log('Seed complete');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});



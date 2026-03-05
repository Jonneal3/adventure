const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing Supabase env vars');
    process.exit(1);
  }

  const slug = process.argv[2];
  if (!slug) {
    console.error('Usage: node scripts/inspect-subcategory.cjs <slug>');
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await supabase
    .from('categories_subcategories')
    .select('id, slug, subcategory, demo_template_config, demo_branding')
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    console.error('Query error:', error.message);
    process.exit(1);
  }
  console.log(JSON.stringify(data, null, 2));
}

main().catch(e => { console.error(e); process.exit(1);});



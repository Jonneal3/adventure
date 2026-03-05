const { createClient } = require('@supabase/supabase-js');

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error('Missing Supabase env vars');
    process.exit(1);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const statements = [
    "ALTER TABLE public.categories_subcategories ADD COLUMN IF NOT EXISTS demo_template_config jsonb;",
    "ALTER TABLE public.categories_subcategories ADD COLUMN IF NOT EXISTS demo_branding jsonb;",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='categories_subcategories' AND column_name='demo_prompt_id') THEN ALTER TABLE public.categories_subcategories ADD COLUMN demo_prompt_id uuid; ALTER TABLE public.categories_subcategories ADD CONSTRAINT categories_subcategories_demo_prompt_id_fkey FOREIGN KEY (demo_prompt_id) REFERENCES public.prompts (id) ON UPDATE CASCADE ON DELETE SET NULL; END IF; END $$;",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_categories_subcategories_slug') THEN CREATE INDEX idx_categories_subcategories_slug ON public.categories_subcategories (slug); END IF; END $$;"
  ];

  for (const sql of statements) {
    const { error } = await supabase.rpc('exec', { sql });
    if (error) {
      // Fallback: try using rest query interface when no RPC available
      console.warn('RPC exec not available or failed, skipping:', error.message);
    }
  }

  console.log('Applied demo columns if missing.');
}

main().catch(err => { console.error(err); process.exit(1); });



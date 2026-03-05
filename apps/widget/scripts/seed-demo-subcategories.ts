import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

type DemoSeed = {
  slug: string;
  demo_enabled?: boolean;
  demo_template_config?: any;
  demo_branding?: any;
  demo_prompt_template?: string;
  demo_suggestions?: any;
};

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const supabaseKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) as string;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { schema: 'public' }
  });

  const seedPath = path.resolve(process.cwd(), 'scripts', 'demo-subcategories.seed.json');
  const raw = fs.readFileSync(seedPath, 'utf-8');
  const items: DemoSeed[] = JSON.parse(raw);

  for (const item of items) {
    const { slug } = item;
    const { data: found, error } = await supabase
      .from('categories_subcategories')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !found) {
      console.warn(`Skipping slug ${slug}: not found`);
      continue;
    }

    const updatePayload: any = {
      demo_enabled: item.demo_enabled ?? true,
      demo_template_config: item.demo_template_config ?? null,
      demo_branding: item.demo_branding ?? null,
      demo_prompt_template: item.demo_prompt_template ?? null,
      demo_suggestions: item.demo_suggestions ?? null,
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



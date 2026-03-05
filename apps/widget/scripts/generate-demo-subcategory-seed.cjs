const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const BASE_CONFIG = Object.freeze({
  cta_text: "Get started by uploading a reference image or entering a prompt",
  logo_url: "",
  cta_color: "#374151",
  brand_name: "SIF - Demo - Home Services",
  title_text: "Create Amazing AI Images",
  cta_enabled: false,
  font_family: "Inter",
  layout_mode: "prompt-top",
  logo_height: 48,
  title_color: "#374151",
  demo_enabled: true,
  iframe_width: "500px",
  logo_enabled: false,
  shadow_style: "medium",
  border_radius: 8,
  cta_font_size: 16,
  iframe_border: true,
  iframe_height: "600px",
  iframe_shadow: "medium",
  primary_color: "#000000",
  prompt_margin: 0,
  title_enabled: false,
  base_font_size: 16,
  header_enabled: true,
  iframe_loading: "lazy",
  iframe_sandbox: "allow-scripts allow-same-origin allow-forms",
  prompt_padding: 16,
  cta_font_family: "Inter",
  demo_loop_count: 3,
  gallery_columns: 2,
  gallery_spacing: 16,
  overlay_enabled: true,
  secondary_color: "#ffffff",
  title_font_size: 20,
  background_color: "#ffffff",
  background_image: "",
  brand_name_color: "#1f2937",
  header_alignment: "center",
  iframe_scrolling: "auto",
  lead_step1_title: "Where should we send your AI-generated photos?",
  lead_step2_title: "One last thing! We'll send your photos right away...",
  prompt_font_size: 16,
  uploader_enabled: true,
  container_padding: 16,
  gallery_font_size: 14,
  logo_border_color: "#e5e7eb",
  logo_border_width: 0,
  mobile_font_scale: 0.9,
  overlay_font_size: 14,
  prompt_text_color: "#374151",
  suggestions_count: 3,
  title_font_family: "Inter",
  background_opacity: 1,
  brand_name_enabled: true,
  gallery_max_images: 1,
  logo_border_radius: 4,
  mobile_layout_mode: "prompt-top",
  overlay_icon_color: "#ffffff",
  prompt_font_family: "Inter",
  uploader_font_size: 14,
  background_gradient: "",
  demo_upload_message: "Upload your reference images to guide the AI",
  gallery_font_family: "Inter",
  iframe_border_color: "#e5e7eb",
  iframe_border_width: 1,
  overlay_font_family: "Inter",
  prompt_border_color: "#e2e8f0",
  prompt_border_style: "solid",
  prompt_border_width: 1,
  suggestions_enabled: true,
  uploader_icon_style: "folder",
  uploader_max_images: 1,
  uploader_text_color: "#475569",
  brand_name_font_size: 28,
  gallery_shadow_style: "medium",
  gallery_show_prompts: true,
  iframe_border_radius: 12,
  lead_capture_enabled: true,
  lead_capture_trigger: "submit",
  lead_modal_font_size: 14,
  prompt_border_radius: 12,
  prompt_section_width: 40,
  suggestion_font_size: 12,
  uploader_font_family: "Inter",
  container_padding_top: 24,
  demo_click_to_dismiss: false,
  gallery_border_radius: 12,
  iframe_referrerpolicy: "no-referrer-when-downgrade",
  lead_modal_text_color: "#000000",
  prompt_section_height: 30,
  suggestion_arrow_icon: true,
  suggestion_text_color: "#374151",
  uploader_border_color: "#cbd5e1",
  uploader_border_style: "dashed",
  uploader_border_width: 2,
  uploader_primary_text: "Add reference images to guide the AI generation",
  brand_name_font_family: "Inter",
  container_padding_left: 24,
  gallery_section_height: 70,
  lead_modal_font_family: "Inter",
  lead_step1_placeholder: "Enter your email",
  mobile_gallery_columns: 1,
  prompt_gallery_spacing: 24,
  prompt_input_font_size: 16,
  suggestion_font_family: "Inter",
  uploader_border_radius: 12,
  container_padding_right: 24,
  demo_generation_message: "Your AI-generated images will appear here",
  prompt_background_color: "transparent",
  prompt_input_text_color: "#1e293b",
  suggestion_border_color: "#e5e7eb",
  suggestion_border_style: "solid",
  suggestion_border_width: 1,
  suggestion_shadow_style: "subtle",
  uploader_secondary_text: "Drag & drop or click to upload",
  container_padding_bottom: 24,
  gallery_background_color: "transparent",
  iframe_allowtransparency: true,
  lead_modal_border_radius: 12,
  overlay_background_color: "rgba(0, 0, 0, 0.5)",
  overlay_download_enabled: true,
  prompt_input_font_family: "Inter",
  prompt_placeholder_color: "#64748b",
  prompt_section_alignment: "center",
  sidebar_background_color: "#ffffff",
  submit_button_text_color: "#ffffff",
  suggestion_border_radius: 8,
  overlay_reference_enabled: true,
  prompt_input_border_color: "#e2e8f0",
  prompt_input_border_style: "solid",
  prompt_input_border_width: 1,
  uploader_background_color: "#f1f5f9",
  gallery_image_border_color: "#e5e7eb",
  gallery_image_border_style: "solid",
  gallery_image_border_width: 1,
  prompt_input_border_radius: 8,
  prompt_overflow_protection: true,
  gallery_image_border_radius: 8,
  lead_modal_background_color: "#ffffff",
  lead_step2_name_placeholder: "What's your name?",
  submit_button_border_radius: 8,
  suggestion_background_color: "#ffffff",
  gallery_image_border_enabled: false,
  lead_step2_phone_placeholder: "Enter your phone number",
  prompt_input_background_color: "#f8fafc",
  gallery_container_border_color: "#e5e7eb",
  gallery_container_border_style: "solid",
  gallery_container_border_width: 1,
  prompt_input_placeholder_color: "#9ca3af",
  submit_button_background_color: "#3b82f6",
  gallery_container_border_radius: 12,
  gallery_container_border_enabled: false,
  submit_button_hover_background_color: "#2563eb"
});

function toBrandName(subcategory) {
  const base = (subcategory || 'Brand').trim();
  const title = base
    .split(/[-_\s]+/)
    .map(s => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' ');

  const prefixes = [
    'Acme', 'TrueClean', 'BrightPath', 'BluePeak', 'Prime', 'Nimbus', 'Atlas', 'Vertex', 'Summit', 'Pioneer',
    'Apex', 'Northstar', 'Keystone', 'Silverline', 'FirstChoice', 'NextGen', 'ClearView', 'ProCare', 'Evergreen'
  ];
  const suffixes = [
    'Co', 'Company', 'Inc', 'LLC', 'Group', 'Labs', 'Solutions', 'Design', 'Pros', 'Works'
  ];
  const patterns = [
    (t, p, s, sample) => `${p} ${sample}${t} ${s}`,
    (t, p, s, sample) => `${p} ${sample}${t}`,
    (t, p, s, sample) => `${t} ${s}`,
    (t, p, s, sample) => `${t} ${s}`,
    (t, p, s, sample) => `${p} ${sample}${t} ${s}`,
  ];

  const seed = (title + base).toLowerCase();
  const hash = seed.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 0);
  const p = prefixes[hash % prefixes.length];
  const s = suffixes[(hash >>> 3) % suffixes.length];
  const useSample = ((hash >>> 7) % 3) === 0; // ~33% include "Sample"
  const sample = useSample ? 'Sample ' : '';
  const pat = patterns[(hash >>> 5) % patterns.length];
  return pat(title, p, s, sample).replace(/\s+/g, ' ').trim();
}

function pickColor(seed) {
  const palette = ['#0ea5e9','#16a34a','#ef4444','#a855f7','#f59e0b','#0f766e','#111827','#1f2937','#06b6d4','#ea580c'];
  const idx = Math.abs((seed || '').split('').reduce((a,c)=>a+c.charCodeAt(0),0)) % palette.length;
  return palette[idx];
}

function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '#000000');
  if (!m) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}
function rgbToHex(r, g, b) {
  const toHex = (v) => v.toString(16).padStart(2, '0');
  return `#${toHex(clamp(Math.round(r),0,255))}${toHex(clamp(Math.round(g),0,255))}${toHex(clamp(Math.round(b),0,255))}`;
}
function lighten(hex, amount = 0.2) {
  const { r, g, b } = hexToRgb(hex);
  const nr = r + (255 - r) * amount;
  const ng = g + (255 - g) * amount;
  const nb = b + (255 - b) * amount;
  return rgbToHex(nr, ng, nb);
}
function darken(hex, amount = 0.15) {
  const { r, g, b } = hexToRgb(hex);
  const nr = r * (1 - amount);
  const ng = g * (1 - amount);
  const nb = b * (1 - amount);
  return rgbToHex(nr, ng, nb);
}

function initialsFrom(subcategory) {
  const words = String(subcategory || '')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);
  if (words.length === 0) return 'AI';
  const chars = words.slice(0, 2).map(w => w[0].toUpperCase());
  return chars.join('');
}

function monogramDataUrl(subcategory, colorHex) {
  const initials = initialsFrom(subcategory);
  const bg = colorHex || '#111827';
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <style>
      .text { font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, "Apple Color Emoji", "Segoe UI Emoji"; font-weight: 700; }
    </style>
  </defs>
  <rect width="128" height="128" rx="16" fill="${bg}"/>
  <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#ffffff" font-size="56" class="text">${initials}</text>
</svg>`;
  const base64 = Buffer.from(svg, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

function logoUrlFor(subcategory, colorHex) {
  // Stable SVG icons via Iconify; colorized to the niche theme color
  const key = (subcategory || '').toLowerCase();
  const mappings = [
    // Home services
    { match: ['window','windows'], icon: 'mdi:window-closed' },
    { match: ['roof','roofing'], icon: 'mdi:home-roof' },
    { match: ['siding'], icon: 'mdi:wall' },
    { match: ['gutter','gutters'], icon: 'mdi:water' },
    { match: ['door','garage door','garage'], icon: 'mdi:garage' },
    { match: ['paint','painting','wallpaper'], icon: 'mdi:format-paint' },
    { match: ['floor','flooring','carpet','tile','hardwood'], icon: 'mdi:floor-plan' },
    { match: ['kitchen','cabinet','countertop'], icon: 'mdi:stove' },
    { match: ['bath','bathroom','shower'], icon: 'mdi:shower' },
    { match: ['hvac','ac','air','heating','cooling'], icon: 'mdi:hvac' },
    { match: ['plumb','plumbing','pipe','drain'], icon: 'mdi:pipe' },
    { match: ['electric','electrical','wiring','lighting','light'], icon: 'mdi:lightbulb-on-outline' },
    { match: ['landscaping','landscape','lawn','garden','tree'], icon: 'mdi:grass' },
    { match: ['fence','fencing'], icon: 'mdi:fence' },
    { match: ['deck','patio','pergola','gazebo'], icon: 'mdi:deck' },
    { match: ['pave','paving','driveway','asphalt','concrete'], icon: 'mdi:road' },
    { match: ['pool','spa','hot tub'], icon: 'mdi:pool' },
    { match: ['insulation'], icon: 'mdi:home-thermometer' },
    { match: ['pest','termite','rodent'], icon: 'mdi:bug' },
    { match: ['security','camera','cctv'], icon: 'mdi:cctv' },
    { match: ['smart','automation'], icon: 'mdi:home-automation' },
    { match: ['irrigation','sprinkler'], icon: 'mdi:sprinkler' },
    { match: ['clean','cleaning','maid'], icon: 'mdi:broom' },
    { match: ['junk','haul','removal'], icon: 'mdi:dump-truck' },
    { match: ['moving','mover'], icon: 'mdi:truck' },
    // Beauty and wellness
    { match: ['makeup','cosmetic'], icon: 'mdi:lipstick' },
    { match: ['hair','barber','styling','color'], icon: 'mdi:hair-dryer' },
    { match: ['lash','lashes'], icon: 'mdi:eye' },
    { match: ['nail','manicure','pedicure'], icon: 'mdi:hand' },
    { match: ['tattoo'], icon: 'mdi:needle' },
    { match: ['rhinoplasty','implants','prosthetics'], icon: 'mdi:account' },
    // Medical/dental
    { match: ['dental','orthodont'], icon: 'mdi:tooth' },
    // E‑commerce/common retail
    { match: ['apparel','clothing','tailor'], icon: 'mdi:tshirt-crew' },
    { match: ['shoe','shoes'], icon: 'mdi:shoe-sneaker' },
    { match: ['handbag','purse'], icon: 'mdi:handbag' },
    { match: ['furniture','sofa'], icon: 'mdi:sofa' },
  ];
  let icon = null;
  for (const row of mappings) {
    if (row.match.some(m => key.includes(m))) { icon = row.icon; break; }
  }
  if (icon) {
    const colorParam = encodeURIComponent(colorHex || '#000000');
    return `https://api.iconify.design/${icon}.svg?color=${colorParam}`;
  }
  // Fallback: colorized monogram
  return monogramDataUrl(subcategory, colorHex);
}

function themeFor(subcategory) {
  const key = (subcategory || '').toLowerCase();
  const theming = [
    { match: ['landscape','lawn','garden','tree','irrigation','sprinkler'], primary: '#16a34a' }, // green
    { match: ['pave','paving','driveway','asphalt','concrete'], primary: '#374151' }, // charcoal
    { match: ['makeup','cosmetic','lashes','lash'], primary: '#ec4899' }, // pink
    { match: ['hair','barber','styling','color'], primary: '#f59e0b' }, // amber
    { match: ['nail','manicure','pedicure'], primary: '#e11d48' }, // rose
    { match: ['tattoo'], primary: '#111827' }, // near-black
    { match: ['pool','spa','hot tub'], primary: '#06b6d4' }, // cyan
    { match: ['solar'], primary: '#f59e0b' }, // amber
    { match: ['roof','roofing'], primary: '#1f2937' }, // slate
    { match: ['siding','window','windows','door','garage'], primary: '#0ea5e9' }, // blue
    { match: ['paint','painting','wallpaper'], primary: '#f59e0b' }, // amber
    { match: ['floor','flooring','tile','hardwood','carpet'], primary: '#8b5cf6' }, // violet
    { match: ['kitchen','cabinet','countertop'], primary: '#ea580c' }, // orange
    { match: ['plumb','plumbing','pipe','drain'], primary: '#0891b2' }, // teal
    { match: ['electric','electrical','wiring','lighting','light'], primary: '#22c55e' }, // green
    { match: ['security','camera','cctv'], primary: '#0ea5e9' }, // blue
    { match: ['deck','patio','pergola','gazebo'], primary: '#b45309' }, // brown/amber dark
    { match: ['clean','cleaning','maid'], primary: '#06b6d4' }, // cyan
    { match: ['junk','haul','removal','moving','mover'], primary: '#ef4444' }, // red
    { match: ['dental','orthodont'], primary: '#0ea5e9' }, // blue
    { match: ['furniture','sofa'], primary: '#8b5cf6' }, // violet
    { match: ['apparel','clothing','tailor','shoe','shoes','handbag','purse'], primary: '#111827' }, // neutral
  ];
  for (const row of theming) {
    if (row.match.some(m => key.includes(m))) return row.primary;
  }
  // default hashed color fallback
  return pickColor(key);
}

function themeKeyFor(subcategory) {
  const key = (subcategory || '').toLowerCase();
  const mapping = [
    { match: ['landscape','lawn','garden','tree','irrigation','sprinkler'], key: 'green' },
    { match: ['pave','paving','driveway','asphalt','concrete'], key: 'charcoal' },
    { match: ['makeup','cosmetic','lashes','lash'], key: 'pink' },
    { match: ['hair','barber','styling','color'], key: 'amber' },
    { match: ['nail','manicure','pedicure'], key: 'rose' },
    { match: ['tattoo'], key: 'neutral' },
    { match: ['pool','spa','hot tub'], key: 'cyan' },
    { match: ['solar'], key: 'amber' },
    { match: ['roof','roofing'], key: 'slate' },
    { match: ['siding','window','windows','door','garage'], key: 'cyan' },
    { match: ['paint','painting','wallpaper'], key: 'amber' },
    { match: ['floor','flooring','tile','hardwood','carpet'], key: 'violet' },
    { match: ['kitchen','cabinet','countertop'], key: 'orange' },
    { match: ['plumb','plumbing','pipe','drain'], key: 'teal' },
    { match: ['electric','electrical','wiring','lighting','light'], key: 'green' },
    { match: ['security','camera','cctv'], key: 'cyan' },
    { match: ['deck','patio','pergola','gazebo'], key: 'amber' },
    { match: ['clean','cleaning','maid'], key: 'cyan' },
    { match: ['junk','haul','removal','moving','mover'], key: 'pink' },
    { match: ['dental','orthodont'], key: 'cyan' },
    { match: ['furniture','sofa'], key: 'violet' },
  ];
  for (const row of mapping) {
    if (row.match.some(m => key.includes(m))) return row.key;
  }
  return 'neutral';
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase env vars');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    db: { schema: 'public' }
  });

  const { data, error } = await supabase
    .from('categories_subcategories')
    .select('slug, subcategory')
    .order('subcategory', { ascending: true });

  if (error) {
    console.error('Failed to load subcategories:', error.message);
    process.exit(1);
  }

  const items = (data || []).filter(row => !!row.slug).map(row => {
    const brand = toBrandName(row.subcategory);
    const color = themeFor(row.subcategory);
    const themeKey = themeKeyFor(row.subcategory);
    const minimalConfig = {
      brand_name: brand,
      logo_url: logoUrlFor(row.subcategory, color),
      theme_key: themeKey
    };
    return {
      slug: row.slug,
      demo_template_config: minimalConfig
    };
  });

  const outPath = path.resolve(process.cwd(), 'scripts', 'demo-subcategories.seed.json');
  fs.writeFileSync(outPath, JSON.stringify(items, null, 2));
  console.log(`Generated ${items.length} seed entries to ${outPath}`);
}

main().catch(e => { console.error(e); process.exit(1); });



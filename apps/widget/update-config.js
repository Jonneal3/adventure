const { createClient } = require('@supabase/supabase-js');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const instanceId = '701f3234-82b4-42f8-9cf5-5beac2c9f773';

// New config with green colors
const newConfig = {
  "cta_text": "Get started by uploading a reference image or entering a prompt",
  "logo_url": "",
  "cta_color": "#374151",
  "brand_name": "TEST INSTANCE",
  "title_text": "Create Amazing AI Images",
  "cta_enabled": false,
  "font_family": "Poppins",
  "layout_mode": "prompt-top",
  "logo_height": 48,
  "title_color": "#374151",
  "demo_enabled": true,
  "iframe_width": "592px",
  "logo_enabled": false,
  "shadow_style": "medium",
  "border_radius": 12,
  "cta_font_size": 16,
  "iframe_border": true,
  "iframe_height": "600px",
  "iframe_shadow": "medium",
  "primary_color": "#ca8a04",
  "title_enabled": false,
  "base_font_size": 20,
  "header_enabled": true,
  "iframe_loading": "lazy",
  "iframe_sandbox": "allow-scripts allow-same-origin allow-forms",
  "cta_font_family": "Inter",
  "demo_loop_count": 3,
  "gallery_columns": 2,
  "gallery_spacing": 16,
  "overlay_enabled": true,
  "secondary_color": "#dc2626",
  "title_font_size": 20,
  "background_color": "#f0fdf4",
  "brand_name_color": "#65a30d",
  "header_alignment": "center",
  "iframe_scrolling": "auto",
  "lead_step1_title": "Where should we send your AI-generated photos?",
  "lead_step2_title": "One last thing! We'll send your photos right away...",
  "prompt_font_size": 16,
  "uploader_enabled": true,
  "container_padding": 28,
  "logo_border_color": "#e5e7eb",
  "logo_border_width": 0,
  "mobile_font_scale": 0.9,
  "prompt_text_color": "#064e3b",
  "suggestions_count": 3,
  "title_font_family": "Inter",
  "brand_name_enabled": true,
  "gallery_max_images": 2,
  "logo_border_radius": 4,
  "mobile_layout_mode": "prompt-top",
  "prompt_font_family": "Inter",
  "demo_upload_message": "Upload your reference images to guide the AI",
  "iframe_border_color": "#e5e7eb",
  "iframe_border_width": 1,
  "prompt_border_color": "#6ee7b7",
  "prompt_border_style": "solid",
  "prompt_border_width": 1,
  "suggestions_enabled": true,
  "uploader_icon_style": "folder",
  "uploader_max_images": 1,
  "uploader_text_color": "#047857",
  "brand_name_font_size": 28,
  "gallery_show_prompts": true,
  "iframe_border_radius": 12,
  "lead_capture_enabled": false,
  "prompt_border_radius": 12,
  "prompt_section_width": 20,
  "container_padding_top": 10,
  "demo_click_to_dismiss": true,
  "iframe_referrerpolicy": "no-referrer-when-downgrade",
  "lead_modal_text_color": "#000000",
  "prompt_section_height": 30,
  "suggestion_arrow_icon": true,
  "suggestion_text_color": "#064e3b",
  "uploader_border_color": "#6ee7b7",
  "uploader_primary_text": "Add reference images to guide the AI generation",
  "brand_name_font_family": "Inter",
  "container_padding_left": 10,
  "gallery_section_height": 70,
  "lead_step1_placeholder": "Enter your email",
  "mobile_gallery_columns": 1,
  "prompt_gallery_spacing": 24,
  "prompt_input_font_size": 16,
  "container_padding_right": 10,
  "demo_generation_message": "Your AI-generated images will appear here",
  "prompt_background_color": "#f0fdf4",
  "prompt_input_text_color": "#064e3b",
  "suggestion_border_color": "#6ee7b7",
  "uploader_secondary_text": "Drag & drop or click to upload",
  "container_padding_bottom": 10,
  "iframe_allowtransparency": true,
  "lead_modal_border_radius": 12,
  "overlay_download_enabled": true,
  "prompt_input_font_family": "Inter",
  "prompt_placeholder_color": "#047857",
  "prompt_section_alignment": "center",
  "submit_button_text_color": "#ffffff",
  "overlay_reference_enabled": true,
  "prompt_input_border_color": "#6ee7b7",
  "prompt_input_border_style": "solid",
  "prompt_input_border_width": 1,
  "uploader_background_color": "#f0fdf4",
  "prompt_input_border_radius": 8,
  "lead_modal_background_color": "#ffffff",
  "lead_step2_name_placeholder": "What's your name?",
  "suggestion_background_color": "#ffffff",
  "lead_step2_phone_placeholder": "Enter your phone number",
  "prompt_input_background_color": "#ffffff",
  "prompt_input_placeholder_color": "#047857",
  "submit_button_background_color": "#059669",
  "submit_button_hover_background_color": "#047857"
};

async function updateConfig() {
  console.log('🔄 Updating config for instance:', instanceId);
  
  try {
    // First, let's check the current config
    const { data: currentInstance, error: fetchError } = await supabase
      .from('instances')
      .select('config, updated_at, name')
      .eq('id', instanceId)
      .single();
      
    if (fetchError) {
      console.error('❌ Error fetching current config:', fetchError);
      return;
    }
    
    console.log('📋 Current config colors:', {
      primary_color: currentInstance.config?.primary_color,
      secondary_color: currentInstance.config?.secondary_color,
      background_color: currentInstance.config?.background_color,
      prompt_text_color: currentInstance.config?.prompt_text_color,
      updated_at: currentInstance.updated_at
    });
    
    // Update the config
    const { data: updatedInstance, error: updateError } = await supabase
      .from('instances')
      .update({ 
        config: newConfig,
        updated_at: new Date().toISOString()
      })
      .eq('id', instanceId)
      .select('config, updated_at, name')
      .single();
      
    if (updateError) {
      console.error('❌ Error updating config:', updateError);
      return;
    }
    
    console.log('✅ Config updated successfully!');
    console.log('📋 New config colors:', {
      primary_color: updatedInstance.config?.primary_color,
      secondary_color: updatedInstance.config?.secondary_color,
      background_color: updatedInstance.config?.background_color,
      prompt_text_color: updatedInstance.config?.prompt_text_color,
      updated_at: updatedInstance.updated_at
    });
    
  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

updateConfig();

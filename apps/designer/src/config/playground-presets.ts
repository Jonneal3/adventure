import type { DesignSettings } from "@mage/types";

/**
 * Playground presets
 * ------------------
 * We only have one runtime route now: `/adventure/:instanceId`.
 *
 * Playground is responsible for demonstrating *different experiences* by applying
 * saved preset config templates (Internal vs Form), then layering on:
 * - the selected vertical's `categories_subcategories.demo_template_config`
 * - the selected theme patch (colors only)
 *
 * These presets should stay stable and human-editable.
 */

export const PLAYGROUND_PRESET_INTERNAL = {
  // Experience: internal tool (sales / live demos)
  form_status_enabled: false,
  form_show_progress_bar: false,
  form_show_step_descriptions: false,

  // Internal tends to be "clean" and non-lead-capture
  lead_capture_enabled: false,
  demo_enabled: false,

  // Layout + sizing
  layout_mode: "left-right",
  prompt_section_width: 44,
  prompt_gallery_spacing: 14,
  iframe_width: "1100",
  iframe_height: "720",

  // Gallery tends to be real results (no placeholders)
  gallery_show_placeholder_images: false,

  // Suggestions currently disabled across product
  suggestions_enabled: false,
} as any as Partial<DesignSettings>;

export const PLAYGROUND_PRESET_FORM = {
  // Experience: AI Form (flow)
  form_status_enabled: true,
  form_show_progress_bar: true,
  form_show_step_descriptions: true,

  // Form demos should feel more "marketing / conversion"
  lead_capture_enabled: true,
  lead_capture_trigger: "submit" as any,

  // Layout + sizing
  layout_mode: "prompt-top",
  iframe_width: "900",
  iframe_height: "650",

  // Form experiences typically don't rely on placeholder galleries
  gallery_show_placeholder_images: false,

  // Suggestions currently disabled across product
  suggestions_enabled: false,
} as any as Partial<DesignSettings>;

export const PLAYGROUND_PRESETS: Record<"internal" | "form", Partial<DesignSettings>> = {
  internal: PLAYGROUND_PRESET_INTERNAL,
  form: PLAYGROUND_PRESET_FORM,
};

/**
 * UI Step types for the AI form flow (the "Real Schema").
 *
 * Treat `ui_step.schema.json` as the canonical source of truth; this file is a
 * convenient TS mirror for UI consumption.
 */
export type UIStepType =
  | "intro"
  | "text_input"
  | "text"
  | "prompt_input"
  | "promptInput"
  | "multiple_choice"
  | "choice"
  | "segmented_choice"
  | "chips_multi"
  | "yes_no"
  | "image_choice_grid"
  | "rating"
  | "slider"
  | "range_slider"
  | "file_upload"
  | "upload"
  | "file_picker"
  | "budget_cards"
  | "date_picker"
  | "color_picker"
  | "searchable_select"
  | "gallery"
  | "lead_capture"
  | "pricing"
  | "confirmation"
  | "designer"
  | "composite";

export type UIOption = {
  label: string;
  value: string;
  description?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
};

export type UIStepComponent = {
  type: string;
  key?: string;
  text?: string | null;
  required?: boolean | null;
  props?: Record<string, any> | null;
};

export type UIStepBlueprint = {
  components?: UIStepComponent[] | null;
  validation?: Record<string, any> | null;
  presentation?: {
    continue_label?: string | null;
    auto_advance?: boolean | null;
  } | null;
  ai_hint?: string | null;
};

export type UIStepBase = {
  id: string;
  type: UIStepType;
  question: string;
  humanism?: string | null;
  visual_hint?: string | null;
  required?: boolean | null;
  metric_gain?: number | null;
  blueprint?: UIStepBlueprint | null;
};

export type TextInputUI = UIStepBase & {
  type: "text_input" | "text";
  max_length?: number | null;
  placeholder?: string | null;
  multiline?: boolean | null;
};

export type PromptInputUI = UIStepBase & {
  type: "prompt_input" | "promptInput";
  max_length?: number | null;
  placeholder?: string | null;
  multiline?: boolean | null;
};

export type MultipleChoiceUI = UIStepBase & {
  type:
    | "multiple_choice"
    | "choice"
    | "segmented_choice"
    | "chips_multi"
    | "yes_no"
    | "image_choice_grid";
  options: UIOption[];
  multi_select?: boolean | null;
  min_selections?: number | null;
  max_selections?: number | null;
  min_options?: number | null;
  max_options?: number | null;
  allow_other?: boolean | null;
  other_label?: string | null;
  other_placeholder?: string | null;
  other_requires_text?: boolean | null;
  imageChoiceVariant?: "swipe" | "selectors" | null;
  variant?: "list" | "grid" | "compact" | "cards" | null;
  columns?: number | null;
};

export type RatingUI = UIStepBase & {
  type: "rating";
  scale_min: number;
  scale_max: number;
  step?: number | null;
  anchors?: Record<string, string> | null;
};

export type SliderUI = UIStepBase & {
  type: "slider";
  min: number;
  max: number;
  step?: number | null;
  unit?: string | null;
  currency?: string | null;
  format?: "currency" | null;
  prefix?: string;
  suffix?: string;
};

export type RangeSliderUI = UIStepBase & {
  type: "range_slider";
  min: number;
  max: number;
  step?: number | null;
  unit?: string | null;
  format?: "currency" | null;
  prefix?: string;
  suffix?: string;
};

export type FileUploadUI = UIStepBase & {
  type: "file_upload" | "upload" | "file_picker";
  allowed_file_types?: string[] | null;
  max_size_mb?: number | null;
  upload_role?: string | null;
  max_files?: number | null;
  allow_skip?: boolean | null;
};

export type BudgetCardsUI = UIStepBase & {
  type: "budget_cards";
  ranges: Array<Record<string, any>>;
  allow_custom?: boolean | null;
  custom_min?: number | null;
  custom_max?: number | null;
  currency_code?: string | null;
};

export type IntroUI = UIStepBase & {
  type: "intro";
  brand?: string | null;
  bullets?: string[] | null;
};

export type DatePickerUI = UIStepBase & {
  type: "date_picker";
  min_date?: string | null;
  max_date?: string | null;
};

export type ColorPickerUI = UIStepBase & {
  type: "color_picker";
  colors?: string[] | null;
};

export type SearchableSelectUI = UIStepBase & {
  type: "searchable_select";
  options: UIOption[];
  multi_select?: boolean | null;
  max_selections?: number | null;
  search_placeholder?: string | null;
};

export type GalleryUI = UIStepBase & {
  type: "gallery";
  subtext?: string | null;
};

export type LeadCaptureUI = UIStepBase & {
  type: "lead_capture";
  required_inputs?: Array<"email" | "phone" | "name"> | null;
  require_terms?: boolean | null;
  compact?: boolean | null;
};

export type PricingUI = UIStepBase & {
  type: "pricing";
  pricing_breakdown?: Array<{ label: string; amount: number; unit?: string | null }> | null;
  total_amount?: number | null;
  currency_code?: string | null;
  call_to_action?: string | null;
};

export type ConfirmationUI = UIStepBase & {
  type: "confirmation";
  summary_text?: string | null;
  confirmation_message?: string | null;
};

export type DesignerUI = UIStepBase & {
  type: "designer";
  allow_refinements?: boolean | null;
};

export type CompositeUI = UIStepBase & {
  type: "composite";
  blocks: Array<Record<string, any>>;
};

export type UIStep =
  | IntroUI
  | TextInputUI
  | PromptInputUI
  | MultipleChoiceUI
  | RatingUI
  | SliderUI
  | RangeSliderUI
  | FileUploadUI
  | BudgetCardsUI
  | DatePickerUI
  | ColorPickerUI
  | SearchableSelectUI
  | GalleryUI
  | LeadCaptureUI
  | PricingUI
  | ConfirmationUI
  | DesignerUI
  | CompositeUI;


// AI Form Type Definitions
// Separate from DesignSettings - this is for AI form mode

export type FlowQuestionType = 
  | 'text' 
  | 'textarea' 
  | 'select' 
  | 'multi-select' 
  | 'color' 
  | 'style' 
  | 'material' 
  | 'image-upload' 
  | 'number' 
  | 'range' 
  | 'boolean';

export type FlowStepType = 
  | 'question' 
  | 'design' 
  | 'review' 
  | 'custom';

export type DesignGenerationStrategy = 
  | 'progressive'  // Generate after each question/step
  | 'after_all'    // Generate after all questions
  | 'custom';      // Custom triggers

export type QuestionGenerationMode = 
  | 'ai'      // AI-generated questions (future)
  | 'manual'  // Manually configured questions
  | 'hybrid'; // Mix of AI and manual

// Flow Question Configuration
export interface FlowQuestion {
  id: string;
  type: FlowQuestionType;
  label: string;
  placeholder?: string;
  description?: string;
  required?: boolean;
  
  // Field-specific options
  options?: Array<{ value: string; label: string }>; // For select, multi-select
  min?: number; // For number, range
  max?: number; // For number, range
  step?: number; // For number, range
  default?: string | number | boolean | string[]; // Default value
  
  // Validation
  validation?: {
    pattern?: string; // Regex pattern
    minLength?: number;
    maxLength?: number;
    custom?: string; // Custom validation function name
  };
  
  // Category/subcategory context
  categoryContext?: {
    categoryId?: string;
    subcategoryId?: string;
    showFor?: string[]; // Array of category/subcategory IDs
    hideFor?: string[]; // Array of category/subcategory IDs
  };
  
  // Component-specific settings
  componentSettings?: {
    colorPicker?: {
      showAlpha?: boolean;
      presetColors?: string[];
    };
    styleSelector?: {
      displayMode?: 'grid' | 'list' | 'cards';
      showImages?: boolean;
    };
    materialSelector?: {
      source?: 'inventory' | 'preset' | 'both';
      category?: string;
    };
    imageUpload?: {
      maxFiles?: number;
      maxSize?: number; // in MB
      acceptedTypes?: string[];
    };
  };
}

// Flow Step Configuration
export interface FlowStep {
  id: string;
  type: FlowStepType;
  order: number;
  title?: string;
  description?: string;
  
  // Question configuration (if type is 'question')
  question?: FlowQuestion;
  questions?: FlowQuestion[]; // Multiple questions in one step
  
  // Design generation trigger
  designTrigger?: {
    generateAfter?: boolean; // Generate after this step
    generateBefore?: boolean; // Generate before this step
    conditions?: {
      // Only generate if certain answers exist
      requiredAnswers?: string[]; // Array of question IDs
    };
  };
  
  // Component to render
  componentType?: string; // Which component to use for this step
  
  // Conditional display
  conditions?: {
    // Show this step only if...
    showIf?: {
      questionId: string;
      operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
      value: any;
    }[];
    // Hide this step if...
    hideIf?: {
      questionId: string;
      operator: 'equals' | 'not_equals' | 'contains';
      value: any;
    }[];
  };
  
  // Step-specific settings
  settings?: {
    showProgress?: boolean;
    allowSkip?: boolean;
    allowBack?: boolean;
    showDesignPreview?: boolean;
  };
}

// Flow Component Definition
export interface FlowComponent {
  id: string;
  name: string;
  type: string;
  description?: string;
  config?: Record<string, any>;
}

// Flow Data Collection Configuration
export interface FlowDataCollection {
  fields: FlowField[];
  requiredFields: string[]; // Array of field IDs
  exportFormat?: 'json' | 'csv' | 'webhook';
  webhookMapping?: Record<string, string>; // Map flow fields to webhook fields
}

export interface FlowField {
  id: string;
  name: string;
  type: string;
  source: 'answer' | 'generated' | 'system'; // Where the data comes from
  questionId?: string; // If source is 'answer', which question
  transform?: string; // Optional transformation function name
}

// Main Flow Configuration
export interface FlowConfig {
  // Basic settings
  enabled: boolean;
  name?: string;
  description?: string;
  
  // Steps configuration
  steps: FlowStep[];
  
  // Question generation
  questionGenerationMode: QuestionGenerationMode;
  
  // Design generation strategy
  designGenerationStrategy: DesignGenerationStrategy;
  designGenerationTriggers?: {
    afterSteps?: number[]; // Generate after these step indices
    afterQuestions?: string[]; // Generate after these question IDs
    custom?: {
      stepId: string;
      trigger: 'before' | 'after';
    }[];
  };
  
  // Data collection
  dataCollection: FlowDataCollection;
  
  // Component library
  componentLibrary?: FlowComponent[];
  
  // Design settings (all DesignSettings fields except form-overlay and demo_overlay)
  // This mirrors DesignSettings but for AI form mode
  design?: {
    // ===========================================
    // OVERALL STYLE SETTINGS
    // ===========================================
    background_color?: string;
    background_opacity?: number;
    background_gradient?: string;
    background_image?: string;
    container_padding?: number;
    container_padding_top?: number;
    container_padding_right?: number;
    container_padding_bottom?: number;
    container_padding_left?: number;
    border_radius?: number;
    shadow_style?: 'none' | 'subtle' | 'medium' | 'large' | 'glow';
    sidebar_background_color?: string;
    
    // ===========================================
    // PREVIEW SETTINGS
    // ===========================================
    max_width?: number;
    max_height?: number;
    scale_factor?: number;
    
    // ===========================================
    // LAYOUT CONFIGURATION
    // ===========================================
    layout_mode?: 'left-right' | 'right-left' | 'prompt-top' | 'prompt-bottom' | 'mobile-optimized';
    prompt_section_width?: number;
    prompt_section_height?: number;
    prompt_gallery_spacing?: number;
    gallery_section_height?: number;
    
    // ===========================================
    // PROMPT SECTION
    // ===========================================
    prompt_background_color?: string;
    prompt_border_style?: 'solid' | 'dashed' | 'dotted' | 'none';
    prompt_border_color?: string;
    prompt_border_width?: number;
    prompt_border_radius?: number;
    prompt_text_color?: string;
    prompt_font_family?: string;
    prompt_font_size?: number;
    prompt_placeholder_color?: string;
    prompt_section_alignment?: 'left' | 'center' | 'right';
    prompt_padding?: number;
    prompt_margin?: number;
    prompt_overflow_protection?: boolean;
    submit_button_background_color?: string;
    submit_button_text_color?: string;
    submit_button_hover_background_color?: string;
    submit_button_border_radius?: number;
    
    // ===========================================
    // PROMPT INPUT FIELD
    // ===========================================
    prompt_input_background_color?: string;
    prompt_input_border_style?: 'solid' | 'dashed' | 'dotted' | 'none';
    prompt_input_border_color?: string;
    prompt_input_border_width?: number;
    prompt_input_border_radius?: number;
    prompt_input_text_color?: string;
    prompt_input_font_family?: string;
    prompt_input_font_size?: number;
    prompt_input_placeholder_color?: string;
    
    // ===========================================
    // HEADER SECTION
    // ===========================================
    header_enabled?: boolean;
    header_alignment?: 'left' | 'center' | 'right';
    logo_enabled?: boolean;
    logo_url?: string;
    logo_height?: number;
    logo_border_width?: number;
    logo_border_color?: string;
    logo_border_radius?: number;
    brand_name?: string;
    brand_name_enabled?: boolean;
    brand_name_color?: string;
    brand_name_font_family?: string;
    brand_name_font_size?: number;
    
    // ===========================================
    // TITLE/CTA SECTION
    // ===========================================
    title_enabled?: boolean;
    title_text?: string;
    title_color?: string;
    title_font_family?: string;
    title_font_size?: number;
    cta_text?: string;
    cta_enabled?: boolean;
    cta_font_family?: string;
    cta_font_size?: number;
    cta_color?: string;
    
    // ===========================================
    // IFRAME SETTINGS
    // ===========================================
    iframe_width?: string;
    iframe_height?: string;
    iframe_border?: boolean;
    iframe_border_width?: number;
    iframe_border_color?: string;
    iframe_border_radius?: number;
    iframe_shadow?: 'none' | 'subtle' | 'medium' | 'large' | 'glow';
    iframe_loading?: 'lazy' | 'eager';
    iframe_sandbox?: string;
    iframe_referrerpolicy?: string;
    iframe_allowtransparency?: boolean;
    iframe_scrolling?: 'auto' | 'yes' | 'no';
    
    // ===========================================
    // IMAGE UPLOADER SECTION
    // ===========================================
    uploader_enabled?: boolean;
    uploader_max_images?: number;
    uploader_background_color?: string;
    uploader_border_style?: 'solid' | 'dashed' | 'dotted' | 'none';
    uploader_border_color?: string;
    uploader_border_width?: number;
    uploader_border_radius?: number;
    uploader_text_color?: string;
    uploader_font_family?: string;
    uploader_font_size?: number;
    uploader_icon_style?: string;
    uploader_primary_text?: string;
    uploader_secondary_text?: string;
    
    // Suggestion Buttons
    suggestions_enabled?: boolean;
    suggestions_count?: number;
    suggestion_background_color?: string;
    suggestion_text_color?: string;
    suggestion_border_style?: 'solid' | 'dashed' | 'dotted' | 'none';
    suggestion_border_color?: string;
    suggestion_border_width?: number;
    suggestion_border_radius?: number;
    suggestion_font_family?: string;
    suggestion_font_size?: number;
    suggestion_shadow_style?: 'none' | 'subtle' | 'medium' | 'large' | 'glow';
    suggestion_arrow_icon?: boolean;
    
    // ===========================================
    // IMAGE GALLERY SECTION
    // ===========================================
    gallery_background_color?: string;
    gallery_border_radius?: number;
    gallery_spacing?: number;
    gallery_columns?: number;
    gallery_max_images?: number;
    gallery_shadow_style?: 'none' | 'subtle' | 'medium' | 'large' | 'glow';
    gallery_font_family?: string;
    gallery_font_size?: number;
    gallery_container_border_enabled?: boolean;
    gallery_container_border_width?: number;
    gallery_container_border_color?: string;
    gallery_container_border_style?: 'solid' | 'dashed' | 'dotted' | 'none';
    gallery_container_border_radius?: number;
    gallery_image_border_enabled?: boolean;
    gallery_image_border_width?: number;
    gallery_image_border_color?: string;
    gallery_image_border_style?: 'solid' | 'dashed' | 'dotted' | 'none';
    gallery_image_border_radius?: number;
    overlay_enabled?: boolean;
    overlay_download_enabled?: boolean;
    overlay_reference_enabled?: boolean;
    overlay_background_color?: string;
    overlay_icon_color?: string;
    overlay_font_family?: string;
    overlay_font_size?: number;
    gallery_show_prompts?: boolean;
    
    // ===========================================
    // RESPONSIVE SETTINGS
    // ===========================================
    mobile_layout_mode?: 'left-right' | 'right-left' | 'prompt-top' | 'prompt-bottom' | 'mobile-optimized';
    mobile_gallery_columns?: number;
    mobile_font_scale?: number;
    
    // Branding
    primary_color?: string;
    secondary_color?: string;
    font_family?: string;
    base_font_size?: number;
    
    // Modal settings
    modal_backdrop_color?: string;
    modal_backdrop_opacity?: number;
    modal_width?: string;
    modal_height?: string;
    modal_max_width?: number;
    modal_max_height?: number;
    modal_border_radius?: number;
    modal_background_color?: string;
    modal_show_close_button?: boolean;
    modal_close_button_color?: string;
    modal_close_button_hover_color?: string;
    modal_close_on_backdrop?: boolean;
    modal_close_on_escape?: boolean;
    modal_animation_type?: 'fade' | 'slide-up' | 'slide-down' | 'scale';
    modal_animation_duration?: number;
    modal_position?: 'center' | 'top' | 'bottom';
    
    // Standalone settings
    full_width_layout?: boolean;
    sticky_header?: boolean;
    show_page_title?: boolean;
    show_breadcrumbs?: boolean;
    show_back_button?: boolean;
    page_background_color?: string;
    content_max_width?: number;
  };
  
  // Layout
  layout?: {
    questionPosition?: 'left' | 'right' | 'top' | 'bottom';
    designPreviewPosition?: 'left' | 'right' | 'top' | 'bottom';
    showProgressBar?: boolean;
    showStepNumbers?: boolean;
  };
  
  // Completion settings
  completion?: {
    showSummary?: boolean;
    allowDownload?: boolean;
    allowShare?: boolean;
    redirectUrl?: string;
    completionMessage?: string;
  };
  
  // Integration settings
  integrations?: {
    inventory?: {
      enabled: boolean;
      source?: string;
      syncFields?: string[];
    };
    crm?: {
      enabled: boolean;
      mapping?: Record<string, string>;
    };
  };
}

// Flow State (runtime state, not config)
export interface FlowState {
  currentStepIndex: number;
  answers: Record<string, any>; // questionId -> answer
  generatedDesigns: Array<{
    id: string;
    imageUrl: string;
    prompt: string;
    stepIndex: number;
    timestamp: string;
  }>;
  completed: boolean;
  startedAt: string;
  lastUpdatedAt: string;
}

// Flow Submission (stored in form_submissions table with submission_type='flow')
// Uses existing form_submissions table with additional flow-specific columns
export interface FlowSubmission {
  id: string;
  instance_id: string;
  account_id?: string;
  email: string; // Required by form_submissions
  name?: string;
  phone?: string;
  submission_type: 'flow';
  current_step: number;
  answers: Record<string, any>; // Stored in submission_data JSONB
  generated_designs?: Array<{
    id: string;
    imageUrl: string;
    prompt: string;
    stepIndex: number;
    timestamp: string;
  }>;
  status: 'in_progress' | 'completed' | 'abandoned';
  category_id?: string;
  subcategory_id?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  // Additional form_submissions fields
  session_id?: string;
  submission_data?: Record<string, any>; // Can store flow answers here too
}

// NOTE: We intentionally do not support "question_templates" stored in the DB.
// Flow questions should come from the instance's flow_config (manual builder)
// or be generated dynamically by an AI endpoint (future).

# AI Form (Flow) Config Structure

This document describes the complete `FlowConfig` structure that is passed to the widget for rendering AI forms.

## Overview

The `FlowConfig` is stored in the `instances.flow_config` column in Supabase and contains all configuration needed to render and operate an AI form.

## Complete Config Structure

```typescript
interface FlowConfig {
  // ===========================================
  // BASIC SETTINGS
  // ===========================================
  enabled: boolean;                    // Whether AI form is enabled for this instance
  name?: string;                       // Form name/title
  description?: string;                // Form description
  
  // ===========================================
  // STEPS CONFIGURATION
  // ===========================================
  steps: FlowStep[];                   // Array of form steps/questions
  
  // ===========================================
  // QUESTION GENERATION
  // ===========================================
  questionGenerationMode: 'ai' | 'manual' | 'hybrid';
  
  // ===========================================
  // DESIGN GENERATION STRATEGY
  // ===========================================
  designGenerationStrategy: 'progressive' | 'after_all' | 'custom';
  designGenerationTriggers?: {
    afterSteps?: number[];             // Generate after these step indices
    afterQuestions?: string[];          // Generate after these question IDs
    custom?: {
      stepId: string;
      trigger: 'before' | 'after';
    }[];
  };
  
  // ===========================================
  // DATA COLLECTION
  // ===========================================
  dataCollection: {
    fields: FlowField[];
    requiredFields: string[];          // Array of field IDs
    exportFormat?: 'json' | 'csv' | 'webhook';
    webhookMapping?: Record<string, string>;
  };
  
  // ===========================================
  // COMPONENT LIBRARY (optional)
  // ===========================================
  componentLibrary?: FlowComponent[];
  
  // ===========================================
  // DESIGN SETTINGS
  // ===========================================
  // Only form-relevant fields are saved (widget-specific fields are filtered out)
  design?: {
    // Overall Styling
    background_color?: string;          // Form background color (hex)
    background_opacity?: number;        // 0-1 for transparency
    background_gradient?: string;       // CSS gradient string
    background_image?: string;          // Background image URL
    container_padding?: number;         // Padding around form container
    container_padding_top?: number;
    container_padding_right?: number;
    container_padding_bottom?: number;
    container_padding_left?: number;
    border_radius?: number;            // Overall border radius
    max_width?: number;                 // Max width in pixels
    max_height?: number;                // Max height in pixels
    
    // Branding
    primary_color?: string;            // Brand/primary color (used for buttons, highlights)
    secondary_color?: string;           // Secondary brand color
    font_family?: string;               // Default font family (e.g., "Inter", "Poppins")
    base_font_size?: number;           // Base font size in pixels
    
    // Question Box / Step Container Styling
    prompt_background_color?: string;   // Background color for question boxes
    prompt_text_color?: string;         // Text color in question boxes
    prompt_font_family?: string;        // Font for question text
    prompt_font_size?: number;          // Font size for questions
    prompt_border_color?: string;       // Border color for question boxes
    prompt_border_width?: number;       // Border width (0-4)
    prompt_border_style?: 'solid' | 'dashed' | 'dotted' | 'none';
    prompt_border_radius?: number;       // Corner radius for question boxes
    prompt_placeholder_color?: string;   // Placeholder text color
    
    // Button Styling
    submit_button_background_color?: string;  // Button background (or 'transparent' for outline)
    submit_button_text_color?: string;        // Button text color
    submit_button_hover_background_color?: string; // Hover state background
    
    // Modal Settings (if form is shown in modal)
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
  };
  
  // ===========================================
  // LAYOUT SETTINGS
  // ===========================================
  layout?: {
    questionPosition?: 'left' | 'right' | 'top' | 'bottom';
    designPreviewPosition?: 'left' | 'right' | 'top' | 'bottom';
    showProgressBar?: boolean;
    showStepNumbers?: boolean;
  };
  
  // ===========================================
  // COMPLETION SETTINGS
  // ===========================================
  completion?: {
    showSummary?: boolean;
    allowDownload?: boolean;
    allowShare?: boolean;
    redirectUrl?: string;
    completionMessage?: string;
  };
  
  // ===========================================
  // INTEGRATION SETTINGS
  // ===========================================
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
```

## FlowStep Structure

```typescript
interface FlowStep {
  id: string;                          // Unique step ID
  type: 'question' | 'design' | 'review' | 'custom';
  order: number;                       // Display order
  title?: string;                      // Step title
  description?: string;               // Step description
  
  // Question configuration
  question?: FlowQuestion;              // Single question
  questions?: FlowQuestion[];          // Multiple questions in one step
  
  // Design generation trigger
  designTrigger?: {
    generateAfter?: boolean;
    generateBefore?: boolean;
    conditions?: {
      requiredAnswers?: string[];
    };
  };
  
  // Conditional display
  conditions?: {
    showIf?: {
      questionId: string;
      operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
      value: any;
    }[];
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
```

## FlowQuestion Structure

```typescript
interface FlowQuestion {
  id: string;                          // Unique question ID
  type: 'text' | 'textarea' | 'select' | 'multi-select' | 'color' | 'style' | 
        'material' | 'image-upload' | 'number' | 'range' | 'boolean';
  label: string;                        // Question label
  placeholder?: string;                 // Input placeholder
  description?: string;                 // Help text
  required?: boolean;                    // Is this field required?
  
  // Field-specific options
  options?: Array<{ value: string; label: string }>; // For select, multi-select
  min?: number;                         // For number, range
  max?: number;                         // For number, range
  step?: number;                        // For number, range
  default?: string | number | boolean | string[]; // Default value
  
  // Validation
  validation?: {
    pattern?: string;                    // Regex pattern
    minLength?: number;
    maxLength?: number;
    custom?: string;                    // Custom validation function name
  };
  
  // Category/subcategory context
  categoryContext?: {
    categoryId?: string;
    subcategoryId?: string;
    showFor?: string[];                  // Show for these category/subcategory IDs
    hideFor?: string[];                  // Hide for these category/subcategory IDs
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
      maxSize?: number;                 // in MB
      acceptedTypes?: string[];
    };
  };
}
```

## Example Config

```json
{
  "enabled": true,
  "name": "Product Customization Form",
  "description": "Collect preferences and generate designs",
  "steps": [
    {
      "id": "step-1",
      "type": "question",
      "order": 1,
      "title": "Choose Your Style",
      "question": {
        "id": "q-style",
        "type": "select",
        "label": "What style are you looking for?",
        "required": true,
        "options": [
          { "value": "modern", "label": "Modern" },
          { "value": "classic", "label": "Classic" },
          { "value": "minimal", "label": "Minimal" }
        ]
      }
    }
  ],
  "questionGenerationMode": "manual",
  "designGenerationStrategy": "progressive",
  "dataCollection": {
    "fields": [
      {
        "id": "style",
        "name": "Style",
        "type": "string",
        "source": "answer",
        "questionId": "q-style"
      }
    ],
    "requiredFields": ["style"]
  },
  "design": {
    "background_color": "#ffffff",
    "primary_color": "#3b82f6",
    "font_family": "Inter",
    "prompt_background_color": "#f9fafb",
    "prompt_border_radius": 12,
    "submit_button_background_color": "#3b82f6",
    "submit_button_text_color": "#ffffff",
    "max_width": 800,
    "container_padding": 24
  },
  "layout": {
    "showProgressBar": true,
    "showStepNumbers": true
  }
}
```

## How Widget Receives Config

1. **Initial Load**: Widget fetches `flow_config` from `instances` table via Supabase
2. **Real-time Updates**: Widget listens for `UPDATE_FLOW_CONFIG` postMessage events from designer
3. **Config Location**: `instances.flow_config` JSONB column in Supabase

## Important Notes

- **Design fields are filtered**: Only form-relevant design fields are saved (widget-specific fields like `gallery_*`, `demo_*`, `overlay_*` are filtered out)
- **Real-time updates**: Design changes in the designer are sent via `postMessage` with type `UPDATE_FLOW_CONFIG`
- **Config structure**: The entire `FlowConfig` object is stored, but only `design` subset is sent for real-time updates

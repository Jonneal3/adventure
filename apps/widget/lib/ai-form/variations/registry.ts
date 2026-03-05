/**
 * Step Variation Registry
 * 
 * Central catalog of all possible variations for each StepIntent.
 * DSPy uses this to choose the best variation based on context.
 */

import type { StepIntent, StepIntentCatalog } from "./schema";

export const STEP_VARIATION_CATALOG: Record<StepIntent, StepIntentCatalog> = {
  collect_lead: {
    stepIntent: "collect_lead",
    metadata: {
      description: "Capture user contact information",
      typicalUseCases: ["End of form", "Before pricing", "After visual preview"],
      priority: 1,
    },
    variations: [
      {
        id: "simple_email",
        name: "Simple Email Input",
        description: "Single email field, minimal friction",
        componentType: "lead_capture",
        componentTree: {
          type: "LeadCaptureStep",
          props: {
            mode: "email",
            requiredInputs: ["email"],
          },
        },
        schema: {
          requiredFields: ["email"],
          optionalFields: ["headline", "subtext"],
        },
        layoutHints: { layout: "inline", density: "comfortable" },
        uxCharacteristics: { friction: "low", focus: "high" },
      },
      {
        id: "modal",
        name: "Modal Overlay",
        description: "Email capture in a modal dialog for high focus",
        componentType: "composite",
        componentTree: {
          type: "Modal",
          children: [
            {
              type: "LeadCaptureStep",
              props: { mode: "email" },
            },
          ],
        },
        schema: {
          requiredFields: ["email"],
          optionalFields: ["headline", "subtext"],
        },
        layoutHints: { layout: "modal", density: "comfortable" },
        uxCharacteristics: { friction: "medium", focus: "high" },
      },
      {
        id: "embedded_with_question",
        name: "Email + Refinement Question",
        description: "Email field alongside a refinement question",
        componentType: "composite",
        componentTree: {
          type: "Flex",
          children: [
            {
              type: "LeadCaptureStep",
              props: { mode: "email", compact: true },
            },
            {
              type: "ChoiceStep",
              props: {},
            },
          ],
        },
        schema: {
          requiredFields: ["email", "question", "options"],
          optionalFields: ["headline", "subtext"],
        },
        layoutHints: { layout: "inline", density: "comfortable" },
        uxCharacteristics: { friction: "medium", focus: "medium" },
      },
      {
        id: "full_form",
        name: "Full Contact Form",
        description: "Email, name, and phone in a single step",
        componentType: "lead_capture",
        componentTree: {
          type: "LeadCaptureStep",
          props: {
            mode: "full",
            requiredInputs: ["email", "name"],
          },
        },
        schema: {
          requiredFields: ["email"],
          optionalFields: ["name", "phone", "headline", "subtext"],
        },
        layoutHints: { layout: "inline", density: "comfortable" },
        uxCharacteristics: { friction: "high", focus: "high" },
      },
    ],
  },
  refine_preferences: {
    stepIntent: "refine_preferences",
    metadata: {
      description: "Ask targeted refinement questions",
      typicalUseCases: ["Before visual generation", "Style preferences", "Constraints"],
      priority: 1,
    },
    variations: [
      {
        id: "slider_with_visual",
        name: "Slider with Visual Above",
        description: "Customizable slider with visual preview above",
        componentType: "composite",
        componentTree: {
          type: "Stack",
          children: [
            {
              type: "ImagePreview",
              props: {},
            },
            {
              type: "SliderStep",
              props: {},
            },
          ],
        },
        schema: {
          requiredFields: ["prompt", "min", "max"],
          optionalFields: ["helperText", "labels", "typical", "visualUrl"],
        },
        layoutHints: { layout: "inline", density: "comfortable", emphasis: "visual" },
        uxCharacteristics: { friction: "low", focus: "medium" },
      },
      {
        id: "choice_with_visual",
        name: "Choice Grid with Visual",
        description: "Image choice grid with visual context",
        componentType: "image_choice_grid",
        componentTree: {
          type: "ImageChoiceGridStep",
          props: {},
        },
        schema: {
          requiredFields: ["prompt", "options"],
          optionalFields: ["helperText", "visuals"],
        },
        layoutHints: { layout: "inline", density: "comfortable", emphasis: "visual" },
        uxCharacteristics: { friction: "low", focus: "medium" },
      },
      {
        id: "simple_choice",
        name: "Simple Choice Question",
        description: "Basic choice question without visuals",
        componentType: "choice",
        componentTree: {
          type: "ChoiceStep",
          props: {},
        },
        schema: {
          requiredFields: ["prompt", "options"],
          optionalFields: ["helperText"],
        },
        layoutHints: { layout: "inline", density: "comfortable", emphasis: "text" },
        uxCharacteristics: { friction: "low", focus: "medium" },
      },
      {
        id: "range_slider",
        name: "Range Slider",
        description: "Range slider for numeric preferences",
        componentType: "range_slider",
        componentTree: {
          type: "RangeSliderStep",
          props: {},
        },
        schema: {
          requiredFields: ["prompt", "min", "max"],
          optionalFields: ["helperText", "typical", "unit"],
        },
        layoutHints: { layout: "inline", density: "comfortable" },
        uxCharacteristics: { friction: "low", focus: "medium" },
      },
    ],
  },
  visual_hook: {
    stepIntent: "visual_hook",
    metadata: {
      description: "Show AI-generated visual preview",
      typicalUseCases: ["After refinement questions", "Before pricing"],
      priority: 1,
    },
    variations: [
      {
        id: "image_only",
        name: "Image Only",
        description: "Just show the generated image",
        componentType: "designer",
        componentTree: {
          type: "DesignerStep",
          props: {},
        },
        schema: {
          requiredFields: [],
          optionalFields: ["headline", "subtext"],
        },
        layoutHints: { layout: "fullscreen", density: "spacious", emphasis: "visual" },
        uxCharacteristics: { friction: "low", focus: "high" },
      },
      {
        id: "image_with_questions",
        name: "Image + Refinement Questions",
        description: "Show image with refinement questions alongside",
        componentType: "composite",
        componentTree: {
          type: "Grid",
          children: [
            {
              type: "DesignerStep",
              props: {},
            },
            {
              type: "ChoiceStep",
              props: {},
            },
          ],
        },
        schema: {
          requiredFields: ["question", "options"],
          optionalFields: ["headline", "subtext"],
        },
        layoutHints: { layout: "inline", density: "comfortable", emphasis: "balanced" },
        uxCharacteristics: { friction: "medium", focus: "medium" },
      },
      {
        id: "image_center_selectors_left",
        name: "Stage 3: Image Center, Selectors Left",
        description: "Image displayed in center, selectors on left, pricing on right",
        componentType: "designer",
        componentTree: {
          type: "DesignerStep",
          props: {
            useStage3Layout: true,
            layoutVariant: "image_center_selectors_left",
          },
        },
        schema: {
          requiredFields: [],
          optionalFields: ["headline", "subtext", "selectors", "pricing"],
        },
        layoutHints: { layout: "inline", density: "comfortable", emphasis: "visual" },
        uxCharacteristics: { friction: "low", focus: "high" },
      },
      {
        id: "image_left_pricing_right",
        name: "Stage 3: Image Left, Pricing Right",
        description: "Image on left side, pricing panel on right",
        componentType: "designer",
        componentTree: {
          type: "DesignerStep",
          props: {
            useStage3Layout: true,
            layoutVariant: "image_left_pricing_right",
          },
        },
        schema: {
          requiredFields: [],
          optionalFields: ["headline", "subtext", "selectors", "pricing"],
        },
        layoutHints: { layout: "inline", density: "comfortable", emphasis: "visual" },
        uxCharacteristics: { friction: "low", focus: "high" },
      },
      {
        id: "image_fullscreen_selectors_overlay",
        name: "Stage 3: Fullscreen with Overlay",
        description: "Fullscreen image with selectors overlaid at bottom",
        componentType: "designer",
        componentTree: {
          type: "DesignerStep",
          props: {
            useStage3Layout: true,
            layoutVariant: "image_fullscreen_selectors_overlay",
          },
        },
        schema: {
          requiredFields: [],
          optionalFields: ["headline", "subtext", "selectors"],
        },
        layoutHints: { layout: "fullscreen", density: "spacious", emphasis: "visual" },
        uxCharacteristics: { friction: "low", focus: "high" },
      },
      {
        id: "image_grid_refinement_below",
        name: "Stage 3: Image Grid with Refinement",
        description: "Grid of images with refinement questions below",
        componentType: "designer",
        componentTree: {
          type: "DesignerStep",
          props: {
            useStage3Layout: true,
            layoutVariant: "image_grid_refinement_below",
          },
        },
        schema: {
          requiredFields: [],
          optionalFields: ["headline", "subtext", "selectors", "prompt"],
        },
        layoutHints: { layout: "inline", density: "comfortable", emphasis: "balanced" },
        uxCharacteristics: { friction: "medium", focus: "medium" },
      },
    ],
  },
  collect_context: {
    stepIntent: "collect_context",
    metadata: {
      description: "Collect initial context about the project",
      typicalUseCases: ["Beginning of form", "Service selection", "Initial requirements"],
      priority: 1,
    },
    variations: [
      {
        id: "service_selection",
        name: "Service Selection",
        description: "Choose a service or category",
        componentType: "choice",
        componentTree: {
          type: "ChoiceStep",
          props: {},
        },
        schema: {
          requiredFields: ["prompt", "options"],
          optionalFields: ["helperText"],
        },
        layoutHints: { layout: "inline", density: "comfortable" },
        uxCharacteristics: { friction: "low", focus: "high" },
      },
      {
        id: "image_choice_context",
        name: "Visual Context Selection",
        description: "Image-based context selection",
        componentType: "image_choice_grid",
        componentTree: {
          type: "ImageChoiceGridStep",
          props: {},
        },
        schema: {
          requiredFields: ["prompt", "options"],
          optionalFields: ["helperText", "visuals"],
        },
        layoutHints: { layout: "inline", density: "comfortable", emphasis: "visual" },
        uxCharacteristics: { friction: "low", focus: "medium" },
      },
    ],
  },
  show_pricing: {
    stepIntent: "show_pricing",
    metadata: {
      description: "Display pricing information",
      typicalUseCases: ["After visual preview", "Before lead capture"],
      priority: 1,
    },
    variations: [
      {
        id: "pricing_only",
        name: "Pricing Display",
        description: "Show pricing information",
        componentType: "pricing",
        componentTree: {
          type: "PricingStep",
          props: {},
        },
        schema: {
          requiredFields: [],
          optionalFields: ["headline", "subtext"],
        },
        layoutHints: { layout: "inline", density: "comfortable" },
        uxCharacteristics: { friction: "low", focus: "high" },
      },
      {
        id: "pricing_with_upsell",
        name: "Pricing + Upsell Options",
        description: "Show pricing with upgrade options",
        componentType: "composite",
        componentTree: {
          type: "Stack",
          children: [
            {
              type: "PricingStep",
              props: {},
            },
            {
              type: "ChoiceStep",
              props: {},
            },
          ],
        },
        schema: {
          requiredFields: ["upsellOptions"],
          optionalFields: ["headline", "subtext"],
        },
        layoutHints: { layout: "inline", density: "comfortable" },
        uxCharacteristics: { friction: "medium", focus: "high" },
      },
    ],
  },
  confirmation: {
    stepIntent: "confirmation",
    metadata: {
      description: "Confirm submission or completion",
      typicalUseCases: ["End of form", "After lead capture"],
      priority: 1,
    },
    variations: [
      {
        id: "simple_confirmation",
        name: "Simple Confirmation",
        description: "Basic confirmation message",
        componentType: "confirmation",
        componentTree: {
          type: "ConfirmationStep",
          props: {},
        },
        schema: {
          requiredFields: [],
          optionalFields: ["headline", "subtext"],
        },
        layoutHints: { layout: "inline", density: "comfortable" },
        uxCharacteristics: { friction: "low", focus: "medium" },
      },
    ],
  },
};


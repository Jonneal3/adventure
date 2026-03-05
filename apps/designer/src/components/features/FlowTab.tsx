"use client";

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { ChevronDown, FileText, Plus, X, CheckCircle, Settings, Palette, Layout, MessageSquare, Image as ImageIcon, HelpCircle, Brush, Type, ChevronRight } from "lucide-react";
import { FlowConfig } from '@/types/flow';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { ColorInput, NumberInput, SelectInput, FontSelector } from "./FormComponents";
import { LayoutMode, BorderStyle, ShadowStyle, designThemes, loadGoogleFont } from '@mage/types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface FlowTabProps {
  flowConfig: FlowConfig | null;
  updateFlowConfig: (updates: Partial<FlowConfig>) => void;
  openSections: Record<string, Record<string, boolean>>;
  toggleSection: (tab: string, section: string) => void;
  instanceId?: string;
}

function getPrimaryDefaultStep(): FlowConfig["steps"][number] {
  return {
    id: "step-1",
    order: 0,
    type: "question",
    title: "Step 1",
    description: "Start with the primary question.",
    question: {
      id: "primary",
      type: "textarea",
      label: "What are you looking for?",
      placeholder: "Describe what you want…",
      required: false,
    },
  };
}

export const FlowTab: React.FC<FlowTabProps> = ({
  flowConfig,
  updateFlowConfig,
  openSections,
  toggleSection,
  instanceId,
}) => {
  // Initialize flow config if it doesn't exist
  const config = flowConfig || {
    enabled: false,
    steps: [],
    questionGenerationMode: 'manual' as const,
    designGenerationStrategy: 'progressive' as const,
    dataCollection: {
      fields: [],
      requiredFields: [],
    },
  };

  const flowSections = openSections.flow || {};

  // Get design config with defaults
  const designConfig = config.design || {};

  const handleUpdate = useCallback((updates: Partial<FlowConfig>) => {
    updateFlowConfig(updates);
  }, [updateFlowConfig]);

  // Clean design object to only include form-relevant fields
  // This prevents widget-specific fields (gallery, demo, overlay, etc.) from being saved
  const cleanDesignForForm = useCallback((design: any): Partial<NonNullable<FlowConfig['design']>> => {
    if (!design) return {};
    
    // Only keep fields that are actually used in AI Form
    const formRelevantFields: (keyof NonNullable<FlowConfig['design']>)[] = [
      // Overall styling
      'background_color',
      'background_opacity',
      'background_gradient',
      'container_padding',
      'container_padding_top',
      'container_padding_right',
      'container_padding_bottom',
      'container_padding_left',
      'border_radius',
      'max_width',
      'max_height',
      
      // Branding
      'primary_color',
      'secondary_color',
      'font_family',
      'base_font_size',
      
      // Question box / prompt styling
      'prompt_background_color',
      'prompt_text_color',
      'prompt_font_family',
      'prompt_font_size',
      'prompt_border_color',
      'prompt_border_width',
      'prompt_border_style',
      'prompt_border_radius',
      'prompt_placeholder_color',
      
      // Button styling
      'submit_button_background_color',
      'submit_button_text_color',
      'submit_button_hover_background_color',
      
      // Modal settings (if form is shown in modal)
      'modal_backdrop_color',
      'modal_backdrop_opacity',
      'modal_width',
      'modal_height',
      'modal_max_width',
      'modal_max_height',
      'modal_border_radius',
      'modal_background_color',
      'modal_show_close_button',
      'modal_close_button_color',
      'modal_close_button_hover_color',
    ];
    
    const cleaned: Partial<NonNullable<FlowConfig['design']>> = {};
    formRelevantFields.forEach((key) => {
      if (design[key] !== undefined) {
        cleaned[key] = design[key];
      }
    });
    
    return cleaned;
  }, []);

  // Helper to update design settings
  // Only saves form-relevant fields, filters out widget-specific junk
  const updateDesign = useCallback((designUpdates: Partial<FlowConfig['design']>) => {
    // Merge updates with existing config, then clean to remove widget-specific fields
    const merged = { ...designConfig, ...designUpdates };
    const cleaned = cleanDesignForForm(merged);
    
    handleUpdate({
      design: cleaned
    });
  }, [handleUpdate, designConfig, cleanDesignForForm]);

  const applyFormTheme = useCallback((theme: (typeof designThemes)[number]) => {
    updateDesign({
      background_color: theme.background_color,
      primary_color: (theme as any).primary_color ?? theme.accent_color ?? theme.submit_button_background_color,
      prompt_background_color: theme.prompt_background_color ?? theme.background_color,
      submit_button_background_color: theme.submit_button_background_color ?? theme.accent_color,
      submit_button_text_color: theme.submit_button_text_color ?? '#ffffff',
    });
  }, [updateDesign]);

  // Handle padding sync
  const handlePaddingSync = useCallback((value: number) => {
    updateDesign({
      container_padding: value,
      container_padding_top: value,
      container_padding_right: value,
      container_padding_bottom: value,
      container_padding_left: value,
    });
  }, [updateDesign]);

  // Handle layout change
  const handleLayoutChange = useCallback((newMode: LayoutMode) => {
    const updates: Partial<FlowConfig['design']> = { layout_mode: newMode };
    
    if (newMode === "left-right" || newMode === "right-left") {
      updates.prompt_section_width = 20;
    }
    
    updateDesign(updates);
  }, [updateDesign]);

  // Load fonts when they change
  React.useEffect(() => {
    try {
      if (designConfig.prompt_font_family && 
          designConfig.prompt_font_family !== 'inherit' && 
          designConfig.prompt_font_family !== 'sans-serif' && 
          designConfig.prompt_font_family !== 'serif') {
        loadGoogleFont(designConfig.prompt_font_family);
      }
      if (designConfig.brand_name_font_family &&
          designConfig.brand_name_font_family !== 'inherit' &&
          designConfig.brand_name_font_family !== 'sans-serif' &&
          designConfig.brand_name_font_family !== 'serif') {
        loadGoogleFont(designConfig.brand_name_font_family);
      }
    } catch (error) {}
  }, [designConfig.prompt_font_family, designConfig.brand_name_font_family]);

  return (
    <div className="space-y-4 pt-3">
      {/* Basic Settings */}
      <div className="space-y-3">
        <div
          className="flex items-center justify-between p-3 bg-card/40 rounded-xl border border-border/60 shadow-sm cursor-pointer hover:bg-muted/20 transition-colors"
          onClick={() => toggleSection('flow', 'basic-settings')}
        >
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <Label className="text-sm font-medium cursor-pointer">Basic Settings</Label>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${flowSections['basic-settings'] ? 'rotate-180' : ''}`}
          />
        </div>

        {flowSections['basic-settings'] && (
          <div className="pl-4 space-y-3 border-l-2 border-border/50 ml-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Enable AI Form</Label>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => {
                    // When the AI Form enablement changes, force-refresh the right-side /adventure preview
                    // so the runtime reboots with the latest flow_config.
                    try {
                      window.dispatchEvent(new Event('designer-refresh-widget-preview'));
                    } catch {}

                    if (!checked) {
                      handleUpdate({ enabled: false });
                      return;
                    }

                    const steps =
                      Array.isArray(config.steps) && config.steps.length > 0 ? config.steps : [getPrimaryDefaultStep()];

                    // If we didn't have an existing flow_config yet, persist the full base config so the form can render immediately.
                    if (!flowConfig) {
                      updateFlowConfig({
                        ...config,
                        enabled: true,
                        steps,
                      });
                      return;
                    }

                    handleUpdate({ enabled: true, steps });
                  }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Enable AI form for this instance
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Flow Name</Label>
              <Input
                value={config.name || ''}
                onChange={(e) => handleUpdate({ name: e.target.value })}
                placeholder="My Flow Form"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Description</Label>
              <Input
                value={config.description || ''}
                onChange={(e) => handleUpdate({ description: e.target.value })}
                placeholder="Describe your flow form"
              />
            </div>
          </div>
        )}
      </div>

      {/* Global Design Tokens - Set once, applies everywhere */}
      <details 
        className="group rounded-xl border border-border/60 bg-card/40 shadow-sm"
        open={flowSections['global-design']}
      >
        <summary 
          className="flex items-center justify-between cursor-pointer py-3 px-3 hover:bg-muted/25 transition-colors select-none group-open:bg-muted/20"
          onClick={(e) => {
            e.preventDefault();
            toggleSection('flow', 'global-design');
          }}
        >
          <span className="flex items-center gap-2.5 text-sm font-medium">
            <Palette className="h-4 w-4 text-muted-foreground" />
            Overall Style
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${flowSections['global-design'] ? 'rotate-180' : ''}`} />
        </summary>
        <div className="py-3 px-3 space-y-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Set these once and they apply to all form components automatically
          </p>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Theme</Label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between h-9 px-2 text-left text-xs font-normal"
                  aria-label="Select theme preset"
                  title="Select theme preset"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex gap-1">
                      <div
                        className="h-3 w-3 rounded-full border border-border"
                        style={{ backgroundColor: designConfig.background_color || "#ffffff" }}
                      />
                      <div
                        className="h-3 w-3 rounded-full border border-border"
                        style={{ backgroundColor: designConfig.prompt_background_color || designConfig.background_color || "#f9fafb" }}
                      />
                      <div
                        className="h-3 w-3 rounded-full border border-border"
                        style={{ backgroundColor: designConfig.submit_button_background_color || designConfig.primary_color || "#3b82f6" }}
                      />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-foreground/90">Theme</span>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 max-h-80 overflow-y-auto">
                {designThemes.map((theme) => (
                  <DropdownMenuItem
                    key={theme.name}
                    className="h-auto cursor-pointer p-2"
                    onClick={() => applyFormTheme(theme)}
                  >
                    <div className="flex w-full items-center gap-2">
                      <div className="flex gap-1">
                        <div
                          className="h-3 w-3 rounded-full border border-border"
                          style={{ backgroundColor: theme.background_color || "#ffffff" }}
                        />
                        <div
                          className="h-3 w-3 rounded-full border border-border"
                          style={{ backgroundColor: theme.prompt_background_color || theme.background_color || "#f9fafb" }}
                        />
                        <div
                          className="h-3 w-3 rounded-full border border-border"
                          style={{ backgroundColor: theme.submit_button_background_color || theme.accent_color || "#3b82f6" }}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium">{theme.name}</div>
                      </div>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Primary Color */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Brand Color</Label>
            <p className="text-xs text-muted-foreground">Used for buttons, highlights, and selected options</p>
            <ColorInput
              label="Brand Color"
              value={designConfig.primary_color || "#3b82f6"}
              onChange={(value) => updateDesign({ primary_color: value })}
            />
          </div>

          {/* Font Family */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Text Font</Label>
            <p className="text-xs text-muted-foreground">Applied to all text: labels, questions, buttons</p>
            <FontSelector
              label="Choose Font"
              value={designConfig.font_family || "Inter"}
              onChange={(value) => updateDesign({ font_family: value })}
            />
          </div>

          {/* Background */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Form Background</Label>
            <p className="text-xs text-muted-foreground">Background color for the entire form</p>
            <ColorInput
              label="Background Color"
              value={designConfig.background_color || "#ffffff"}
              onChange={(value) => updateDesign({ background_color: value })}
              showOpacity={true}
            />
          </div>

          {/* Button Style */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Button Appearance</Label>
            <p className="text-xs text-muted-foreground">Applied to all buttons in all steps</p>
            <SelectInput
              label="How Buttons Look"
              value={designConfig.submit_button_background_color && designConfig.submit_button_background_color !== 'transparent' ? 'filled' : 'outline'}
              onChange={(value) => {
                if (value === 'filled') {
                  updateDesign({ 
                    submit_button_background_color: designConfig.primary_color || "#3b82f6",
                    submit_button_text_color: "#ffffff"
                  });
                } else {
                  updateDesign({ 
                    submit_button_background_color: 'transparent',
                    submit_button_text_color: designConfig.primary_color || "#3b82f6"
                  });
                }
              }}
              options={[
                { value: 'filled', label: 'Solid (Filled)' },
                { value: 'outline', label: 'Outline (Border Only)' }
              ]}
            />
          </div>
        </div>
      </details>

      {/* Per-Step Design Tokens - Optional overrides */}
      <details 
        className="group rounded-xl border border-border/60 bg-card/40 shadow-sm"
        open={flowSections['per-step-design']}
      >
        <summary 
          className="flex items-center justify-between cursor-pointer py-3 px-3 hover:bg-muted/25 transition-colors select-none group-open:bg-muted/20"
          onClick={(e) => {
            e.preventDefault();
            toggleSection('flow', 'per-step-design');
          }}
        >
          <span className="flex items-center gap-2.5 text-sm font-medium">
            <Settings className="h-4 w-4 text-muted-foreground" />
            Question Box Style (Optional)
          </span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${flowSections['per-step-design'] ? 'rotate-180' : ''}`} />
        </summary>
        <div className="py-3 px-3 space-y-4 border-t border-border/50">
          <p className="text-xs text-muted-foreground">
            Optional: Override global tokens for specific steps. Leave empty to inherit global settings.
          </p>

          {/* Step Container Background */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Question Box Background</Label>
            <p className="text-xs text-muted-foreground">Optional: Override background for question boxes (defaults to form background)</p>
            <ColorInput
              label="Question Box Color"
              value={designConfig.prompt_background_color || designConfig.background_color || "#ffffff"}
              onChange={(value) => updateDesign({ prompt_background_color: value })}
              showOpacity={true}
            />
          </div>

          {/* Step Size */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Form Width</Label>
            <p className="text-xs text-muted-foreground">Optional: Control how wide the form appears</p>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="Max Width"
                value={designConfig.max_width || 800}
                onChange={(value) => updateDesign({ max_width: value })}
                min={400}
                max={1400}
              />
              {/*
                Container padding / Spacing Around Form (commented out – can re-enable if needed)
              <NumberInput
                label="Spacing Around Form"
                value={designConfig.container_padding ?? 24}
                onChange={handlePaddingSync}
                min={0}
                max={120}
              />
              */}
            </div>
          </div>

          {/* Step Border */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Add Border to Question Boxes</Label>
            <p className="text-xs text-muted-foreground">Optional: Add a border around each question box</p>
            <div className="grid grid-cols-2 gap-3">
              <NumberInput
                label="Border Thickness"
                value={designConfig.prompt_border_width || 0}
                onChange={(value) => updateDesign({ prompt_border_width: value })}
                min={0}
                max={4}
              />
              <ColorInput
                label="Border Color"
                value={designConfig.prompt_border_color || designConfig.primary_color || "#3b82f6"}
                onChange={(value) => updateDesign({ prompt_border_color: value })}
              />
            </div>
          </div>

          {/* Step Radius */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Rounded Corners</Label>
            <p className="text-xs text-muted-foreground">Optional: How rounded the question box corners are</p>
            <NumberInput
              label="Corner Roundness"
              value={designConfig.border_radius || designConfig.prompt_border_radius || 12}
              onChange={(value) => {
                updateDesign({ 
                  border_radius: value,
                  prompt_border_radius: value 
                });
              }}
              min={0}
              max={50}
            />
          </div>
        </div>
      </details>
    </div>
  );
};

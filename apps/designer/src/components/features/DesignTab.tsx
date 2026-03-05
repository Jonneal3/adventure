import React, { useCallback, useMemo } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { Brush, ChevronDown, Eye, FormInput, HelpCircle, Image, MessageSquare, Settings, Type } from "lucide-react";
import { ColorInput, NumberInput, SelectInput, FontSelector } from "./FormComponents";
import { DesignSettings, ShadowStyle, designThemes, loadGoogleFont } from '@mage/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { useInstance } from '@/contexts/InstanceContext';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

interface DesignTabProps {
  config: DesignSettings;
  instanceId?: string; // Add instanceId prop for category management
  openSections: Record<string, Record<string, boolean>>;
  toggleSection: (tab: string, section: string) => void;
  updateConfig: (updates: Partial<DesignSettings>) => void;
}

// Error boundary component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(error: Error): void {}

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-4 text-sm text-red-500">
          Something went wrong with the design tab. Please try refreshing the page.
        </div>
      );
    }

    return this.props.children;
  }
}

export const DesignTab: React.FC<DesignTabProps> = React.memo(({
  config,
  instanceId: _instanceId,
  openSections,
  toggleSection,
  updateConfig,
}) => {
  // For now we only support a single layout: prompt-bottom.
  // Keep the UI simple and force configs back to this value.
  React.useEffect(() => {
    if (config.layout_mode !== "prompt-bottom") {
      updateConfig({ layout_mode: "prompt-bottom" as any });
    }
  }, [config.layout_mode, updateConfig]);

  // Access instance for per-use-case behavior
  const { currentInstance } = useInstance();
  const useCase = (currentInstance as any)?.use_case as 'tryon' | 'scene' | undefined;
  const isTryOn = useCase === 'tryon';
  
  // Load fonts when they change for real-time preview
  React.useEffect(() => {
    try {
      if (config.prompt_font_family && 
          config.prompt_font_family !== 'inherit' && 
          config.prompt_font_family !== 'sans-serif' && 
          config.prompt_font_family !== 'serif') {
        loadGoogleFont(config.prompt_font_family);
      }
      if (config.suggestion_font_family && 
          config.suggestion_font_family !== 'inherit' && 
          config.suggestion_font_family !== 'sans-serif' && 
          config.suggestion_font_family !== 'serif') {
        loadGoogleFont(config.suggestion_font_family);
      }
      if (config.uploader_font_family && 
          config.uploader_font_family !== 'inherit' && 
          config.uploader_font_family !== 'sans-serif' && 
          config.uploader_font_family !== 'serif') {
        loadGoogleFont(config.uploader_font_family);
      }
      if (config.gallery_font_family && 
          config.gallery_font_family !== 'inherit' && 
          config.gallery_font_family !== 'sans-serif' && 
          config.gallery_font_family !== 'serif') {
        loadGoogleFont(config.gallery_font_family);
      }
      if (config.lead_modal_font_family &&
          config.lead_modal_font_family !== 'inherit' &&
          config.lead_modal_font_family !== 'sans-serif' &&
          config.lead_modal_font_family !== 'serif') {
        loadGoogleFont(config.lead_modal_font_family);
      }
      if (config.brand_name_font_family &&
          config.brand_name_font_family !== 'inherit' &&
          config.brand_name_font_family !== 'sans-serif' &&
          config.brand_name_font_family !== 'serif') {
        loadGoogleFont(config.brand_name_font_family);
      }
    } catch (error) {}
  }, [
    config.prompt_font_family,
    config.suggestion_font_family,
    config.uploader_font_family,
    config.gallery_font_family,
    config.lead_modal_font_family,
    config.brand_name_font_family,
  ]);

  // Memoize the sections that should be open
  const designSections = useMemo(() => openSections.design || {}, [openSections.design]);

  const applyWidgetTheme = useCallback((theme: (typeof designThemes)[number]) => {
    updateConfig({
      background_color: theme.background_color,
      background_gradient: theme.background_gradient,
      background_image: theme.background_image,
      background_opacity: theme.background_opacity,
      container_padding: theme.container_padding,
      gallery_background_color: theme.gallery_background_color,
      gallery_border_radius: theme.gallery_border_radius,
      gallery_container_border_color: theme.gallery_container_border_color,
      gallery_container_border_enabled: theme.gallery_container_border_enabled,
      gallery_container_border_radius: theme.gallery_container_border_radius,
      gallery_container_border_style: theme.gallery_container_border_style,
      gallery_container_border_width: theme.gallery_container_border_width,
      gallery_font_family: theme.gallery_font_family,
      gallery_font_size: theme.gallery_font_size,
      gallery_image_border_color: theme.gallery_image_border_color,
      gallery_image_border_enabled: theme.gallery_image_border_enabled,
      gallery_image_border_radius: theme.gallery_image_border_radius,
      gallery_image_border_style: theme.gallery_image_border_style,
      gallery_image_border_width: theme.gallery_image_border_width,
      gallery_shadow_style: theme.gallery_shadow_style,
      overlay_background_color: theme.overlay_background_color,
      overlay_font_family: theme.overlay_font_family,
      overlay_font_size: theme.overlay_font_size,
      overlay_icon_color: theme.overlay_icon_color,
      prompt_background_color: theme.prompt_background_color,
      prompt_border_color: theme.prompt_border_color,
      prompt_border_radius: theme.prompt_border_radius,
      prompt_border_style: theme.prompt_border_style,
      prompt_border_width: theme.prompt_border_width,
      prompt_font_family: theme.prompt_font_family,
      prompt_font_size: theme.prompt_font_size,
      prompt_input_background_color: theme.prompt_input_background_color,
      prompt_input_border_color: theme.prompt_input_border_color,
      prompt_input_border_radius: theme.prompt_input_border_radius,
      prompt_input_border_style: theme.prompt_input_border_style,
      prompt_input_border_width: theme.prompt_input_border_width,
      prompt_input_placeholder_color: theme.prompt_input_placeholder_color,
      prompt_input_text_color: theme.prompt_input_text_color,
      prompt_placeholder_color: theme.prompt_placeholder_color,
      prompt_text_color: theme.prompt_text_color,
      sidebar_background_color: theme.sidebar_background_color,
      submit_button_background_color: theme.submit_button_background_color,
      submit_button_hover_background_color: theme.submit_button_hover_background_color,
      submit_button_text_color: theme.submit_button_text_color,
      suggestion_background_color: theme.suggestion_background_color,
      suggestion_border_color: theme.suggestion_border_color,
      suggestion_border_radius: theme.suggestion_border_radius,
      suggestion_border_style: theme.suggestion_border_style,
      suggestion_border_width: theme.suggestion_border_width,
      suggestion_font_family: theme.suggestion_font_family,
      suggestion_font_size: theme.suggestion_font_size,
      suggestion_shadow_style: theme.suggestion_shadow_style,
      suggestion_text_color: theme.suggestion_text_color,
      uploader_background_color: theme.uploader_background_color,
      uploader_border_color: theme.uploader_border_color,
      uploader_border_radius: theme.uploader_border_radius,
      uploader_border_style: theme.uploader_border_style,
      uploader_border_width: theme.uploader_border_width,
      uploader_font_family: theme.uploader_font_family,
      uploader_font_size: theme.uploader_font_size,
      uploader_text_color: theme.uploader_text_color,
    });
  }, [updateConfig]);

  // Layout controls are temporarily disabled (standardizing on prompt-bottom).

  /*
    Container padding sync handler (temporarily disabled to keep the designer minimalist).
    Re-enable along with the "Container Padding" section in Overall Style.
  */
  // const handlePaddingSync = useCallback((value: number) => {
  //   updateConfig({
  //     container_padding: value,
  //     container_padding_top: value,
  //     container_padding_right: value,
  //     container_padding_bottom: value,
  //     container_padding_left: value,
  //   });
  // }, [updateConfig]);

    const sectionClasses =
      "group rounded-xl border border-border/60 bg-card/40 shadow-sm hover:bg-muted/20 transition-colors";
    const sectionSummaryClasses =
      "flex items-center justify-between cursor-pointer py-3 px-3 select-none text-foreground/90 hover:bg-muted/30 transition-colors group-open:bg-muted/20";
    const sectionContentClasses = "py-3 px-3 space-y-4 border-t border-border/50";

    const subSectionClasses = "group rounded-lg border border-border/50 bg-background/40";
    const subSectionSummaryClasses =
      "flex items-center justify-between cursor-pointer py-2.5 px-3 text-sm font-medium text-foreground/90 hover:bg-muted/25 transition-colors group-open:bg-muted/20";
    const subSectionContentClasses = "px-3 pb-3 pt-3 space-y-3 border-t border-border/40";

	  return (
	    <ErrorBoundary>
	      <div className="space-y-4 pt-3">
          {/*
            Theme Presets card (kept in Overall Style)
            <div className="rounded-xl border border-border/60 bg-card/40 shadow-sm p-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground/90">
                <Palette className="h-4 w-4 text-muted-foreground" />
                Theme
              </div>
              <div className="text-xs text-muted-foreground">
                Apply a preset and then fine‑tune any setting below.
              </div>
            </div>

            <div className="mt-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-between h-auto px-3 py-2 text-left"
                  >
                    <div className="flex items-center gap-2 w-full">
                      <div className="flex gap-1">
                        <div
                          className="w-3 h-3 rounded-full border border-border"
                          style={{ backgroundColor: config.background_color || "#ffffff" }}
                        />
                        <div
                          className="w-3 h-3 rounded-full border border-border"
                          style={{ backgroundColor: config.prompt_background_color || "transparent" }}
                        />
                        <div
                          className="w-3 h-3 rounded-full border border-border"
                          style={{ backgroundColor: config.submit_button_background_color || "#3b82f6" }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium">Choose a theme</div>
                      </div>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72 max-h-80 overflow-y-auto">
                  {designThemes.map((theme) => {
                    const preview = getCompleteTheme(theme);
                    return (
                      <DropdownMenuItem
                        key={theme.name}
                        className="h-auto p-2 cursor-pointer"
                        onClick={() => applyTheme(theme)}
                      >
                        <div className="flex items-center gap-2 w-full">
                          <div className="flex gap-1">
                            <div
                              className="w-3 h-3 rounded-full border border-border"
                              style={{ backgroundColor: preview.background_color || "#ffffff" }}
                            />
                            <div
                              className="w-3 h-3 rounded-full border border-border"
                              style={{ backgroundColor: preview.prompt_background_color || "transparent" }}
                            />
                            <div
                              className="w-3 h-3 rounded-full border border-border"
                              style={{ backgroundColor: preview.submit_button_background_color || "#3b82f6" }}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{theme.name}</div>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          */}

	        {/* Overall Style */}
	        <details 
	          className={sectionClasses}
	          open={designSections['overall-style']}
	        >
	          <summary 
	            className={sectionSummaryClasses}
	            onClick={(e) => {
	              e.preventDefault();
	              toggleSection('design', 'overall-style');
	            }}
	          >
            <span className="flex items-center gap-2.5 text-sm font-medium">
              <Settings className="h-4 w-4 text-muted-foreground" />
              Overall Style
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${designSections['overall-style'] ? 'rotate-180' : ''}`} />
          </summary>
	          <div className={sectionContentClasses}>
              {/* Theme Presets (keep here: Overall Style) */}
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
                            style={{ backgroundColor: config.background_color || "#ffffff" }}
                          />
                          <div
                            className="h-3 w-3 rounded-full border border-border"
                            style={{ backgroundColor: config.prompt_background_color || "#f9fafb" }}
                          />
                          <div
                            className="h-3 w-3 rounded-full border border-border"
                            style={{ backgroundColor: config.submit_button_background_color || "#3b82f6" }}
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
                        onClick={() => applyWidgetTheme(theme)}
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

	            {/* Colors & Style Settings */}
	            <div className="space-y-4 pt-2">
	              <div className="flex items-center gap-2">
	                <Label className="text-sm font-semibold">Widget Container</Label>
	                <TooltipProvider>
	                  <Tooltip>
	                    <TooltipTrigger>
	                      <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Customize the overall look of your widget</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
	              
	              <div className="space-y-4">
	                <ColorInput
	                  label="Background Color"
	                  value={config.background_color || "#ffffff"}
	                  onChange={(value) => updateConfig({ background_color: value })}
	                  showOpacity={true}
	                />

                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput
                      label="Corner Radius"
                      value={config.border_radius || 12}
                      onChange={(value) => updateConfig({ border_radius: value })}
                      min={0}
                      max={32}
                    />
                    <SelectInput
                      label="Shadow Style"
                      value={config.shadow_style || "subtle"}
                      onChange={(value) => updateConfig({ shadow_style: value as ShadowStyle })}
                      options={[
                        { value: "none", label: "None" },
                        { value: "subtle", label: "Subtle" },
                        { value: "medium", label: "Medium" },
                        { value: "large", label: "Large" },
                        { value: "glow", label: "Glow" },
                      ]}
                    />
                  </div>
	              </div>
	            </div>

                  {/*
                    Container Padding (temporarily disabled)
                    Reason: keep the designer minimal; padding is better handled by themes/templates.
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Container Padding</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Adjust the spacing around your widget's content</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>

                      <div className="space-y-4">
                        <NumberInput
                          label="All Sides"
                          value={config.container_padding ?? 16}
                          onChange={handlePaddingSync}
                          min={0}
                          max={120}
                        />
                      </div>
                    </div>
                  */}

                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold">Designer Sidebar</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="text-xs">Controls the background of the left sidebar.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <ColorInput
                    label="Sidebar Background"
                    value={config.sidebar_background_color || "#ffffff"}
                    onChange={(value) => updateConfig({ sidebar_background_color: value })}
                    showOpacity={true}
                  />
                </div>
		          </div>
		        </details>

	        {/* Branding */}
	        <details 
	          className={sectionClasses}
	          open={designSections['branding']}
	        >
	          <summary 
	            className={sectionSummaryClasses}
	            onClick={(e) => {
	              e.preventDefault();
	              toggleSection('design', 'branding');
	            }}
          >
            <span className="flex items-center gap-2.5 text-sm font-medium">
              <Brush className="h-4 w-4 text-muted-foreground" />
              Branding
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${designSections['branding'] ? 'rotate-180' : ''}`} />
          </summary>
	          <div className={sectionContentClasses}>
	            {/* Header Enable/Disable Toggle */}
	            <div className="flex items-center justify-between">
	              <Label className="text-sm font-semibold">Enable Header</Label>
	              <Switch
                checked={config.header_enabled ?? true}
                onCheckedChange={(checked) => updateConfig({ header_enabled: checked })}
              />
            </div>
            
            {config.header_enabled && (
              <>
                {/* Brand Name Enable/Disable Toggle */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Show Brand Name</Label>
                  <Switch
                    checked={config.brand_name_enabled ?? true}
                    onCheckedChange={(checked) => updateConfig({ brand_name_enabled: checked })}
                  />
                </div>
                
                {/* Brand Name - This controls the "AI Studio" title */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Brand Name</Label>
                  <Input
                    value={config.brand_name || ""}
                    onChange={(e) => updateConfig({ brand_name: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="Your Brand Name (e.g., AI Studio)"
                  />
                  <ColorInput
                    label="Brand Name Color"
                    value={config.brand_name_color || "#1f2937"}
                    onChange={(value) => updateConfig({ brand_name_color: value })}
                  />
                <div className="grid grid-cols-2 gap-3">
                  <FontSelector
                    label="Brand Font Family"
                    value={config.brand_name_font_family || "Inter"}
                    onChange={(value) => updateConfig({ brand_name_font_family: value })}
                  />
	                  <NumberInput
	                    label="Brand Font Size"
	                    value={config.brand_name_font_size || 24}
	                    onChange={(value) => updateConfig({ brand_name_font_size: value })}
	                    min={12}
	                    max={72}
	                  />
                </div>
                </div>

                {/* Logo Enable/Disable Toggle */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Show Logo</Label>
                  <Switch
                    checked={config.logo_enabled ?? false}
                    onCheckedChange={(checked) => updateConfig({ logo_enabled: checked })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Logo</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={config.logo_url || ""}
                      onChange={(e) => updateConfig({ logo_url: e.target.value })}
                      placeholder="https://your-cdn.com/logo.png"
                      className="h-8 text-xs"
                    />
                    <label className="inline-flex items-center px-3 py-1.5 h-8 text-xs rounded-md border bg-background hover:bg-muted cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const url = URL.createObjectURL(file);
                            updateConfig({ logo_url: url });
                          } catch (err) {}
                        }}
                      />
                      Choose File
                    </label>
                  </div>
                  {config.logo_url && (
                    <div className="flex items-center gap-2 pt-1">
                      <img src={config.logo_url} alt="Logo preview" className="h-8 w-auto rounded border" />
                      <Button variant="ghost" size="sm" className="h-8 px-2 text-xs"
                        onClick={() => updateConfig({ logo_url: '' })}
                      >Remove</Button>
                    </div>
                  )}
                </div>

                
              </>
            )}
          </div>
        </details>

          {/*
            Layout (temporarily hidden)
            We’re standardizing on a single layout: prompt-bottom.

            <details className={sectionClasses} open={designSections['layout']}>
              ...
            </details>
          */}

	        {/* User Input Section */}
	        <details 
	          className={sectionClasses}
	          open={designSections['input-section']}
	        >
	          <summary 
	            className={sectionSummaryClasses}
	            onClick={(e) => {
	              e.preventDefault();
	              toggleSection('design', 'input-section');
	            }}
          >
            <span className="flex items-center gap-2.5 text-sm font-medium">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              User Input
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${designSections['input-section'] ? 'rotate-180' : ''}`} />
          </summary>
	          <div className={sectionContentClasses}>
            <div className="text-xs text-muted-foreground">
              Configure how users interact with your widget
            </div>

            {/* Main Input Section Settings */}
	            <div className="space-y-3">
	              <div className="space-y-1.5 bg-background/50 rounded-md p-3">
	                <Label className="text-sm font-semibold">Overall Input Area</Label>
	                <ColorInput
	                  value={config.prompt_background_color || 'transparent'}
	                  onChange={(value) => updateConfig({ prompt_background_color: value })}
	                  label="Background Color"
	                />
                {/*
                  Spacing controls (temporarily disabled to keep the designer minimal).
                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput
                      value={config.prompt_padding || 16}
                      onChange={(value) => updateConfig({ prompt_padding: value })}
                      label="Inner Padding"
                      min={8}
                      max={40}
                    />
                    <NumberInput
                      value={config.prompt_margin || 0}
                      onChange={(value) => updateConfig({ prompt_margin: value })}
                      label="Outer Margin"
                      min={0}
                      max={24}
                    />
                  </div>
                */}

                  {/*
                    Prevent Border Clipping (temporarily disabled)
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium">Prevent Border Clipping</Label>
                      <Switch
                        checked={config.prompt_overflow_protection ?? true}
                        onCheckedChange={(checked) => updateConfig({ prompt_overflow_protection: checked })}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Automatically adjusts container sizing to prevent border radius cutoff
                    </p>
                  */}
              </div>

                  {/*
                    Prompt Section Alignment (temporarily disabled)
                    {(config.layout_mode === "prompt-top" || config.layout_mode === "prompt-bottom") && (
                      <SelectInput
                        value={config.prompt_section_alignment || 'center'}
                        onChange={(value) => {
                          updateConfig({ prompt_section_alignment: value as 'left' | 'center' | 'right' });
                        }}
                        options={[
                          { value: 'left', label: 'Left' },
                          { value: 'center', label: 'Center' },
                          { value: 'right', label: 'Right' }
                        ]}
                        label={`Prompt Section Alignment (${config.layout_mode === "prompt-top" ? "Top" : "Bottom"})`}
                      />
                    )}
                  */}

                  {/*
                    Input Section Width (temporarily disabled)
                    {(config.layout_mode === "prompt-top" || config.layout_mode === "prompt-bottom") && (
                      <div className="space-y-3 pt-2">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-semibold">
                              Input Section Width
                            </Label>
                            <span className="text-xs text-muted-foreground">
                              {config.prompt_section_width || 60}%
                            </span>
                          </div>
                          <div className="pl-4 border-l-2 border-border/30">
                            <input
                              type="range"
                              min="50"
                              max="80"
                              value={config.prompt_section_width || 60}
                              onChange={(e) => updateConfig({ prompt_section_width: parseInt(e.target.value) })}
                              className="w-full h-2 bg-muted/60 rounded-full appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:border [&::-webkit-slider-thumb]:border-background [&::-webkit-slider-thumb]:shadow-sm [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:border [&::-moz-range-thumb]:border-background [&::-moz-range-thumb]:shadow-sm"
                              key={`width-slider-${config.layout_mode}`}
                            />
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                              <span>50%</span>
                              <span>80%</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  */}
            </div>

            {/* Image Uploader Subsection */}
            <details 
              className={subSectionClasses}
              open={designSections['uploader']}
            >
              <summary 
                className={subSectionSummaryClasses}
                onClick={(e) => {
                  e.preventDefault();
                  toggleSection('design', 'uploader');
                }}
              >
                <span className="flex items-center gap-2 text-sm">
                  <Image className="h-4 w-4 text-muted-foreground" />
                  Image Uploader
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform text-muted-foreground ${designSections['uploader'] ? 'rotate-180' : ''}`} />
              </summary>
              <div className={subSectionContentClasses}>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Enable Uploader</Label>
                  <Switch
                    checked={config.uploader_enabled ?? true}
                    onCheckedChange={(checked) => updateConfig({ uploader_enabled: checked })}
                  />
                </div>
                
                {config.uploader_enabled && (
                  <>
	                    <div className="space-y-2">
	                      <Label className="text-xs font-medium text-muted-foreground">Max Reference Images</Label>
	                      <Input
	                        type="number"
	                        value={config.uploader_max_images ?? (isTryOn ? 4 : 1)}
                        onChange={(e) => {
                          const raw = parseInt(e.target.value || '0', 10);
                          const next = Math.max(1, isNaN(raw) ? 1 : raw);
                          if (useCase === 'scene') {
                            updateConfig({ uploader_max_images: 1 });
                          } else {
                            updateConfig({ uploader_max_images: next });
                          }
	                        }}
	                        min={1}
	                        disabled={useCase === 'scene'}
	                        className={`h-8 text-xs ${useCase === 'scene' ? 'text-muted-foreground/60 cursor-not-allowed' : ''}`}
	                      />
                      <p className="text-[11px] text-muted-foreground">
                        {useCase === 'scene'
                          ? 'Scene use case supports a single reference image.'
                          : 'Try‑on supports multiple reference images; set any limit you prefer.'}
                      </p>
                    </div>
                    
                    {/*
                      Uploader styling (temporarily disabled)
                      <ColorInput
                        label="Background Color"
                        value={config.uploader_background_color || "#f8fafc"}
                        onChange={(value) => updateConfig({ uploader_background_color: value })}
                        showOpacity={true}
                      />

                      <div className="space-y-3">
                        <SelectInput
                          label="Border Style"
                          value={config.uploader_border_style || "dashed"}
                          onChange={(value) => updateConfig({ uploader_border_style: value as BorderStyle })}
                          options={[
                            { value: "solid", label: "Solid" },
                            { value: "dashed", label: "Dashed" },
                            { value: "dotted", label: "Dotted" },
                            { value: "none", label: "None" }
                          ]}
                        />
                        <ColorInput
                          label="Border Color"
                          value={config.uploader_border_color || "#cbd5e1"}
                          onChange={(value) => updateConfig({ uploader_border_color: value })}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <NumberInput
                          label="Border Width"
                          value={config.uploader_border_width ?? 2}
                          onChange={(value) => updateConfig({ uploader_border_width: value })}
                          min={0}
                          max={20}
                        />
                        <NumberInput
                          label="Border Radius"
                          value={config.uploader_border_radius ?? 12}
                          onChange={(value) => updateConfig({ uploader_border_radius: value })}
                          min={0}
                          max={100}
                        />
                      </div>
                    */}
                    
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Primary Text</Label>
                        <Input
                          value={config.uploader_primary_text || "Add reference images to guide the AI generation"}
                          onChange={(e) => updateConfig({ uploader_primary_text: e.target.value })}
                          className="h-8 text-xs"
                          placeholder="Add reference images to guide the AI generation"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-xs font-medium">Secondary Text</Label>
                        <Input
                          value={config.uploader_secondary_text || "Drag & drop or click to upload"}
                          onChange={(e) => updateConfig({ uploader_secondary_text: e.target.value })}
                          className="h-8 text-xs"
                          placeholder="Drag & drop or click to upload"
                        />
                      </div>
                    </div>
                    
                    {/*
                      <div className="grid grid-cols-2 gap-3">
                        <ColorInput
                          label="Text Color"
                          value={config.uploader_text_color || "#64748b"}
                          onChange={(value) => updateConfig({ uploader_text_color: value })}
                        />
                        <NumberInput
                          label="Font Size"
                          value={config.uploader_font_size || 14}
                          onChange={(value) => updateConfig({ uploader_font_size: value })}
                          min={10}
                          max={24}
                        />
                      </div>
                    */}
                    
                    <FontSelector
                      label="Font Family"
                      value={config.uploader_font_family || "Inter"}
                      onChange={(value) => updateConfig({ uploader_font_family: value })}
                    />
                  </>
                )}
              </div>
            </details>

            {/* Prompt Input Subsection */}
            <details 
              className={subSectionClasses}
              open={designSections['prompt']}
            >
              <summary 
                className={subSectionSummaryClasses}
                onClick={(e) => {
                  e.preventDefault();
                  toggleSection('design', 'prompt');
                }}
              >
                <span className="flex items-center gap-2 text-sm">
                  <Type className="h-4 w-4 text-muted-foreground" />
                  Prompt Input
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform text-muted-foreground ${designSections['prompt'] ? 'rotate-180' : ''}`} />
              </summary>
	              <div className={subSectionContentClasses}>
	                {/* Typography Section */}
	                <div className="space-y-3">
	                  <Label className="text-xs font-medium text-muted-foreground">Typography</Label>
                  <div className="space-y-3 pl-2">
                    <div className="grid grid-cols-2 gap-3">
                      <FontSelector
                        label="Font Family"
                        value={config.prompt_font_family || "Inter"}
                        onChange={(value) => updateConfig({ prompt_font_family: value })}
                      />
                      <NumberInput
                        label="Font Size"
                        value={config.prompt_font_size || 16}
                        onChange={(value) => updateConfig({ prompt_font_size: value })}
                        min={12}
                        max={32}
                      />
	                    </div>
	                  </div>
	                </div>

                    {/*
                      Prompt input colors (temporarily disabled)
                      <div className="space-y-3">
                        <Label className="text-xs font-medium text-muted-foreground">Colors</Label>
                        <div className="space-y-3 pl-2">
                          <ColorInput
                            label="Text Color"
                            value={config.prompt_input_text_color || '#374151'}
                            onChange={(value) => updateConfig({ prompt_input_text_color: value })}
                          />
                          <ColorInput
                            label="Placeholder Color"
                            value={config.prompt_input_placeholder_color || '#9ca3af'}
                            onChange={(value) => updateConfig({ prompt_input_placeholder_color: value })}
                          />
                        </div>
                      </div>
                    */}

	                <div className="space-y-3">
                  <Label className="text-xs font-medium">Submit Button</Label>
                  {/* Button Colors */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Colors</Label>
                    <ColorInput
                      label="Background Color"
                      value={config.submit_button_background_color || "#3b82f6"}
                      onChange={(value) => updateConfig({ submit_button_background_color: value })}
                    />
                    <ColorInput
                      label="Text Color"
                      value={config.submit_button_text_color || "#ffffff"}
                      onChange={(value) => updateConfig({ submit_button_text_color: value })}
                    />
                    <ColorInput
                      label="Hover Background Color"
                      value={config.submit_button_hover_background_color || "#2563eb"}
                      onChange={(value) => updateConfig({ submit_button_hover_background_color: value })}
                    />
                  </div>
                  
                  {/* Button Border */}
                  <div className="space-y-2">
                    <Label className="text-xs font-medium text-muted-foreground">Border</Label>
                    <NumberInput
                      label="Border Radius"
                      value={config.submit_button_border_radius || 8}
                      onChange={(value) => updateConfig({ submit_button_border_radius: value })}
                      min={0}
                      max={32}
                    />
                  </div>
                </div>
              </div>
            </details>

            {/* Suggestion Buttons Subsection */}
            <details 
              className={subSectionClasses}
              open={designSections['suggestions']}
            >
              <summary 
                className={subSectionSummaryClasses}
                onClick={(e) => {
                  e.preventDefault();
                  toggleSection('design', 'suggestions');
                }}
              >
                <span className="flex items-center gap-2 text-sm">
                  <Settings className="h-3.5 w-3.5" />
                  Suggestion Buttons
                </span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform text-muted-foreground ${designSections['suggestions'] ? 'rotate-180' : ''}`} />
              </summary>
              <div className={subSectionContentClasses}>
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Enable Suggestions</Label>
                  <Switch
                    checked={config.suggestions_enabled ?? true}
                    onCheckedChange={(checked) => updateConfig({ suggestions_enabled: checked })}
                  />
                </div>
                
	                {config.suggestions_enabled && (
	                  <>
	                    <NumberInput
	                      label="Number of Suggestions"
                      value={config.suggestions_count || 3}
                      onChange={(value) => updateConfig({ suggestions_count: value })}
                      min={1}
	                      max={12}
	                    />

                      {/*
                        Suggestion button colors (temporarily disabled)
                        <div className="space-y-3">
                          <Label className="text-xs font-medium text-muted-foreground">Colors</Label>
                          <div className="space-y-3 pl-2">
                            <ColorInput
                              label="Background Color"
                              value={config.suggestion_background_color || "#ffffff"}
                              onChange={(value) => updateConfig({ suggestion_background_color: value })}
                              showOpacity={true}
                            />
                            <ColorInput
                              label="Text Color"
                              value={config.suggestion_text_color || "#374151"}
                              onChange={(value) => updateConfig({ suggestion_text_color: value })}
                            />
                          </div>
                        </div>
                      */}
	                  </>
	                )}
	              </div>
	            </details>
          </div>
        </details>

	        {/* Image Gallery */}
	        <details 
	          className={sectionClasses}
	          open={designSections['gallery']}
	        >
	          <summary 
	            className={sectionSummaryClasses}
	            onClick={(e) => {
	              e.preventDefault();
	              toggleSection('design', 'gallery');
	            }}
          >
            <span className="flex items-center gap-2.5 text-sm font-medium">
              {/* 4 square grid icon */}
              <div className="grid grid-cols-2 gap-0.5 w-4 h-4 text-muted-foreground">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="bg-current rounded-[2px]" />
                ))}
              </div>
              Image Gallery
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${designSections['gallery'] ? 'rotate-180' : ''}`} />
          </summary>
	          <div className={sectionContentClasses}>
            {/* Gallery Container Subsection */}
            <details 
              className={subSectionClasses}
              open={designSections['gallery_container']}
            >
              <summary 
                className={subSectionSummaryClasses}
                onClick={(e) => {
                  e.preventDefault();
                  toggleSection('design', 'gallery_container');
                }}
              >
                <span className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 border border-current rounded opacity-60"></div>
                  Gallery Container
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform text-muted-foreground ${designSections['gallery_container'] ? 'rotate-180' : ''}`} />
              </summary>
              <div className={subSectionContentClasses}>
                    {/*
                      Gallery background color (temporarily disabled)
                      <ColorInput
                        label="Background Color"
                        value={config.gallery_background_color || "transparent"}
                        onChange={(value) => updateConfig({ gallery_background_color: value })}
                        showOpacity={true}
                      />
                    */}
                
                <div className="grid grid-cols-2 gap-3">
                  <SelectInput
                    label="Columns"
                    value={config.gallery_columns?.toString() ?? "2"}
	                    onChange={(value) => {
	                      const numValue = parseInt(value);
	                      if (numValue === 2 && (config.gallery_max_images ?? 1) < 2) {
	                        updateConfig({ gallery_columns: numValue, gallery_max_images: 2 });
	                      } else {
                        updateConfig({ gallery_columns: numValue });
                      }
                    }}
                    options={[
                      { value: "1", label: "1 Column" },
                      { value: "2", label: "2 Columns" }
                    ]}
                  />
	                  <NumberInput
	                    label="Spacing"
	                    value={config.gallery_spacing ?? 12}
	                    onChange={(value) => updateConfig({ gallery_spacing: value })}
	                    min={0}
	                    max={50}
	                  />
                </div>
                
                <NumberInput
                  label="Max Images"
                  value={config.gallery_max_images ?? 4}
                  onChange={(value) => {
                    const requiresTwo = (config.gallery_columns ?? 2) === 2;
                    const adjusted = requiresTwo ? Math.max(2, value) : Math.max(1, value);
                    updateConfig({ gallery_max_images: adjusted });
                  }}
                  min={(config.gallery_columns ?? 2) === 2 ? 2 : 1}
                  max={12}
                />
	                {(config.gallery_columns ?? 2) === 2 && (
	                  <p className="text-xs text-muted-foreground">
	                    With 2 columns, at least 2 images are required.
	                  </p>
	                )}
	              </div>
	            </details>

            {/* Individual Images Subsection */}
            <details 
              className={subSectionClasses}
              open={designSections['gallery_images']}
            >
              <summary 
                className={subSectionSummaryClasses}
                onClick={(e) => {
                  e.preventDefault();
                  toggleSection('design', 'gallery_images');
                }}
              >
                <span className="flex items-center gap-2 text-sm">
                  <div className="w-3 h-3 bg-background/20 rounded"></div>
                  Individual Images
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform text-muted-foreground ${designSections['gallery_images'] ? 'rotate-180' : ''}`} />
		              </summary>
		              <div className={subSectionContentClasses}>
		                <SelectInput
		                  label="Shadow Style"
		                  value={config.gallery_shadow_style || "medium"}
		                  onChange={(value) => updateConfig({ gallery_shadow_style: value as ShadowStyle })}
	                  options={[
	                    { value: "none", label: "None" },
	                    { value: "subtle", label: "Subtle" },
	                    { value: "medium", label: "Medium" },
	                    { value: "large", label: "Large" },
	                    { value: "glow", label: "Glow" }
	                  ]}
	                />
	              </div>
	            </details>

	          </div>
	        </details>

	        {/* Form Overlay */}
	        <details 
	          className={sectionClasses}
	          open={designSections['form-overlay']}
	        >
	          <summary 
	            className={sectionSummaryClasses}
	            onClick={(e) => {
	              e.preventDefault();
	              toggleSection('design', 'form-overlay');
	            }}
          >
            <span className="flex items-center gap-2.5 text-sm font-medium">
              <FormInput className="h-4 w-4 text-muted-foreground" />
              Form Overlay
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${designSections['form-overlay'] ? 'rotate-180' : ''}`} />
          </summary>
	          <div className={sectionContentClasses}>
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold">Enable Form Overlay</Label>
              <Switch
                checked={config.lead_capture_enabled ?? false}
                onCheckedChange={(checked) => {
                  updateConfig({ lead_capture_enabled: checked });
                }}
              />
            </div>

            {config.lead_capture_enabled && (
              <>
                {/* Trigger Selection */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">When to Show</Label>
                  <div className="text-[11px] text-muted-foreground">Lead form trigger options</div>
                  <TooltipProvider>
                    <div className="grid grid-cols-2 gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
	                          <button
	                            type="button"
	                            onClick={() => updateConfig({ lead_capture_trigger: 'immediate' as any })}
	                            className={`h-8 text-xs rounded-md border px-2 text-left transition-colors ${
	                              (config as any).lead_capture_trigger === 'immediate'
	                                ? 'border-primary bg-primary/10 text-foreground'
	                                : 'border-border bg-background/30 text-muted-foreground hover:bg-muted/30'
	                            }`}
	                          >
	                            Immediate
	                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Blocks access to the designer until the form is submitted.
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
	                          <button
	                            type="button"
	                            onClick={() => updateConfig({ lead_capture_trigger: 'submit' as any })}
	                            className={`h-8 text-xs rounded-md border px-2 text-left transition-colors ${
	                              (config as any).lead_capture_trigger === 'submit' || !(config as any).lead_capture_trigger
	                                ? 'border-primary bg-primary/10 text-foreground'
	                                : 'border-border bg-background/30 text-muted-foreground hover:bg-muted/30'
	                            }`}
	                          >
	                            On First Submit
	                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          On the first Submit click, show the form before any generation starts.
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
	                          <button
	                            type="button"
	                            onClick={() => updateConfig({ lead_capture_trigger: 'halfway' as any })}
	                            className={`h-8 text-xs rounded-md border px-2 text-left transition-colors ${
	                              (config as any).lead_capture_trigger === 'halfway'
	                                ? 'border-primary bg-primary/10 text-foreground'
	                                : 'border-border bg-background/30 text-muted-foreground hover:bg-muted/30'
	                            }`}
	                          >
	                            Halfway (tease)
	                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Start generation and display a partial/low-res preview, then show the form to continue and reveal the full result.
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
	                          <button
	                            type="button"
	                            onClick={() => updateConfig({ lead_capture_trigger: 'on_download' as any })}
	                            className={`h-8 text-xs rounded-md border px-2 text-left transition-colors ${
	                              (config as any).lead_capture_trigger === 'on_download'
	                                ? 'border-primary bg-primary/10 text-foreground'
	                                : 'border-border bg-background/30 text-muted-foreground hover:bg-muted/30'
	                            }`}
	                          >
	                            On Download
	                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Allow viewing; when the user clicks Download on an image, show the form first.
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Step 1 - Email</Label>
                  <Input
                    value={config.lead_step1_title || "Where should we send your AI-generated photos?"}
                    onChange={(e) => updateConfig({ lead_step1_title: e.target.value })}
                    placeholder="Step 1 title"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={config.lead_step1_placeholder || "Enter your email"}
                    onChange={(e) => updateConfig({ lead_step1_placeholder: e.target.value })}
                    placeholder="Email placeholder"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Step 2 - Name & Phone</Label>
                  <Input
                    value={config.lead_step2_title || "One last thing! We'll send your photos right away..."}
                    onChange={(e) => updateConfig({ lead_step2_title: e.target.value })}
                    placeholder="Step 2 title"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={config.lead_step2_name_placeholder || "What's your name?"}
                    onChange={(e) => updateConfig({ lead_step2_name_placeholder: e.target.value })}
                    placeholder="Name placeholder"
                    className="h-8 text-xs"
                  />
                  <Input
                    value={config.lead_step2_phone_placeholder || "Enter your phone number"}
                    onChange={(e) => updateConfig({ lead_step2_phone_placeholder: e.target.value })}
                    placeholder="Phone placeholder"
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Modal Styling</Label>
                  <div className="text-[11px] text-muted-foreground">Controls modal background, text color, and typography.</div>
                  <ColorInput
                    label="Background Color"
                    value={config.lead_modal_background_color || "#ffffff"}
                    onChange={(value) => updateConfig({ lead_modal_background_color: value })}
                  />
                  <ColorInput
                    label="Text Color"
                    value={config.lead_modal_text_color || "#000000"}
                    onChange={(value) => updateConfig({ lead_modal_text_color: value })}
                  />
                  <NumberInput
                    label="Border Radius"
                    value={config.lead_modal_border_radius || 12}
                    onChange={(value) => updateConfig({ lead_modal_border_radius: value })}
                    min={0}
                    max={50}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FontSelector
                      label="Font Family"
                      value={config.lead_modal_font_family || "Inter"}
                      onChange={(value) => updateConfig({ lead_modal_font_family: value })}
                    />
                    <NumberInput
                      label="Font Size"
                      value={config.lead_modal_font_size || 14}
                      onChange={(value) => updateConfig({ lead_modal_font_size: value })}
                      min={10}
                      max={32}
                    />
                  </div>
                </div>
                
                {/* Submit Button Styling */}
                <div className="space-y-3">
                  <Label className="text-sm font-semibold">Submit Button</Label>
                  <div className="text-[11px] text-muted-foreground">Controls CTA button and link hover colors in the modal.</div>
                  <ColorInput
                    label="Button Color"
                    value={config.primary_color || "#3b82f6"}
                    onChange={(value) => updateConfig({ primary_color: value })}
                  />
                  <ColorInput
                    label="Hover Color"
                    value={config.secondary_color || "#1e40af"}
                    onChange={(value) => updateConfig({ secondary_color: value })}
                  />
                </div>
              </>
            )}
          </div>
        </details>

	        {/* Demo Overlay */}
	        <details 
	          className={sectionClasses}
	          open={designSections['demo_overlay']}
	        >
	          <summary 
	            className={sectionSummaryClasses}
	            onClick={(e) => {
	              e.preventDefault();
	              toggleSection('design', 'demo_overlay');
	            }}
          >
            <span className="flex items-center gap-2.5 text-sm font-medium">
              <HelpCircle className="h-4 w-4 text-muted-foreground" />
              Demo Overlay
            </span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${designSections['demo_overlay'] ? 'rotate-180' : ''}`} />
          </summary>
	          <div className={sectionContentClasses}>
            {/* Preview Button */}
            <div className="flex items-center justify-between p-2 bg-zinc-100 dark:bg-zinc-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Preview Demo Overlay</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Ensure demo is enabled, then trigger overlay in the preview
                  updateConfig({ demo_enabled: true });
                  const event = new CustomEvent('preview-demo-overlay');
                  window.dispatchEvent(event);
                }}
                className="h-8"
              >
                Preview
              </Button>
            </div>

            {/* Settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Show Demo Overlay</Label>
	                <Switch
	                  checked={config.demo_enabled ?? true}
	                  onCheckedChange={(checked) => updateConfig({ demo_enabled: checked })}
	                  className="data-[state=checked]:bg-primary"
	                />
              </div>
              <p className="text-xs text-muted-foreground mb-2">Show a helpful overlay to guide new users</p>

              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Click to Dismiss</Label>
	                <Switch
	                  checked={config.demo_click_to_dismiss ?? false}
	                  onCheckedChange={(checked) => updateConfig({ demo_click_to_dismiss: checked })}
	                  className="data-[state=checked]:bg-primary"
	                />
              </div>
              <p className="text-xs text-muted-foreground mb-2">Allow users to dismiss the demo by clicking anywhere</p>

              <div className="space-y-3 pt-2">
                <Label className="text-sm font-semibold">Demo Messages</Label>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Upload Step</Label>
                  <Input
                    value={config.demo_upload_message || "Upload your reference images to guide the AI"}
                    onChange={(e) => updateConfig({ demo_upload_message: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="Upload your reference images to guide the AI"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">Gallery Step</Label>
                  <Input
                    value={config.demo_generation_message || "Your AI-generated images will appear here"}
                    onChange={(e) => updateConfig({ demo_generation_message: e.target.value })}
                    className="h-8 text-xs"
                    placeholder="Your AI-generated images will appear here"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  These messages are shown in the demo overlay tutorial.
                </p>
              </div>

              <Label className="text-sm font-semibold">Loop Count</Label>
              <NumberInput
                label=""
                value={config.demo_loop_count ?? 3}
                onChange={(value) => updateConfig({ demo_loop_count: Math.max(1, Math.min(10, value)) })}
                min={1}
                max={10}
                placeholder="3"
              />
              <p className="text-xs text-muted-foreground">Number of times to repeat the demo (1-10)</p>
            </div>
          </div>
        </details>

        {/* Implementation Mode Settings moved to Launch tab */}

      </div>
    </ErrorBoundary>
  );
}); 

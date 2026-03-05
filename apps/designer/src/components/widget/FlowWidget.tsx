"use client";

import type { CSSProperties } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useSupabaseClientWithAuth } from '@/hooks/useSupabaseClientWithAuth';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { FlowConfig } from '@/types/flow';
import { useFlowState } from '@/hooks/useFlowState';
import { FlowQuestion } from './FlowQuestion';

interface FlowWidgetProps {
  instanceId: string;
  initialDesign?: FlowConfig["design"];
}

const QUESTION_GENERATION_MODES = ['ai', 'manual', 'hybrid'] as const;
const DESIGN_GENERATION_STRATEGIES = ['progressive', 'after_all', 'custom'] as const;

function normalizeFlowConfig(raw: unknown): FlowConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const v: any = raw;

  const steps = Array.isArray(v.steps) ? (v.steps as FlowConfig['steps']) : [];
  const questionGenerationMode = QUESTION_GENERATION_MODES.includes(v.questionGenerationMode)
    ? v.questionGenerationMode
    : 'manual';
  const designGenerationStrategy = DESIGN_GENERATION_STRATEGIES.includes(v.designGenerationStrategy)
    ? v.designGenerationStrategy
    : 'progressive';

  const dataCollection =
    v.dataCollection && typeof v.dataCollection === 'object'
      ? v.dataCollection
      : { fields: [], requiredFields: [] };

  return {
    enabled: v.enabled === true,
    name: typeof v.name === 'string' ? v.name : undefined,
    description: typeof v.description === 'string' ? v.description : undefined,
    steps,
    questionGenerationMode,
    designGenerationStrategy,
    designGenerationTriggers:
      v.designGenerationTriggers && typeof v.designGenerationTriggers === 'object' ? v.designGenerationTriggers : undefined,
    dataCollection,
    componentLibrary: Array.isArray(v.componentLibrary) ? v.componentLibrary : undefined,
    design: v.design && typeof v.design === 'object' ? v.design : undefined,
    layout: v.layout && typeof v.layout === 'object' ? v.layout : undefined,
    completion: v.completion && typeof v.completion === 'object' ? v.completion : undefined,
    integrations: v.integrations && typeof v.integrations === 'object' ? v.integrations : undefined,
  };
}

export function FlowWidget({ instanceId, initialDesign }: FlowWidgetProps) {
  const [flowConfig, setFlowConfig] = useState<FlowConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [designOverride, setDesignOverride] = useState<FlowConfig["design"] | null>(initialDesign ?? null);
  
  const supabase = useSupabaseClientWithAuth();
  const { session } = useAuth();
  const { toast } = useToast();

  const {
    state,
    currentStep,
    updateAnswer,
    nextStep,
    previousStep,
    getProgress,
    canProceed,
    isFirstStep,
    isLastStep,
  } = useFlowState({
    instanceId,
    flowConfig,
  });

  const stepsCount = Array.isArray(flowConfig?.steps) ? flowConfig.steps.length : 0;
  const design = { ...(flowConfig?.design || {}), ...(designOverride || {}) };

  // Form UI toggles (stored in instances.config, but streamed into preview via design override merge).
  // Back-compat: if these are not present, fall back to flow_config.layout defaults (show unless false).
  const showProgressBar =
    (design as any)?.form_show_progress_bar ?? (flowConfig?.layout?.showProgressBar !== false);
  const showStepDescriptions =
    (design as any)?.form_show_step_descriptions ?? (flowConfig?.layout?.showStepNumbers !== false);

  useEffect(() => {
    if (!instanceId || !supabase) return;
    
    const fetchInstance = async () => {
      try {
        setLoading(true);
        
        const { data: instanceData, error: instanceError } = await supabase
          .from('instances')
          .select('flow_config')
          .eq('id', instanceId)
          .single();

        if (instanceError) throw instanceError;

        if (instanceData?.flow_config) {
          const normalized = normalizeFlowConfig(instanceData.flow_config);
          if (!normalized) {
            setFlowConfig(null);
            toast({
              title: "Flow Not Configured",
              description: "This instance does not have AI form configured.",
              variant: "destructive",
            });
          } else {
            setFlowConfig(normalized);
          }
        } else {
          toast({
            title: "Flow Not Configured",
            description: "This instance does not have AI form configured.",
            variant: "destructive",
          });
        }
      } catch (err) {
        toast({
          title: "Error",
          description: "Failed to load flow configuration",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInstance();
  }, [instanceId, supabase, toast]);

  // Let iframe previews know the form is ready to receive updates.
  useEffect(() => {
    try {
      window.parent?.postMessage({ type: 'WIDGET_READY', timestamp: Date.now() }, '*');
    } catch {}
  }, []);

  // Listen for real-time config updates from designer
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data: any = event.data;
      if (!data || typeof data !== 'object') return;
      
      if (data.type === 'UPDATE_FLOW_CONFIG' && data.config) {
        setDesignOverride((prev) => ({ ...(prev || {}), ...data.config }));

        // Update flow config with new design settings
        setFlowConfig((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            design: { ...prev.design, ...data.config }
          };
        });

        // Stop resend loops in preview frames.
        try {
          window.parent?.postMessage({ type: 'UPDATE_CONFIG_ACK', timestamp: Date.now() }, '*');
        } catch {}
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("debugFlow") !== "1") return;
      // eslint-disable-next-line no-console
      console.log("[FlowWidget debug]", {
        enabled: flowConfig?.enabled,
        instanceId,
        loading,
        stepsCount,
      });
    } catch {}
  }, [flowConfig?.enabled, instanceId, loading, stepsCount]);

  const containerStyle = useMemo(() => {
    const s: CSSProperties = {};
    if (design.background_color) s.backgroundColor = design.background_color;
    if (typeof design.container_padding === 'number') s.padding = design.container_padding;
    if (typeof design.container_padding_top === 'number') s.paddingTop = design.container_padding_top;
    if (typeof design.container_padding_right === 'number') s.paddingRight = design.container_padding_right;
    if (typeof design.container_padding_bottom === 'number') s.paddingBottom = design.container_padding_bottom;
    if (typeof design.container_padding_left === 'number') s.paddingLeft = design.container_padding_left;
    if (design.font_family) s.fontFamily = design.font_family;
    if (typeof design.base_font_size === 'number') s.fontSize = `${design.base_font_size}px`;
    return s;
  }, [
    design.background_color,
    design.base_font_size,
    design.container_padding,
    design.container_padding_bottom,
    design.container_padding_left,
    design.container_padding_right,
    design.container_padding_top,
    design.font_family,
  ]);

  const cardStyle = useMemo(() => {
    const s: CSSProperties = {};
    if (typeof design.max_width === 'number') s.maxWidth = design.max_width;
    if (typeof design.border_radius === 'number') s.borderRadius = design.border_radius;
    if (design.prompt_background_color) s.backgroundColor = design.prompt_background_color;
    return s;
  }, [design.border_radius, design.max_width, design.prompt_background_color]);

  const primaryColor = design.primary_color || undefined;
  const nextButtonBg = design.submit_button_background_color || primaryColor;
  const nextButtonText = design.submit_button_text_color || undefined;

  const promptBoxStyle = useMemo(() => {
    const s: CSSProperties = {};
    if (design.prompt_background_color) s.backgroundColor = design.prompt_background_color;
    if (design.prompt_text_color) s.color = design.prompt_text_color;
    if (typeof design.prompt_border_radius === 'number') s.borderRadius = design.prompt_border_radius;

    const borderStyle = design.prompt_border_style;
    const borderWidth = design.prompt_border_width;
    const borderColor = design.prompt_border_color;

    if (borderStyle && borderStyle !== 'none') s.borderStyle = borderStyle;
    if (typeof borderWidth === 'number') s.borderWidth = borderWidth;
    if (borderColor) s.borderColor = borderColor;

    if (borderStyle === 'none') {
      s.borderStyle = 'solid';
      s.borderWidth = 0;
    }

    if (typeof design.prompt_padding === 'number') s.padding = design.prompt_padding;
    return s;
  }, [
    design.prompt_background_color,
    design.prompt_border_color,
    design.prompt_border_radius,
    design.prompt_border_style,
    design.prompt_border_width,
    design.prompt_padding,
    design.prompt_text_color,
  ]);

  if (loading) {
    return (
      <div className="w-full" style={containerStyle}>
        <Card className="w-full max-w-2xl mx-auto" style={cardStyle}>
          <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Loading flow...</p>
          </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!flowConfig || !flowConfig.enabled) {
    return (
      <div className="w-full" style={containerStyle}>
        <Card className="w-full max-w-2xl mx-auto" style={cardStyle}>
          <CardContent className="p-8">
            <p className="text-center text-destructive">
              AI form is not configured or enabled for this instance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (stepsCount === 0) {
    return (
      <div className="w-full" style={containerStyle}>
        <Card className="w-full max-w-4xl mx-auto" style={cardStyle}>
          <CardHeader>
            <CardTitle>{flowConfig.name || "AI Form"}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Theme preview is enabled, but this flow has no steps yet. (This is the flow-based form renderer, not the widget app UI.)
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="space-y-4 rounded-lg border p-4" style={promptBoxStyle}>
              <h3 className="text-lg font-semibold">No steps configured</h3>
              <p className="text-sm text-muted-foreground">
                Add at least one step to `instances.flow_config.steps` to render a real form. For now, here’s a
                sample field to preview colors.
              </p>

              <div className="space-y-2">
                <Label>Sample input</Label>
                <Input placeholder="Type here…" />
              </div>
            </div>

            <div className="flex items-center justify-end pt-4 border-t">
              <Button
                disabled
                style={{
                  backgroundColor: nextButtonBg,
                  color: nextButtonText,
                  opacity: 0.7,
                }}
              >
                Next <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentStep) {
    return (
      <div className="w-full" style={containerStyle}>
        <Card className="w-full max-w-4xl mx-auto" style={cardStyle}>
          <CardHeader>
            <CardTitle>{flowConfig.name || "AI Form"}</CardTitle>
          </CardHeader>
          <CardContent className="p-8">
            <p className="text-center text-muted-foreground">No steps available in this flow.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = getProgress();

  return (
    <div className="w-full" style={containerStyle}>
      <Card className="w-full max-w-4xl mx-auto" style={cardStyle}>
        <CardHeader>
        {flowConfig.name && (
          <CardTitle>{flowConfig.name}</CardTitle>
        )}
        {flowConfig.description && (
          <p className="text-sm text-muted-foreground mt-1">{flowConfig.description}</p>
        )}
        
        {/* Progress Bar */}
        {showProgressBar && (
          <div className="mt-4">
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, backgroundColor: primaryColor }}
              />
            </div>
            {showStepDescriptions ? (
              <div className="flex justify-between mt-2 text-xs text-muted-foreground">
                <span>
                  Step {state.currentStepIndex + 1} of {stepsCount}
                </span>
                <span>{Math.round(progress)}%</span>
              </div>
            ) : null}
          </div>
        )}
        </CardHeader>
      
        <CardContent className="space-y-6">
          {/* Current Step */}
          <div className="space-y-4 rounded-lg border p-4" style={promptBoxStyle}>
          {currentStep.title && (
            <h3 className="text-lg font-semibold">{currentStep.title}</h3>
          )}
          {currentStep.description && (
            <p className="text-sm text-muted-foreground">{currentStep.description}</p>
          )}

          {/* Question(s) */}
          {currentStep.question && (
            <FlowQuestion
              question={currentStep.question}
              value={state.answers[currentStep.question.id]}
              onChange={(value) => updateAnswer(currentStep.question!.id, value)}
            />
          )}

          {currentStep.questions && currentStep.questions.length > 0 && (
            <div className="space-y-4">
              {currentStep.questions.map((question) => (
                <FlowQuestion
                  key={question.id}
                  question={question}
                  value={state.answers[question.id]}
                  onChange={(value) => updateAnswer(question.id, value)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button
            variant="outline"
            onClick={previousStep}
            disabled={isFirstStep}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>

          <Button
            onClick={nextStep}
            disabled={!canProceed() || isLastStep}
            style={{
              backgroundColor: nextButtonBg,
              color: nextButtonText,
            }}
          >
            {isLastStep ? 'Complete' : 'Next'}
            {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" />}
          </Button>
        </div>
        </CardContent>
      </Card>
    </div>
  );
}

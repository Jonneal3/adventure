"use client";

import React from "react";
import type { StepDefinition } from "@/types/ai-form";
import type { MultipleChoiceUI } from "@/types/ai-form-ui-contract";
import { StepLayout } from "../ui-layout/StepLayout";
import { Choice } from "../input-controls/ChoiceControl";
import { useFormTheme } from "../../demo/FormThemeProvider";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface MultipleChoiceStepProps {
  step: StepDefinition | MultipleChoiceUI;
  stepData?: any;
  onComplete: (data: any) => void;
  onBack?: () => void;
  canGoBack: boolean;
  isLoading: boolean;
  feedbackPrompt?: React.ReactNode;
  headerInlineControl?: React.ReactNode;
  actionsVariant?: "default" | "sticky_mobile" | "icon_only";
  compactInPreview?: boolean;
  layoutDebugEnabled?: boolean;
  allStepData?: Record<string, any>;
}

export function MultipleChoiceStep({
  step,
  stepData,
  onComplete,
  onBack,
  canGoBack,
  isLoading,
  feedbackPrompt,
  headerInlineControl,
  actionsVariant,
  compactInPreview,
  layoutDebugEnabled,
  allStepData = {},
}: MultipleChoiceStepProps) {
  const { theme } = useFormTheme();
  const continueLabel = (step as any)?.blueprint?.presentation?.continue_label ?? "Continue";
  const autoAdvanceOverride = (step as any)?.blueprint?.presentation?.auto_advance;
  const isUIStep = "type" in (step as any) && !(step as any).componentType;
  const multiple = isUIStep
    ? Boolean((step as MultipleChoiceUI).multi_select)
    : Boolean((step as StepDefinition).data?.multiple || (step as StepDefinition).data?.multiSelect);
  const minSelections =
    isUIStep && multiple && Number.isFinite(Number((step as any)?.min_selections))
      ? Math.max(1, Math.floor(Number((step as any).min_selections)))
      : multiple
        ? 1
        : 1;
  const otherRequiresText = Boolean(
    isUIStep && ((step as any)?.other_requires_text || (step as any)?.blueprint?.validation?.other_requires_text)
  );

  const [value, setValue] = React.useState<any>(stepData ?? (multiple ? [] : null));
  const isConceptEditingStep = String((step as any)?.id || "") === "step-project-scope" &&
    Boolean((step as any)?.blueprint?.validation?.concept_editing);
  const initialConceptEditValue = React.useMemo(() => {
    if (stepData && typeof stepData === "object" && !Array.isArray(stepData)) {
      return {
        changes: Array.isArray(stepData.changes) ? stepData.changes : [],
        prompt: typeof stepData.prompt === "string" ? stepData.prompt : "",
      };
    }
    return { changes: Array.isArray(stepData) ? stepData : [], prompt: "" };
  }, [stepData]);
  const [conceptChanges, setConceptChanges] = React.useState<string[]>(initialConceptEditValue.changes);
  const [conceptPrompt, setConceptPrompt] = React.useState(initialConceptEditValue.prompt);

  React.useEffect(() => {
    if (stepData !== undefined) setValue(stepData);
  }, [stepData]);

  React.useEffect(() => {
    if (!isConceptEditingStep) return;
    setConceptChanges(initialConceptEditValue.changes);
    setConceptPrompt(initialConceptEditValue.prompt);
  }, [initialConceptEditValue, isConceptEditingStep]);

  if (isConceptEditingStep) {
    const rawOptions = Array.isArray((step as any)?.options) ? (step as any).options : [];
    const max = Number.isFinite(Number((step as any)?.max_selections)) ? Number((step as any).max_selections) : 5;
    const hasConceptInput = conceptChanges.length > 0 || conceptPrompt.trim().length > 0;
    const submitConceptChanges = () => onComplete({ changes: conceptChanges, prompt: conceptPrompt.trim() });
    const usingProjectPhoto = String(allStepData["step-style-direction"] || "") === "__project_photo__";
    const displayStep = {
      ...(step as any),
      question: usingProjectPhoto ? "What would you like to change in your space?" : "Change this design",
      humanism: "Pick a few ideas or describe your own.",
    };

    return (
      <StepLayout
        step={displayStep}
        onComplete={submitConceptChanges}
        onBack={onBack}
        canGoBack={canGoBack}
        isLoading={isLoading}
        canContinue={hasConceptInput}
        continueLabel={continueLabel}
        feedbackPrompt={feedbackPrompt}
        headerInlineControl={headerInlineControl}
        actionsVariant={actionsVariant}
        compactInPreview={compactInPreview}
        layoutDebugEnabled={layoutDebugEnabled}
      >
        <div className="flex h-full min-h-0 w-full flex-col overflow-visible px-1 pb-1">
          <div className="flex flex-wrap items-center justify-start gap-2">
            {rawOptions.map((option: any) => {
              const optionValue = String(option?.value || option?.label || "");
              const selected = conceptChanges.includes(optionValue);
              const atLimit = conceptChanges.length >= max && !selected;
              return (
                <button
                  key={optionValue}
                  type="button"
                  disabled={atLimit}
                  aria-pressed={selected}
                  onClick={() => {
                    setConceptChanges((current) =>
                      current.includes(optionValue)
                        ? current.filter((item) => item !== optionValue)
                        : current.length < max
                          ? [...current, optionValue]
                          : current,
                    );
                  }}
                  className={cn(
                    "inline-flex min-h-10 items-center justify-center gap-1 rounded-full border px-4 py-2 text-[12px] font-semibold leading-none transition",
                    selected
                      ? "border-black bg-black text-white shadow-sm"
                      : "border-black/20 bg-white text-foreground/80 hover:border-black/35 hover:bg-black/[0.025]",
                    atLimit && "cursor-not-allowed opacity-45",
                  )}
                  style={{ fontFamily: theme.fontFamily, borderRadius: "9999px" }}
                >
                  {selected ? <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> : null}
                  {String(option?.label || optionValue)}
                </button>
              );
            })}
          </div>
          <div className="mt-5 shrink-0">
            <label className="mb-2 block text-[12px] font-medium text-foreground/60" htmlFor="concept-change-prompt">
              Or describe your own
            </label>
            <div className="relative">
              <textarea
                id="concept-change-prompt"
                value={conceptPrompt}
                onChange={(event) => setConceptPrompt(event.target.value.slice(0, 280))}
                placeholder={String((step as any)?.blueprint?.validation?.prompt_placeholder || "Make the walls sage green and give the fixtures a more refined look…")}
                rows={3}
                className="min-h-[6rem] w-full resize-none rounded-2xl border border-black/15 bg-white px-4 py-3 text-[13px] leading-relaxed text-foreground outline-none transition placeholder:text-foreground/35 focus:border-black/40 focus:ring-2 focus:ring-black/[0.06]"
                style={{ fontFamily: theme.fontFamily }}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && hasConceptInput) submitConceptChanges();
                }}
              />
              <span className="pointer-events-none absolute bottom-2 right-3 text-[10px] tabular-nums text-foreground/35">
                {conceptPrompt.length}/280
              </span>
            </div>
          </div>
        </div>
      </StepLayout>
    );
  }

  const canContinue = (() => {
    if (multiple) {
      if (!Array.isArray(value)) return false;
      if (otherRequiresText && value.includes("other")) return false;
      return value.length >= minSelections;
    }
    if (otherRequiresText && value === "other") return false;
    return value !== null && value !== undefined && value !== "";
  })();

  return (
    <StepLayout
      step={step as any}
      onComplete={() => onComplete(value)}
      onBack={onBack}
      canGoBack={canGoBack}
      isLoading={isLoading}
      canContinue={canContinue}
      continueLabel={continueLabel}
      feedbackPrompt={feedbackPrompt}
      headerInlineControl={headerInlineControl}
      actionsVariant={actionsVariant}
      compactInPreview={compactInPreview}
      layoutDebugEnabled={layoutDebugEnabled}
    >
      <div
        className={
          compactInPreview
            ? "flex h-full min-h-0 min-w-0 w-full flex-col justify-start overflow-hidden py-0 text-center [&>div]:w-full [&>div]:min-w-0 [&>div>div]:mx-auto"
            : "w-full min-w-0 [&>div]:w-full [&>div]:text-left [&>div>div]:mx-0 [&>div>div:first-child]:w-full [&>div>div:first-child]:justify-start"
        }
      >
        <Choice
          step={step as any}
          stepData={value}
          onChange={setValue}
          forceCompact={compactInPreview}
          onAutoSubmit={(v) => {
            // For single-select, auto-advance.
            const shouldAuto = typeof autoAdvanceOverride === "boolean" ? autoAdvanceOverride : !multiple;
            if (shouldAuto) onComplete(v);
          }}
        />
      </div>
    </StepLayout>
  );
}

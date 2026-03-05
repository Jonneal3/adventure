"use client";

import React from "react";
import type { IntroUI } from "@/types/ai-form-ui-contract";
import { useFormTheme } from "../../demo/FormThemeProvider";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Sparkles, Clock3, ShieldCheck } from "lucide-react";

interface InitialStepProps {
  step: IntroUI;
  stepData?: any;
  onComplete: (data: any) => void;
  onBack?: () => void;
  canGoBack: boolean;
  isLoading: boolean;
  actionsVariant?: "default" | "sticky_mobile" | "icon_only";
}

export function InitialStep({ step, onComplete, onBack, canGoBack, isLoading, actionsVariant }: InitialStepProps) {
  const { theme } = useFormTheme();
  const brand = step.brand || null;
  const continueLabel = step.blueprint?.presentation?.continue_label || "Start";
  const actionButtonClass = "flex-1 min-w-0 h-11 px-3 text-sm font-semibold overflow-hidden";

  const handleStart = () => {
    onComplete({
      started: true,
      brand: brand || null,
      timestamp: new Date().toISOString(),
    });
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h2 className="text-lg sm:text-xl font-semibold min-w-0 flex-1 break-words" style={{ color: theme.textColor, fontFamily: theme.fontFamily }}>
          {step.question || "Let’s get started"}
        </h2>
        {step.humanism ? (
          <p className="mt-1 text-sm opacity-80" style={{ color: theme.textColor, fontFamily: theme.fontFamily }}>
            {step.humanism}
          </p>
        ) : null}
      </div>

      <div className="space-y-6">
        <div
          className="rounded-2xl border p-4"
          style={{
            backgroundColor: "var(--form-surface-color, rgba(255,255,255,0.70))",
            borderColor: "var(--form-surface-border-color, rgba(0,0,0,0.10))",
            borderRadius: `${theme.borderRadius}px`,
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: `${theme.primaryColor}18` }}
            >
              <Sparkles className="h-5 w-5" style={{ color: theme.primaryColor }} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[15px]">
                {brand ? `Personalized to ${brand}` : "Personalized to your answers"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground/80 leading-relaxed">
                We’ll ask only what we need. If the AI can infer it safely, we won’t bother you.
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div
            className="rounded-2xl border p-4"
            style={{
              backgroundColor: "var(--form-surface-color, rgba(255,255,255,0.70))",
              borderColor: "var(--form-surface-border-color, rgba(0,0,0,0.10))",
              borderRadius: `${theme.borderRadius}px`,
            }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              ~2 minutes
            </div>
            <div className="mt-2 text-sm font-medium">Quick, focused questions</div>
          </div>
          <div
            className="rounded-2xl border p-4"
            style={{
              backgroundColor: "var(--form-surface-color, rgba(255,255,255,0.70))",
              borderColor: "var(--form-surface-border-color, rgba(0,0,0,0.10))",
              borderRadius: `${theme.borderRadius}px`,
            }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              No spam
            </div>
            <div className="mt-2 text-sm font-medium">You control what you share</div>
          </div>
          <div
            className="rounded-2xl border p-4"
            style={{
              backgroundColor: "var(--form-surface-color, rgba(255,255,255,0.70))",
              borderColor: "var(--form-surface-border-color, rgba(0,0,0,0.10))",
              borderRadius: `${theme.borderRadius}px`,
            }}
          >
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <Sparkles className="h-4 w-4" />
              Better results
            </div>
            <div className="mt-2 text-sm font-medium">Cleaner inputs → cleaner outputs</div>
          </div>
        </div>
      </div>

      {actionsVariant === "icon_only" ? (
        <div className="flex items-center justify-between pt-1">
          {canGoBack && onBack ? (
            <Button
              type="button"
              onClick={onBack}
              variant="outline"
              className="h-10 w-10 rounded-full p-0"
              style={{
                borderColor: "var(--form-surface-border-color, rgba(0,0,0,0.14))",
                color: theme.textColor,
                fontFamily: theme.fontFamily,
              }}
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
          ) : (
            <div className="h-10 w-10" aria-hidden="true" />
          )}
          <Button
            type="button"
            onClick={handleStart}
            disabled={isLoading}
            className="h-10 w-10 rounded-full p-0"
            style={{
              backgroundColor: theme.buttonStyle?.backgroundColor || theme.primaryColor,
              color: theme.buttonStyle?.textColor || "#ffffff",
              fontFamily: theme.fontFamily,
            }}
            aria-label={isLoading ? "Loading" : continueLabel}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex min-w-0 gap-3 pt-2">
          {canGoBack && onBack ? (
            <Button
              type="button"
              onClick={onBack}
              variant="outline"
              className={actionButtonClass}
              style={{
                borderColor: theme.primaryColor,
                color: theme.primaryColor,
                fontFamily: theme.fontFamily,
                borderRadius: `${theme.borderRadius}px`,
              }}
            >
              <span className="truncate">Back</span>
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={handleStart}
            disabled={isLoading}
            className={actionButtonClass}
            style={{
              backgroundColor: theme.buttonStyle?.backgroundColor || theme.primaryColor,
              color: theme.buttonStyle?.textColor || "#ffffff",
              fontFamily: theme.fontFamily,
              borderRadius: `${theme.borderRadius}px`,
            }}
          >
            <span className="truncate">{isLoading ? "Loading..." : continueLabel}</span>
          </Button>
        </div>
      )}
    </div>
  );
}

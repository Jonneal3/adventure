"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useFormTheme } from "../../demo/FormThemeProvider";
import { useLayoutDensity } from "./layout-density";
import { ArrowLeft, ArrowRight } from "lucide-react";

interface StepLayoutProps {
  step: any;
  children: React.ReactNode;
  onComplete: () => void;
  onBack?: () => void;
  canGoBack?: boolean;
  isLoading?: boolean;
  canContinue?: boolean;
  continueLabel?: string;
  className?: string;
  actionsVariant?: "default" | "sticky_mobile" | "icon_only";
  feedbackPrompt?: React.ReactNode;
  headerInlineControl?: React.ReactNode;
  compactInPreview?: boolean;
}

function getQuestion(step: any): string {
  return (
    String(step?.question || "").trim() ||
    String(step?.content?.prompt || "").trim() ||
    "Tell us a bit more"
  );
}

function getSubtext(step: any): string {
  return (
    String(step?.humanism || "").trim() ||
    String(step?.subtext || "").trim() ||
    String(step?.content?.subtext || "").trim()
  );
}

export function StepLayout({
  step,
  children,
  onComplete,
  onBack,
  canGoBack = false,
  isLoading = false,
  canContinue = true,
  continueLabel,
  className,
  actionsVariant = "default",
  feedbackPrompt,
  headerInlineControl,
  compactInPreview = false,
}: StepLayoutProps) {
  const { theme } = useFormTheme();
  const density = useLayoutDensity();
  const isCompact = density === "compact";
  const useCompactPane = compactInPreview;
  const useCompactPreviewPane = compactInPreview && actionsVariant === "icon_only";
  const question = getQuestion(step);
  const subtext = getSubtext(step);
  const resolvedContinueLabel = continueLabel || step?.blueprint?.presentation?.continue_label || "Continue";
  const disableContinue = Boolean(isLoading || !canContinue);
  const actionButtonClass = "h-9 min-w-[88px] px-3 text-xs font-semibold shrink-0";
  const iconButtonClass = "h-8 w-10 p-0 rounded-full";
  const contentViewportClassName = cn(
    "flex-1 min-h-0",
    useCompactPane && actionsVariant !== "icon_only"
      ? "overflow-y-auto overflow-x-hidden pr-1 sm:pr-2"
      : "overflow-hidden",
    useCompactPane ? "rounded-lg" : null
  );

  return (
    <div
      className={cn(
        "w-full mx-auto h-full min-h-0 overflow-hidden",
        useCompactPane ? "max-w-none" : "max-w-5xl",
        useCompactPane ? "px-2 py-2 sm:px-3 sm:py-3" : isCompact ? "px-4 py-4" : "px-4 py-6",
        className
      )}
    >
      {actionsVariant === "icon_only" ? (
        <div className={cn("grid h-full min-h-0 items-stretch", useCompactPane ? "grid-cols-[auto,minmax(0,1fr),auto] gap-2" : "grid-cols-[auto,minmax(0,1fr),auto] gap-3")}>
          {canGoBack && onBack ? (
            <Button
              type="button"
              onClick={onBack}
              variant="outline"
              className={cn(iconButtonClass, "shrink-0")}
              style={{
                borderColor: "var(--form-surface-border-color, rgba(0,0,0,0.14))",
                color: theme.textColor,
                fontFamily: theme.fontFamily,
              }}
              aria-label="Go back"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <div className="h-8 w-10 shrink-0" aria-hidden="true" />
          )}
          <div
            className={cn(
              "min-w-0 min-h-0 flex flex-col overflow-hidden",
              useCompactPane ? "gap-2" : isCompact ? "gap-4" : "gap-6"
            )}
          >
            <div className={cn("shrink-0", headerInlineControl ? "flex items-start justify-between gap-2" : undefined)}>
              <div className="min-w-0 flex-1">
                <h2
                  className={cn(
                    useCompactPane ? "text-sm sm:text-base leading-tight" : isCompact ? "text-xl" : "text-2xl",
                    "font-semibold min-w-0 break-words"
                  )}
                  style={{ color: theme.textColor, fontFamily: theme.fontFamily }}
                >
                  {question}
                </h2>
                {subtext ? (
                  <p
                    className={cn(
                      "mt-1 opacity-80",
                      useCompactPane ? "text-[11px] leading-tight line-clamp-2" : "text-sm"
                    )}
                    style={{ color: theme.textColor, fontFamily: theme.fontFamily }}
                  >
                    {subtext}
                  </p>
                ) : null}
              </div>
              {headerInlineControl ? <div className="shrink-0">{headerInlineControl}</div> : null}
            </div>
            {feedbackPrompt ? <div className={cn("shrink-0", useCompactPane ? "mt-1" : "mt-3")}>{feedbackPrompt}</div> : null}
            <div className={contentViewportClassName}>
              <div className={cn("flex min-h-full min-w-0 flex-col overflow-hidden", useCompactPane ? "justify-center" : "justify-start")}>
                {children}
              </div>
            </div>
          </div>
          <Button
            type="button"
            onClick={onComplete}
            disabled={disableContinue}
            className={cn(iconButtonClass, "shrink-0")}
            style={{
              backgroundColor: theme.buttonStyle?.backgroundColor || theme.primaryColor,
              color: theme.buttonStyle?.textColor || "#ffffff",
              fontFamily: theme.fontFamily,
            }}
            aria-label={isLoading ? "Loading" : resolvedContinueLabel}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className={cn("flex h-full min-h-0 flex-col", useCompactPane ? "gap-3" : isCompact ? "gap-4" : "gap-6")}>
          <div className={cn("shrink-0", headerInlineControl ? "flex items-start justify-between gap-2" : undefined)}>
            <div className="min-w-0 flex-1">
              <h2
                className={cn(
                  useCompactPane ? "text-base sm:text-lg" : isCompact ? "text-xl" : "text-2xl",
                  "font-semibold min-w-0 break-words"
                )}
                style={{ color: theme.textColor, fontFamily: theme.fontFamily }}
              >
                {question}
              </h2>
              {subtext ? (
                <p
                  className={cn("mt-1 opacity-80", useCompactPane ? "text-xs sm:text-sm" : "text-sm")}
                  style={{ color: theme.textColor, fontFamily: theme.fontFamily }}
                >
                  {subtext}
                </p>
              ) : null}
            </div>
            {headerInlineControl ? <div className="shrink-0">{headerInlineControl}</div> : null}
          </div>
          {feedbackPrompt ? <div className="shrink-0">{feedbackPrompt}</div> : null}

          <div className={contentViewportClassName}>
            <div className={cn("flex min-h-full min-w-0 flex-col overflow-hidden", useCompactPane ? "justify-start" : "justify-start")}>
              {children}
            </div>
          </div>

          <div
            className={cn(
              "flex min-w-0 justify-center gap-2.5 shrink-0",
              actionsVariant === "sticky_mobile"
                ? "sticky bottom-2 z-10 rounded-xl border p-2 bg-[var(--form-surface-color)] border-[color:var(--form-surface-border-color)]"
                : null
            )}
          >
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
                Back
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={onComplete}
              disabled={disableContinue}
              className={actionButtonClass}
              style={{
                backgroundColor: theme.buttonStyle?.backgroundColor || theme.primaryColor,
                color: theme.buttonStyle?.textColor || "#ffffff",
                fontFamily: theme.fontFamily,
                borderRadius: `${theme.borderRadius}px`,
              }}
            >
              {isLoading ? "Loading..." : resolvedContinueLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

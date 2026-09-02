"use client";

import React from "react";
import { FormLoader } from "./FormLoader";

export type AdventureLoaderPhase =
  | "initial"
  | "batch_pricing"
  | "preview_generating"
  | "preview_refining"
  | "preview_refreshing"
  | "inspiration";

interface PhaseConfig {
  primary: string;
}

const PHASE_CONFIGS: Record<AdventureLoaderPhase, PhaseConfig> = {
  initial: {
    primary: "Getting tailored pricing for you…",
  },
  batch_pricing: {
    primary: "Getting you accurate pricing…",
  },
  preview_generating: {
    primary: "Finding similar projects…",
  },
  preview_refining: {
    primary: "Fine-tuning your preview…",
  },
  preview_refreshing: {
    primary: "Refreshing your preview…",
  },
  inspiration: {
    primary: "Gathering inspiration nearby…",
  },
};

export interface AdventureLoaderProps {
  /** Which phase/context. Determines messages and behavior. */
  phase: AdventureLoaderPhase;
  /** Retained for call-site compatibility; the loader is present only while active. */
  active?: boolean;
  /** Layout: centered (full) or pill (compact overlay) */
  variant?: "centered" | "pill";
  /** Context-specific message shown with the spinner. */
  messageOverride?: string;
  /** Custom className passed to FormLoader */
  className?: string;
  /** Visual tone for pill overlays */
  tone?: "default" | "overlay";
  /** Spinner size */
  size?: "sm" | "md";
  /** Inline style for FormLoader */
  style?: React.CSSProperties;
}

export function AdventureLoader({
  phase,
  variant = "centered",
  messageOverride,
  className,
  tone = "default",
  size = "md",
  style,
}: AdventureLoaderProps) {
  const config = PHASE_CONFIGS[phase];
  const primary = messageOverride ?? config.primary;

  return (
    <FormLoader
      message={primary}
      variant={variant}
      size={size}
      className={className}
      tone={tone}
      style={style}
    />
  );
}

"use client";

import React, { createContext, useContext, useMemo, useState } from "react";

export type ViewportMode = "mobile" | "desktop";

export interface ExperienceFacts {
  viewportMode?: ViewportMode;
  showBranding?: boolean;
  showProgress?: boolean;
  showTimeline?: boolean;
  previewEnabled?: boolean;
  previewVisible?: boolean;
  previewHasImage?: boolean;
  leadCaptured?: boolean;
  showQuestionPane?: boolean;
  showEaseFeedback?: boolean;
  showReflectionFeedback?: boolean;
}

export interface ExperienceSections {
  viewportMode: ViewportMode;
  header: boolean;
  branding: boolean;
  progress: boolean;
  timeline: boolean;
  previewRail: boolean;
  questionPane: boolean;
  easeFeedback: boolean;
  reflectionFeedback: boolean;
}

function deriveSections(facts: ExperienceFacts): ExperienceSections {
  const viewportMode = facts.viewportMode ?? "desktop";
  const branding = Boolean(facts.showBranding);
  const progress = Boolean(facts.showProgress);
  const timeline = Boolean(facts.showTimeline);
  const previewRail = Boolean(facts.previewEnabled);
  const questionPane = Boolean(facts.showQuestionPane);
  const easeFeedback = Boolean(facts.showEaseFeedback);
  const reflectionFeedback = Boolean(facts.showReflectionFeedback);

  return {
    viewportMode,
    header: branding || progress || timeline,
    branding,
    progress,
    timeline,
    previewRail,
    questionPane,
    easeFeedback,
    reflectionFeedback,
  };
}

interface ExperienceStateContextValue {
  facts: ExperienceFacts;
  setFacts: React.Dispatch<React.SetStateAction<ExperienceFacts>>;
  sections: ExperienceSections;
}

const ExperienceStateContext = createContext<ExperienceStateContextValue | null>(null);

export function ExperienceStateProvider({
  children,
  initialFacts,
}: {
  children: React.ReactNode;
  initialFacts?: ExperienceFacts;
}) {
  const [facts, setFacts] = useState<ExperienceFacts>(initialFacts ?? {});
  const sections = useMemo(() => deriveSections(facts), [facts]);
  const value = useMemo(() => ({ facts, setFacts, sections }), [facts, sections]);
  return <ExperienceStateContext.Provider value={value}>{children}</ExperienceStateContext.Provider>;
}

export function useExperienceState() {
  const ctx = useContext(ExperienceStateContext);
  if (!ctx) {
    throw new Error("useExperienceState must be used within ExperienceStateProvider");
  }
  return ctx;
}

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { ArrowLeft, Camera, Loader2, LockKeyhole, Sparkles } from "lucide-react";
import { PreviewSection } from "./PreviewSection";
import { FormQuestionSection } from "./FormQuestionPaneSection";
import type { DesignAdventureInputMode } from "./DesignModeToolbar";
import { LOCAL_PARTS_STEP_ID, LOCAL_SCOPE_STEP_ID } from "../utils/build-local-skeleton";
import { useFormSubmission } from "@/hooks/use-form-submission";
import { upsertLeadState } from "@/lib/ai-form/state/form-state-storage";
import { formatCurrency } from "@/lib/ai-form/utils/currency";
import { roundCurrencyBucket } from "@/lib/visual-pricing/rounding";

function isValidDiscoveryEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function stablePricingHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function starterPriceMultiplier(priceTier: string | null | undefined, pricingKey: string, pricingIndex?: number): number {
  const tier = String(priceTier || "").trim().toLowerCase();
  const tierMultipliers: Record<string, number> = {
    "$": 0.9,
    "$$": 1,
    "$$$": 1.18,
    "$$$$": 1.35,
    basic: 0.9,
    budget: 0.9,
    standard: 1,
    midrange: 1,
    premium: 1.18,
    luxury: 1.35,
  };
  const fallbackMultipliers = [0.94, 1, 1.06, 1.12, 0.88, 1.16, 1.22, 0.82];
  const bucket = Number.isFinite(Number(pricingIndex))
    ? Math.abs(Math.floor(Number(pricingIndex))) % fallbackMultipliers.length
    : stablePricingHash(pricingKey) % fallbackMultipliers.length;
  const designMultiplier = fallbackMultipliers[bucket] ?? 1;
  const tierMultiplier = tierMultipliers[tier] ?? 1;
  return tierMultiplier * designMultiplier;
}

function DiscoveryPriceReveal({
  config,
  instanceId,
  sessionId,
  leadCaptured,
  priceRange,
  priceTier,
  pricingKey,
  pricingIndex,
  onCustomize,
  onBrowse,
}: {
  config?: any;
  instanceId: string;
  sessionId: string;
  leadCaptured: boolean;
  priceRange?: { low?: number; high?: number; currency?: string } | null;
  priceTier?: string | null;
  pricingKey: string;
  pricingIndex?: number;
  onCustomize: () => void;
  onBrowse: () => void;
}) {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const { submitForm, isSubmitting } = useFormSubmission({ instanceId, sessionId });
  const explicitMin = Number(priceRange?.low);
  const explicitMax = Number(priceRange?.high);
  const hasExplicitRange = Number.isFinite(explicitMin) && explicitMin > 0 && Number.isFinite(explicitMax) && explicitMax > 0;
  const configuredMin = Number(config?.previewPricing?.totalMin ?? config?.previewPricing?.min);
  const configuredMax = Number(config?.previewPricing?.totalMax ?? config?.previewPricing?.max);
  const baseLow = Number.isFinite(configuredMin) && configuredMin > 0 ? Math.min(configuredMin, configuredMax || configuredMin) : 12_000;
  const baseHigh = Number.isFinite(configuredMax) && configuredMax > baseLow ? configuredMax : Math.max(baseLow + 6_000, 18_000);
  const multiplier = starterPriceMultiplier(priceTier, pricingKey, pricingIndex);
  const derivedLow = roundCurrencyBucket(baseLow * multiplier);
  const derivedHigh = roundCurrencyBucket(baseHigh * multiplier);
  const low = hasExplicitRange ? Math.min(explicitMin, explicitMax) : Math.max(1_000, derivedLow);
  const high = hasExplicitRange
    ? Math.max(explicitMin, explicitMax)
    : Math.max(low + Math.max(500, roundCurrencyBucket((baseHigh - baseLow) * 0.5)), derivedHigh);
  const currency = typeof priceRange?.currency === "string"
    ? priceRange.currency
    : typeof config?.previewPricing?.currency === "string"
      ? config.previewPricing.currency
      : "USD";
  const priceLabel = `${formatCurrency(low, { currency })}–${formatCurrency(high, { currency })}`;

  const submitEmail = async () => {
    const normalized = email.trim();
    if (!isValidDiscoveryEmail(normalized)) {
      setError("Enter a valid email address.");
      return;
    }
    setError(null);
    const result = await submitForm({
      email: normalized,
      isPartial: true,
      submissionData: { gateContext: "discovery_price", surface: "selected_design" },
    });
    if (!result.success) {
      setError(result.message || "Could not reveal the estimate. Please try again.");
      return;
    }
    upsertLeadState(sessionId, { leadCaptured: true, leadEmail: normalized, leadCapturedAt: Date.now() });
  };

  if (leadCaptured) {
    return (
      <div className="mx-auto h-full min-h-0 w-full max-w-[470px] px-2 pb-6 pt-2 text-left">
        <h2 className="text-[26px] font-semibold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[29px]">Get pricing for this design</h2>
        <div className="mt-6 flex justify-center">
          <div className="inline-flex min-w-[220px] items-center justify-center whitespace-nowrap rounded-full border border-black/10 bg-gradient-to-b from-white/90 to-black/[0.035] px-5 py-3 text-[20px] font-semibold tracking-[-0.025em] text-foreground shadow-[0_6px_18px_rgba(15,23,42,0.055)] backdrop-blur-md sm:text-[22px]">
            {priceLabel}
          </div>
        </div>
        <p className="mt-3 max-w-[390px] text-[11px] leading-relaxed text-foreground/48">Preliminary pricing for a similar project. Final cost depends on scope, materials, and site conditions.</p>
        <div className="mt-6 flex flex-wrap items-center justify-start gap-2.5">
          <button type="button" onClick={onCustomize} className="inline-flex min-h-10 items-center justify-center rounded-full border border-primary bg-primary px-5 py-2 text-[12px] font-semibold text-primary-foreground shadow-sm transition hover:brightness-[0.97]">
            Change this design
          </button>
          <button type="button" onClick={onBrowse} className="inline-flex min-h-10 items-center justify-center rounded-full border border-primary/25 bg-primary/[0.08] px-5 py-2 text-[12px] font-semibold text-foreground/70 transition hover:bg-primary/[0.13] hover:text-foreground">
            Browse other designs
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto h-full min-h-0 w-full max-w-[470px] px-2 pb-6 pt-2 text-left" style={{ textAlign: "left" }}>
      <h2 className="text-[26px] font-semibold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[29px]">Your personalized concept and price range are ready.</h2>

      <div className="mt-6 flex justify-center">
        <span className="inline-flex min-w-[220px] items-center justify-center gap-2.5 overflow-hidden whitespace-nowrap rounded-full border border-black/10 bg-gradient-to-b from-white/90 to-black/[0.035] px-5 py-3 shadow-[0_6px_18px_rgba(15,23,42,0.055)] backdrop-blur-md" aria-label="Locked preliminary price range">
          <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="select-none text-[15px] font-semibold tracking-[-0.015em] text-foreground/55 blur-[5px]" aria-hidden="true">
            {priceLabel}
          </span>
        </span>
      </div>

      <form
        className="mt-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submitEmail();
        }}
      >
        <p className="mb-4 text-[13px] leading-relaxed text-foreground/60">Enter your email to reveal pricing, save this design, and keep editing.</p>
        <label className="sr-only" htmlFor="discovery-price-email">Email address</label>
        <div className="relative">
          <input
            id="discovery-price-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            className="h-12 w-full rounded-full border border-black/20 bg-white px-4 pr-[132px] text-left text-[13px] outline-none transition placeholder:text-foreground/35 focus:border-black/50 focus:ring-2 focus:ring-black/[0.06]"
          />
          <button
            type="submit"
            disabled={isSubmitting}
            className="absolute right-1 top-1/2 inline-flex h-10 -translate-y-1/2 items-center justify-center rounded-full bg-black px-5 text-[11px] font-semibold text-white transition hover:bg-black/85 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? "Revealing…" : "Reveal my estimate"}
          </button>
        </div>
        {error ? <p className="mt-2 text-[11px] font-medium text-red-600" role="alert">{error}</p> : null}
        <p className="mt-2.5 text-center text-[10px] text-foreground/45">
          We promise never to send you spam :) <span aria-hidden="true">·</span>{" "}
          <a href="/terms" target="_blank" rel="noreferrer" className="underline decoration-black/20 underline-offset-2 transition hover:text-foreground/70">
            Terms of Service
          </a>
        </p>
      </form>
    </div>
  );
}

/**
 * Fixed vh strips for Ideas + design-tool modes. Guided (`questions`) does not use this — that host is
 * `h-auto` capped with max-height so the pane snaps to step content (see compact question host JSX).
 */
function getCompactQuestionHostHeightClass(opts: {
  isMobileViewport: boolean;
  compactLargeQuestionHost: boolean;
  compactSingleHeroLayout: boolean;
  adventureInputMode: DesignAdventureInputMode;
}): string {
  const { isMobileViewport, compactLargeQuestionHost, compactSingleHeroLayout, adventureInputMode } = opts;
  const toolHeavyStrip =
    adventureInputMode === "prompt" ||
    adventureInputMode === "budget" ||
    adventureInputMode === "uploads";

  if (isMobileViewport) {
    if (compactLargeQuestionHost) {
      if (compactSingleHeroLayout) {
        return toolHeavyStrip ? "h-[24vh] max-h-[24vh]" : "h-[18vh] max-h-[18vh]";
      }
      return toolHeavyStrip ? "h-[28vh] max-h-[28vh]" : "h-[22vh] max-h-[22vh]";
    }
    if (compactSingleHeroLayout) {
      return toolHeavyStrip ? "h-[20vh] max-h-[20vh]" : "h-[14vh] max-h-[14vh]";
    }
    return toolHeavyStrip ? "h-[25vh] max-h-[25vh]" : "h-[19vh] max-h-[19vh]";
  }
  if (compactLargeQuestionHost) {
    if (compactSingleHeroLayout) {
      return toolHeavyStrip ? "h-[21vh] max-h-[21vh]" : "h-[15vh] max-h-[15vh]";
    }
    return toolHeavyStrip ? "h-[26vh] max-h-[26vh]" : "h-[20vh] max-h-[20vh]";
  }
  if (compactSingleHeroLayout) {
    return toolHeavyStrip ? "h-[18vh] max-h-[18vh]" : "h-[12vh] max-h-[12vh]";
  }
  return toolHeavyStrip ? "h-[23vh] max-h-[23vh]" : "h-[17vh] max-h-[17vh]";
}

function compactQuestionHostClassNames(opts: {
  isMobileViewport: boolean;
  compactLargeQuestionHost: boolean;
  compactSingleHeroLayout: boolean;
  adventureInputMode: DesignAdventureInputMode;
}): string {
  const { adventureInputMode } = opts;
  /** Guided: height follows the questionnaire / image rail; scroll inside host if taller than cap. */
  if (adventureInputMode === "questions") {
    return cn(
      "h-auto min-h-0 shrink-0 overflow-y-auto overflow-x-hidden overscroll-contain",
      "max-h-[min(62dvh,560px)]"
    );
  }
  return cn("overflow-hidden", getCompactQuestionHostHeightClass(opts));
}

export function StepEngineBodySection(props: any) {
  const {
    previewColumnRef,
    previewLayoutActive,
    isMobileViewport,
    usePreviewDominantLayout,
    previewRailOpen,
    showPreviewSection,
    previewEnabled,
    leadPricingPresentationActive,
    studioEstimateMode,
    previewViewportRef,
    pricedGridStepActive,
    allowConceptGallery,
    styleStepActive,
    showQuestionPaneUnderPreview,
    adventureInputMode,
    previewAutoAnsweredQuestionCount,
    previewAutoGenerationCounterScope,
    config,
    hasPreviewSubsections,
    instanceId,
    isAdventureSurface,
    isRefinementUploadStep,
    previewMaxPx,
    previewHasImage,
    previewSurfaceMode,
    previewRefreshNonce,
    stepNavReturnToGalleryNonce,
    pendingPreviewSceneUploadUrl,
    promptDraft,
    promptSubmitCount,
    sessionId,
    setPreviewAutoGenerationBusy,
    setPreviewHasImage,
    setPreviewVisible,
    state,
    useDesktopPreviewLayout,
    useMobilePreviewLayout,
    hideQuestionPane,
    compactQuestionHost,
    compactLargeQuestionHost,
    flowCompleted,
    handleBack,
    handleEaseFeedback,
    handleReflectionFeedback,
    handleStepComplete,
    isBatchLoading,
    isFetchingNext,
    effectiveLeadCompleteForPreviewFlow,
    leadGateLocksQuestionArea,
    setAdventureInputMode,
    onApplyIdeaSuggestion,
    budgetSliderConfig,
    budgetValue,
    handleBudgetChange,
    setPromptDraft,
    onPromptSubmit,
    onRegeneratePreview,
    questionContentRef,
    questionScale,
    questionViewportRef,
    refinementUploadInputRef,
    refinementUploading,
    reflectionFeedbackSent,
    setRefinementUploading,
    showStepTransitionSkeleton,
    previewGeneratingFocused,
    showAccuratePricingLoader,
    showEasePrompt,
    stepForRenderer,
    theme,
    layoutDebugEnabled,
    effectiveCurrentStep,
    guidedThumbnailMode,
    onKeepDesigning,
    onPreviewSurfaceModeChange,
    onProjectPhotoSelected,
    starterConcept,
    onBackToStartingIdeas,
  } = props;
  const reduceMotion = useReducedMotion();
  const currentStepId = String(effectiveCurrentStep?.id || "");
  const hasSecondProjectQuestion = Boolean(
    state?.steps?.some((step: any) => String(step?.id || "") === LOCAL_PARTS_STEP_ID),
  );
  const projectSequenceLabel =
    currentStepId === LOCAL_PARTS_STEP_ID
      ? "Project 2 of 2"
      : currentStepId === LOCAL_SCOPE_STEP_ID && hasSecondProjectQuestion
        ? "Project 1 of 2"
        : null;
  const projectPhotoInputRef = React.useRef<HTMLInputElement>(null);
  const [discoveryCustomizeOpened, setDiscoveryCustomizeOpened] = React.useState(false);
  const [discoveryPricingRequested, setDiscoveryPricingRequested] = React.useState(false);
  const [projectPhotoUploading, setProjectPhotoUploading] = React.useState(false);
  const [projectPhotoError, setProjectPhotoError] = React.useState<string | null>(null);

  const handleProjectPhoto = React.useCallback(
    async (file?: File | null) => {
      if (!file || !onProjectPhotoSelected || projectPhotoUploading) return;
      if (!file.type.startsWith("image/")) {
        setProjectPhotoError("Choose an image file.");
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        setProjectPhotoError("Choose an image smaller than 8 MB.");
        return;
      }
      setProjectPhotoUploading(true);
      setProjectPhotoError(null);
      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Could not read that photo."));
          reader.readAsDataURL(file);
        });
        const response = await fetch("/api/upload-reference-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ instanceId, image: dataUrl }),
        });
        const payload = response.ok ? await response.json().catch(() => ({})) : null;
        const url = typeof payload?.url === "string" && payload.url ? payload.url : dataUrl;
        await onProjectPhotoSelected(url);
      } catch (error) {
        setProjectPhotoError(error instanceof Error ? error.message : "Could not add that photo.");
      } finally {
        setProjectPhotoUploading(false);
      }
    },
    [instanceId, onProjectPhotoSelected, projectPhotoUploading],
  );

  /** Single hero (not concept grid): give the preview more vertical space; keep questions in a shorter bottom strip. */
  const compactSingleHeroLayout = Boolean(
    compactQuestionHost && previewSurfaceMode === "single"
  );

  /** One vertical scroller for preview + step content (mobile image generation — matches style-step scroll feel). */
  const mobileGenerationScrollStack = Boolean(
    isMobileViewport &&
      previewGeneratingFocused &&
      showPreviewSection &&
      !hideQuestionPane
  );
  /** Concept grid needs its own vertical pan; outer column scroll yields to inner; question pane scrolls separately. */
  const mobileGalleryStackSplit = Boolean(
    mobileGenerationScrollStack && isMobileViewport && previewSurfaceMode === "gallery"
  );
  const starterStudioActive = Boolean(starterConcept && !styleStepActive && !showPreviewSection);
  const showDiscoveryPriceReveal = Boolean(
    starterStudioActive &&
      !starterConcept?.isProjectPhoto &&
      (effectiveLeadCompleteForPreviewFlow || discoveryPricingRequested)
  );
  React.useEffect(() => {
    setDiscoveryCustomizeOpened(false);
    setDiscoveryPricingRequested(false);
  }, [starterConcept?.value]);

  const previewSectionEl = (
    <PreviewSection
      adventureInputMode={adventureInputMode}
      answeredQuestionCount={previewAutoAnsweredQuestionCount}
      autoGenerationCounterScope={previewAutoGenerationCounterScope}
      config={config}
      hasPreviewSubsections={hasPreviewSubsections}
      instanceId={instanceId}
      isAdventureSurface={isAdventureSurface}
      isRefinementUploadStep={isRefinementUploadStep}
      previewMaxPx={previewMaxPx}
      previewHasImage={previewHasImage}
      previewRefreshNonce={previewRefreshNonce}
      stepNavReturnToGalleryNonce={stepNavReturnToGalleryNonce}
      pendingPreviewSceneUploadUrl={pendingPreviewSceneUploadUrl}
      promptDraft={promptDraft}
      promptSubmitCount={promptSubmitCount}
      sessionId={sessionId}
      setAutoGenerationBusy={setPreviewAutoGenerationBusy}
      setPreviewHasImage={setPreviewHasImage}
      setPreviewVisible={setPreviewVisible}
      leadPricingPresentationActive={leadPricingPresentationActive}
      studioEstimateMode={studioEstimateMode}
      showQuestionPaneUnderPreview={showQuestionPaneUnderPreview}
      stateStepData={state?.stepData}
      toolingEnabled={!pricedGridStepActive}
      disableConceptPicker={!pricedGridStepActive && !allowConceptGallery}
      useDesktopPreviewLayout={useDesktopPreviewLayout}
      useMobilePreviewLayout={useMobilePreviewLayout}
      usePreviewDominantLayout={previewLayoutActive}
      generationScrollStack={mobileGenerationScrollStack}
      previewSurfaceMode={previewSurfaceMode}
      onKeepDesigning={onKeepDesigning}
      onPreviewSurfaceModeChange={onPreviewSurfaceModeChange}
      studioStarterConcept={starterConcept}
    />
  );

  const formQuestionSectionEl = (
    <FormQuestionSection
      config={config}
      effectiveCurrentStep={effectiveCurrentStep}
      flowCompleted={flowCompleted}
      forceExpandedStepLayout={pricedGridStepActive}
      guidedThumbnailMode={guidedThumbnailMode}
      handleBack={currentStepId === LOCAL_SCOPE_STEP_ID ? undefined : handleBack}
      handleEaseFeedback={handleEaseFeedback}
      handleReflectionFeedback={handleReflectionFeedback}
      handleStepComplete={handleStepComplete}
      hideQuestionPane={hideQuestionPane}
      instanceId={instanceId}
      isBatchLoading={isBatchLoading}
      isFetchingNext={isFetchingNext}
      isMobileViewport={isMobileViewport}
      isRefinementUploadStep={isRefinementUploadStep}
      leadCapturedForUI={effectiveLeadCompleteForPreviewFlow}
      leadGateLocksQuestionArea={leadGateLocksQuestionArea}
      adventureInputMode={adventureInputMode}
      setAdventureInputMode={setAdventureInputMode}
      onApplyIdeaSuggestion={onApplyIdeaSuggestion}
      budgetSliderConfig={budgetSliderConfig}
      budgetValue={budgetValue}
      onBudgetChange={handleBudgetChange}
      promptDraft={promptDraft}
      setPromptDraft={setPromptDraft}
      handlePromptSubmit={onPromptSubmit}
      onRegeneratePreview={onRegeneratePreview}
      previewEnabled={previewEnabled}
      previewHasImage={previewHasImage}
      previewSurfaceMode={previewSurfaceMode}
      questionContentRef={questionContentRef}
      questionScale={questionScale}
      questionViewportRef={questionViewportRef}
      refinementUploadInputRef={refinementUploadInputRef}
      refinementUploading={refinementUploading}
      reflectionFeedbackSent={reflectionFeedbackSent}
      sessionId={sessionId}
      setRefinementUploading={setRefinementUploading}
      showStepTransitionSkeleton={showStepTransitionSkeleton}
      showAccuratePricingLoader={showAccuratePricingLoader}
      showEasePrompt={showEasePrompt}
      showQuestionPaneUnderPreview={showQuestionPaneUnderPreview}
      state={state}
      stepForRenderer={stepForRenderer}
      theme={theme}
      layoutDebugEnabled={layoutDebugEnabled}
      usePreviewDominantLayout={previewLayoutActive}
      scrollStackWithPreview={mobileGenerationScrollStack}
      onProjectPhotoSelected={onProjectPhotoSelected}
    />
  );

  return (
    <main
      className={cn(
        "relative flex flex-1 items-stretch justify-center pb-0 pt-1.5 sm:px-3 sm:pb-3 sm:pt-3",
        "min-h-0 overflow-hidden sm:min-h-0",
        "max-sm:flex-none max-sm:min-h-0 max-sm:overflow-visible max-sm:px-0 max-sm:pt-0"
      )}
    >
      <div
        className={cn(
          "mx-auto w-full max-w-[88rem]",
          "h-full min-h-0 overflow-hidden sm:h-full",
          "max-sm:h-auto max-sm:min-h-0 max-sm:overflow-visible"
        )}
      >
        <motion.div
          ref={previewColumnRef}
          layout={false}
          className={cn(
            "relative flex min-h-0 flex-col overflow-hidden sm:h-full sm:max-h-full",
            "max-sm:overflow-visible",
            showPreviewSection && isMobileViewport ? "max-sm:min-h-[min(65dvh,560px)]" : "max-sm:min-h-0",
            previewLayoutActive ? (isMobileViewport ? "gap-0" : "gap-1.5") : usePreviewDominantLayout ? "gap-2" : previewRailOpen ? "gap-2" : "gap-0"
          )}
        >
          {starterStudioActive ? (
            <div className="flex h-full min-h-0 items-start justify-center overflow-y-auto px-2 pb-6 pt-2 sm:px-3 sm:pb-0 sm:pt-1 md:overflow-hidden">
              <div
                className="mx-auto grid w-full max-w-[88rem] items-stretch overflow-hidden rounded-[1.35rem] border border-black/10 bg-[var(--form-surface-color)] shadow-[0_16px_44px_rgba(15,23,42,0.08)] md:h-full md:min-h-0 md:max-h-full md:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]"
                style={{ ["--primary" as any]: "0 0% 6%", ["--primary-foreground" as any]: "0 0% 100%", ["--ring" as any]: "0 0% 6%" }}
              >
                <section className="min-h-[22rem] min-w-0 md:min-h-0">
                  <motion.figure
                    layoutId={starterConcept?.isProjectPhoto ? undefined : `starting-idea-${starterConcept?.value}`}
                    initial={reduceMotion ? { opacity: 0 } : { opacity: 0.94, scale: 0.985 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={reduceMotion ? { duration: 0.12 } : { duration: 0.34, ease: [0.16, 1, 0.3, 1] }}
                    className="group relative h-full overflow-hidden bg-black/[0.03]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={starterConcept?.imageUrl}
                      alt={starterConcept?.label || "Selected starter concept"}
                      className="h-full min-h-[22rem] w-full object-cover md:min-h-0"
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 via-black/18 to-transparent" />
                    <button
                      type="button"
                      onClick={onBackToStartingIdeas}
                      className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-black/35 px-3 py-2 text-xs font-semibold text-white shadow-sm backdrop-blur-md transition hover:bg-black/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-4 sm:top-4"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" /> Back to ideas
                    </button>
                    <figcaption className="absolute inset-x-0 bottom-0 p-4 text-left text-white sm:p-6">
                      <h2 className="text-[20px] font-semibold tracking-[-0.02em] sm:text-[23px]">{starterConcept?.label}</h2>
                      <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white/72">
                        {starterConcept?.isProjectPhoto ? "Your space" : "Starter concept"}
                      </p>
                    </figcaption>
                  </motion.figure>
                </section>
                <motion.aside
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 22 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: reduceMotion ? 0.12 : 0.3, delay: reduceMotion ? 0 : 0.08, ease: "easeOut" }}
                  className="flex min-h-[26rem] min-w-0 flex-col overflow-hidden border-t border-black/10 bg-[var(--form-surface-color)] p-4 sm:p-5 md:min-h-0 md:border-l md:border-t-0"
                >
                  {!starterConcept?.isProjectPhoto ? (
                    <div className="mb-4 shrink-0 px-1">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground">
                        {showDiscoveryPriceReveal ? "Get estimate" : "Starter idea selected"}
                      </div>
                      <div className="mt-3 border-t border-foreground/70" />
                    </div>
                  ) : null}
                  {starterConcept?.isProjectPhoto ? (
                    <div className="mb-2 flex shrink-0 items-center justify-between gap-3 rounded-xl bg-black/[0.025] px-3 py-2 text-xs font-semibold text-foreground/60">
                      <span className="flex items-center gap-2"><Camera className="h-3.5 w-3.5" /> Using your photo</span>
                      <button type="button" onClick={() => projectPhotoInputRef.current?.click()} className="text-primary hover:underline">Replace</button>
                    </div>
                  ) : null}
                  <div className="min-h-0 flex-1 overflow-visible md:overflow-y-auto md:overscroll-contain">
                    {showDiscoveryPriceReveal ? (
                      <DiscoveryPriceReveal
                        config={config}
                        instanceId={instanceId}
                        sessionId={sessionId}
                        leadCaptured={effectiveLeadCompleteForPreviewFlow}
                        priceRange={starterConcept?.priceRange}
                        priceTier={starterConcept?.priceTier}
                        pricingKey={String(starterConcept?.value || starterConcept?.imageUrl || "starter-concept")}
                        pricingIndex={starterConcept?.pricingIndex}
                        onCustomize={() => setDiscoveryCustomizeOpened(true)}
                        onBrowse={onBackToStartingIdeas}
                      />
                    ) : (
                      <div className="mx-auto flex h-full min-h-0 w-full max-w-[470px] flex-col px-1 pb-3 pt-1 text-left">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h2 className="text-[25px] font-semibold leading-[1.1] tracking-[-0.03em] text-foreground">What would you change?</h2>
                            <p className="mt-1.5 text-[11px] leading-relaxed text-foreground/50">Make a few changes. We’ll update the design and its preliminary pricing together.</p>
                          </div>
                          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.025] px-2.5 py-1.5 text-[9px] font-semibold text-foreground/55">
                            <LockKeyhole className="h-3 w-3" /> Price range updating
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {["Use warmer materials", "Improve the lighting", "Make it more modern", "Simplify the details"].map((suggestion) => (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => {
                                setPromptDraft(suggestion);
                                onPromptSubmit();
                                setDiscoveryCustomizeOpened(true);
                              }}
                              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-black/10 bg-black/[0.025] px-3 text-[11px] font-medium text-foreground/70 transition hover:border-primary/35 hover:bg-primary/[0.06] hover:text-foreground"
                            >
                              <Sparkles className="h-3 w-3 text-primary" /> {suggestion}
                            </button>
                          ))}
                        </div>

                        <div className="mt-4 rounded-xl border border-black/10 bg-white p-2 shadow-sm">
                          <textarea
                            value={promptDraft}
                            onChange={(event) => setPromptDraft(event.target.value)}
                            placeholder="Use gray tile, add a larger mirror, and make it feel warmer…"
                            className="min-h-[76px] w-full resize-none border-0 bg-transparent px-2 py-1 text-[12px] leading-relaxed text-foreground outline-none placeholder:text-foreground/35"
                          />
                          <div className="flex items-center justify-between gap-2 border-t border-black/[0.07] pt-2">
                            <button
                              type="button"
                              onClick={() => projectPhotoInputRef.current?.click()}
                              className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-[10px] font-semibold text-foreground/55 transition hover:bg-black/[0.04] hover:text-foreground"
                            >
                              <Camera className="h-3.5 w-3.5" /> Add project photo
                            </button>
                            <button
                              type="button"
                              disabled={!promptDraft.trim()}
                              onClick={() => {
                                onPromptSubmit();
                                setDiscoveryCustomizeOpened(true);
                              }}
                              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-4 text-[10px] font-semibold text-primary-foreground transition hover:brightness-95 disabled:opacity-40"
                            >
                              Update design <Sparkles className="h-3 w-3" />
                            </button>
                          </div>
                        </div>

                        {budgetSliderConfig ? (
                          <label className="mt-3 block rounded-xl bg-black/[0.025] px-3 py-2.5">
                            <span className="flex items-center justify-between text-[10px] font-semibold text-foreground/60">
                              Budget direction <span>{typeof budgetValue === "number" ? formatCurrency(budgetValue, { currency: budgetSliderConfig.currency || "USD" }) : "Flexible"}</span>
                            </span>
                            <input
                              type="range"
                              min={budgetSliderConfig.min}
                              max={budgetSliderConfig.max}
                              step={budgetSliderConfig.step}
                              value={typeof budgetValue === "number" ? budgetValue : budgetSliderConfig.min}
                              onChange={(event) => handleBudgetChange(Number(event.target.value))}
                              className="mt-2 w-full accent-[var(--primary)]"
                            />
                          </label>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => setDiscoveryPricingRequested(true)}
                          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full border border-primary/25 bg-primary/[0.07] px-4 text-[11px] font-semibold text-foreground/70 transition hover:bg-primary/[0.12] hover:text-foreground"
                        >
                          See my pricing
                        </button>

                        {onProjectPhotoSelected ? (
                          <input
                            ref={projectPhotoInputRef}
                            type="file"
                            accept="image/*"
                            className="sr-only"
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0];
                              void handleProjectPhoto(file);
                              event.currentTarget.value = "";
                            }}
                          />
                        ) : null}
                      </div>
                    )}
                  </div>
                  {starterConcept?.isProjectPhoto && onProjectPhotoSelected ? (
                    <div className="sr-only">
                      <input
                        ref={projectPhotoInputRef}
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          void handleProjectPhoto(file);
                          event.currentTarget.value = "";
                        }}
                      />
                      <button
                        type="button"
                        disabled={projectPhotoUploading}
                        onClick={() => projectPhotoInputRef.current?.click()}
                        className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-foreground/65 transition hover:bg-foreground/[0.04] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {projectPhotoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                        {projectPhotoUploading ? "Adding your photo…" : "Want to see this in your space? Add a photo"}
                      </button>
                      {projectPhotoError ? <p className="mt-1 text-xs font-medium text-red-600" role="alert">{projectPhotoError}</p> : null}
                    </div>
                  ) : null}
                </motion.aside>
              </div>
            </div>
          ) : mobileGenerationScrollStack ? (
            <div
              className={cn(
                "flex min-h-0 flex-1 flex-col overflow-x-hidden overscroll-contain [touch-action:pan-y]",
                mobileGalleryStackSplit
                  ? "overflow-y-visible"
                  : "overflow-y-auto"
              )}
              style={{ WebkitOverflowScrolling: "touch" }}
            >
              {showPreviewSection ? (
                <div ref={previewViewportRef} className="flex shrink-0 flex-col">
                  {previewSectionEl}
                </div>
              ) : null}
              {!hideQuestionPane ? (
                <div
                  className={cn(
                    "flex w-full flex-col border-t border-[color:var(--form-surface-border-color)] bg-[var(--form-surface-color)]",
                    mobileGalleryStackSplit ? "min-h-0 min-w-0 flex-1 shrink overflow-y-auto overflow-x-hidden overscroll-contain" : "shrink-0",
                    pricedGridStepActive
                      ? "flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain"
                      : compactQuestionHost
                        ? isMobileViewport
                          ? cn(
                              "flex flex-col pb-[max(env(safe-area-inset-bottom),8px)]",
                              compactQuestionHostClassNames({
                                isMobileViewport,
                                compactLargeQuestionHost,
                                compactSingleHeroLayout,
                                adventureInputMode,
                              })
                            )
                          : cn(
                              "flex flex-col pb-0.5 sm:pb-1",
                              compactQuestionHostClassNames({
                                isMobileViewport,
                                compactLargeQuestionHost,
                                compactSingleHeroLayout,
                                adventureInputMode,
                              })
                            )
                        : "flex flex-col min-h-0"
                  )}
                  style={
                    pricedGridStepActive || mobileGalleryStackSplit
                      ? ({ WebkitOverflowScrolling: "touch", touchAction: "pan-y" } as React.CSSProperties)
                      : undefined
                  }
                >
                  {formQuestionSectionEl}
                </div>
              ) : null}
            </div>
          ) : (
            <>
              {showPreviewSection ? (
                <div
                  ref={previewViewportRef}
                  className={cn(
                    ((!flowCompleted && styleStepActive) || (pricedGridStepActive && showQuestionPaneUnderPreview))
                      ? "pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0"
                      : leadPricingPresentationActive
                        ? "flex min-h-0 flex-col overflow-hidden"
                        : studioEstimateMode
                          ? "flex min-h-0 flex-col overflow-hidden"
                        : isMobileViewport && previewSurfaceMode === "gallery"
                          ? "flex min-h-0 flex-col overflow-y-visible overflow-x-hidden"
                          : "flex min-h-0 flex-col overflow-y-auto overflow-x-hidden overscroll-contain",
                    previewLayoutActive ? "flex-1 min-h-0" : "shrink-0"
                  )}
                >
                  {previewSectionEl}
                </div>
              ) : null}
              {!hideQuestionPane ? (
                <div
                  className={cn(
                    pricedGridStepActive
                      ? "flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-contain"
                      : compactQuestionHost
                        ? isMobileViewport
                          ? cn(
                              "flex min-h-0 shrink-0 flex-col pb-[max(env(safe-area-inset-bottom),8px)]",
                              compactQuestionHostClassNames({
                                isMobileViewport,
                                compactLargeQuestionHost,
                                compactSingleHeroLayout,
                                adventureInputMode,
                              })
                            )
                          : cn(
                              "flex min-h-0 shrink-0 flex-col pb-0.5 sm:pb-1",
                              compactQuestionHostClassNames({
                                isMobileViewport,
                                compactLargeQuestionHost,
                                compactSingleHeroLayout,
                                adventureInputMode,
                              })
                            )
                        : "flex flex-col flex-1 min-h-0"
                  )}
                  style={pricedGridStepActive ? ({ WebkitOverflowScrolling: "touch", touchAction: "pan-y" } as React.CSSProperties) : undefined}
                >
                  {formQuestionSectionEl}
                </div>
              ) : null}
            </>
          )}
        </motion.div>
      </div>
    </main>
  );
}

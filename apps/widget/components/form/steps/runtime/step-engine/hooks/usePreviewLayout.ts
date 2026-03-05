import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const DOMINANT_PREVIEW_SHARE = 0.8;

interface UsePreviewLayoutParams {
  previewEnabled: boolean;
  showBrandingHeader: boolean;
  currentStepId?: string | null;
}

export function usePreviewLayout({
  previewEnabled,
  showBrandingHeader,
  currentStepId,
}: UsePreviewLayoutParams) {
  const [previewMaxPx, setPreviewMaxPx] = useState<number | null>(null);
  const [questionScale, setQuestionScale] = useState(1);
  const lockedPreviewMaxPxRef = useRef<number | null>(null);
  const hasPreview = previewEnabled;
  const previewRailOpen = previewEnabled;

  const previewColumnRef = useRef<HTMLDivElement>(null);
  const previewViewportRef = useRef<HTMLDivElement>(null);
  const questionViewportRef = useRef<HTMLDivElement>(null);
  const questionContentRef = useRef<HTMLDivElement>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const isDesktopViewport = !isMobileViewport;

  useLayoutEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobileViewport(Boolean(mq.matches));
    update();
    try {
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    } catch {
      // @ts-ignore Safari < 14
      mq.addListener?.(update);
      // @ts-ignore Safari < 14
      return () => mq.removeListener?.(update);
    }
  }, []);

  const isAdventureSurface = showBrandingHeader;
  const usePreviewDominantLayout = previewEnabled && isMobileViewport;
  const useDesktopPreviewLayout = previewEnabled && isDesktopViewport;
  const useMobilePreviewLayout = previewEnabled && isMobileViewport;

  const computePreviewMaxPx = useCallback(() => {
    if (!previewEnabled) {
      setPreviewMaxPx(null);
      setQuestionScale(1);
      lockedPreviewMaxPxRef.current = null;
      return;
    }

    if (usePreviewDominantLayout || useDesktopPreviewLayout) {
      const columnEl = previewColumnRef.current;
      const previewViewportEl = previewViewportRef.current;
      if (!columnEl) return;
      const columnHeight = columnEl.clientHeight;
      const previewViewportHeight = previewViewportEl?.clientHeight ?? 0;
      const measuredPreviewHeight =
        previewViewportHeight > 0 ? previewViewportHeight : Math.max(0, Math.floor(columnHeight * DOMINANT_PREVIEW_SHARE));
      if (measuredPreviewHeight <= 0) return;

      const safetyPx = 12;
      const nextPreviewMaxPx = Math.max(0, Math.floor(measuredPreviewHeight - safetyPx));
      lockedPreviewMaxPxRef.current = null;
      setPreviewMaxPx((prev) => {
        if (prev === null) return nextPreviewMaxPx;
        return Math.abs(prev - nextPreviewMaxPx) < 8 ? prev : nextPreviewMaxPx;
      });
      setQuestionScale(1);
      return;
    }

    const columnEl = previewColumnRef.current;
    const contentEl = questionContentRef.current;
    if (!columnEl) return;

    const columnHeight = columnEl.clientHeight;
    if (columnHeight <= 0) return;
    if (!contentEl) {
      const fallbackPreview = Math.max(0, Math.floor(columnHeight * 0.65) - 24);
      setPreviewMaxPx((prev) => (prev === null ? fallbackPreview : Math.abs(prev - fallbackPreview) < 12 ? prev : fallbackPreview));
      return;
    }

    const contentHeight = Math.max(contentEl.scrollHeight, contentEl.clientHeight);
    const gapPx = 8;
    const safetyPx = 20;
    const totalAvailable = Math.max(0, Math.floor(columnHeight - gapPx - safetyPx));

    if (contentHeight <= 0) {
      lockedPreviewMaxPxRef.current = null;
      const fallbackPreview = Math.min(totalAvailable, 520);
      setPreviewMaxPx((prev) => {
        if (prev === null) return fallbackPreview;
        return Math.abs(prev - fallbackPreview) < 12 ? prev : fallbackPreview;
      });
      setQuestionScale(1);
      return;
    }

    const locked = lockedPreviewMaxPxRef.current;
    const nextPreviewMaxRaw = typeof locked === "number" ? locked : Math.max(0, Math.floor(totalAvailable - contentHeight));
    const nextPreviewMax = Math.min(totalAvailable, Math.max(0, nextPreviewMaxRaw));
    const roundedPreview = Math.round(nextPreviewMax);

    if (lockedPreviewMaxPxRef.current === null && roundedPreview > 0) {
      lockedPreviewMaxPxRef.current = roundedPreview;
    }

    setPreviewMaxPx((prev) => {
      if (prev === null) return roundedPreview;
      return Math.abs(prev - roundedPreview) < 12 ? prev : roundedPreview;
    });
    setQuestionScale(1);
  }, [previewEnabled, useDesktopPreviewLayout, usePreviewDominantLayout]);

  useLayoutEffect(() => {
    computePreviewMaxPx();
  }, [computePreviewMaxPx, currentStepId]);

  useEffect(() => {
    if (!previewEnabled) return;
    if (typeof ResizeObserver === "undefined") return;

    const targets: Element[] = [];
    if (usePreviewDominantLayout || useDesktopPreviewLayout) {
      const columnEl = previewColumnRef.current;
      if (!columnEl) return;
      targets.push(columnEl);
    } else {
      const columnEl = previewColumnRef.current;
      const contentEl = questionContentRef.current;
      if (!columnEl || !contentEl) return;
      targets.push(columnEl, contentEl);
    }

    let raf = 0;
    const schedule = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => computePreviewMaxPx());
    };

    const ro = new ResizeObserver(schedule);
    for (const el of targets) ro.observe(el);
    schedule();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [computePreviewMaxPx, previewEnabled, useDesktopPreviewLayout, usePreviewDominantLayout]);

  return {
    hasPreview,
    isAdventureSurface,
    isDesktopViewport,
    isMobileViewport,
    previewColumnRef,
    previewMaxPx,
    previewRailOpen,
    previewViewportRef,
    questionContentRef,
    questionScale,
    questionViewportRef,
    useMobilePreviewLayout,
    useDesktopPreviewLayout,
    usePreviewDominantLayout,
  };
}

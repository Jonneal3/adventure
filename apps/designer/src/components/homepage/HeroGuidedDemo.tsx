"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Lock, MousePointer2, UserPlus } from "lucide-react";

import { Button } from "@/components/ui/button";

export type IndustryId =
  | "bathroom"
  | "fashion"
  | "furniture"
  | "interior"
  | "landscaping";

type DemoQuestion = {
  id: string;
  label: string;
  options: string[];
};

const INDUSTRIES: {
  id: IndustryId;
  image: string;
  label: string;
  questions: DemoQuestion[];
}[] = [
  {
    id: "furniture",
    image: "/homepage/furniture/after.png",
    label: "Furniture",
    questions: [
      {
        id: "room",
        label: "Which room are they shopping for?",
        options: ["Living room", "Bedroom", "Home office", "Dining room"],
      },
      {
        id: "style",
        label: "What style should it lean toward?",
        options: ["Modern", "Cozy", "Minimal", "Bold"],
      },
      {
        id: "budget",
        label: "What price range feels right?",
        options: ["Value", "Mid-range", "Premium", "Mix"],
      },
    ],
  },
  {
    id: "landscaping",
    image: "/homepage/landscaping/after.png",
    label: "Landscaping",
    questions: [
      {
        id: "area",
        label: "What part of the outdoor space?",
        options: ["Front yard", "Back yard", "Patio", "Whole property"],
      },
      {
        id: "vibe",
        label: "What should it feel like?",
        options: ["Lush", "Low‑maintenance", "Entertaining", "Family friendly"],
      },
      {
        id: "timeline",
        label: "When do they want to start?",
        options: ["ASAP", "1–3 months", "Later", "Exploring"],
      },
    ],
  },
  {
    id: "bathroom",
    image: "/homepage/bathroom/after.png",
    label: "Bathroom",
    questions: [
      {
        id: "scope",
        label: "What kind of remodel?",
        options: ["Refresh", "Full remodel", "New build", "Guest bath"],
      },
      {
        id: "finish",
        label: "What finishes do they like?",
        options: [
          "Warm & natural",
          "Bright & clean",
          "Moody",
          "Patterned tile",
        ],
      },
      {
        id: "layout",
        label: "What’s the priority?",
        options: [
          "Walk‑in shower",
          "More storage",
          "Better lighting",
          "Spa feel",
        ],
      },
    ],
  },
  {
    id: "fashion",
    image: "/homepage/fashion/after.png",
    label: "Fashion",
    questions: [
      {
        id: "occasion",
        label: "What’s the occasion?",
        options: ["Everyday", "Work", "Night out", "Event"],
      },
      {
        id: "palette",
        label: "Color palette?",
        options: ["Neutral", "Monochrome", "Bright", "Earth tones"],
      },
      {
        id: "fit",
        label: "Fit preference?",
        options: ["Relaxed", "Tailored", "Oversized", "Mix"],
      },
    ],
  },
  {
    id: "interior",
    image: "/homepage/interior/after.png",
    label: "Interior",
    questions: [
      {
        id: "space",
        label: "Which space are they updating?",
        options: ["Kitchen", "Living room", "Bedroom", "Entryway"],
      },
      {
        id: "look",
        label: "What vibe should it have?",
        options: ["Bright", "Warm", "Sleek", "Eclectic"],
      },
      {
        id: "constraints",
        label: "Any constraints?",
        options: ["Renting", "Small space", "Budget‑first", "No constraints"],
      },
    ],
  },
];

export const HERO_INDUSTRY_OPTIONS: { id: IndustryId; label: string }[] = [
  { id: "furniture", label: "Furniture" },
  { id: "landscaping", label: "Landscaping" },
  { id: "bathroom", label: "Bathroom" },
  { id: "fashion", label: "Fashion" },
  { id: "interior", label: "Interior" },
];

type DemoState = {
  answers: Record<string, string>;
  hasResult: boolean;
  isGenerating: boolean;
  leadEmail: string;
  leadPhone: string;
  pricingUnlocked: boolean;
  showCaption: boolean;
  showInlineCta: boolean;
  showLeadToast: boolean;
  showPricingGate: boolean;
  stepIndex: number;
};

type CursorState = {
  clickPulse: boolean;
  x: number;
  y: number;
};

function getResetState(): DemoState {
  return {
    answers: {},
    hasResult: false,
    isGenerating: false,
    leadEmail: "",
    leadPhone: "",
    pricingUnlocked: false,
    showCaption: false,
    showInlineCta: false,
    showLeadToast: false,
    showPricingGate: false,
    stepIndex: 0,
  };
}

function isValidEmail(email: string) {
  const trimmed = email.trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function isValidPhone(phone: string) {
  const digits = phone.replace(/[^\d]/g, "");
  return digits.length >= 10;
}

type HeroGuidedDemoProps = {
  industryId?: IndustryId;
  onIndustryChange?: (industryId: IndustryId) => void;
  showIndustrySelector?: boolean;
};

type GuidedHint = {
  id: number;
  message: string;
};

type CoachmarkPlacement = "top" | "bottom" | "left" | "right";

export default function HeroGuidedDemo({
  industryId: controlledIndustryId,
  onIndustryChange,
  showIndustrySelector = true,
}: HeroGuidedDemoProps) {
  const reduceMotion = useReducedMotion();
  const [uncontrolledIndustryId, setUncontrolledIndustryId] =
    useState<IndustryId>(() => "furniture");
  const [mode, setMode] = useState<"guided" | "interactive">(() =>
    reduceMotion ? "interactive" : "guided",
  );
  const guidedHintIdRef = useRef(0);
  const [guidedHint, setGuidedHint] = useState<GuidedHint | null>(null);
  const guidedHintAnchorRef = useRef<HTMLElement | null>(null);
  const guidedHintPreferPlacementRef = useRef<CoachmarkPlacement>("top");
  const [guidedHintPosition, setGuidedHintPosition] = useState<{
    placement: CoachmarkPlacement;
    x: number;
    y: number;
  } | null>(null);
  const industryId = controlledIndustryId ?? uncontrolledIndustryId;
  const activeIndustry = useMemo(() => {
    return INDUSTRIES.find((ind) => ind.id === industryId) ?? INDUSTRIES[0];
  }, [industryId]);

  const containerRef = useRef<HTMLDivElement>(null);
  const questionCardRef = useRef<HTMLDivElement | null>(null);
  const previewAreaRef = useRef<HTMLDivElement | null>(null);
  const firstOptionRef = useRef<HTMLButtonElement | null>(null);
  const nextGenerateRef = useRef<HTMLButtonElement | null>(null);
  const pricingCardRef = useRef<HTMLButtonElement | null>(null);
  const pricingEmailRef = useRef<HTMLInputElement | null>(null);
  const pricingPhoneRef = useRef<HTMLInputElement | null>(null);
  const pricingUnlockRef = useRef<HTMLButtonElement | null>(null);
  const lastIndustryRef = useRef<IndustryId>(industryId);

  const [state, setState] = useState<DemoState>(() => {
    if (reduceMotion) {
      const defaults = Object.fromEntries(
        activeIndustry.questions.map((q) => [q.id, q.options[0]]),
      );
      return {
        answers: defaults,
        hasResult: true,
        isGenerating: false,
        leadEmail: "",
        leadPhone: "",
        pricingUnlocked: false,
        showCaption: true,
        showInlineCta: true,
        showLeadToast: false,
        showPricingGate: false,
        stepIndex: activeIndustry.questions.length,
      };
    }
    return getResetState();
  });

  const [cursor, setCursor] = useState<CursorState>(() => ({
    clickPulse: false,
    x: 36,
    y: 44,
  }));

  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const setSelectedIndustryId = (nextIndustryId: IndustryId) => {
    if (controlledIndustryId !== undefined) {
      onIndustryChange?.(nextIndustryId);
      return;
    }
    setUncontrolledIndustryId(nextIndustryId);
  };

  const seqRef = useRef(0);
  const timeoutsRef = useRef<number[]>([]);
  const guidedHintTimeoutRef = useRef<number | null>(null);

  const clearTimers = () => {
    for (const id of timeoutsRef.current) window.clearTimeout(id);
    timeoutsRef.current = [];
  };

  const trackTimeout = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timeoutsRef.current.push(id);
  };

  const showGuidedHint = (message: string, ms = 3600) => {
    guidedHintIdRef.current += 1;
    setGuidedHint({ id: guidedHintIdRef.current, message });
    if (guidedHintTimeoutRef.current) {
      window.clearTimeout(guidedHintTimeoutRef.current);
    }
    const id = window.setTimeout(() => setGuidedHint(null), ms);
    guidedHintTimeoutRef.current = id;
    timeoutsRef.current.push(id);
  };

  const showGuidedCoachmark = (params: {
    anchorEl?: HTMLElement | null;
    message: string;
    ms?: number;
    preferPlacement?: CoachmarkPlacement;
  }) => {
    if (params.anchorEl) {
      guidedHintAnchorRef.current = params.anchorEl;
    }
    if (params.preferPlacement) {
      guidedHintPreferPlacementRef.current = params.preferPlacement;
    }
    showGuidedHint(params.message, params.ms);
  };

  const calculateCoachmarkPosition = (params: {
    anchorRect: DOMRect;
    containerRect: DOMRect;
    preferPlacement: CoachmarkPlacement;
  }) => {
    const tooltipWidth = 280;
    const tooltipHeight = 56;
    const offset = 12;

    const rect = params.anchorRect;
    const containerRect = params.containerRect;
    const relLeft = rect.left - containerRect.left;
    const relTop = rect.top - containerRect.top;
    const relRight = rect.right - containerRect.left;
    const relBottom = rect.bottom - containerRect.top;
    const relWidth = rect.width;
    const relHeight = rect.height;

    let x = 0;
    let y = 0;
    let placement: CoachmarkPlacement = params.preferPlacement;

    const flipIfOffscreen = (candidate: {
      placement: CoachmarkPlacement;
      x: number;
      y: number;
    }) => {
      const padding = 12;
      const fitsX =
        candidate.x >= padding &&
        candidate.x + tooltipWidth <= containerRect.width - padding;
      const fitsY =
        candidate.y >= padding &&
        candidate.y + tooltipHeight <= containerRect.height - padding;
      return fitsX && fitsY;
    };

    const candidates: Array<CoachmarkPlacement> = [
      params.preferPlacement,
      params.preferPlacement === "top"
        ? "bottom"
        : params.preferPlacement === "bottom"
          ? "top"
          : params.preferPlacement === "left"
            ? "right"
            : "left",
      "top",
      "bottom",
      "left",
      "right",
    ];

    const build = (next: CoachmarkPlacement) => {
      switch (next) {
        case "top":
          return {
            placement: next,
            x: relLeft + relWidth / 2 - tooltipWidth / 2,
            y: relTop - tooltipHeight - offset,
          };
        case "bottom":
          return {
            placement: next,
            x: relLeft + relWidth / 2 - tooltipWidth / 2,
            y: relBottom + offset,
          };
        case "left":
          return {
            placement: next,
            x: relLeft - tooltipWidth - offset,
            y: relTop + relHeight / 2 - tooltipHeight / 2,
          };
        case "right":
          return {
            placement: next,
            x: relRight + offset,
            y: relTop + relHeight / 2 - tooltipHeight / 2,
          };
      }
    };

    let picked = build(candidates[0]);
    for (const candidate of candidates) {
      const test = build(candidate);
      if (flipIfOffscreen(test)) {
        picked = test;
        break;
      }
    }

    placement = picked.placement;
    x = picked.x;
    y = picked.y;

    const padding = 12;
    x = Math.max(
      padding,
      Math.min(x, containerRect.width - tooltipWidth - padding),
    );
    y = Math.max(
      padding,
      Math.min(y, containerRect.height - tooltipHeight - padding),
    );

    return { placement, x, y };
  };

  useEffect(() => {
    if (mode !== "guided" || reduceMotion || !guidedHint) {
      setGuidedHintPosition(null);
      return;
    }

    const recompute = () => {
      const anchor = guidedHintAnchorRef.current ?? containerRef.current;
      const container = containerRef.current;
      if (!anchor || !container) return;
      const rect = anchor.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      setGuidedHintPosition(
        calculateCoachmarkPosition({
          anchorRect: rect,
          containerRect,
          preferPlacement: guidedHintPreferPlacementRef.current,
        }),
      );
    };

    let rafId = 0;
    let tries = 0;
    const maxTries = 12;

    const tryRecompute = () => {
      tries += 1;
      const anchor = guidedHintAnchorRef.current ?? containerRef.current;
      if (anchor) {
        recompute();
        return;
      }
      if (tries >= maxTries) return;
      rafId = window.requestAnimationFrame(tryRecompute);
    };

    tryRecompute();

    window.addEventListener("resize", recompute);
    window.addEventListener("scroll", recompute, true);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener("resize", recompute);
      window.removeEventListener("scroll", recompute, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guidedHint?.id, mode, reduceMotion]);

  const moveCursorTo = (el: HTMLElement | null) => {
    const container = containerRef.current;
    if (!container || !el) return;
    const containerRect = container.getBoundingClientRect();
    const rect = el.getBoundingClientRect();

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const x = ((cx - containerRect.left) / containerRect.width) * 100;
    const y = ((cy - containerRect.top) / containerRect.height) * 100;

    const clamp = (v: number) => Math.min(98, Math.max(2, v));
    setCursor((prev) => ({
      ...prev,
      clickPulse: false,
      x: clamp(x),
      y: clamp(y),
    }));
  };

  const scheduleMoveTo = (getEl: () => HTMLElement | null, startMs: number) => {
    let moved = false;
    const tries = 14;
    const intervalMs = 120;

    for (let i = 0; i < tries; i += 1) {
      schedule(
        () => {
          if (moved) return;
          const el = getEl();
          if (!el || !el.isConnected) return;
          moved = true;
          moveCursorTo(el);
        },
        startMs + i * intervalMs,
      );
    }
  };

  const schedule = (fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      if (modeRef.current !== "guided") return;
      fn();
    }, ms);
    timeoutsRef.current.push(id);
  };

  const totalSteps = activeIndustry.questions.length;

  const startAutoplay = () => {
    seqRef.current += 1;
    const seq = seqRef.current;

    clearTimers();
    setState(getResetState());
    setGuidedHint(null);

    // Timing: intentionally slower so it feels readable.
    const baseDelayMs = 1750;
    const clickDownMs = 160;
    const clickUpMs = 620;
    const moveMs = 650;
    const betweenStepsMs = 1050;
    const pauseOnResultMs = 2600;

    const typeField = (params: {
      field: "leadEmail" | "leadPhone";
      msPerChar: number;
      startMs: number;
      value: string;
    }) => {
      for (let i = 1; i <= params.value.length; i += 1) {
        schedule(
          () => {
            setState((prev) => ({
              ...prev,
              [params.field]: params.value.slice(0, i),
            }));
          },
          params.startMs + i * params.msPerChar,
        );
      }
    };

    showGuidedCoachmark({
      anchorEl: questionCardRef.current ?? containerRef.current,
      message: "Guided questions qualify the lead and personalize the preview.",
      ms: 3200,
      preferPlacement: "top",
    });

    let t = baseDelayMs;

    activeIndustry.questions.forEach((q, idx) => {
      // Click first option (like a visitor would).
      scheduleMoveTo(() => firstOptionRef.current, t);

      schedule(() => {
        if (seqRef.current !== seq) return;
        setCursor((prev) => ({ ...prev, clickPulse: true }));
        showGuidedCoachmark({
          anchorEl: questionCardRef.current ?? firstOptionRef.current,
          message: "Each answer tailors the preview (and your follow‑up).",
          ms: 2600,
          preferPlacement: "top",
        });
        setState((prev) => ({
          ...prev,
          answers: { ...prev.answers, [q.id]: q.options[0] },
        }));
      }, t + clickDownMs);

      schedule(() => {
        if (seqRef.current !== seq) return;
        setCursor((prev) => ({ ...prev, clickPulse: false }));
      }, t + clickUpMs);

      // Click Next to advance (matches interactive flow).
      scheduleMoveTo(() => nextGenerateRef.current, t + clickUpMs + moveMs);

      schedule(
        () => {
          if (seqRef.current !== seq) return;
          setCursor((prev) => ({ ...prev, clickPulse: true }));
          setState((prev) => ({ ...prev, stepIndex: idx + 1 }));
        },
        t + clickUpMs + moveMs + clickDownMs,
      );

      schedule(
        () => {
          if (seqRef.current !== seq) return;
          setCursor((prev) => ({ ...prev, clickPulse: false }));
        },
        t + clickUpMs + moveMs + clickUpMs,
      );

      t += clickUpMs + moveMs + clickUpMs + betweenStepsMs;
    });

    // Generate.
    scheduleMoveTo(() => nextGenerateRef.current, t);

    schedule(() => {
      if (seqRef.current !== seq) return;
      setCursor((prev) => ({ ...prev, clickPulse: true }));
      showGuidedCoachmark({
        anchorEl: nextGenerateRef.current ?? questionCardRef.current,
        message: "Click Generate to show the preview instantly.",
        ms: 2600,
        preferPlacement: "left",
      });
      setState((prev) => ({ ...prev, hasResult: false, isGenerating: true }));
    }, t + clickDownMs);

    schedule(
      () => {
        if (seqRef.current !== seq) return;
        setCursor((prev) => ({ ...prev, clickPulse: false }));
        setState((prev) => ({
          ...prev,
          hasResult: true,
          isGenerating: false,
          showCaption: true,
          showInlineCta: true,
          stepIndex: totalSteps,
        }));

        showGuidedCoachmark({
          anchorEl: previewAreaRef.current ?? containerRef.current,
          message: "Preview updates instantly based on their answers.",
          ms: 2600,
          preferPlacement: "top",
        });
      },
      t + clickUpMs + 980,
    );

    // Click pricing estimate card to open the gate.
    schedule(
      () => {
        if (seqRef.current !== seq) return;
        showGuidedCoachmark({
          anchorEl: pricingCardRef.current ?? previewAreaRef.current,
          message: "Reveal an estimate after opt-in (lead + context).",
          ms: 3200,
          preferPlacement: "left",
        });
      },
      t + clickUpMs + 980 + pauseOnResultMs,
    );
    scheduleMoveTo(
      () => pricingCardRef.current,
      t + clickUpMs + 980 + pauseOnResultMs,
    );

    schedule(
      () => {
        if (seqRef.current !== seq) return;
        setCursor((prev) => ({ ...prev, clickPulse: true }));
        setState((prev) => ({ ...prev, showPricingGate: true }));
      },
      t + clickUpMs + 980 + pauseOnResultMs + 280,
    );

    // Type email, then phone, then unlock.
    const email = "jordan@acme.com";
    const phone = "(555) 555-1212";

    schedule(
      () => {
        if (seqRef.current !== seq) return;
        setCursor((prev) => ({ ...prev, clickPulse: false }));
        setState((prev) => ({ ...prev, leadEmail: "", leadPhone: "" }));
      },
      t + clickUpMs + 980 + pauseOnResultMs + 760,
    );
    scheduleMoveTo(
      () => pricingEmailRef.current,
      t + clickUpMs + 980 + pauseOnResultMs + 780,
    );

    typeField({
      field: "leadEmail",
      msPerChar: 80,
      startMs: t + clickUpMs + 980 + pauseOnResultMs + 820,
      value: email,
    });

    scheduleMoveTo(
      () => pricingPhoneRef.current,
      t + clickUpMs + 980 + pauseOnResultMs + 820 + 65 * email.length + 760,
    );

    typeField({
      field: "leadPhone",
      msPerChar: 70,
      startMs:
        t + clickUpMs + 980 + pauseOnResultMs + 820 + 80 * email.length + 860,
      value: phone,
    });

    const unlockAtMs =
      t +
      clickUpMs +
      980 +
      pauseOnResultMs +
      820 +
      80 * email.length +
      860 +
      70 * phone.length +
      880;

    scheduleMoveTo(() => pricingUnlockRef.current, unlockAtMs - 380);

    schedule(() => {
      if (seqRef.current !== seq) return;
      setCursor((prev) => ({ ...prev, clickPulse: true }));
      setState((prev) => ({
        ...prev,
        pricingUnlocked: true,
        showLeadToast: true,
        showPricingGate: false,
      }));
      showGuidedCoachmark({
        anchorEl: pricingCardRef.current ?? previewAreaRef.current,
        message: "Lead captured with the preview + answers.",
        ms: 2600,
        preferPlacement: "left",
      });
    }, unlockAtMs);

    schedule(
      () => {
        if (seqRef.current !== seq) return;
        setCursor((prev) => ({ ...prev, clickPulse: false }));
        setState((prev) => ({ ...prev, showLeadToast: false }));
      },
      t +
        clickUpMs +
        980 +
        pauseOnResultMs +
        820 +
        65 * email.length +
        860 +
        55 * phone.length +
        4200,
    );

    schedule(
      () => {
        if (seqRef.current !== seq) return;
        startAutoplay();
      },
      t +
        clickUpMs +
        980 +
        pauseOnResultMs +
        820 +
        65 * email.length +
        860 +
        55 * phone.length +
        7200,
    );
  };

  useEffect(() => {
    if (reduceMotion || mode !== "guided") return;
    startAutoplay();
    return () => clearTimers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndustry.id, mode, reduceMotion]);

  useEffect(() => {
    if (mode !== "guided") return;
    clearTimers();
    setState(getResetState());
    startAutoplay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  useEffect(() => {
    if (!reduceMotion || mode !== "interactive") return;
    clearTimers();
    const defaults = Object.fromEntries(
      activeIndustry.questions.map((q) => [q.id, q.options[0]]),
    );
    setState({
      answers: defaults,
      hasResult: true,
      isGenerating: false,
      leadEmail: "",
      leadPhone: "",
      pricingUnlocked: false,
      showCaption: true,
      showInlineCta: true,
      showLeadToast: false,
      showPricingGate: false,
      stepIndex: activeIndustry.questions.length,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndustry.questions, mode, reduceMotion]);

  const takeControl = () => {
    if (mode === "interactive") return;
    setMode("interactive");
    clearTimers();
    setCursor((prev) => ({ ...prev, clickPulse: false }));
    setGuidedHint(null);
    guidedHintAnchorRef.current = null;
    setState((prev) => ({
      ...prev,
      showLeadToast: false,
    }));
  };

  const handleGenerate = async () => {
    clearTimers();
    takeControl();
    setState((prev) => ({
      ...prev,
      hasResult: false,
      isGenerating: true,
      pricingUnlocked: false,
      showCaption: false,
      showInlineCta: false,
      showLeadToast: false,
      showPricingGate: false,
    }));
    trackTimeout(() => {
      setState((prev) => ({
        ...prev,
        hasResult: true,
        isGenerating: false,
        showCaption: true,
        showInlineCta: true,
      }));
    }, 850);
  };

  const handleSelectIndustry = (nextIndustryId: IndustryId) => {
    clearTimers();
    lastIndustryRef.current = nextIndustryId;
    setSelectedIndustryId(nextIndustryId);
    const nextIndustry =
      INDUSTRIES.find((ind) => ind.id === nextIndustryId) ?? INDUSTRIES[0];

    if (modeRef.current === "guided") {
      // Let autoplay restart for the new industry.
      setState(getResetState());
      return;
    }

    const defaults = Object.fromEntries(
      nextIndustry.questions.map((q) => [q.id, q.options[0]]),
    );

    setState({
      answers: defaults,
      hasResult: false,
      isGenerating: false,
      leadEmail: "",
      leadPhone: "",
      pricingUnlocked: false,
      showCaption: false,
      showInlineCta: false,
      showLeadToast: false,
      showPricingGate: false,
      stepIndex: 0,
    });
  };

  useEffect(() => {
    if (lastIndustryRef.current === industryId) return;
    clearTimers();
    lastIndustryRef.current = industryId;

    const nextIndustry =
      INDUSTRIES.find((ind) => ind.id === industryId) ?? INDUSTRIES[0];

    if (modeRef.current === "guided") {
      setState(getResetState());
      return;
    }

    const defaults = Object.fromEntries(
      nextIndustry.questions.map((q) => [q.id, q.options[0]]),
    );
    setState({
      answers: defaults,
      hasResult: false,
      isGenerating: false,
      leadEmail: "",
      leadPhone: "",
      pricingUnlocked: false,
      showCaption: false,
      showInlineCta: false,
      showLeadToast: false,
      showPricingGate: false,
      stepIndex: 0,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [industryId]);

  const handleOpenPricingGate = () => {
    takeControl();
    setState((prev) => ({ ...prev, showPricingGate: !prev.showPricingGate }));
  };

  const handleUnlockPricing = () => {
    setState((prev) => {
      if (!isValidEmail(prev.leadEmail) || !isValidPhone(prev.leadPhone))
        return prev;
      return {
        ...prev,
        pricingUnlocked: true,
        showLeadToast: true,
        showPricingGate: false,
      };
    });

    clearTimers();
    trackTimeout(() => {
      setState((prev) => ({ ...prev, showLeadToast: false }));
    }, 2600);
  };

  const handleAnswer = (questionId: string, value: string) => {
    takeControl();
    setState((prev) => {
      const nextAnswers = { ...prev.answers, [questionId]: value };
      return { ...prev, answers: nextAnswers };
    });
  };

  const activeQuestion = activeIndustry.questions[state.stepIndex] ?? null;
  const allAnswered = activeIndustry.questions.every((q) =>
    Boolean(state.answers[q.id]),
  );

  return (
    <div
      id="hero-demo"
      onPointerDown={takeControl}
      ref={containerRef}
      className="relative flex flex-col h-[520px] sm:h-[580px] lg:h-[600px] rounded-3xl border border-gray-200/70 dark:border-gray-800/70 bg-white/80 dark:bg-black/50 shadow-[0_18px_60px_-30px_rgba(0,0,0,0.28)] backdrop-blur-xl overflow-hidden"
    >
      {mode === "guided" && !reduceMotion && guidedHint && guidedHintPosition && (
        <div className="pointer-events-none absolute inset-0 z-50">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={guidedHint.id}
              className="absolute z-50"
              style={{
                left: guidedHintPosition.x,
                top: guidedHintPosition.y,
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.98, y: 6 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98, y: 6 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-xl bg-gray-900/90 text-white text-[11px] px-3 py-2 backdrop-blur-md border border-white/10 shadow-lg w-[280px]"
              >
                {guidedHint.message}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {mode === "guided" && !reduceMotion && (
        <div className="pointer-events-none absolute inset-0 hidden md:block">
          <motion.div
            className="absolute -translate-x-2 -translate-y-2 z-40"
            animate={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
            transition={{
              damping: 24,
              mass: 0.55,
              stiffness: 260,
              type: "spring",
            }}
          >
            <motion.div
              animate={
                cursor.clickPulse ? { scale: [1, 0.92, 1] } : { scale: 1 }
              }
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              <span className="relative inline-block">
                <MousePointer2
                  className="absolute left-0 top-0 h-6 w-6 text-white drop-shadow-sm"
                  strokeWidth={3}
                />
                <MousePointer2
                  className="h-6 w-6 text-black drop-shadow-sm"
                  strokeWidth={1.75}
                />
              </span>
            </motion.div>
          </motion.div>
        </div>
      )}

      <div className="relative flex flex-col flex-1 min-h-0 px-4 pt-4 pb-4 sm:px-5 sm:pt-5 sm:pb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-gray-300/80 dark:bg-gray-700/80" />
              <span className="h-2 w-2 rounded-full bg-gray-300/60 dark:bg-gray-700/60" />
              <span className="h-2 w-2 rounded-full bg-gray-300/40 dark:bg-gray-700/40" />
            </div>
          </div>

          {!reduceMotion && (
            <div className="flex items-center gap-2 text-[11px]">
              <button
                type="button"
                onClick={() => setMode("guided")}
                aria-pressed={mode === "guided"}
                className={[
                  "px-1.5 py-1 font-medium transition-colors",
                  mode === "guided"
                    ? "text-gray-900 underline underline-offset-4 dark:text-gray-100"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                ].join(" ")}
              >
                Guided
              </button>
              <span
                className="text-gray-300 dark:text-gray-700"
                aria-hidden="true"
              >
                /
              </span>
              <button
                type="button"
                onClick={takeControl}
                aria-pressed={mode === "interactive"}
                className={[
                  "px-1.5 py-1 font-medium transition-colors",
                  mode === "interactive"
                    ? "text-gray-900 underline underline-offset-4 dark:text-gray-100"
                    : "text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                ].join(" ")}
              >
                Interactive
              </button>
            </div>
          )}
        </div>

        {showIndustrySelector && (
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            {INDUSTRIES.map((industry) => {
              const selected = industry.id === industryId;
              return (
                <button
                  key={industry.id}
                  type="button"
                  onClick={() => handleSelectIndustry(industry.id)}
                  className={[
                    "rounded-full border px-2.5 py-0.5 text-[10px] transition-colors",
                    selected
                      ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                      : "border-gray-200 bg-white/70 text-gray-700 hover:bg-white dark:border-gray-800 dark:bg-black/30 dark:text-gray-300 dark:hover:bg-black/40",
                  ].join(" ")}
                >
                  {industry.label}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-3 grid flex-1 min-h-0 gap-3 grid-rows-[auto_1fr]">
          <div
            ref={questionCardRef}
            className="rounded-2xl border border-gray-200/70 dark:border-gray-800/70 bg-white/80 dark:bg-black/40 p-3"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mt-1 text-[13px] font-medium text-gray-900 dark:text-gray-100">
                  {activeQuestion
                    ? activeQuestion.label
                    : "Ready to generate a preview"}
                </div>
                {activeQuestion && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {activeQuestion.options.map((opt, optIndex) => {
                      const selected = state.answers[activeQuestion.id] === opt;
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => handleAnswer(activeQuestion.id, opt)}
                          ref={(el) => {
                            if (!el) return;
                            if (mode !== "guided") return;
                            if (optIndex !== 0) return;
                            firstOptionRef.current = el;
                          }}
                          className={[
                            "rounded-full border px-2.5 py-0.5 text-[10px] transition-colors",
                            selected
                              ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                              : "border-gray-200 bg-white/70 text-gray-700 hover:bg-white dark:border-gray-800 dark:bg-black/30 dark:text-gray-300 dark:hover:bg-black/40",
                          ].join(" ")}
                        >
                          {opt}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2">
                <motion.button
                  type="button"
                  onClick={() => {
                    takeControl();
                    if (activeQuestion) {
                      const nextIndex = Math.min(
                        state.stepIndex + 1,
                        totalSteps,
                      );
                      setState((prev) => ({ ...prev, stepIndex: nextIndex }));
                      return;
                    }
                    handleGenerate();
                  }}
                  ref={(el) => {
                    if (!el) return;
                    nextGenerateRef.current = el;
                  }}
                  className="relative inline-flex items-center justify-center rounded-xl px-3.5 py-1.5 text-[12px] font-medium text-white bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 transition-colors"
                  animate={state.isGenerating ? { scale: 0.99 } : { scale: 1 }}
                  transition={{ duration: 0.2, ease: "easeInOut" }}
                  disabled={
                    activeQuestion
                      ? !state.answers[activeQuestion.id]
                      : !allAnswered
                  }
                >
                  {activeQuestion ? "Next" : "Generate"}
                </motion.button>
              </div>
            </div>
          </div>

          <div
            ref={previewAreaRef}
            className="min-h-0 rounded-2xl border border-gray-200/70 dark:border-gray-800/70 bg-white/60 dark:bg-black/30 overflow-hidden"
          >
            <div className="relative h-full bg-gray-100 dark:bg-gray-900">
              {state.hasResult && (
                <div className="absolute bottom-3 left-3 z-10">
                  <div className="rounded-xl bg-black/55 text-white px-3 py-2 backdrop-blur-md border border-white/10">
                    <div className="text-[11px] font-medium leading-none">
                      Preview
                    </div>
                    <div className="mt-1 text-[10px] text-white/80 leading-snug max-w-[240px]">
                      Demo uses a sample image. Live widget generates in real
                      time.
                    </div>
                  </div>
                </div>
              )}
              <AnimatePresence initial={false}>
                {state.isGenerating && (
                  <motion.div
                    key="generating"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-3 left-3 z-10 rounded-xl bg-black/55 text-white px-3 py-2 backdrop-blur-md border border-white/10 text-[11px]"
                  >
                    Generating…
                  </motion.div>
                )}
              </AnimatePresence>
              <AnimatePresence initial={false} mode="wait">
                {state.hasResult ? (
                  <motion.div
                    key="result"
                    initial={{ opacity: 0, scale: 1.01 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0"
                  >
                    <div className="absolute inset-0">
                      <div className="relative h-full w-full">
                        <Image
                          src={activeIndustry.image}
                          alt="AI preview"
                          fill
                          priority
                          sizes="(max-width: 1024px) 100vw, 720px"
                          className="object-cover"
                        />
                      </div>
                    </div>
                    <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="text-center px-8">
                      <div className="text-[12px] font-medium text-gray-700 dark:text-gray-200">
                        Answer a few questions to generate.
                      </div>
                      <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                        Then unlock the estimate with contact info.
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {state.hasResult && (
                <div className="absolute right-3 bottom-3 sm:right-4 sm:bottom-4 w-[230px]">
                  <div className="relative rounded-2xl border border-white/10 bg-black/55 text-white backdrop-blur-md">
                    {!state.pricingUnlocked ? (
                      <>
                        <button
                          type="button"
                          onClick={handleOpenPricingGate}
                          ref={(el) => {
                            if (!el) return;
                            pricingCardRef.current = el;
                          }}
                          className="w-full text-left px-3 py-2.5 rounded-2xl hover:bg-white/5 transition-colors"
                          aria-label="Unlock pricing by entering your email"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[11px] font-medium">
                              Estimate
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="text-[12px] font-semibold blur-[3px] select-none">
                                $6.5k–$12k
                              </div>
                              <Lock className="h-4 w-4 text-white/80" />
                            </div>
                          </div>
                        </button>

                        <AnimatePresence initial={false}>
                          {state.showPricingGate && (
                            <motion.div
                              key="pricing-gate"
                              initial={{ opacity: 0, scale: 0.99, y: 6 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.99, y: 6 }}
                              transition={{
                                duration: 0.22,
                                ease: [0.22, 1, 0.36, 1],
                              }}
                              className="px-3 pb-3"
                            >
                              <div className="grid gap-1.5">
                                <input
                                  value={state.leadEmail}
                                  onChange={(e) =>
                                    setState((prev) => ({
                                      ...prev,
                                      leadEmail: e.target.value,
                                    }))
                                  }
                                  placeholder="you@company.com"
                                  inputMode="email"
                                  ref={(el) => {
                                    if (!el) return;
                                    pricingEmailRef.current = el;
                                  }}
                                  className="h-8 w-full rounded-xl bg-white/10 border border-white/10 px-3 text-[11px] text-white placeholder:text-white/50 outline-none focus:border-white/25"
                                  aria-label="Email address"
                                />
                                <div className="flex gap-1.5">
                                  <input
                                    value={state.leadPhone}
                                    onChange={(e) =>
                                      setState((prev) => ({
                                        ...prev,
                                        leadPhone: e.target.value,
                                      }))
                                    }
                                    placeholder="(555) 555-1212"
                                    inputMode="tel"
                                    ref={(el) => {
                                      if (!el) return;
                                      pricingPhoneRef.current = el;
                                    }}
                                    className="h-8 min-w-0 flex-1 rounded-xl bg-white/10 border border-white/10 px-3 text-[11px] text-white placeholder:text-white/50 outline-none focus:border-white/25"
                                    aria-label="Phone number"
                                  />
                                  <button
                                    type="button"
                                    onClick={handleUnlockPricing}
                                    disabled={
                                      !isValidEmail(state.leadEmail) ||
                                      !isValidPhone(state.leadPhone)
                                    }
                                    ref={(el) => {
                                      if (!el) return;
                                      pricingUnlockRef.current = el;
                                    }}
                                    className="h-8 rounded-xl bg-white text-gray-900 px-3 text-[11px] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    Unlock
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    ) : (
                      <div className="px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[11px] font-medium">
                            Estimate
                          </div>
                          <div className="text-[12px] font-semibold">
                            $6.5k–$12k
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <AnimatePresence initial={false}>
                {state.showLeadToast && (
                  <motion.div
                    key="lead-toast"
                    initial={{ opacity: 0, scale: 0.98, y: -8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98, y: -8 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute top-3 left-3 sm:top-4 sm:left-4"
                  >
                    <div className="rounded-2xl bg-black/70 text-white px-3.5 py-2.5 backdrop-blur-md border border-white/10 shadow-sm">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                          <UserPlus className="h-4 w-4 text-white/90" />
                        </span>
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium leading-tight">
                            Lead captured
                          </div>
                          <div className="text-[10px] text-white/80 truncate">
                            {state.leadEmail.trim() || "you@company.com"} •
                            saved with preview + answers
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence initial={false}>
                {state.showCaption && (
                  <motion.div
                    key="caption"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute left-3 right-3 bottom-3 sm:left-4 sm:right-4 sm:bottom-4"
                  >
                    <div className="sr-only">Preview ready.</div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence initial={false}>
              {state.showInlineCta && (
                <motion.div
                  key="inline-cta"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="mx-3 mb-3 sm:mx-4 sm:mb-4 rounded-2xl border border-gray-200/60 dark:border-gray-800/60 bg-white/80 dark:bg-black/35 px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3"
                >
                  <div className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
                    Want a full interactive demo for your industry?
                  </div>
                  <Button
                    asChild
                    variant="secondary"
                    className="h-8 px-3 rounded-full self-start sm:self-auto"
                  >
                    <Link href="/playground">
                      Open playground <ArrowRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, Phone } from "lucide-react";
import { useFormTheme } from "@/components/form/demo/FormThemeProvider";
import { useFormSubmission } from "@/hooks/use-form-submission";
import { cn } from "@/lib/utils";

function hexToRgba(hex: string, alpha: number): string | null {
  const h = String(hex || "").replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  if (full.length !== 6) return null;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if (![r, g, b].every((n) => Number.isFinite(n))) return null;
  const a = Math.max(0, Math.min(1, alpha));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function withAlpha(color: string, alpha: number): string {
  const c = String(color || "").trim();
  const a = Math.max(0, Math.min(1, alpha));
  if (!c) return `rgba(15, 23, 42, ${a})`;
  const rgba = c.startsWith("#") ? hexToRgba(c, a) : null;
  if (rgba) return rgba;
  const pct = Math.round(a * 100);
  return `color-mix(in srgb, ${c} ${pct}%, transparent)`;
}

type LeadGenPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  sessionId: string;
  gateContext: string;
  surface?: "default" | "overlay";
  contentStyle?: React.CSSProperties;
  title: string;
  description?: string;
  finePrint?: string;
  ctaLabel?: string;
  phoneTitle?: string;
  phoneDescription?: string;
  phoneLabel?: string;
  requirePhone?: boolean;
  /**
   * When true (default), submitting the email step sends a partial lead immediately.
   * When false, email just advances the UI and the lead is submitted only once (on phone step).
   */
  submitOnEmail?: boolean;
  /**
   * When true, we attempt a best-effort partial lead submission if the user shows exit intent
   * (mouseleave at top), hides the page, or dismisses the popover (escape/click-outside).
   */
  enableExitIntentSubmit?: boolean;
  /** Extra metadata merged into the submission payload. */
  submissionData?: Record<string, any>;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  sideOffset?: number;
  children: React.ReactNode;
  /** Called after the email submit succeeds (before the phone step). */
  onEmailCaptured?: (payload: { email: string; name?: string | null }) => void;
  /** Called after a partial lead submission succeeds (email step when `submitOnEmail` is true). */
  onPartialSubmitted?: (payload: { email: string; name?: string | null }) => void;
  /** Called after a full lead submission succeeds (phone step). */
  onSubmitted?: (payload: { email: string; name?: string | null }) => void;
};

function formStateStorageKey(sessionId: string) {
  return `formState:${sessionId}`;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  return s.length ? s : null;
}

/** Validates real email format: local@domain.tld */
function isValidEmail(value: string): boolean {
  const s = value.trim();
  if (!s || s.length < 5) return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(s);
}

/** Formats phone digits as (XXX) XXX-XXXX */
function formatPhoneMask(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function parsePhoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/** Formats phone input as (XXX) XXX-XXXX. Returns { display, digits } for mask + submission. */
function formatPhoneInput(value: string): { display: string; digits: string } {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return { display: digits ? `(${digits}` : "", digits };
  if (digits.length <= 6) return { display: `(${digits.slice(0, 3)}) ${digits.slice(3)}`, digits };
  return { display: `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`, digits };
}

function emitFormStateUpdated(sessionId: string, patch?: Record<string, any>) {
  if (!sessionId || typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent("sif_form_state_updated", { detail: { sessionId, ...(patch ? { patch } : {}) } }));
  } catch {}
}

function upsertLeadGate(sessionId: string, gateContext: string, patch: { shownAt?: number; completedAt?: number; dismissedAt?: number }) {
  if (!sessionId || typeof window === "undefined") return;
  let leadGates: Record<string, any> | null = null;
  try {
    const key = formStateStorageKey(sessionId);
    const raw = window.localStorage.getItem(key);
    const base = raw ? JSON.parse(raw) : {};
    const next: Record<string, any> = base && typeof base === "object" ? { ...(base as any) } : {};
    const existing = next.leadGates && typeof next.leadGates === "object" ? { ...(next.leadGates as any) } : {};
    const current = existing[gateContext] && typeof existing[gateContext] === "object" ? { ...existing[gateContext] } : {};
    existing[gateContext] = { ...current, ...patch };
    next.leadGates = existing;
    leadGates = next.leadGates;
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {}
  emitFormStateUpdated(sessionId, leadGates ? { leadGates } : undefined);
}

function upsertLeadCaptured(sessionId: string, patch: { leadCaptured: boolean; leadEmail?: string | null; leadCapturedAt?: number | null }) {
  if (!sessionId || typeof window === "undefined") return;
  try {
    const key = formStateStorageKey(sessionId);
    const raw = window.localStorage.getItem(key);
    const base = raw ? JSON.parse(raw) : {};
    const next: Record<string, any> = base && typeof base === "object" ? { ...(base as any) } : {};
    next.leadCaptured = Boolean(patch.leadCaptured);
    if ("leadEmail" in patch) next.leadEmail = patch.leadEmail ?? null;
    if ("leadCapturedAt" in patch) next.leadCapturedAt = patch.leadCapturedAt ?? null;
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {}
  emitFormStateUpdated(sessionId, patch as any);
}

function upsertLeadEmail(sessionId: string, email: string | null) {
  if (!sessionId || typeof window === "undefined") return;
  try {
    const key = formStateStorageKey(sessionId);
    const raw = window.localStorage.getItem(key);
    const base = raw ? JSON.parse(raw) : {};
    const next: Record<string, any> = base && typeof base === "object" ? { ...(base as any) } : {};
    next.leadEmail = email ?? null;
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {}
  emitFormStateUpdated(sessionId, { leadEmail: email ?? null });
}

function upsertLeadPhone(sessionId: string, phone: string | null) {
  if (!sessionId || typeof window === "undefined") return;
  try {
    const key = formStateStorageKey(sessionId);
    const raw = window.localStorage.getItem(key);
    const base = raw ? JSON.parse(raw) : {};
    const next: Record<string, any> = base && typeof base === "object" ? { ...(base as any) } : {};
    next.leadPhone = phone ?? null;
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {}
  emitFormStateUpdated(sessionId, { leadPhone: phone ?? null });
}

function loadPrefill(sessionId: string): { email: string; name: string; phone: string } {
  if (!sessionId || typeof window === "undefined") return { email: "", name: "", phone: "" };
  try {
    const raw = window.localStorage.getItem(formStateStorageKey(sessionId));
    if (!raw) return { email: "", name: "", phone: "" };
    const parsed = JSON.parse(raw);
    const email = normalizeOptionalString((parsed as any)?.leadEmail) ?? "";
    const name = normalizeOptionalString((parsed as any)?.userFullName) ?? "";
    const phone = normalizeOptionalString((parsed as any)?.leadPhone) ?? "";
    return { email, name, phone };
  } catch {
    return { email: "", name: "", phone: "" };
  }
}

export function LeadGenPopover({
  open,
  onOpenChange,
  instanceId,
  sessionId,
  gateContext,
  surface = "default",
  contentStyle,
  title,
  description,
  finePrint,
  ctaLabel = "Send",
  phoneTitle = "Best phone number?",
  phoneDescription = "Optional — we can text updates too.",
  phoneLabel = "Phone number",
  requirePhone = false,
  submitOnEmail = true,
  enableExitIntentSubmit = false,
  submissionData,
  align = "end",
  side = "top",
  sideOffset = 6,
  children,
  onEmailCaptured,
  onPartialSubmitted,
  onSubmitted,
}: LeadGenPopoverProps) {
  const { theme } = useFormTheme();
  const { submitForm, isSubmitting } = useFormSubmission({ instanceId, sessionId });
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<"email" | "phone">("email");
  const [error, setError] = useState<string | null>(null);
  const prefillRef = useRef<{ email: string; name: string; phone: string } | null>(null);
  const emailRef = useRef<string>("");
  const partialSubmittedRef = useRef(false);
  const fullSubmittedRef = useRef(false);
  const silentInFlightRef = useRef(false);
  const beaconSentRef = useRef(false);

  const canSubmit = Boolean(normalizeOptionalString(email) && isValidEmail(email));
  const isOverlay = surface === "overlay";
  const accent = (theme.primaryColor || "#3b82f6").trim();
  const secondary = (theme.secondaryColor || accent).trim();
  const textColor = isOverlay ? "rgba(255,255,255,0.92)" : (theme.textColor || "#0f172a");
  const popBg = isOverlay ? "var(--sif-lead-gen-overlay-bg, var(--sif-overlay-bg, rgba(15,23,42,0.92)))" : "var(--form-surface-color, rgba(255,255,255,0.97))";
  const popBorder = isOverlay ? "rgba(255,255,255,0.10)" : withAlpha(accent, 0.22);
  const iconMuted = isOverlay ? "rgba(255,255,255,0.65)" : withAlpha(theme.textColor || "#0f172a", 0.55);
  const inputBorder = isOverlay ? "rgba(255,255,255,0.14)" : withAlpha(accent, 0.22);
  const ring = isOverlay ? "rgba(255,255,255,0.22)" : withAlpha(accent, 0.35);
  const popRadiusPx = Math.max(Number(theme.borderRadius ?? 14), 14);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setStep("email");
    const prefill = loadPrefill(sessionId);
    prefillRef.current = prefill;
    setEmail(prefill.email);
    setPhone(prefill.phone ? formatPhoneInput(prefill.phone).display : "");
    emailRef.current = prefill.email;
    partialSubmittedRef.current = false;
    fullSubmittedRef.current = false;
    silentInFlightRef.current = false;
    beaconSentRef.current = false;
    upsertLeadGate(sessionId, gateContext, { shownAt: Date.now() });
  }, [gateContext, open, sessionId]);

  const submitPartialLeadSilently = useCallback(
    async (trigger: string) => {
      if (!enableExitIntentSubmit) return;
      if (isSubmitting) return;
      if (silentInFlightRef.current) return;
      if (fullSubmittedRef.current) return;
      if (submitOnEmail && partialSubmittedRef.current) return;

      const addr =
        normalizeOptionalString(emailRef.current) ?? normalizeOptionalString(email);
      if (!addr || !addr.includes("@")) return;

      const name = prefillRef.current?.name ? prefillRef.current.name : null;
      const p = normalizeOptionalString(phone);

      silentInFlightRef.current = true;
      try {
        const result = await submitForm({
          email: addr,
          name: name || undefined,
          phone: p || undefined,
          isPartial: true,
          submissionData: { gateContext, surface: "popover", trigger, step },
        });
        if (result.success) {
          partialSubmittedRef.current = true;
          upsertLeadEmail(sessionId, addr);
          if (p) upsertLeadPhone(sessionId, p);
        }
      } catch {
        // best-effort
      } finally {
        silentInFlightRef.current = false;
      }
    },
    [email, enableExitIntentSubmit, gateContext, isSubmitting, phone, sessionId, step, submitForm, submitOnEmail]
  );

  const sendBeaconPartial = useCallback(
    (trigger: string) => {
      if (!enableExitIntentSubmit) return false;
      if (fullSubmittedRef.current) return false;
      if (submitOnEmail && partialSubmittedRef.current) return false;
      if (beaconSentRef.current) return false;
      if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") return false;

      const addr =
        normalizeOptionalString(emailRef.current) ?? normalizeOptionalString(email);
      if (!addr || !addr.includes("@")) return false;

      const name = prefillRef.current?.name ? prefillRef.current.name : null;
      const p = normalizeOptionalString(phone);

      try {
        const payload = {
          instanceId,
          email: addr,
          name: name || undefined,
          phone: p || undefined,
          isPartial: true,
          submissionData: { gateContext, surface: "popover", trigger, step },
          sessionId,
        };
        const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
        const ok = navigator.sendBeacon("/api/leads", blob);
        if (ok) {
          beaconSentRef.current = true;
          partialSubmittedRef.current = true;
          upsertLeadEmail(sessionId, addr);
          if (p) upsertLeadPhone(sessionId, p);
        }
        return ok;
      } catch {
        return false;
      }
    },
    [email, enableExitIntentSubmit, gateContext, instanceId, phone, sessionId, step, submitOnEmail]
  );

  const close = useCallback(() => {
    // Best-effort: if user dismisses, capture partial lead.
    void submitPartialLeadSilently("dismiss");
    upsertLeadGate(sessionId, gateContext, { dismissedAt: Date.now() });
    onOpenChange(false);
  }, [gateContext, onOpenChange, sessionId, submitPartialLeadSilently]);

  const handleEmailSubmit = useCallback(async () => {
    setError(null);
    const addr = normalizeOptionalString(email);
    if (!addr) return;
    if (!isValidEmail(addr)) {
      setError("Please enter a valid email address.");
      return;
    }
    emailRef.current = addr;

    const name = prefillRef.current?.name ? prefillRef.current.name : null;
    if (submitOnEmail) {
      const result = await submitForm({
        email: addr,
        name: name || undefined,
        isPartial: true,
        submissionData: { gateContext, surface: "popover", step: "email", ...(submissionData || {}) },
      });

      if (!result.success) {
        setError(result.message || "Couldn’t submit. Try again.");
        return;
      }

      partialSubmittedRef.current = true;
      const now = Date.now();
      upsertLeadCaptured(sessionId, { leadCaptured: true, leadEmail: addr, leadCapturedAt: now });
      onEmailCaptured?.({ email: addr, name });
      onPartialSubmitted?.({ email: addr, name });
    } else {
      // Don't submit yet; just persist email so it can be reused and advance to phone.
      upsertLeadEmail(sessionId, addr);
      onEmailCaptured?.({ email: addr, name });
    }
    setStep("phone");
  }, [email, gateContext, onEmailCaptured, onPartialSubmitted, sessionId, submitForm, submitOnEmail]);

  const canSubmitPhone = useMemo(() => {
    const p = normalizeOptionalString(phone);
    if (!requirePhone && !p) return true;
    if (!p) return false;
    const digits = p.replace(/\D/g, "");
    return digits.length >= 10;
  }, [phone, requirePhone]);

  const handlePhoneSubmit = useCallback(async () => {
    setError(null);
    const addr = normalizeOptionalString(emailRef.current) ?? normalizeOptionalString(email);
    if (!addr) {
      setStep("email");
      return;
    }
    const name = prefillRef.current?.name ? prefillRef.current.name : null;
    const p = normalizeOptionalString(phone);
    if (requirePhone && !p) {
      setError("Enter a valid phone number.");
      return;
    }
    if (requirePhone) {
      const digits = (p || "").replace(/\D/g, "");
      if (digits.length < 10) {
        setError("Enter a valid phone number.");
        return;
      }
    }

    const result = await submitForm({
      email: addr,
      name: name || undefined,
      phone: p || undefined,
      isPartial: false,
      submissionData: { gateContext, surface: "popover", step: "phone", ...(submissionData || {}) },
    });

    if (!result.success) {
      setError(result.message || "Couldn’t submit. Try again.");
      return;
    }

    fullSubmittedRef.current = true;
    upsertLeadPhone(sessionId, p ?? null);
    if (!submitOnEmail) {
      // Mark lead captured now (single-submit mode).
      upsertLeadCaptured(sessionId, { leadCaptured: true, leadEmail: addr, leadCapturedAt: Date.now() });
    }
    upsertLeadGate(sessionId, gateContext, { completedAt: Date.now() });
    onSubmitted?.({ email: addr, name });
    onOpenChange(false);
  }, [email, gateContext, onOpenChange, onSubmitted, phone, requirePhone, sessionId, submitForm, submitOnEmail]);

  const handleSkipPhone = useCallback(() => {
    if (requirePhone) return;
    upsertLeadGate(sessionId, gateContext, { completedAt: Date.now() });
    onOpenChange(false);
  }, [gateContext, onOpenChange, requirePhone, sessionId]);

  const content = useMemo(
    () => (
      <div className={cn("space-y-2", isOverlay ? "space-y-1.5" : "")}>
        {step === "email" ? (
          <>
            <div className="space-y-0.5">
              <div
                className={cn("font-semibold leading-snug", isOverlay ? "text-[11.5px]" : "text-[12px]")}
                style={{ color: textColor, fontFamily: theme.fontFamily }}
              >
                {title}
              </div>
              {description ? (
                <div
                  className={cn("opacity-75 leading-snug", isOverlay ? "text-[10.5px]" : "text-[11px]")}
                  style={{ color: textColor, fontFamily: theme.fontFamily }}
                >
                  {description}
                </div>
              ) : null}
            </div>

              {isOverlay ? (
                <div className="relative">
                  <Mail className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: iconMuted }} />
                  <Input
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="h-8 rounded-xl pl-8 pr-[108px] text-[12px] bg-white/10 border-white/10 text-white placeholder:text-white/50 focus-visible:ring-2 focus-visible:ring-offset-0"
                    inputMode="email"
                    style={{
                      borderColor: inputBorder,
                      fontFamily: theme.fontFamily,
                      color: textColor,
                      ["--tw-ring-color" as any]: ring,
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleEmailSubmit();
                      if (e.key === "Escape") close();
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={!canSubmit || isSubmitting}
                    onClick={() => void handleEmailSubmit()}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 rounded-full px-2.5 text-[12px] bg-white/10 text-white hover:bg-white/15 border border-white/10 shadow-sm whitespace-nowrap"
                    style={{ fontFamily: theme.fontFamily }}
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : ctaLabel}
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Mail className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: iconMuted }} />
                    <Input
                      autoFocus
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="h-8 pl-8 text-[12px] bg-white/70 focus-visible:ring-2 focus-visible:ring-offset-0"
                      inputMode="email"
                      style={{
                        borderColor: inputBorder,
                        fontFamily: theme.fontFamily,
                        color: theme.textColor,
                        ["--tw-ring-color" as any]: ring,
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void handleEmailSubmit();
                        if (e.key === "Escape") close();
                      }}
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!canSubmit || isSubmitting}
                    onClick={() => void handleEmailSubmit()}
                    className="h-8 px-3 text-[12px]"
                    style={{ backgroundColor: accent, fontFamily: theme.fontFamily }}
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : ctaLabel}
                  </Button>
                </div>
              )}
	          </>
        ) : (
          <>
            <div className="space-y-0.5">
              <div
                className={cn("font-semibold leading-snug", isOverlay ? "text-[11.5px]" : "text-[12px]")}
                style={{ color: textColor, fontFamily: theme.fontFamily }}
              >
                {phoneTitle}
              </div>
              {phoneDescription ? (
                <div
                  className={cn("opacity-75 leading-snug", isOverlay ? "text-[10.5px]" : "text-[11px]")}
                  style={{ color: textColor, fontFamily: theme.fontFamily }}
                >
                  {phoneDescription}
                </div>
              ) : null}
            </div>

            <div className="relative">
              <Phone className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: iconMuted }} />
              <Input
                autoFocus
                value={phone}
                onChange={(e) => {
                  const { display } = formatPhoneInput(e.target.value);
                  setPhone(display);
                }}
                placeholder="(555) 555-5555"
                className={cn(
                  "h-8 pl-8 text-[12px] focus-visible:ring-2 focus-visible:ring-offset-0",
                  isOverlay
                    ? "rounded-xl pr-[108px] bg-white/10 border-white/10 text-white placeholder:text-white/50"
                    : "pr-[88px] bg-white/70"
                )}
                inputMode="tel"
                aria-label={phoneLabel}
                style={{
                  borderColor: inputBorder,
                  fontFamily: theme.fontFamily,
                  color: textColor,
                  ["--tw-ring-color" as any]: ring,
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handlePhoneSubmit();
                  if (e.key === "Escape") close();
                }}
              />
              <Button
                type="button"
                size="sm"
                disabled={!canSubmitPhone || isSubmitting}
                onClick={() => void handlePhoneSubmit()}
                className={cn(
                  "absolute right-1 top-1/2 -translate-y-1/2 h-7 text-[12px] whitespace-nowrap",
                  isOverlay
                    ? "rounded-full px-2.5 bg-white/10 text-white hover:bg-white/15 border border-white/10 shadow-sm"
                    : "rounded-lg px-3"
                )}
                style={isOverlay ? { fontFamily: theme.fontFamily } : { backgroundColor: accent, fontFamily: theme.fontFamily }}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continue"}
              </Button>
            </div>
            {!requirePhone ? (
              <button
                type="button"
                onClick={handleSkipPhone}
                className="text-[11px] opacity-75 hover:opacity-100 transition-opacity"
                style={{ color: textColor, fontFamily: theme.fontFamily }}
              >
                Skip
              </button>
            ) : null}
          </>
        )}

        {error ? (
          <div className="text-xs text-red-600" style={{ fontFamily: theme.fontFamily }}>
            {error}
          </div>
        ) : null}

        {finePrint ? (
          <div className="text-[10.5px] opacity-60 leading-snug" style={{ color: textColor, fontFamily: theme.fontFamily }}>
            {finePrint}
          </div>
        ) : null}
      </div>
    ),
	    [
      accent,
      canSubmit,
      canSubmitPhone,
      close,
      ctaLabel,
      description,
      email,
      handleEmailSubmit,
      handlePhoneSubmit,
      handleSkipPhone,
      error,
      finePrint,
      isSubmitting,
      phone,
      phoneDescription,
      phoneLabel,
      phoneTitle,
      requirePhone,
      submitOnEmail,
	      step,
	      theme.fontFamily,
	      textColor,
	      title,
	    ]
	  );

  useEffect(() => {
    if (!open) return;
    if (!enableExitIntentSubmit) return;

    const onMouseLeave = (e: MouseEvent) => {
      // Exit intent: mouse leaves through the top edge.
      if (e.clientY <= 0) void submitPartialLeadSilently("exit_intent_mouseleave_top");
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        sendBeaconPartial("visibility_hidden");
      }
    };
    const onPageHide = () => {
      sendBeaconPartial("pagehide");
    };

    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [enableExitIntentSubmit, open, sendBeaconPartial, submitPartialLeadSilently]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) {
          onOpenChange(true);
          return;
        }
        if (open) close();
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
	      <PopoverContent
	        align={align}
	        side={side}
	        sideOffset={sideOffset}
	        collisionPadding={12}
	        sticky="always"
	        className={cn(
            "relative max-w-[92vw] overflow-hidden rounded-2xl border shadow-xl",
            isOverlay ? "w-80 p-2.5 text-white" : "w-72 p-3"
          )}
	        style={{
              ...(contentStyle || {}),
	          backgroundColor: popBg as any,
	          borderColor: popBorder,
	          borderRadius: `${popRadiusPx}px`,
	        }}
	      >
        <PopoverPrimitive.Arrow
          className="stroke-[color:var(--sif-pop-border)] fill-[color:var(--sif-pop-bg)]"
          style={
            {
              ["--sif-pop-bg" as any]: popBg,
              ["--sif-pop-border" as any]: popBorder,
            } as React.CSSProperties
          }
        />

          {!isOverlay ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(110% 80% at 25% 20%, ${withAlpha(accent, 0.18)} 0%, rgba(0,0,0,0) 55%), radial-gradient(110% 80% at 75% 100%, ${withAlpha(secondary, 0.14)} 0%, rgba(0,0,0,0) 55%)`,
              }}
              aria-hidden
            />
          ) : null}
	        <div className="relative">{content}</div>
	      </PopoverContent>
	    </Popover>
	  );
}

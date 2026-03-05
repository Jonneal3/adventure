import React, { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { DesignSettings } from "../../types";
import { useFormSubmission } from "../../hooks/use-form-submission";

interface LeadCaptureModalProps {
  config: DesignSettings;
  onSubmit: (data: { email: string; name?: string; phone?: string; isPartial?: boolean; keepModalOpen?: boolean }) => void;
  onClose: () => void;
  instanceId: string;
  /** Optional override to associate lead capture with an external session (e.g. AI form sessionId). */
  sessionId?: string;
  isIframe?: boolean;
  instanceData?: {
    webhook_url?: string;
    account_id?: string;
    name?: string;
  };
}

// Default timeout values - can be overridden by config
const DEFAULT_AUTO_SAVE_DELAY = 2000; // 2 seconds after user stops typing

// Generate a session ID for tracking submissions within a session
const generateSessionId = () => {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

function upsertAiFormState(sessionId: string, patch: Record<string, any>) {
  if (!sessionId || typeof window === "undefined") return;
  try {
    const key = `formState:${sessionId}`;
    const raw = window.localStorage.getItem(key);
    const base = raw ? JSON.parse(raw) : {};
    const next: Record<string, any> = base && typeof base === "object" && !Array.isArray(base) ? { ...(base as any) } : {};
    for (const [k, v] of Object.entries(patch || {})) {
      next[k] = v;
    }
    window.localStorage.setItem(key, JSON.stringify(next));
    try {
      window.dispatchEvent(new CustomEvent("sif_form_state_updated", { detail: { sessionId, patch } }));
    } catch {}
  } catch {}
}

interface FormData {
  email: string;
  name: string;
  phone: string;
  step: number;
  termsAccepted: boolean;
  lastUpdated: number;
}

export const LeadCaptureModal: React.FC<LeadCaptureModalProps> = ({
  config,
  onSubmit,
  onClose,
  instanceId,
  sessionId: sessionIdOverride,
  isIframe = false,
  instanceData,
}) => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState(1);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLeadAvailable, setIsLeadAvailable] = useState(true);
  const [availabilityChecked, setAvailabilityChecked] = useState(false);

  // Generate session ID for this modal instance
  const sessionId = useRef(sessionIdOverride || generateSessionId()).current;

  // Use the new database-based form submission hook
  const { 
    submitForm, 
    checkStep2Completion, 
    isSubmitting, 
    hasSubmitted, 
    setHasSubmitted 
  } = useFormSubmission({ instanceId, sessionId });

  const STORAGE_KEY = `lead_form_data_${instanceId}`;

  const formDataRef = useRef<FormData>({
    email: "",
    name: "",
    phone: "",
    step: 1,
    termsAccepted: false,
    lastUpdated: Date.now()
  });

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load saved form data on mount and check submission status
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    
    if (savedData) {
      try {
        const parsedData: FormData = JSON.parse(savedData);
        setEmail(parsedData.email || "");
        setName(parsedData.name || "");
        setPhone(parsedData.phone || "");
        setTermsAccepted(parsedData.termsAccepted || false);
        setStep(parsedData.step || 1);
        
        // Update ref
        formDataRef.current = {
          ...parsedData,
          lastUpdated: Date.now()
        };
        // Check if this session has already completed step 2
        checkStep2Completion().then((hasCompletedStep2) => {
          if (hasCompletedStep2) {
            setHasSubmitted(true);
          }
        });
      } catch (error) {
        console.error('Error parsing saved form data:', error);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, [instanceId, checkStep2Completion]);

  // Auto-save form data as user types
  const saveFormData = useCallback((newData: Partial<FormData>) => {
    const updatedData = {
      ...formDataRef.current,
      ...newData,
      lastUpdated: Date.now()
    };
    
    formDataRef.current = updatedData;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
    } catch (error) {
      console.error('❌ Failed to save form data to localStorage:', error);
    }
  }, []);

  // Get configurable timeouts with fallbacks to defaults
  const autoSaveDelay = config.lead_auto_save_delay || DEFAULT_AUTO_SAVE_DELAY;

  // Debounced auto-save
  const debouncedSave = useCallback((newData: Partial<FormData>) => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveFormData(newData);
    }, autoSaveDelay);
  }, [saveFormData, autoSaveDelay]);

  // Handle form field changes with auto-save
  const handleEmailChange = (value: string) => {
    setEmail(value);
    debouncedSave({ email: value });
  };

  const handleNameChange = (value: string) => {
    setName(value);
    debouncedSave({ name: value });
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    debouncedSave({ phone: value });
  };

  const handleTermsChange = (value: boolean) => {
    setTermsAccepted(value);
    debouncedSave({ termsAccepted: value });
  };

  const handleStepChange = (newStep: number) => {
    setStep(newStep);
    debouncedSave({ step: newStep });
  };

  // Page-level exit intent detection (when mouse leaves top of viewport)
  useEffect(() => {
    if (isIframe) return;

    const handleMouseLeave = (e: MouseEvent) => {
      // Detect when mouse leaves the top of viewport (exit intent)
      if (e.clientY <= 0) {
        if (!hasSubmitted && !isSubmitting) {
          // Submit partial data but keep modal open
          submitPartialLeadSilently();
        }
      }
    };

    // Add event listener for page-level exit intent
    document.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [hasSubmitted, isSubmitting]);

  // No visibility change detection - only precise X zone detection
  // Check lead availability (brick form) for immediate mode on fresh session
  useEffect(() => {
    const isImmediate = !!(config.lead_capture_enabled && (config as any).lead_capture_trigger === 'immediate');
    if (!isImmediate || !instanceId) {
      setAvailabilityChecked(true);
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/leads/availability/${instanceId}`);
        if (res.ok) {
          const data = await res.json();
          setIsLeadAvailable(Boolean(data.available));
        }
      } catch {
        // Default to available on error
        setIsLeadAvailable(true);
      } finally {
        setAvailabilityChecked(true);
      }
    })();
  }, [config.lead_capture_enabled, (config as any).lead_capture_trigger, instanceId]);

  // Bill helper (email/phone) for immediate mode
  const billLeadStage = useCallback(async (stage: 'email' | 'phone') => {
    try {
      if (!instanceData?.account_id) return;
      const res = await fetch('/api/leads/bill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          instanceId, 
          accountId: instanceData.account_id, 
          stage, 
          sessionId,
          email: stage === 'email' ? email : undefined,
          phone: stage === 'phone' ? phone : undefined
        })
      });
      // We allow lead even if billing fails; no UI error is required here
      await res.json().catch(() => ({}));
    } catch {
      // Ignore; allow through per spec
      
    }
  }, [instanceData?.account_id, instanceId]);

  // Submit partial lead data silently (keep modal open)
  const submitPartialLeadSilently = useCallback(async () => {
    if (isSubmitting) return;
    
    // Get current form data from ref to ensure we have the latest values
    const currentFormData = formDataRef.current;
    
    
    
    try {
      // Save current form state
      saveFormData({
        email: currentFormData.email,
        name: currentFormData.name,
        phone: currentFormData.phone,
        step: currentFormData.step,
        termsAccepted: currentFormData.termsAccepted
      });

      // Determine if we have any data to submit
      const hasAnyData = currentFormData.email || currentFormData.name || currentFormData.phone;
      
      if (hasAnyData) {
        // Submit to database first
        const submissionResult = await submitForm({
          email: currentFormData.email,
          name: currentFormData.name || undefined,
          phone: currentFormData.phone || undefined,
          isPartial: true,
          submissionData: {
            step: currentFormData.step,
            termsAccepted: currentFormData.termsAccepted,
            sessionId,
            trigger: 'exit_intent_silent'
          }
        });

        if (submissionResult.success) {
          if (currentFormData.email) {
            upsertAiFormState(sessionId, { leadEmail: String(currentFormData.email).trim() || null });
          }
          // Also call the original onSubmit for webhook processing
          await onSubmit({
            email: currentFormData.email,
            name: currentFormData.name || undefined,
            phone: currentFormData.phone || undefined,
            isPartial: true,
            keepModalOpen: true
          });
          
        } else {
          
        }
      } else {
        
      }
      
      // DON'T clean up saved form data - keep it for user to complete
      
    } catch (error) {
      console.error('❌ Error submitting silent partial lead:', error);
    }
  }, [isSubmitting, submitForm, onSubmit, saveFormData, sessionId]);

  // Submit partial lead data (closes modal)
  const submitPartialLead = useCallback(async () => {
    if (isSubmitting) return;
    
    // Get current form data from ref to ensure we have the latest values
    const currentFormData = formDataRef.current;
    
    
    
    try {
      // Save current form state
      saveFormData({
        email: currentFormData.email,
        name: currentFormData.name,
        phone: currentFormData.phone,
        step: currentFormData.step,
        termsAccepted: currentFormData.termsAccepted
      });

      // Determine if we have any data to submit
      const hasAnyData = currentFormData.email || currentFormData.name || currentFormData.phone;
      
      if (hasAnyData) {
        // Submit to database first
        const submissionResult = await submitForm({
          email: currentFormData.email,
          name: currentFormData.name || undefined,
          phone: currentFormData.phone || undefined,
          isPartial: true,
          submissionData: {
            step: currentFormData.step,
            termsAccepted: currentFormData.termsAccepted,
            sessionId,
            trigger: 'partial_submission'
          }
        });

        if (submissionResult.success) {
          if (currentFormData.email) {
            upsertAiFormState(sessionId, { leadEmail: String(currentFormData.email).trim() || null });
          }
          // Also call the original onSubmit for webhook processing
          await onSubmit({
            email: currentFormData.email,
            name: currentFormData.name || undefined,
            phone: currentFormData.phone || undefined,
            isPartial: true
          });
          
        } else {
          
        }
      } else {
        
      }
      
      // Clean up saved form data
      localStorage.removeItem(STORAGE_KEY);
      
    } catch (error) {
      console.error('❌ Error submitting partial lead:', error);
    }
  }, [isSubmitting, submitForm, onSubmit, saveFormData, sessionId]);

  // Handle close button click
  const handleClose = useCallback(async () => {
    if (!isSubmitting) {
      await submitPartialLead();
    } else {
      
    }
    
    onClose();
  }, [isSubmitting, submitPartialLead, onClose, hasSubmitted]);

  // Handle step 1 submission
  const handleStep1Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!termsAccepted) {
      
      return;
    }
    
    if (email) {
      saveFormData({ email, termsAccepted, step: 2 });
      // The AI form engine (StepEngine) + preview surfaces unlock pricing only after an explicit lead capture flag
      // is set in `formState:${sessionId}` (not merely because an email value exists).
      const now = Date.now();
      upsertAiFormState(sessionId, {
        leadCaptured: true,
        leadCapturedAt: now,
        leadEmail: email.trim() || null,
      });
      // Bill email stage only if immediate lead capture is enabled
      if (config.lead_capture_enabled && (config as any).lead_capture_trigger === 'immediate') {
        await billLeadStage('email');
      }
      handleStepChange(2);
      // NOTE: We do NOT set hasSubmitted here - only when they complete step 2
    }
  };

  // Handle step 2 submission
  const handleStep2Submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (name && phone) {
      
      try {
        const now = Date.now();
        // Bill phone stage only if immediate lead capture is enabled
        if (config.lead_capture_enabled && (config as any).lead_capture_trigger === 'immediate') {
          await billLeadStage('phone');
        }
        // Submit to database first
        const submissionResult = await submitForm({
          email,
          name,
          phone,
          isPartial: false,
          submissionData: {
            step,
            termsAccepted,
            sessionId,
            trigger: 'complete_submission'
          }
        });

        if (submissionResult.success) {
          upsertAiFormState(sessionId, {
            leadCaptured: true,
            leadCapturedAt: now,
            leadEmail: email.trim() || null,
          });
          // Also call the original onSubmit for webhook processing
          await onSubmit({ email, name, phone, isPartial: false });
          
          
          // Clean up saved form data
          localStorage.removeItem(STORAGE_KEY);
          
          onClose();
        } else {
          
        }
      } catch (error) {
        console.error('❌ Error submitting complete lead:', error);
      }
    }
  };

  // Removed demo/debug logs

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 LeadCaptureModal unmounting - cleaning up timeouts');
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Use dedicated modal styling attributes with fallbacks to widget theme colors
  // Prefer global theme colors when provided (primary/secondary), then modal-specific overrides
  const primaryColor = config.primary_color || config.submit_button_background_color || config.prompt_background_color || "#3b82f6";
  const secondaryColor = config.secondary_color || config.submit_button_hover_background_color || "#1e40af";
  const modalBackgroundColor = config.lead_modal_background_color || config.prompt_background_color || config.background_color || "#ffffff";
  const modalTextColor = config.lead_modal_text_color || config.prompt_text_color || config.brand_name_color || "#374151";
  const modalBorderRadius = config.lead_modal_border_radius || config.prompt_border_radius || config.border_radius || 12;
  const modalFontFamily = config.lead_modal_font_family || config.overlay_font_family || config.prompt_font_family || 'inherit';
  const modalFontSize = config.lead_modal_font_size || config.overlay_font_size || undefined;
  const borderColor = config.prompt_border_color || "#d1d5db";
  const inputBackgroundColor = config.prompt_input_background_color || "#ffffff";
  const inputTextColor = config.prompt_input_text_color || "#374151";
  const inputFontFamily = modalFontFamily; // enforce modal font for inputs
  const inputFontSize = modalFontSize; // optional, inherit if undefined

  const step1Title = config.lead_step1_title || "Where should we send your AI-generated photos?";
  const step2Title = config.lead_step2_title || "✨ Almost There!";

  const isImmediate = !!(config.lead_capture_enabled && (config as any).lead_capture_trigger === 'immediate');
  const isBricked = isImmediate && availabilityChecked && !isLeadAvailable;

  const toCssSize = (value: string | number | undefined) => {
    if (typeof value === "number" && Number.isFinite(value)) return `${value}px`;
    if (typeof value === "string" && value.trim()) return value.trim();
    return undefined;
  };

  const modalPosition = config.modal_position ?? "center";
  const closeOnBackdrop = !isImmediate && config.modal_close_on_backdrop !== false;
  const closeOnEscape = !isImmediate && config.modal_close_on_escape !== false;
  const showCloseButton = !isImmediate && config.modal_show_close_button !== false;
  const animationType = config.modal_animation_type ?? "none";
  const animationDuration = typeof config.modal_animation_duration === "number" ? config.modal_animation_duration : 200;

  const overlayPositionClasses =
    modalPosition === "top"
      ? "items-start justify-center"
      : modalPosition === "bottom"
        ? "items-end justify-center"
        : modalPosition === "left"
          ? "items-center justify-start"
          : modalPosition === "right"
            ? "items-center justify-end"
            : "items-center justify-center";

  const animationClasses =
    animationType === "none"
      ? ""
      : animationType === "zoom"
        ? "animate-in fade-in-0 zoom-in-95"
        : animationType === "slide-up"
          ? "animate-in fade-in-0 slide-in-from-bottom-4"
          : animationType === "slide-down"
            ? "animate-in fade-in-0 slide-in-from-top-4"
            : "animate-in fade-in-0";

  const modalWidth = toCssSize(config.modal_width);
  const modalHeight = toCssSize(config.modal_height);
  const maxWidthCss =
    typeof config.modal_max_width === "number" && Number.isFinite(config.modal_max_width)
      ? `min(${config.modal_max_width}px, 100%)`
      : undefined;
  const maxHeightCss =
    typeof config.modal_max_height === "number" && Number.isFinite(config.modal_max_height)
      ? `min(${config.modal_max_height}px, 98vh)`
      : "98vh";

  // Escape-to-close (disabled for immediate lead capture)
  useEffect(() => {
    if (!closeOnEscape) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeOnEscape, handleClose]);

  return (
    <div
      className={`fixed inset-0 ${isImmediate ? '' : 'bg-black/50'} flex ${overlayPositionClasses} z-50`}
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        if (closeOnBackdrop) handleClose();
      }}
    >
      <div 
        className={`w-full p-6 mx-4 relative ${animationClasses}`}
        style={{
          backgroundColor: modalBackgroundColor,
          color: modalTextColor,
          borderRadius: `${modalBorderRadius}px`,
          border: config.prompt_border_width ? `${config.prompt_border_width}px ${config.prompt_border_style || 'solid'} ${borderColor}` : 'none',
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
          fontFamily: modalFontFamily,
          fontSize: modalFontSize ? `${modalFontSize}px` : undefined,
          width: modalWidth || undefined,
          height: modalHeight || undefined,
          maxWidth: isImmediate ? '30rem' : (maxWidthCss || undefined),
          maxHeight: maxHeightCss,
          paddingTop: isImmediate ? 28 : undefined,
          paddingBottom: isImmediate ? 28 : undefined,
          animationDuration: `${animationDuration}ms`,
        }}
      >
        {showCloseButton && (
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
            style={{ color: modalTextColor }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
        
        {/* Debug buttons (only in development) */}
        
        
        <h2 className="text-xl font-semibold mb-3 text-center" style={{ 
          color: modalTextColor,
          fontFamily: config.overlay_font_family || config.prompt_font_family || config.brand_name_font_family || 'inherit',
          fontSize: config.overlay_font_size ? `${config.overlay_font_size * 1.2}px` : 'inherit'
        }}>
          {step === 1 ? step1Title : step2Title}
        </h2>
        
        {/* Back button for step 2 */}
        {step === 2 && (
          <button
            type="button"
            onClick={() => handleStepChange(1)}
            className="mb-3 flex items-center text-sm hover:opacity-80 transition-opacity"
            style={{ color: modalTextColor, fontFamily: config.overlay_font_family || config.prompt_font_family || 'inherit' }}
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Go back
          </button>
        )}
        
        {step === 1 ? (
          <form onSubmit={handleStep1Submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" style={{ 
                color: modalTextColor,
                fontFamily: modalFontFamily,
                fontSize: modalFontSize ? `${modalFontSize}px` : 'inherit'
              }}>Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder={config.lead_step1_placeholder || "Enter your email"}
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                required
                disabled={isBricked}
                className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-offset-0 transition-colors"
                style={{
                  backgroundColor: inputBackgroundColor,
                  borderColor: borderColor,
                  color: inputTextColor,
                  fontFamily: inputFontFamily,
                  fontSize: inputFontSize ? `${inputFontSize}px` : undefined,
                  outline: "none",
                  borderRadius: `${config.prompt_input_border_radius || config.prompt_border_radius || 8}px`,
                  borderWidth: `${config.prompt_input_border_width || config.prompt_border_width || 1}px`,
                  borderStyle: config.prompt_input_border_style || config.prompt_border_style || 'solid'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = primaryColor;
                  e.target.style.boxShadow = `0 0 0 3px ${primaryColor}20`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = borderColor;
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
            
            <button
              type="submit"
              disabled={!termsAccepted || isSubmitting || isBricked}
              className="w-full py-3 px-4 rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: (!termsAccepted || isBricked) ? "#9ca3af" : primaryColor,
                color: "#ffffff",
                boxShadow: termsAccepted ? `0 4px 6px -1px ${primaryColor}40` : "none"
              }}
              onMouseEnter={(e) => {
                if (termsAccepted && !isSubmitting && !isBricked) {
                  e.currentTarget.style.backgroundColor = secondaryColor;
                  // Ensure text remains visible with high contrast
                  e.currentTarget.style.color = "#ffffff";
                }
              }}
              onMouseLeave={(e) => {
                if (termsAccepted && !isSubmitting && !isBricked) {
                  e.currentTarget.style.backgroundColor = primaryColor;
                  e.currentTarget.style.color = "#ffffff";
                }
              }}
            >
              {isBricked ? 'Unavailable' : (isSubmitting ? 'Saving...' : 'Send My Photos')}
            </button>
            
            {/* Terms and Conditions with Privacy Reassurance */}
            <div className="flex items-start justify-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => handleTermsChange(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded focus:ring-2 focus:ring-offset-0 transition-colors"
                style={{
                  accentColor: primaryColor,
                  borderColor: borderColor
                }}
                required
              />
              <label htmlFor="terms" className="text-xs" style={{ color: modalTextColor, fontFamily: config.overlay_font_family || config.prompt_font_family || 'inherit', fontSize: config.overlay_font_size ? `${Math.max(10, config.overlay_font_size - 2)}px` : undefined }}>
                I agree to{' '}
                <a 
                  href="/terms" 
                  target="_blank" 
                  className="underline transition-colors"
                  style={{ color: primaryColor }}
                  onMouseEnter={(e) => e.currentTarget.style.color = secondaryColor}
                  onMouseLeave={(e) => e.currentTarget.style.color = primaryColor}
                >
                  terms and conditions
                </a>. We don&apos;t keep your photos on file ever!
              </label>
            </div>
          </form>
        ) : (
          <form onSubmit={handleStep2Submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" style={{ 
                color: modalTextColor,
                fontFamily: modalFontFamily,
                fontSize: modalFontSize ? `${modalFontSize}px` : 'inherit'
              }}>Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder={config.lead_step2_name_placeholder || "What's your name?"}
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                required
                disabled={isBricked}
                className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-offset-0 transition-colors"
                style={{
                  backgroundColor: inputBackgroundColor,
                  borderColor: borderColor,
                  color: inputTextColor,
                  fontFamily: inputFontFamily,
                  fontSize: inputFontSize ? `${inputFontSize}px` : undefined,
                  outline: "none",
                  borderRadius: `${config.prompt_input_border_radius || config.prompt_border_radius || 8}px`,
                  borderWidth: `${config.prompt_input_border_width || config.prompt_border_width || 1}px`,
                  borderStyle: config.prompt_input_border_style || config.prompt_border_style || 'solid'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = primaryColor;
                  e.target.style.boxShadow = `0 0 0 3px ${primaryColor}20`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = borderColor;
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" style={{ 
                color: modalTextColor,
                fontFamily: modalFontFamily,
                fontSize: modalFontSize ? `${modalFontSize}px` : 'inherit'
              }}>Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={config.lead_step2_phone_placeholder || "Enter your phone number"}
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                required
                disabled={isBricked}
                className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-offset-0 transition-colors"
                style={{
                  backgroundColor: inputBackgroundColor,
                  borderColor: borderColor,
                  color: inputTextColor,
                  fontFamily: inputFontFamily,
                  fontSize: inputFontSize ? `${inputFontSize}px` : undefined,
                  outline: "none",
                  borderRadius: `${config.prompt_input_border_radius || config.prompt_border_radius || 8}px`,
                  borderWidth: `${config.prompt_input_border_width || config.prompt_border_width || 1}px`,
                  borderStyle: config.prompt_input_border_style || config.prompt_border_style || 'solid'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = primaryColor;
                  e.target.style.boxShadow = `0 0 0 3px ${primaryColor}20`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = borderColor;
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
            <button
              type="submit"
              disabled={isSubmitting || isBricked}
              className="w-full py-3 px-4 rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: isBricked ? '#9ca3af' : primaryColor,
                color: "#ffffff",
                boxShadow: `0 4px 6px -1px ${primaryColor}40`
              }}
              onMouseEnter={(e) => {
                if (!isBricked) e.currentTarget.style.backgroundColor = secondaryColor;
                // Ensure text remains visible with high contrast
                e.currentTarget.style.color = "#ffffff";
              }}
              onMouseLeave={(e) => {
                if (!isBricked) e.currentTarget.style.backgroundColor = primaryColor;
                e.currentTarget.style.color = "#ffffff";
              }}
            >
              {isBricked ? 'Unavailable' : (isSubmitting ? 'Submitting...' : 'Get My Photos')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}; 

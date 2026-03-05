import React, { useState, useEffect, useRef } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { DesignSettings } from "@mage/types";

interface LeadCaptureModalProps {
  config: DesignSettings;
  onSubmit: (data: { email: string; name?: string; phone?: string; isPartial?: boolean }) => void;
  onClose: () => void;
  instanceId: string;
  isIframe?: boolean;
}

const IDLE_TIMEOUT = 30000; // 30 seconds
const MOUSE_LEAVE_DELAY = 1000; // 1 second delay before considering mouse leave as exit intent

/**
 * Exit Intent Detection Limitations:
 * 1. In iframe context:
 *    - Cannot detect parent window/tab closure
 *    - Cannot detect mouse movements outside iframe boundaries
 *    - beforeunload only works within iframe context
 * 2. In full page context:
 *    - Can detect tab/window closure
 *    - Can detect mouse movements to viewport edges
 *    - Can detect visibility changes
 */
export const LeadCaptureModal: React.FC<LeadCaptureModalProps> = ({
  config,
  onSubmit,
  onClose,
  instanceId,
  isIframe = false,
}) => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [hasSubmittedEmail, setHasSubmittedEmail] = useState(false);
  const [isMouseLeaving, setIsMouseLeaving] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const mouseLeaveTimeoutRef = useRef<NodeJS.Timeout>();
  const idleTimeoutRef = useRef<NodeJS.Timeout>();
  const lastActivityRef = useRef<number>(Date.now());

  // Load saved email if exists
  useEffect(() => {
    const savedEmail = localStorage.getItem(`lead_email_${instanceId}`);
    if (savedEmail) {
      setEmail(savedEmail);
      setHasSubmittedEmail(true);
    }
  }, [instanceId]);

  // Handle activity tracking
  const resetIdleTimer = () => {
    lastActivityRef.current = Date.now();
    if (idleTimeoutRef.current) {
      clearTimeout(idleTimeoutRef.current);
    }
    idleTimeoutRef.current = setTimeout(checkIdle, IDLE_TIMEOUT);
  };

  const checkIdle = () => {
    const now = Date.now();
    const timeSinceLastActivity = now - lastActivityRef.current;
    
    if (timeSinceLastActivity >= IDLE_TIMEOUT && email && !hasSubmittedEmail) {
      submitPartialLead();
    }
  };

  // Handle iframe visibility - only works within iframe context
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && email && !hasSubmittedEmail) {
        submitPartialLead();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [email, hasSubmittedEmail]);

  // Handle mouse movement and exit intent - only works in full page context
  useEffect(() => {
    if (isIframe) return; // Skip mouse tracking in iframe context

    const handleMouseMove = () => {
      resetIdleTimer();
    };

    const handleMouseLeave = (e: MouseEvent) => {
      // Only track mouse leaving the viewport in full page context
      if (e.clientY <= 0 || e.clientX <= 0 || 
          e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setIsMouseLeaving(true);
        if (mouseLeaveTimeoutRef.current) {
          clearTimeout(mouseLeaveTimeoutRef.current);
        }
        mouseLeaveTimeoutRef.current = setTimeout(() => {
          if (email && !hasSubmittedEmail) {
            submitPartialLead();
          }
        }, MOUSE_LEAVE_DELAY);
      }
    };

    const handleMouseEnter = () => {
      setIsMouseLeaving(false);
      if (mouseLeaveTimeoutRef.current) {
        clearTimeout(mouseLeaveTimeoutRef.current);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    // Initial idle timer setup
    resetIdleTimer();

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      if (idleTimeoutRef.current) {
        clearTimeout(idleTimeoutRef.current);
      }
      if (mouseLeaveTimeoutRef.current) {
        clearTimeout(mouseLeaveTimeoutRef.current);
      }
    };
  }, [email, hasSubmittedEmail, isIframe]);

  // Handle page exit - only works within iframe's own context
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (email && !hasSubmittedEmail) {
        submitPartialLead();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [email, hasSubmittedEmail]);

  const submitPartialLead = () => {
    if (email && !hasSubmittedEmail) {
      onSubmit({ email, isPartial: true });
      setHasSubmittedEmail(true);
      localStorage.setItem(`lead_email_${instanceId}`, email);
    }
  };

  const handleStep1Submit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // For step 1, require terms acceptance
    if (step === 1 && !termsAccepted) {
      return;
    }
    
    if (email) {
      // Save email to localStorage
      localStorage.setItem(`lead_email_${instanceId}`, email);
      setHasSubmittedEmail(true);
      setStep(2);
    }
  };

  const handleStep2Submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name && phone) {
      // Submit complete data
      onSubmit({ email, name, phone, isPartial: false });
      // Clear saved email
      localStorage.removeItem(`lead_email_${instanceId}`);
      onClose();
    }
  };

  const modalStyle = {
    backgroundColor: config.lead_modal_background_color || "#ffffff",
    color: config.lead_modal_text_color || "#000000",
    fontFamily: config.lead_modal_font_family || 'inherit',
    fontSize: `${config.lead_modal_font_size || 14}px`,
    borderRadius: `${config.lead_modal_border_radius || 12}px`,
  };

  // Use user's color scheme for better styling
  const primaryColor = config.primary_color || "#3b82f6";
  const secondaryColor = config.secondary_color || "#1e40af";
  const textColor = config.lead_modal_text_color || "#374151";
  const backgroundColor = config.lead_modal_background_color || "#ffffff";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div 
        className="w-full max-w-md p-6 mx-4 relative"
        style={{
          backgroundColor,
          color: textColor,
          borderRadius: `${config.lead_modal_border_radius || 12}px`,
          fontFamily: config.lead_modal_font_family || 'inherit',
          fontSize: `${config.lead_modal_font_size || 14}px`,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
        }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 transition-colors"
          style={{ color: textColor }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <h2 className="text-xl font-semibold mb-3 text-center" style={{ color: textColor }}>
          {step === 1 ? (
            <>
              <span className="text-2xl">📸</span> Where should we send your AI-generated photos? <span className="text-2xl">✨</span>
            </>
          ) : (
            '✨ Almost There!'
          )}
        </h2>
        
        {/* Back button for step 2 */}
        {step === 2 && (
          <button
            type="button"
            onClick={() => setStep(1)}
            className="mb-3 flex items-center text-sm hover:opacity-80 transition-opacity"
            style={{ color: textColor }}
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
              <Label htmlFor="email" style={{ color: textColor }}>Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder={config.lead_step1_placeholder || "Enter your email"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-offset-0 transition-colors"
                style={{
                  backgroundColor: "#ffffff",
                  borderColor: "#d1d5db",
                  color: "#374151",
                  outline: "none"
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = primaryColor;
                  e.target.style.boxShadow = `0 0 0 3px ${primaryColor}20`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#d1d5db";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
            
            <button
              type="submit"
              disabled={!termsAccepted}
              className="w-full py-3 px-4 rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: termsAccepted ? primaryColor : "#9ca3af",
                color: "#ffffff",
                boxShadow: termsAccepted ? `0 4px 6px -1px ${primaryColor}40` : "none"
              }}
              onMouseEnter={(e) => {
                if (termsAccepted) {
                  e.currentTarget.style.backgroundColor = secondaryColor;
                }
              }}
              onMouseLeave={(e) => {
                if (termsAccepted) {
                  e.currentTarget.style.backgroundColor = primaryColor;
                }
              }}
            >
              Send My Photos
            </button>
            
            {/* Terms and Conditions with Privacy Reassurance */}
            <div className="flex items-start justify-center space-x-2 pt-2">
              <input
                type="checkbox"
                id="terms"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded focus:ring-2 focus:ring-offset-0 transition-colors"
                style={{
                  accentColor: primaryColor,
                  borderColor: "#d1d5db"
                }}
                required
              />
              <label htmlFor="terms" className="text-xs" style={{ color: textColor }}>
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
                </a>. We don't keep your photos on file ever!
              </label>
            </div>
          </form>
        ) : (
          <form onSubmit={handleStep2Submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" style={{ color: textColor }}>Full Name</Label>
              <Input
                id="name"
                type="text"
                placeholder={config.lead_step2_name_placeholder || "What's your name?"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-offset-0 transition-colors"
                style={{
                  backgroundColor: "#ffffff",
                  borderColor: "#d1d5db",
                  color: "#374151",
                  outline: "none"
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = primaryColor;
                  e.target.style.boxShadow = `0 0 0 3px ${primaryColor}20`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#d1d5db";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" style={{ color: textColor }}>Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder={config.lead_step2_phone_placeholder || "Enter your phone number"}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-offset-0 transition-colors"
                style={{
                  backgroundColor: "#ffffff",
                  borderColor: "#d1d5db",
                  color: "#374151",
                  outline: "none"
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = primaryColor;
                  e.target.style.boxShadow = `0 0 0 3px ${primaryColor}20`;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "#d1d5db";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 px-4 rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
              style={{
                backgroundColor: primaryColor,
                color: "#ffffff",
                boxShadow: `0 4px 6px -1px ${primaryColor}40`
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = secondaryColor;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = primaryColor;
              }}
            >
              Get My Photos
            </button>
          </form>
        )}
      </div>
    </div>
  );
}; 
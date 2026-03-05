import { useState, useEffect, useCallback, useRef } from 'react';

interface LeadData {
  email: string;
  name: string;
  phone: string;
}

interface PartialSubmission {
  email: string;
  timestamp: number;
  prompt: string;
  step: number;
  webhookSent?: boolean;
}

interface UseLeadCaptureProps {
  instanceId: string;
  isClient: boolean;
  prompt: string;
  onComplete: (leadData: LeadData) => Promise<void>;
  onPartialSubmit?: (partialData: { email: string; prompt: string }) => Promise<void>;
}

export function useLeadCapture({ instanceId, isClient, prompt, onComplete, onPartialSubmit }: UseLeadCaptureProps) {
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadEmail, setLeadEmail] = useState('');
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadStep, setLeadStep] = useState(1);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [partialSubmission, setPartialSubmission] = useState<PartialSubmission | null>(null);
  const [step1CompletedThisSession, setStep1CompletedThisSession] = useState(false);

  // Use refs to break circular dependencies
  const onPartialSubmitRef = useRef(onPartialSubmit);
  const promptRef = useRef(prompt);
  const partialWebhookSentRef = useRef<Set<string>>(new Set()); // Track sent emails to prevent duplicates
  
  // Update refs when props change
  useEffect(() => {
    onPartialSubmitRef.current = onPartialSubmit;
    promptRef.current = prompt;
  }, [onPartialSubmit, prompt]);

  // Load any existing partial submission on mount
  useEffect(() => {
    if (!isClient) return;
    
    const savedSubmission = localStorage.getItem(`partial_submission_${instanceId}`);
    if (savedSubmission) {
      try {
        const parsed = JSON.parse(savedSubmission);
        // Only restore if it's less than 24 hours old
        if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
          setPartialSubmission(parsed);
          setLeadEmail(parsed.email);

          // Mark as already sent if webhook was sent before
          if (parsed.webhookSent) {
            partialWebhookSentRef.current.add(parsed.email);
          }
        } else {
          localStorage.removeItem(`partial_submission_${instanceId}`);
        }
      } catch (e) {}
    }
  }, [isClient, instanceId]);

  // Submit partial lead as webhook - only called on true exit intent
  const submitPartialLeadOnExit = useCallback(async (email: string, currentPrompt: string) => {
    if (!email || hasSubmitted) {
      return;
    }

    // Only send partial webhook if user hasn't completed the full form yet
    if (hasSubmitted) {
      return;
    }

    // Check if we already sent a webhook for this email
    if (partialWebhookSentRef.current.has(email)) {
      return;
    }

    try {
      // Mark as sent BEFORE making the request to prevent race conditions
      partialWebhookSentRef.current.add(email);

      if (onPartialSubmitRef.current) {
        await onPartialSubmitRef.current({
          email: email,
          prompt: currentPrompt
        });

        // Update localStorage to mark webhook as sent
        const savedSubmission = localStorage.getItem(`partial_submission_${instanceId}`);
        if (savedSubmission) {
          try {
            const parsed = JSON.parse(savedSubmission);
            if (parsed.email === email) {
              parsed.webhookSent = true;
              localStorage.setItem(`partial_submission_${instanceId}`, JSON.stringify(parsed));
            }
          } catch (e) {}
        }
      } else {}
    } catch (error) {
      // Remove from sent set so we can try again
      partialWebhookSentRef.current.delete(email);
    }
  }, [hasSubmitted, instanceId]);

  // Save partial submission to localStorage (but don't send webhook)
  const savePartialSubmissionOnly = useCallback((email: string, currentPrompt: string, step: number) => {
    if (email && !hasSubmitted) {
      const partialData = {
        email: email,
        timestamp: Date.now(),
        prompt: currentPrompt,
        step: step,
        webhookSent: partialWebhookSentRef.current.has(email)
      };
      localStorage.setItem(`partial_submission_${instanceId}`, JSON.stringify(partialData));
      setPartialSubmission(partialData);
    }
  }, [hasSubmitted, instanceId]);

  // Handle exit intent detection and communication with parent page
  useEffect(() => {
    if (!isClient) return;

    // Handle exit intent messages from parent page
    const handleMessage = (event: MessageEvent) => {
      // Filter out React DevTools messages to prevent spam
      if (event.data && typeof event.data === 'object') {
        const data = event.data;
        if (data.source && (
          data.source.includes('react-devtools') || 
          data.source.includes('devtools')
        )) {
          return; // Ignore React DevTools messages
        }
      }

      // Verify the message is from our parent and handle exit intent
      if (event.source === window.parent) {
        if (event.data === 'exit-intent-detected') {
          const currentEmail = leadEmail;
          const currentPrompt = promptRef.current;

          // Save to localStorage first
          savePartialSubmissionOnly(currentEmail, currentPrompt, leadStep);

          // Only submit partial webhook if user has email but hasn't completed the full form
          if (currentEmail && !hasSubmitted && step1CompletedThisSession) {
            submitPartialLeadOnExit(currentEmail, currentPrompt);
          }
        } else if (event.data === 'page-exiting' || event.data === 'iframe-closing') {
          // Just save to localStorage, don't send webhook unless it's true exit intent
          const currentEmail = leadEmail;
          const currentPrompt = promptRef.current;
          savePartialSubmissionOnly(currentEmail, currentPrompt, leadStep);
        }
      }
    };

    // Set up exit intent detection for main page (not iframe)
    const setupExitIntentDetection = () => {
      try {
        // Check if we're in the main window (not iframe)
        if (window.self === window.top) {
          let isExitIntentDetected = false;
          let lastMousePosition = { x: 0, y: 0, time: Date.now() };
          const mouseHistory: Array<{x: number, y: number, time: number}> = [];
          let exitIntentTimer: NodeJS.Timeout | null = null;
          let listenersActive = false;

          const config = {
  exitDelay: 100,
  exitVelocity: 15,
  topZone: 40
};

          const trackMouseMovement = (e: MouseEvent) => {
            const currentTime = Date.now();
            const currentPosition = { x: e.clientX, y: e.clientY, time: currentTime };
            
            // Calculate velocity toward top
            const timeDelta = currentTime - lastMousePosition.time;
            const yDelta = lastMousePosition.y - currentPosition.y;
            const velocity = timeDelta > 0 ? yDelta / timeDelta : 0;
            
            // Add to history
            mouseHistory.push(currentPosition);
            if (mouseHistory.length > 10) {
              mouseHistory.shift();
            }
            
            // Check if in top zone
            const isInTopZone = currentPosition.y <= config.topZone;
            
            // Clear existing timer
            if (exitIntentTimer) {
              clearTimeout(exitIntentTimer);
              exitIntentTimer = null;
            }
            
            let shouldTriggerExitIntent = false;
            let triggerReason = '';
            
            // Pattern 1: Rapid upward movement
            if (velocity > config.exitVelocity && isInTopZone && !isExitIntentDetected) {
              shouldTriggerExitIntent = true;
              triggerReason = 'rapid upward movement';
            }
            
            // Pattern 2: Dwelling near top
            if (isInTopZone && currentPosition.y <= 15 && !isExitIntentDetected) {
              exitIntentTimer = setTimeout(() => {
                if (currentPosition.y <= config.topZone && !isExitIntentDetected) {
                  triggerExitIntent('dwelling near browser controls');
                }
              }, config.exitDelay);
            }
            
            if (shouldTriggerExitIntent) {
              triggerExitIntent(triggerReason);
            }
            
            lastMousePosition = currentPosition;
          };

          const handleMouseLeave = (e: MouseEvent) => {
            if (e.clientY <= 5 && !isExitIntentDetected) {
              triggerExitIntent('mouse left viewport from top');
            }
          };

          const triggerExitIntent = (reason: string) => {
            if (isExitIntentDetected) return;

            isExitIntentDetected = true;

            const currentEmail = leadEmail;
            const currentPrompt = promptRef.current;

            savePartialSubmissionOnly(currentEmail, currentPrompt, leadStep);

            // Submit partial webhook
            submitPartialLeadOnExit(currentEmail, currentPrompt);

            // Reset after delay
            setTimeout(() => {
              isExitIntentDetected = false;
            }, 2000);
          };

          // Function to enable exit intent detection
          const enableExitIntent = () => {
            if (listenersActive) return;
            document.addEventListener('mousemove', trackMouseMovement, { passive: true });
            document.addEventListener('mouseleave', handleMouseLeave);
            listenersActive = true;
          };

          // Function to disable exit intent detection
          const disableExitIntent = () => {
            if (!listenersActive) return;
            document.removeEventListener('mousemove', trackMouseMovement);
            document.removeEventListener('mouseleave', handleMouseLeave);
            listenersActive = false;
            if (exitIntentTimer) {
              clearTimeout(exitIntentTimer);
              exitIntentTimer = null;
            }
          };

          // Function to update listeners based on current state
          const updateExitIntentState = () => {
            const currentEmail = leadEmail;
            const isModalOpen = showLeadModal;
            
            // Exit intent should ONLY be active when:
            // 1. User has email (completed step 1)
            // 2. Modal is closed (not currently filling out form)
            // 3. Haven't submitted full form yet
            // 4. Step 1 was completed in THIS session (not just loaded from localStorage)
            
            if (!currentEmail || !step1CompletedThisSession) {
              // No email or step 1 not completed this session - disable everything
              disableExitIntent();
            } else if (isModalOpen) {
              // Modal is open (user filling out form) - disable exit intent
              disableExitIntent();
            } else if (hasSubmitted) {
              // User has completed full submission - disable exit intent
              disableExitIntent();
            } else {
              // Has email, modal closed, not submitted, step 1 completed this session - ENABLE exit intent
              enableExitIntent();
            }
          };

          // Initial state - should be disabled
          updateExitIntentState();

          // Watch for changes in leadEmail and leadStep
          const updateInterval = setInterval(updateExitIntentState, 500);

          // Cleanup function
          return () => {
            disableExitIntent();
            clearInterval(updateInterval);
          };
        } else {
          // In iframe, we'll rely on messages from parent
          return () => {};
        }
      } catch (e) {
        // Simplified fallback - only when conditions are met
        const handleMouseLeave = (e: MouseEvent) => {
          if (e.clientY <= 0 && leadEmail && !hasSubmitted && step1CompletedThisSession) {
            const currentEmail = leadEmail;
            const currentPrompt = promptRef.current;

            savePartialSubmissionOnly(currentEmail, currentPrompt, leadStep);
            submitPartialLeadOnExit(currentEmail, currentPrompt);
          }
        };

        document.addEventListener('mouseleave', handleMouseLeave);
        return () => {
          document.removeEventListener('mouseleave', handleMouseLeave);
        };
      }
    };

    // Set up message listener
    window.addEventListener('message', handleMessage);
    
    // Set up exit intent detection
    const cleanupExitIntent = setupExitIntentDetection();

    // Notify parent that widget is mounted
    try {
      window.parent.postMessage('widget-mounted', '*');
    } catch (e) {}

    return () => {
      // Clean up message listener
      window.removeEventListener('message', handleMessage);
      
      // Clean up exit intent detection
      cleanupExitIntent();
      
      // Just save state on unmount (no webhook)
      const currentEmail = leadEmail;
      const currentPrompt = promptRef.current;
      savePartialSubmissionOnly(currentEmail, currentPrompt, leadStep);
      
      // Notify parent we're unmounting
      try {
        window.parent.postMessage('widget-unmounting', '*');
      } catch (e) {}
    };
  }, [isClient, leadEmail, leadStep, hasSubmitted, showLeadModal, step1CompletedThisSession, savePartialSubmissionOnly, submitPartialLeadOnExit]);

  // Handle modal close - just save to localStorage, no webhook
  const handleModalClose = useCallback(() => {
    const currentEmail = leadEmail;
    const currentPrompt = promptRef.current;
    
    savePartialSubmissionOnly(currentEmail, currentPrompt, leadStep);
    setShowLeadModal(false);
  }, [leadEmail, leadStep, savePartialSubmissionOnly]);

  const handleLeadSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (leadStep === 1) {
      const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value;
      setLeadEmail(email);
      
      // Mark that step 1 was completed in this session
      setStep1CompletedThisSession(true);
      
      // Save partial submission after step 1 (no webhook)
      savePartialSubmissionOnly(email, promptRef.current, 1);
      
      setLeadStep(2);
      return;
    }
    
    // Step 2 - Final submission
    const formData = new FormData(e.currentTarget);
    const leadData = {
      email: leadEmail,
      name: formData.get('name') as string,
      phone: formData.get('phone') as string
    };

    try {
      // Clear partial submission since we have complete data
      localStorage.removeItem(`partial_submission_${instanceId}`);
      setPartialSubmission(null);
      
      // Clear the webhook sent tracking for this email since we're doing a full submission
      partialWebhookSentRef.current.delete(leadEmail);

      // Close modal and reset form state
      setShowLeadModal(false);
      setLeadStep(1);
      setHasSubmitted(true);
      
      // Call the completion handler (full webhook)
      await onComplete(leadData);
      
    } catch (err) {
      // Still proceed with submission even if lead save fails
      setShowLeadModal(false);
      setLeadStep(1);
      setHasSubmitted(true);
    }
  }, [leadStep, leadEmail, instanceId, onComplete, savePartialSubmissionOnly]);

  return {
    showLeadModal,
    setShowLeadModal,
    leadEmail,
    setLeadEmail,
    leadName,
    setLeadName,
    leadPhone,
    setLeadPhone,
    leadStep,
    setLeadStep,
    hasSubmitted,
    handleModalClose,
    handleLeadSubmit
  };
} 
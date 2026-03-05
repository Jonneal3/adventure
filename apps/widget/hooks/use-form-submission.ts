import { useState, useCallback } from 'react';

interface FormSubmissionData {
  email: string;
  name?: string;
  phone?: string;
  isPartial?: boolean;
  submissionData?: Record<string, any>;
}

interface UseFormSubmissionProps {
  instanceId: string;
  sessionId?: string;
}

export function useFormSubmission({ instanceId, sessionId }: UseFormSubmissionProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Check if session has already completed step 2
  const checkStep2Completion = useCallback(async (): Promise<boolean> => {
    if (!sessionId) return false;
    
    try {
      const response = await fetch(`/api/leads?instanceId=${instanceId}&sessionId=${encodeURIComponent(sessionId)}`);
      if (response.ok) {
        const data = await response.json();
        return data.hasCompletedStep2;
      }
    } catch (error) {
      console.error('Error checking step 2 completion:', error);
    }
    return false;
  }, [instanceId, sessionId]);

  // Submit form data
  const submitForm = useCallback(async (data: FormSubmissionData): Promise<{ success: boolean; message: string; submissionId?: string }> => {
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId,
          email: data.email,
          name: data.name,
          phone: data.phone,
          isPartial: data.isPartial || false,
          submissionData: data.submissionData || {},
          sessionId
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setHasSubmitted(true);
        return {
          success: true,
          message: result.message,
          submissionId: result.submissionId
        };
      } else {
        return {
          success: false,
          message: result.message || 'Failed to submit form'
        };
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      return {
        success: false,
        message: 'Network error occurred'
      };
    } finally {
      setIsSubmitting(false);
    }
  }, [instanceId, sessionId]);

  return {
    isSubmitting,
    hasSubmitted,
    submitForm,
    checkStep2Completion,
    setHasSubmitted
  };
} 
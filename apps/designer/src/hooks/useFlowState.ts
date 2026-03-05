"use client";

import { useState, useCallback, useEffect, useRef } from 'react';
import { FlowState, FlowConfig, FlowStep } from '@/types/flow';

interface UseFlowStateProps {
  instanceId: string;
  flowConfig: FlowConfig | null;
  initialAnswers?: Record<string, any>;
}

export function useFlowState({ instanceId, flowConfig, initialAnswers = {} }: UseFlowStateProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>(initialAnswers);
  const [generatedDesigns, setGeneratedDesigns] = useState<FlowState['generatedDesigns']>([]);
  const [completed, setCompleted] = useState(false);
  const [startedAt] = useState(new Date().toISOString());
  const lastUpdatedRef = useRef<string>(new Date().toISOString());

  const steps: FlowStep[] = Array.isArray((flowConfig as any)?.steps) ? ((flowConfig as any).steps as FlowStep[]) : [];

  // Load state from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const savedState = localStorage.getItem(`flow_state_${instanceId}`);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        // Only restore if it's less than 24 hours old
        if (Date.now() - new Date(parsed.startedAt).getTime() < 24 * 60 * 60 * 1000) {
          setCurrentStepIndex(parsed.currentStepIndex || 0);
          setAnswers(parsed.answers || {});
          setGeneratedDesigns(parsed.generatedDesigns || []);
          setCompleted(parsed.completed || false);
        } else {
          localStorage.removeItem(`flow_state_${instanceId}`);
        }
      } catch (e) {
        // Invalid saved state, ignore
      }
    }
  }, [instanceId]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const state = {
      currentStepIndex,
      answers,
      generatedDesigns,
      completed,
      startedAt,
      lastUpdatedAt: lastUpdatedRef.current,
    };
    
    localStorage.setItem(`flow_state_${instanceId}`, JSON.stringify(state));
  }, [instanceId, currentStepIndex, answers, generatedDesigns, completed, startedAt]);

  const updateAnswer = useCallback((questionId: string, value: any) => {
    setAnswers(prev => {
      const updated = { ...prev, [questionId]: value };
      lastUpdatedRef.current = new Date().toISOString();
      return updated;
    });
  }, []);

  const addGeneratedDesign = useCallback((design: FlowState['generatedDesigns'][0]) => {
    setGeneratedDesigns(prev => [...prev, design]);
    lastUpdatedRef.current = new Date().toISOString();
  }, []);

  const nextStep = useCallback(() => {
    if (!flowConfig) return;
    
    const nextIndex = currentStepIndex + 1;
    if (nextIndex < steps.length) {
      setCurrentStepIndex(nextIndex);
      lastUpdatedRef.current = new Date().toISOString();
    } else {
      setCompleted(true);
      lastUpdatedRef.current = new Date().toISOString();
    }
  }, [currentStepIndex, flowConfig, steps.length]);

  const previousStep = useCallback(() => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => {
        const newIndex = prev - 1;
        lastUpdatedRef.current = new Date().toISOString();
        return newIndex;
      });
    }
  }, [currentStepIndex]);

  const goToStep = useCallback((stepIndex: number) => {
    if (!flowConfig) return;
    if (stepIndex >= 0 && stepIndex < steps.length) {
      setCurrentStepIndex(stepIndex);
      lastUpdatedRef.current = new Date().toISOString();
    }
  }, [flowConfig, steps.length]);

  const getCurrentStep = useCallback((): FlowStep | null => {
    if (!flowConfig || currentStepIndex >= steps.length) {
      return null;
    }
    return steps[currentStepIndex] || null;
  }, [flowConfig, currentStepIndex, steps]);

  const reset = useCallback(() => {
    setCurrentStepIndex(0);
    setAnswers({});
    setGeneratedDesigns([]);
    setCompleted(false);
    lastUpdatedRef.current = new Date().toISOString();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(`flow_state_${instanceId}`);
    }
  }, [instanceId]);

  const getProgress = useCallback((): number => {
    if (!flowConfig || steps.length === 0) return 0;
    return ((currentStepIndex + 1) / steps.length) * 100;
  }, [flowConfig, currentStepIndex, steps.length]);

  const canProceed = useCallback((): boolean => {
    const step = getCurrentStep();
    if (!step) return false;
    
    // Check if required questions are answered
    if (step.question) {
      if (step.question.required && !answers[step.question.id]) {
        return false;
      }
    }
    
    if (step.questions) {
      const requiredQuestions = step.questions.filter(q => q.required);
      for (const q of requiredQuestions) {
        if (!answers[q.id]) {
          return false;
        }
      }
    }
    
    return true;
  }, [getCurrentStep, answers]);

  const state: FlowState = {
    currentStepIndex,
    answers,
    generatedDesigns,
    completed,
    startedAt,
    lastUpdatedAt: lastUpdatedRef.current,
  };

  return {
    state,
    currentStep: getCurrentStep(),
    updateAnswer,
    addGeneratedDesign,
    nextStep,
    previousStep,
    goToStep,
    reset,
    getProgress,
    canProceed,
    isFirstStep: currentStepIndex === 0,
    isLastStep: flowConfig ? currentStepIndex === steps.length - 1 : false,
  };
}

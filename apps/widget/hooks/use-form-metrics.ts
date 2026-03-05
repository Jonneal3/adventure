// Metrics collection hook for AI Form

import { useCallback, useRef, useEffect } from 'react';
import { StepMetrics, SessionMetrics } from '@/types/ai-form';

interface UseFormMetricsOptions {
  instanceId: string;
  sessionId: string;
  entrySource?: string;
  sessionGoal?: string;
}

export function useFormMetrics({
  instanceId,
  sessionId,
  entrySource,
  sessionGoal
}: UseFormMetricsOptions) {
  const stepMetricsRef = useRef<StepMetrics[]>([]);
  const flushedIdxRef = useRef<number>(0);
  const currentStepStartTime = useRef<number>(Date.now());
  const currentStepId = useRef<string | null>(null);

  const trackStepStart = useCallback((stepId: string) => {
    currentStepId.current = stepId;
    currentStepStartTime.current = Date.now();
  }, []);

  const trackStepComplete = useCallback((stepId: string, data?: {
    droppedOff?: boolean;
    backNavigation?: boolean;
    designerEngagement?: boolean;
    leadInputCompleted?: boolean;
    componentType?: string;
    confidence?: number;
    metadata?: Record<string, any>;
  }) => {
    if (!currentStepId.current || currentStepId.current !== stepId) {
      return;
    }

    const timeSpent = Date.now() - currentStepStartTime.current;
    
    const metric: StepMetrics = {
      stepId,
      timeSpentMs: timeSpent,
      droppedOff: data?.droppedOff || false,
      backNavigation: data?.backNavigation || false,
      designerEngagement: data?.designerEngagement || false,
      leadInputCompleted: data?.leadInputCompleted || false,
      componentType: data?.componentType,
      confidence: typeof data?.confidence === 'number' ? data.confidence : undefined,
      metadata: data?.metadata,
      timestamp: new Date()
    };

    stepMetricsRef.current.push(metric);
    currentStepId.current = null;
  }, []);

  const trackStepAbandon = useCallback((stepId: string) => {
    if (!currentStepId.current || currentStepId.current !== stepId) {
      return;
    }

    const timeSpent = Date.now() - currentStepStartTime.current;
    
    const metric: StepMetrics = {
      stepId,
      timeSpentMs: timeSpent,
      droppedOff: true,
      backNavigation: false,
      componentType: undefined,
      confidence: undefined,
      metadata: undefined,
      timestamp: new Date()
    };

    stepMetricsRef.current.push(metric);
    currentStepId.current = null;
  }, []);

  /**
   * Returns ONLY metrics that have not been flushed yet, and advances the flush cursor.
   * Metrics are collected client-side and can be sent with form submissions.
   */
  const flushStepMetrics = useCallback((): StepMetrics[] => {
    const all = stepMetricsRef.current;
    const start = flushedIdxRef.current;
    if (!Array.isArray(all) || all.length <= start) return [];
    const delta = all.slice(start);
    flushedIdxRef.current = all.length;
    return delta;
  }, []);

  return {
    trackStepStart,
    trackStepComplete,
    trackStepAbandon,
    flushStepMetrics,
    stepMetrics: stepMetricsRef.current
  };
}


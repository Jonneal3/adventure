/**
 * OpenTelemetry instrumentation helpers for AI Form events
 * Wraps telemetry events with OpenTelemetry spans and metrics
 * Server-side only - safe to import in API routes
 */

// Lazy import to avoid client bundling
let tracer: any;
let telemetryMetrics: any;

if (typeof window === 'undefined') {
  try {
    const otel = require('./opentelemetry');
    tracer = otel.tracer;
    telemetryMetrics = otel.telemetryMetrics;
  } catch (e) {
    // Fallback no-ops if OpenTelemetry not available
    tracer = { startSpan: () => ({ end: () => {}, setAttribute: () => {}, setStatus: () => {}, recordException: () => {} }) };
    telemetryMetrics = {
      eventsTotal: { add: () => {} },
      eventsByType: { add: () => {} },
      eventLatency: { record: () => {} },
      duplicateEvents: { add: () => {} },
    };
  }
} else {
  // Client-side no-ops
  tracer = { startSpan: () => ({ end: () => {}, setAttribute: () => {}, setStatus: () => {}, recordException: () => {} }) };
  telemetryMetrics = {
    eventsTotal: { add: () => {} },
    eventsByType: { add: () => {} },
    eventLatency: { record: () => {} },
    duplicateEvents: { add: () => {} },
  };
}

export interface TelemetryEventAttributes {
  sessionId: string;
  instanceId: string;
  eventType: string;
  stepId?: string | null;
  batchId?: string | null;
  modelRequestId?: string | null;
  [key: string]: string | number | boolean | null | undefined;
}

/**
 * Instrument a telemetry event with OpenTelemetry
 * Creates a span and records metrics
 */
export function instrumentTelemetryEvent(
  attributes: TelemetryEventAttributes,
  payload?: Record<string, any>
) {
  const span = tracer.startSpan(`telemetry.${attributes.eventType}`, {
    attributes: {
      'telemetry.session_id': attributes.sessionId,
      'telemetry.instance_id': attributes.instanceId,
      'telemetry.event_type': attributes.eventType,
      ...(attributes.stepId && { 'telemetry.step_id': attributes.stepId }),
      ...(attributes.batchId && { 'telemetry.batch_id': attributes.batchId }),
      ...(attributes.modelRequestId && { 'telemetry.model_request_id': attributes.modelRequestId }),
    },
  });

  // Record metrics
  telemetryMetrics.eventsTotal.add(1, {
    event_type: attributes.eventType,
    instance_id: attributes.instanceId,
  });

  telemetryMetrics.eventsByType.add(1, {
    event_type: attributes.eventType,
  });

  // Add payload attributes if provided
  if (payload) {
    Object.entries(payload).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        span.setAttribute(`telemetry.payload.${key}`, value);
      }
    });
  }

  return span;
}

/**
 * Record a duplicate event (for metrics)
 */
export function recordDuplicateEvent(eventType: string) {
  telemetryMetrics.duplicateEvents.add(1, {
    event_type: eventType,
  });
}

/**
 * Record event processing latency
 */
export function recordEventLatency(latencyMs: number, eventType: string) {
  telemetryMetrics.eventLatency.record(latencyMs, {
    event_type: eventType,
  });
}

/**
 * Create a span for form flow operations
 */
export function createFormFlowSpan(operation: string, attributes: Record<string, string | number>) {
  return tracer.startSpan(`form.${operation}`, {
    attributes: {
      'form.operation': operation,
      ...attributes,
    },
  });
}

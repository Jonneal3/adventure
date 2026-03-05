/**
 * OpenTelemetry instrumentation for the AI Form widget
 * Server-side only - prevents client bundling issues
 */

// Lazy-load OpenTelemetry only on server-side to avoid bundling issues
let tracer: any;
let meter: any;
let telemetryMetrics: any;

function initOpenTelemetry() {
  if (typeof window !== 'undefined') {
    // Client-side: return no-ops
    return {
      tracer: { startSpan: () => ({ end: () => {}, setAttribute: () => {}, setStatus: () => {}, recordException: () => {} }) },
      meter: { createCounter: () => ({ add: () => {} }), createHistogram: () => ({ record: () => {} }) },
      metrics: {
        eventsTotal: { add: () => {} },
        eventsByType: { add: () => {} },
        eventLatency: { record: () => {} },
        duplicateEvents: { add: () => {} },
      }
    };
  }

  const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  // If no exporter is configured, don't initialize the SDK (keeps dev logs clean).
  if (!otlpEndpoint) {
    return {
      tracer: { startSpan: () => ({ end: () => {}, setAttribute: () => {}, setStatus: () => {}, recordException: () => {} }) },
      meter: { createCounter: () => ({ add: () => {} }), createHistogram: () => ({ record: () => {} }) },
      metrics: {
        eventsTotal: { add: () => {} },
        eventsByType: { add: () => {} },
        eventLatency: { record: () => {} },
        duplicateEvents: { add: () => {} },
      }
    };
  }

  try {
    // IMPORTANT (dev stability):
    // Next.js dev can sometimes emit a server bundle that references missing `vendor-chunks/@opentelemetry.js`.
    // Using a non-static require prevents webpack from trying to split these into vendor chunks.
    // eslint-disable-next-line no-eval
    const req = (0, eval)("require") as NodeRequire;
    const { trace, metrics: otelMetrics } = req("@opentelemetry/api");
    const { NodeSDK } = req("@opentelemetry/sdk-node");
    const { defaultResource, resourceFromAttributes } = req("@opentelemetry/resources");
    const { SemanticResourceAttributes } = req("@opentelemetry/semantic-conventions");
    const { HttpInstrumentation } = req("@opentelemetry/instrumentation-http");
    const { FetchInstrumentation } = req("@opentelemetry/instrumentation-fetch");
    const { OTLPTraceExporter } = req("@opentelemetry/exporter-trace-otlp-http");
    const { OTLPMetricExporter } = req("@opentelemetry/exporter-metrics-otlp-http");
    const { PeriodicExportingMetricReader } = req("@opentelemetry/sdk-metrics");

    const serviceName = process.env.OTEL_SERVICE_NAME || 'sif-widget';
    const serviceVersion = process.env.OTEL_SERVICE_VERSION || '1.0.0';

    // @opentelemetry/resources v2 does not export a Resource constructor.
    // Build a Resource via helpers and merge into the default resource.
    const resource = defaultResource().merge(
      resourceFromAttributes({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: serviceVersion,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
      })
    );

    const sdk = new NodeSDK({
      resource,
      traceExporter: otlpEndpoint
        ? new OTLPTraceExporter({
            url: `${otlpEndpoint}/v1/traces`,
          })
        : undefined,
      metricReader: otlpEndpoint
        ? new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({
              url: `${otlpEndpoint}/v1/metrics`,
            }),
            exportIntervalMillis: 30000,
          })
        : undefined,
      instrumentations: [
        new HttpInstrumentation({ enabled: true }),
        new FetchInstrumentation({ enabled: true }),
      ],
    });

    sdk.start();

    process.on('SIGTERM', () => {
      sdk
        .shutdown()
        .then(() => console.log('[OpenTelemetry] SDK shut down successfully'))
        .catch((error: unknown) => console.error('[OpenTelemetry] Error shutting down SDK', error))
        .finally(() => process.exit(0));
    });

    const t = trace.getTracer('sif-widget', '1.0.0');
    const m = otelMetrics.getMeter('sif-widget', '1.0.0');

    const metrics = {
      eventsTotal: m.createCounter('telemetry_events_total', {
        description: 'Total number of telemetry events',
      }),
      eventsByType: m.createCounter('telemetry_events_by_type', {
        description: 'Telemetry events by type',
      }),
      eventLatency: m.createHistogram('telemetry_event_latency_ms', {
        description: 'Latency of telemetry event processing in milliseconds',
        unit: 'ms',
      }),
      duplicateEvents: m.createCounter('telemetry_duplicate_events_total', {
        description: 'Total number of duplicate events filtered',
      }),
    };

    return { tracer: t, meter: m, metrics };
  } catch (error) {
    console.warn('[OpenTelemetry] Failed to initialize:', error);
    // Return no-ops if OpenTelemetry fails to load
    return {
      tracer: { startSpan: () => ({ end: () => {}, setAttribute: () => {}, setStatus: () => {}, recordException: () => {} }) },
      meter: { createCounter: () => ({ add: () => {} }), createHistogram: () => ({ record: () => {} }) },
      metrics: {
        eventsTotal: { add: () => {} },
        eventsByType: { add: () => {} },
        eventLatency: { record: () => {} },
        duplicateEvents: { add: () => {} },
      }
    };
  }
}

const { tracer: t, meter: m, metrics: mets } = initOpenTelemetry();
tracer = t;
meter = m;
telemetryMetrics = mets;

export { tracer, meter, telemetryMetrics };

export function createTelemetrySpan(
  eventType: string,
  attributes: Record<string, string | number | boolean>
) {
  return tracer.startSpan(`telemetry.${eventType}`, {
    attributes: {
      'telemetry.event_type': eventType,
      ...attributes,
    },
  });
}

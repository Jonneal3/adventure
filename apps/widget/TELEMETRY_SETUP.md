# Telemetry & OpenTelemetry Setup

This project uses a **dual telemetry system**:
1. **Custom Supabase-based analytics** (business events, user behavior)
2. **OpenTelemetry** (observability, distributed tracing, metrics)

## Architecture

```
Client (Browser)
  ↓
emitTelemetry() → /api/telemetry
  ↓
Server-side:
  1. Deduplication (5-second window)
  2. OpenTelemetry instrumentation (spans + metrics)
  3. Supabase insert (telemetry_events table)
```

## Environment Variables

### OpenTelemetry Configuration

```bash
# Optional: OpenTelemetry endpoint (e.g., Jaeger, Grafana Tempo, or OTLP collector)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318

# Service identification
OTEL_SERVICE_NAME=sif-widget
OTEL_SERVICE_VERSION=1.0.0

# Optional: Disable OpenTelemetry (if not configured, it will use console exporter)
# Set to "false" to disable
OTEL_ENABLED=true
```

### Existing Telemetry Variables

```bash
# Custom telemetry endpoint override (defaults to /api/telemetry)
NEXT_PUBLIC_TELEMETRY_ENDPOINT=/api/telemetry
```

## Features

### 1. Duplicate Event Prevention

- **Client-side**: localStorage + in-memory Set (persists across remounts)
- **Server-side**: 5-second deduplication window (checks Supabase before insert)
- **Metrics**: `telemetry_duplicate_events_total` counter tracks filtered duplicates

### 2. OpenTelemetry Metrics

- `telemetry_events_total` - Total events by type and instance
- `telemetry_events_by_type` - Events grouped by event type
- `telemetry_event_latency_ms` - Processing latency histogram
- `telemetry_duplicate_events_total` - Duplicate events filtered

### 3. Distributed Tracing

- Spans created for each telemetry event
- Form flow spans for major operations
- HTTP/Fetch auto-instrumentation
- Trace context propagation

## Usage

### Client-Side (Already Integrated)

```typescript
import { emitTelemetry } from '@/lib/ai-form/telemetry';

emitTelemetry({
  sessionId: 'sess_...',
  instanceId: '...',
  eventType: 'step_rendered',
  stepId: 'step-1',
  payload: { ... }
});
```

### Server-Side Instrumentation

```typescript
import { instrumentTelemetryEvent } from '@/lib/telemetry/instrumentation';

const span = instrumentTelemetryEvent({
  sessionId: 'sess_...',
  instanceId: '...',
  eventType: 'step_rendered',
}, payload);
span.end();
```

## Visualization

### Supabase (Business Analytics)

Query `telemetry_events` table for:
- User behavior analysis
- Form completion rates
- Step-by-step dropoff analysis
- Custom business metrics

### OpenTelemetry (Observability)

If `OTEL_EXPORTER_OTLP_ENDPOINT` is configured, traces/metrics are sent to:
- **Jaeger** - Distributed tracing UI
- **Grafana Tempo** - Trace backend
- **OTLP Collector** - Forward to any compatible backend

If not configured, traces are logged to console (development only).

## Local Development

1. **Without OpenTelemetry backend**: Works out of the box, traces logged to console
2. **With Jaeger**: 
   ```bash
   docker run -d -p 16686:16686 -p 4318:4318 jaegertracing/all-in-one:latest
   ```
   Set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`

3. **With Grafana Tempo**:
   ```bash
   # Follow Grafana Tempo setup guide
   ```
   Set `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`

## Production Deployment

1. Set `OTEL_EXPORTER_OTLP_ENDPOINT` to your observability backend
2. Ensure `OTEL_SERVICE_NAME` and `OTEL_SERVICE_VERSION` are set
3. Monitor `telemetry_duplicate_events_total` metric to ensure deduplication is working

## Troubleshooting

### Duplicate Events Still Appearing

1. Check server logs for deduplication stats (`skipped` count)
2. Verify client-side localStorage is working
3. Check if events are being sent from multiple browser tabs
4. Review `telemetry_duplicate_events_total` metric

### OpenTelemetry Not Working

1. Verify `instrumentation.ts` exists in project root
2. Check `next.config.js` doesn't disable instrumentation
3. Ensure OpenTelemetry packages are installed
4. Check server logs for OpenTelemetry initialization errors

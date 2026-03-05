/**
 * Next.js instrumentation file
 * This file is automatically loaded by Next.js to initialize OpenTelemetry
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Dev console hygiene: Supabase warns loudly (and repeatedly in Next dev) on Node <= 18.
    // Keep the first warning, suppress duplicates to avoid drowning out real logs.
    if (process.env.NODE_ENV === "development") {
      const major = Number(String(process.version || "").replace(/^v/, "").split(".")[0]);
      if (Number.isFinite(major) && major <= 18) {
        const originalWarn = console.warn.bind(console);
        console.warn = (...args: unknown[]) => {
          const first = args[0];
          if (
            typeof first === "string" &&
            first.includes("Node.js 18 and below are deprecated") &&
            first.includes("@supabase/supabase-js")
          ) {
            const g = globalThis as any;
            if (g.__supabase_node18_warned) return;
            g.__supabase_node18_warned = true;
          }
          return originalWarn(...(args as any));
        };
      }
    }
    // Only initialize on server-side
    await import('./lib/telemetry/opentelemetry');
  }
}

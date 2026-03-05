export function createFetchWithTimeout(timeoutMs: number): typeof fetch {
  const safeTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 15_000;

  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), safeTimeoutMs);

    try {
      const originalSignal = init?.signal;
      if (originalSignal) {
        if (originalSignal.aborted) {
          timeoutController.abort();
        } else {
          originalSignal.addEventListener("abort", () => timeoutController.abort(), { once: true });
        }
      }

      return await fetch(input, { ...init, signal: timeoutController.signal });
    } finally {
      clearTimeout(timeoutId);
    }
  };
}


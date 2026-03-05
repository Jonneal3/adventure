import { useState, useEffect } from 'react';

export function useStripeMode() {
  const [mode, setMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('stripeMode') || 'test';
    }
    return 'test';
  });

  useEffect(() => {
    localStorage.setItem('stripeMode', mode);
  }, [mode]);

  return { mode, setMode };
}

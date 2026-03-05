export type StripeMode = 'test' | 'live';

export function getStripeSecretKey(mode: StripeMode = 'test'): string {
  // Prefer explicit mode-specific keys if provided
  if (mode === 'live') {
    return process.env.STRIPE_SECRET_KEY || '';
  }
  // test mode
  return process.env.STRIPE_TEST_SECRET_KEY || process.env.STRIPE_SECRET_KEY || '';
}

export function getStripeWebhookSecret(mode: StripeMode = 'test'): string {
  if (mode === 'live') {
    return process.env.STRIPE_WEBHOOK_SECRET || '';
  }
  return process.env.STRIPE_TEST_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET || '';
}

export function getStripeModeFromEnv(): StripeMode {
  const mode = (process.env.STRIPE_MODE as StripeMode) || 'test';
  return mode === 'live' ? 'live' : 'test';
}



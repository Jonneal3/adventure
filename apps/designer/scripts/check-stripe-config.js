#!/usr/bin/env node/**
 * Script to check Stripe configuration for live mode
 * Run with: node scripts/check-stripe-config.js
 */

require('dotenv').config({ path: '.env.local' });

const requiredVars = {
  // Mode
  STRIPE_MODE: process.env.STRIPE_MODE,
  
  // Live mode keys
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  
  // Test mode keys (for development)
  STRIPE_TEST_SECRET_KEY: process.env.STRIPE_TEST_SECRET_KEY,
  STRIPE_TEST_WEBHOOK_SECRET: process.env.STRIPE_TEST_WEBHOOK_SECRET,
  NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY,
  
  // Configuration
  NEXT_PUBLIC_STRIPE_IS_ENABLED: process.env.NEXT_PUBLIC_STRIPE_IS_ENABLED,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
};

// Check current mode
const currentMode = requiredVars.STRIPE_MODE || 'test';

// Check required variables for current mode
const missingVars = [];
const warnings = [];

if (currentMode === 'live') {
  if (!requiredVars.STRIPE_SECRET_KEY) {
    missingVars.push('STRIPE_SECRET_KEY');
  } else if (!requiredVars.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
    warnings.push('STRIPE_SECRET_KEY should start with sk_live_');
  }

  if (!requiredVars.STRIPE_WEBHOOK_SECRET) {
    missingVars.push('STRIPE_WEBHOOK_SECRET');
  } else if (!requiredVars.STRIPE_WEBHOOK_SECRET.startsWith('whsec_')) {
    warnings.push('STRIPE_WEBHOOK_SECRET should start with whsec_');
  }

  if (!requiredVars.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    missingVars.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY');
  } else if (!requiredVars.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith('pk_live_')) {
    warnings.push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY should start with pk_live_');
  }
} else {
  if (!requiredVars.STRIPE_TEST_SECRET_KEY) {
    missingVars.push('STRIPE_TEST_SECRET_KEY');
  } else if (!requiredVars.STRIPE_TEST_SECRET_KEY.startsWith('sk_test_')) {
    warnings.push('STRIPE_TEST_SECRET_KEY should start with sk_test_');
  }

  if (!requiredVars.STRIPE_TEST_WEBHOOK_SECRET) {
    missingVars.push('STRIPE_TEST_WEBHOOK_SECRET');
  } else if (!requiredVars.STRIPE_TEST_WEBHOOK_SECRET.startsWith('whsec_')) {
    warnings.push('STRIPE_TEST_WEBHOOK_SECRET should start with whsec_');
  }

  if (!requiredVars.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY) {
    missingVars.push('NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY');
  } else if (!requiredVars.NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY.startsWith('pk_test_')) {
    warnings.push('NEXT_PUBLIC_STRIPE_TEST_PUBLISHABLE_KEY should start with pk_test_');
  }
}

// Check general configuration
if (!requiredVars.NEXT_PUBLIC_STRIPE_IS_ENABLED) {
  missingVars.push('NEXT_PUBLIC_STRIPE_IS_ENABLED');
}

if (!requiredVars.NEXT_PUBLIC_APP_URL) {
  warnings.push('NEXT_PUBLIC_APP_URL is not set (optional but recommended)');
}

// Display results
if (missingVars.length === 0 && warnings.length === 0) {} else {
  if (missingVars.length > 0) {
    missingVars.forEach(varName => {});
  }

  if (warnings.length > 0) {
    warnings.forEach(warning => {});
  }
}

Object.entries(requiredVars).forEach(([key, value]) => {
  if (value) {
    if (key.includes('SECRET') || key.includes('KEY')) {} else {}
  } else {}
}); 
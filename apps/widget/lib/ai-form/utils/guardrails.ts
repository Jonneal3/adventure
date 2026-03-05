// Business guardrails validation

import { AIFormConfig, StepDefinition } from '@/types/ai-form';

export interface GuardrailResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateFlowPlan(
  flowPlan: { steps: StepDefinition[]; maxSteps: number },
  config: AIFormConfig
): GuardrailResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check max steps
  if (flowPlan.steps.length > (config.maxSteps || 10)) {
    errors.push(`Flow plan exceeds maximum steps: ${flowPlan.steps.length} > ${config.maxSteps || 10}`);
  }

  // Check required inputs
  if (config.requiredInputs && config.requiredInputs.length > 0) {
    const hasEmail = flowPlan.steps.some(s => 
      s.componentType === 'lead_capture'
    );
    
    if (config.requiredInputs.includes('email') && !hasEmail) {
      errors.push('Flow plan must include email capture');
    }

    const hasPhone = flowPlan.steps.some(s => 
      s.componentType === 'lead_capture'
    );
    
    if (config.requiredInputs.includes('phone') && !hasPhone) {
      warnings.push('Phone capture recommended but not found');
    }
  }

  // Check lead capture requirement
  if (config.leadCaptureRequired !== false) {
    const hasLeadCapture = flowPlan.steps.some(s => s.componentType === 'lead_capture');
    if (!hasLeadCapture) {
      errors.push('Flow plan must include lead capture step');
    }
  }

  // Check pricing visibility
  if (config.pricingVisibility === 'always') {
    const hasPricing = flowPlan.steps.some(s => s.componentType === 'pricing');
    if (!hasPricing) {
      warnings.push('Pricing visibility set to always but no pricing step found');
    }
  }

  // Check max images
  const uploadSteps = flowPlan.steps.filter(s => s.componentType === 'upload');
  if (uploadSteps.length > (config.maxImages || 3)) {
    warnings.push(`Number of upload steps (${uploadSteps.length}) exceeds recommended maximum (${config.maxImages || 3})`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export function validateStepData(
  step: StepDefinition,
  data: any,
  config: AIFormConfig
): GuardrailResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate based on component type
  switch (step.componentType) {
    case 'choice':
    case 'segmented_choice':
    case 'chips_multi':
    case 'image_choice_grid':
      if (!data || (!Array.isArray(data) && typeof data !== 'string')) {
        errors.push('Choice step requires selected option(s)');
      }
      break;

    case 'yes_no':
      if (data !== 'yes' && data !== 'no') {
        errors.push('Yes/No step requires a yes or no selection');
      }
      break;

    case 'slider':
      if (data === undefined || data === null) {
        errors.push('Slider step requires a value');
      }
      if (step.data?.min !== undefined && data < step.data.min) {
        errors.push(`Slider value (${data}) is below minimum (${step.data.min})`);
      }
      if (step.data?.max !== undefined && data > step.data.max) {
        errors.push(`Slider value (${data}) is above maximum (${step.data.max})`);
      }
      break;

    case 'upload':
      if (!data || (Array.isArray(data) && data.length === 0)) {
        errors.push('Upload step requires at least one file');
      }
      if (Array.isArray(data) && data.length > (config.maxImages || 3)) {
        errors.push(`Too many files uploaded: ${data.length} > ${config.maxImages || 3}`);
      }
      break;

    case 'lead_capture':
      if (!data?.email || !isValidEmail(data.email)) {
        errors.push('Lead capture requires valid email');
      }
      if (config.requiredInputs?.includes('phone') && (!data?.phone || !isValidPhone(data.phone))) {
        errors.push('Lead capture requires valid phone number');
      }
      break;
  }

  // Check guardrails
  if (step.guardrails) {
    Object.entries(step.guardrails).forEach(([key, value]) => {
      // Custom validation logic based on guardrail type
      if (key === 'required' && value === true && !data) {
        errors.push(`Step requires ${step.intent}`);
      }
      if (key === 'minLength' && typeof data === 'string' && data.length < value) {
        errors.push(`Input must be at least ${value} characters`);
      }
      if (key === 'maxLength' && typeof data === 'string' && data.length > value) {
        errors.push(`Input must be no more than ${value} characters`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function isValidPhone(phone: string): boolean {
  // Basic phone validation - allows various formats
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  const digitsOnly = phone.replace(/\D/g, '');
  return phoneRegex.test(phone) && digitsOnly.length >= 10;
}


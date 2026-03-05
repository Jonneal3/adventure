/**
 * General Guidelines - Constitution Layer
 * 
 * This is the "constitution" of the form system. All downstream modules must obey these rules.
 * Defines taste, limits, and when to stop.
 */

export interface FormGuidelines {
  /** Ideal total steps for the form (6-10) */
  idealTotalSteps: { min: number; max: number };
  
  /** Ideal number of context questions before image generation (4-6) */
  idealContextQuestions: { min: number; max: number };
  
  /** Never ask more than this many low-impact questions */
  maxLowImpactQuestions: number;
  
  /** Question quality standards */
  questionQuality: {
    /** Question must eliminate a large portion of possible outputs */
    mustEliminateLargePortion: boolean;
    /** Question must be answerable in ≤5 seconds */
    maxAnswerTimeSeconds: number;
    /** Question must produce info the prompt generator cannot infer later */
    mustBeNonInferable: boolean;
  };
  
  /** Ordering and psychology rules */
  ordering: {
    /** Order: broad → specific */
    broadToSpecific: boolean;
    /** Order: visual → technical */
    visualToTechnical: boolean;
    /** Order: easy → harder */
    easyToHarder: boolean;
    /** Front-load fun/visual questions */
    frontLoadFun: boolean;
    /** Delay budget/contact questions */
    delayBudgetContact: boolean;
  };
  
  /** Stop conditions */
  stopConditions: {
    /** Stop when prompt ambiguity is sufficiently low */
    stopOnLowAmbiguity: boolean;
    /** Stop when additional questions provide diminishing returns */
    stopOnDiminishingReturns: boolean;
    /** Stop when visual feedback is more valuable than another question */
    stopWhenVisualMoreValuable: boolean;
  };
}

/**
 * Default form guidelines - optimized for generating killer image prompts
 */
export const DEFAULT_FORM_GUIDELINES: FormGuidelines = {
  idealTotalSteps: { min: 8, max: 12 },
  idealContextQuestions: { min: 5, max: 8 },
  maxLowImpactQuestions: 1,
  
  questionQuality: {
    mustEliminateLargePortion: true,
    maxAnswerTimeSeconds: 5,
    mustBeNonInferable: true,
  },
  
  ordering: {
    broadToSpecific: true,
    visualToTechnical: true,
    easyToHarder: true,
    frontLoadFun: true,
    delayBudgetContact: true,
  },
  
  stopConditions: {
    stopOnLowAmbiguity: true,
    stopOnDiminishingReturns: true,
    stopWhenVisualMoreValuable: true,
  },
};

/**
 * Get form guidelines (can be customized per instance if needed)
 */
export function getFormGuidelines(custom?: Partial<FormGuidelines>): FormGuidelines {
  return {
    ...DEFAULT_FORM_GUIDELINES,
    ...custom,
  };
}

/**
 * Validate if a question meets quality standards
 */
export function validateQuestionQuality(
  question: { eliminatesLargePortion?: boolean; answerTimeSeconds?: number; isNonInferable?: boolean },
  guidelines: FormGuidelines = DEFAULT_FORM_GUIDELINES
): { valid: boolean; reasons: string[] } {
  const reasons: string[] = [];
  
  if (guidelines.questionQuality.mustEliminateLargePortion && !question.eliminatesLargePortion) {
    reasons.push("Question does not eliminate a large portion of possible outputs");
  }
  
  if (question.answerTimeSeconds && question.answerTimeSeconds > guidelines.questionQuality.maxAnswerTimeSeconds) {
    reasons.push(`Question takes ${question.answerTimeSeconds}s, exceeds ${guidelines.questionQuality.maxAnswerTimeSeconds}s limit`);
  }
  
  if (guidelines.questionQuality.mustBeNonInferable && !question.isNonInferable) {
    reasons.push("Question produces info that prompt generator can infer later");
  }
  
  return {
    valid: reasons.length === 0,
    reasons,
  };
}

/**
 * Check if we should stop asking questions based on guidelines
 */
export function shouldStopAskingQuestions(
  context: {
    questionsAsked: number;
    promptAmbiguity: number; // 0-1, lower = less ambiguous
    diminishingReturns: boolean;
    visualFeedbackAvailable: boolean;
  },
  guidelines: FormGuidelines = DEFAULT_FORM_GUIDELINES
): { shouldStop: boolean; reason?: string } {
  // Check if we've asked enough questions
  if (context.questionsAsked >= guidelines.idealContextQuestions.max) {
    return { shouldStop: true, reason: "Reached maximum ideal context questions" };
  }
  
  // Check stop conditions
  if (guidelines.stopConditions.stopOnLowAmbiguity && context.promptAmbiguity < 0.3) {
    return { shouldStop: true, reason: "Prompt ambiguity is sufficiently low" };
  }
  
  if (guidelines.stopConditions.stopOnDiminishingReturns && context.diminishingReturns) {
    return { shouldStop: true, reason: "Additional questions provide diminishing returns" };
  }
  
  if (guidelines.stopConditions.stopWhenVisualMoreValuable && context.visualFeedbackAvailable) {
    return { shouldStop: true, reason: "Visual feedback is more valuable than another question" };
  }
  
  return { shouldStop: false };
}


/**
 * Normalization Cache
 * 
 * Stores mappings from (raw_answer, question) pairs to normalized slots and confidence.
 * This prevents redundant AI calls for the same user input.
 */

export interface NormalizedResult {
  slots: Record<string, any>;
  confidence: number;
  timestamp: number;
}

// In-memory cache for the current session
const normalizationCache = new Map<string, NormalizedResult>();

/**
 * Generate a cache key for a given answer and question
 */
function getCacheKey(rawAnswer: any, question: string): string {
  const answerStr = typeof rawAnswer === 'string' 
    ? rawAnswer 
    : JSON.stringify(rawAnswer);
  return `${question.trim()}:${answerStr.trim()}`;
}

/**
 * Get a normalized result from the cache
 */
export function getCachedNormalization(rawAnswer: any, question: string): NormalizedResult | null {
  if (!rawAnswer || !question) return null;
  
  const key = getCacheKey(rawAnswer, question);
  const result = normalizationCache.get(key);
  
  if (result) {
    // Optional: check for cache expiration (e.g., 30 minutes)
    const MAX_AGE = 30 * 60 * 1000;
    if (Date.now() - result.timestamp > MAX_AGE) {
      normalizationCache.delete(key);
      return null;
    }
    return result;
  }
  
  return null;
}

/**
 * Store a normalized result in the cache
 */
export function setCachedNormalization(
  rawAnswer: any, 
  question: string, 
  slots: Record<string, any>, 
  confidence: number
): void {
  if (!rawAnswer || !question) return;
  
  const key = getCacheKey(rawAnswer, question);
  normalizationCache.set(key, {
    slots,
    confidence,
    timestamp: Date.now(),
  });
}

/**
 * Clear the normalization cache
 */
export function clearNormalizationCache(): void {
  normalizationCache.clear();
}


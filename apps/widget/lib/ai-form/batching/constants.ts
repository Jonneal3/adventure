/**
 * Calculate prefetch trigger index based on actual batch size.
 * Formula: batchSize - 2 (gives 2-question buffer)
 * For smaller batches (<= 3), use batchSize - 1 (gives 1-question buffer)
 * 
 * Examples:
 * - Batch has 5 steps: trigger at index 3 (5-2=3, question 4)
 * - Batch has 6 steps: trigger at index 4 (6-2=4, question 5)
 * - Batch has 3 steps: trigger at index 2 (3-1=2, question 3)
 */
export function calculatePrefetchTriggerIndex(batchSize: number): number {
  if (batchSize <= 3) {
    return Math.max(0, batchSize - 1);
  }
  return Math.max(0, batchSize - 2);
}



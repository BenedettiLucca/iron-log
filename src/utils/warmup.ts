/**
 * Warm-up progression calculator for strength training
 * Calculates recommended warm-up sets based on working weight
 */

export interface WarmupSet {
  weight: number;
  reps: number;
  percentage: number;
}

/**
 * Calculate warm-up progression sets
 * @param workingWeight The target working weight in kg
 * @param warmupCount Number of warm-up sets (default: 3)
 * @param warmupReps Reps per warm-up set (default: 8)
 * @returns Array of warm-up set recommendations
 */
export function calculateWarmupProgression(
  workingWeight: number,
  warmupCount: number = 3,
  warmupReps: number = 8
): WarmupSet[] {
  if (workingWeight <= 0) return [];

  const warmups: WarmupSet[] = [];
  
  // Progression percentages: 40%, 60%, 80% of working weight
  const percentages = warmupCount === 2 ? [0.5, 0.75] : [0.4, 0.6, 0.8];
  const actualPercentages = percentages.slice(0, warmupCount);

  actualPercentages.forEach((percentage, index) => {
    const weight = Math.round((workingWeight * percentage) / 0.5) * 0.5; // Round to nearest 0.5kg
    warmups.push({
      weight,
      reps: warmupReps,
      percentage: Math.round(percentage * 100)
    });
  });

  return warmups;
}

/**
 * Format warm-up progression as display text
 * @param warmups Array of warm-up sets
 * @returns Formatted string (e.g., "40kg×8, 60kg×8, 80kg×8")
 */
export function formatWarmupProgression(warmups: WarmupSet[]): string {
  if (warmups.length === 0) return '';
  return warmups.map(w => `${w.weight}kg×${w.reps}`).join(', ');
}

/**
 * Get suggested warm-up reps based on working set reps
 * @param workingReps Number of reps in working set
 * @returns Suggested warm-up reps (usually higher than working reps)
 */
export function getWarmupReps(workingReps: number): number {
  if (workingReps <= 5) return 10;
  if (workingReps <= 8) return 8;
  if (workingReps <= 12) return 6;
  return 5;
}

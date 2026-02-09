/**
 * Exercise calculation utilities for 1RM, volume, and other metrics
 */

export interface SetData {
  weightKg: number;
  reps: number;
  rir?: number | null;
}

/**
 * Calculate estimated One Rep Max (1RM) using various formulas
 */
export function calculate1RM(weight: number, reps: number, formula: 'epley' | 'brzycki' | 'average' = 'average'): number {
  if (reps === 1) return weight;
  if (reps < 1 || weight <= 0) return 0;

  const epley = weight * (1 + reps / 30);
  const brzycki = weight * (36 / (37 - reps));

  if (formula === 'epley') return epley;
  if (formula === 'brzycki') return brzycki;

  // Average of both formulas for better accuracy
  return (epley + brzycki) / 2;
}

/**
 * Calculate volume load (weight × reps)
 */
export function calculateVolume(weight: number, reps: number): number {
  return weight * reps;
}

/**
 * Calculate total volume for multiple sets
 */
export function calculateTotalVolume(sets: SetData[]): number {
  return sets.reduce((total, set) => total + calculateVolume(set.weightKg, set.reps), 0);
}

/**
 * Calculate average intensity (weight / 1RM ratio)
 */
export function calculateIntensity(weight: number, oneRepMax: number): number {
  if (oneRepMax === 0) return 0;
  return (weight / oneRepMax) * 100;
}

/**
 * Calculate estimated time under tension (simplified)
 */
export function calculateTimeUnderTension(sets: SetData[], avgRepDuration: number = 3): number {
  // Assuming ~3 seconds per rep (concentric + eccentric)
  return sets.reduce((total, set) => total + set.reps * avgRepDuration, 0);
}

/**
 * Calculate fatigue based on RIR
 */
export function calculateFatigueLevel(rir: number | null | undefined): 'low' | 'medium' | 'high' {
  if (rir === null || rir === undefined) return 'medium';
  if (rir >= 4) return 'low';
  if (rir >= 2) return 'medium';
  return 'high';
}

/**
 * Check if a set is a personal record
 */
export function isPersonalRecord(
  currentSet: SetData,
  historicalSets: SetData[],
  recordType: 'weight' | 'reps' | 'volume' = 'weight'
): boolean {
  if (historicalSets.length === 0) return true;

  switch (recordType) {
    case 'weight':
      const maxWeight = Math.max(...historicalSets.map((s) => s.weightKg));
      return currentSet.weightKg > maxWeight;

    case 'reps':
      const maxReps = Math.max(...historicalSets.map((s) => s.reps));
      return currentSet.reps > maxReps;

    case 'volume':
      const currentVolume = calculateVolume(currentSet.weightKg, currentSet.reps);
      const maxVolume = Math.max(...historicalSets.map((s) => calculateVolume(s.weightKg, s.reps)));
      return currentVolume > maxVolume;

    default:
      return false;
  }
}

/**
 * Calculate training age (months since first session)
 */
export function calculateTrainingAge(firstSessionDate: number): number {
  const now = Date.now();
  const diffMs = now - firstSessionDate;
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30);
  return Math.max(0, diffMonths);
}

/**
 * Calculate session density (work per minute)
 */
export function calculateSessionDensity(totalVolume: number, durationMinutes: number): number {
  if (durationMinutes === 0) return 0;
  return totalVolume / durationMinutes;
}

/**
 * Determine effort level based on RPE/RIR
 */
export function getEffortLevel(rir: number | null | undefined): {
  level: 'easy' | 'moderate' | 'hard' | 'maximal';
  percentage: number;
} {
  if (rir === null || rir === undefined) {
    return { level: 'moderate', percentage: 65 };
  }

  if (rir >= 4) return { level: 'easy', percentage: 50 };
  if (rir >= 2) return { level: 'moderate', percentage: 65 };
  if (rir >= 1) return { level: 'hard', percentage: 80 };
  return { level: 'maximal', percentage: 95 };
}

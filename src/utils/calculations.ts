/**
 * Exercise calculation utilities
 */

export interface SetData {
  weightKg: number;
  reps: number;
  rir?: number | null;
}

/**
 * Calculate volume load (weight × reps)
 */
export function calculateVolume(weight: number, reps: number): number {
  return weight * reps;
}

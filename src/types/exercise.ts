/**
 * Discriminated union types for exercise set data.
 * Use these instead of raw `any` for set data to get compile-time safety.
 */

export type ExerciseType = 'strength' | 'duration';

export interface StrengthSet {
  readonly type: 'strength';
  weightKg: number;
  reps: number;
  rir: number | null;
  durationSeconds?: never;
}

export interface DurationSet {
  readonly type: 'duration';
  durationSeconds: number;
  weightKg?: never;
  reps?: never;
  rir?: never;
}

export type ExerciseSet = StrengthSet | DurationSet;

/** Type guard */
export function isStrengthSet(set: ExerciseSet): set is StrengthSet {
  return set.type === 'strength';
}

/** Type guard */
export function isDurationSet(set: ExerciseSet): set is DurationSet {
  return set.type === 'duration';
}

import { Colors } from '@/constants/colors';

/**
 * Parse target string to extract the target number of sets.
 * Supports patterns like "3x8-12", "4x10", "3x8"
 * Returns null for duration-based exercises or invalid targets.
 */
export function parseTargetSets(target: string | null | undefined): number | null {
  if (!target) return null;
  // Match patterns like "3x8-12", "4x10", "3x8" - must have "x" between numbers
  const match = target.match(/(\d+)x/);
  if (match) {
    return parseInt(match[1], 10);
  }
  // Duration-based exercises don't have set targets
  return null;
}

/**
 * Count completed routine exercises based on target sets met and working sets.
 * Excludes warm-up sets from completion counts.
 */
export function countCompletedRoutineExercises(
  exercises: { id: number; target: string | null | undefined }[],
  sessionSets: { exerciseId: number; isWarmup?: boolean | null }[]
): number {
  const setsPerExercise = new Map<number, number>();

  sessionSets.forEach(set => {
    if (set.isWarmup === true) return;
    const currentCount = setsPerExercise.get(set.exerciseId) || 0;
    setsPerExercise.set(set.exerciseId, currentCount + 1);
  });

  return exercises.reduce((count, exercise) => {
    const targetSets = parseTargetSets(exercise.target);
    const doneSets = setsPerExercise.get(exercise.id) || 0;

    if (targetSets !== null) {
      return doneSets >= targetSets ? count + 1 : count;
    }
    return doneSets > 0 ? count + 1 : count;
  }, 0);
}

/**
 * Returns the hex color string associated with a given Reps in Reserve (RiR) value.
 */
export function getRirColor(rir: number): string {
  if (rir <= 1) return Colors.red400;
  if (rir <= 3) return Colors.success;
  return Colors.secondary;
}


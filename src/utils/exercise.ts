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
  exercises: {
    id?: number;
    exerciseId?: number;
    routineExerciseId?: number | null;
    target?: string | null | undefined;
  }[],
  sessionSets: {
    exerciseId?: number;
    routineExerciseId?: number | null;
    isWarmup?: boolean | null;
  }[]
): number {
  const exerciseFrequency = new Map<number, number>();
  for (const ex of exercises) {
    const exId = ex.exerciseId ?? ex.id;
    if (typeof exId === 'number') {
      exerciseFrequency.set(exId, (exerciseFrequency.get(exId) || 0) + 1);
    }
  }

  const workingSets = sessionSets.filter(set => set.isWarmup !== true);

  return exercises.reduce((count, exercise) => {
    const exId = exercise.exerciseId ?? exercise.id;
    const routineExId = exercise.routineExerciseId;
    const isSingleOccurrence = typeof exId === 'number' && exerciseFrequency.get(exId) === 1;

    const doneSets = workingSets.filter(set => {
      if (routineExId != null && set.routineExerciseId != null) {
        return set.routineExerciseId === routineExId;
      }
      if (set.routineExerciseId == null) {
        return isSingleOccurrence && typeof exId === 'number' && set.exerciseId === exId;
      }
      return isSingleOccurrence && typeof exId === 'number' && set.exerciseId === exId;
    }).length;

    const targetSets = parseTargetSets(exercise.target);
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


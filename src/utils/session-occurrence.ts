export function getRoutineOccurrenceKey(
  routineExerciseId: number | null | undefined,
  exerciseId: number,
): string {
  if (routineExerciseId != null) return `routine:${routineExerciseId}`;
  return `exercise:${exerciseId}`;
}

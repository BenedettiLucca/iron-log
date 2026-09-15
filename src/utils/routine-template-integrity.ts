export type RoutineExerciseInput = {
  id: number;
  routineExerciseId?: number;
  target?: string;
  notes?: string;
  restSeconds?: number;
};

export type TemplateExercise = {
  routineExerciseId: number;
  exerciseId: number;
  name: string;
  target: string;
  notes: string;
  restSeconds: number | null;
  orderIndex: number | null;
};

export type TemplateJoinRow = {
  routineExerciseId: number;
  exerciseId: number;
  name: string;
  target: string | null;
  notes: string | null;
  restSeconds: number | null;
  orderIndex: number | null;
};

export function buildRoutineExerciseRows(
  routineId: number,
  selectedExercises: RoutineExerciseInput[],
) {
  return selectedExercises.map((exercise, index) => ({
    routineId,
    exerciseId: exercise.id,
    orderIndex: index + 1,
    target: exercise.target,
    notes: exercise.notes,
    restSeconds: exercise.restSeconds,
  }));
}

export function buildRoutineExercisePersistencePlan(
  routineId: number,
  selectedExercises: RoutineExerciseInput[],
  existingRoutineExerciseIds: number[],
) {
  const selectedIds = new Set(
    selectedExercises
      .map(exercise => exercise.routineExerciseId)
      .filter((id): id is number => id != null),
  );

  return {
    deleteIds: existingRoutineExerciseIds.filter(id => !selectedIds.has(id)),
    updates: selectedExercises.flatMap((exercise, index) => {
      if (exercise.routineExerciseId == null) return [];
      return [{
        id: exercise.routineExerciseId,
        values: {
          exerciseId: exercise.id,
          orderIndex: index + 1,
          target: exercise.target,
          notes: exercise.notes,
          restSeconds: exercise.restSeconds,
        },
      }];
    }),
    inserts: selectedExercises.flatMap((exercise, index) => {
      if (exercise.routineExerciseId != null) return [];
      return [{
        routineId,
        exerciseId: exercise.id,
        orderIndex: index + 1,
        target: exercise.target,
        notes: exercise.notes,
        restSeconds: exercise.restSeconds,
      }];
    }),
  };
}

export function buildSaveAsTemplateValues(name: string, description: string) {
  return { name, description, isTemplate: true as const };
}

export function mapTemplateExercise(row: TemplateJoinRow): TemplateExercise {
  return {
    routineExerciseId: row.routineExerciseId,
    exerciseId: row.exerciseId,
    name: row.name,
    target: row.target ?? '',
    notes: row.notes ?? '',
    restSeconds: row.restSeconds,
    orderIndex: row.orderIndex,
  };
}

export function buildRoutineRowsFromTemplate(
  routineId: number,
  templateExercises: TemplateExercise[],
) {
  return templateExercises.map((exercise, index) => ({
    routineId,
    exerciseId: exercise.exerciseId,
    orderIndex: index + 1,
    target: exercise.target,
    notes: exercise.notes,
    restSeconds: exercise.restSeconds,
  }));
}

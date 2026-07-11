export type RoutineExerciseInput = {
  id: number;
  target?: string;
  notes?: string;
  restSeconds?: number;
};

export type TemplateExercise = {
  exerciseId: number;
  name: string;
  target: string;
  notes: string;
  restSeconds: number | null;
  orderIndex: number | null;
};

export type TemplateJoinRow = {
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

export function buildSaveAsTemplateValues(name: string, description: string) {
  return { name, description, isTemplate: true as const };
}

export function mapTemplateExercise(row: TemplateJoinRow): TemplateExercise {
  return {
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

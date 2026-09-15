import { getTableColumns } from 'drizzle-orm';
import { routineExercises, sets } from '@/src/db/schema';
import { exerciseParamsSchema } from '@/src/validators/routes';
import { resolveSessionDraft } from '@/src/utils/session-draft';

describe('routine exercise occurrence identity contract', () => {
  it('gives each routine exercise row its own identity and lets sets reference it', () => {
    const routineExerciseColumns = getTableColumns(routineExercises);
    const setColumns = getTableColumns(sets);

    expect(routineExerciseColumns).toHaveProperty('id');
    expect(setColumns).toHaveProperty('routineExerciseId');
  });

  it('keeps the occurrence identity in exercise route params', () => {
    const parsed = exerciseParamsSchema.parse({
      sessionId: '21',
      exerciseId: '7',
      routineExerciseId: '42',
      exerciseName: 'Supino reto',
    });

    expect(parsed).toEqual(expect.objectContaining({
      exerciseId: 7,
      routineExerciseId: 42,
    }));
  });

  it('never restores a draft into a different occurrence of the same exercise', () => {
    const persisted = {
      sessionId: 21,
      exerciseId: 7,
      routineExerciseId: 41,
      weight: '80',
      reps: '8',
      duration: '',
      rir: 2,
      isWarmupMode: false,
      isDirty: true,
      activeSetTime: 0,
    };

    expect(resolveSessionDraft(
      persisted,
      { sessionId: 21, exerciseId: 7, routineExerciseId: 41 },
    )).not.toBeNull();
    expect(resolveSessionDraft(
      persisted,
      { sessionId: 21, exerciseId: 7, routineExerciseId: 42 },
    )).toBeNull();
  });
});

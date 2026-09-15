import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('routine occurrence runtime contract', () => {
  it('routes and keys the workout list by occurrence identity', () => {
    const session = read('app/session/[routineId].tsx');

    expect(session).toMatch(/routineExerciseId:\s*routineExercises\.id/);
    expect(session).toMatch(/exerciseId:\s*exercises\.id/);
    expect(session).toContain('keyExtractor={(item) => item.routineExerciseId.toString()}');
    expect(session).toContain('routineExerciseId: item.routineExerciseId');
    expect(session).toContain('isSingleOccurrence');
    expect(session).toContain('isNull(sets.routineExerciseId)');
  });

  it('loads, inserts, and advances sets by occurrence identity', () => {
    const hook = read('hooks/use-exercise-sets.ts');

    expect(hook).toMatch(/routineExerciseId:\s*number/);
    expect(hook).toContain('eq(sets.routineExerciseId, routineExerciseId)');
    expect(hook).toContain('isNull(sets.routineExerciseId)');
    expect(hook).toContain('routineOccurrences.length === 1');
    expect(hook).toMatch(/routineExerciseId,\s*exerciseName:/);
    expect(hook).toContain('e.routineExerciseId === routineExerciseId');

    const undo = read('hooks/use-session-undo.ts');
    expect(undo).toMatch(/routineExerciseId:\s*number/);
    expect(undo).toContain('eq(sets.routineExerciseId, opts.routineExerciseId)');
    expect(undo).toContain('isNull(sets.routineExerciseId)');
  });

  it('persists occurrence identity in route drafts and next navigation', () => {
    const routes = read('src/validators/routes.ts');
    const screen = read('app/session/exercise.tsx');
    const persistence = read('hooks/use-session-persistence.ts');
    const draft = read('src/utils/session-draft.ts');

    expect(routes).toContain('routineExerciseId: numericParam');
    expect(screen).toContain('routineExerciseId: nextExercise.routineExerciseId');
    expect(screen).toContain('{ sessionId, exerciseId, routineExerciseId }');
    expect(persistence).toMatch(/routineExerciseId:\s*number/);
    expect(draft).toMatch(/routineExerciseId !== identity\.routineExerciseId/);
  });
});

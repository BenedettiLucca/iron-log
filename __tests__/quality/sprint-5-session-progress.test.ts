import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const hookSource = read('hooks/use-exercise-sets.ts');
const sessionSource = read('app/session/[routineId].tsx');

function section(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);

  return source.slice(startIndex, endIndex);
}

describe('Sprint 5 session progress integrity', () => {
  it('projects warm-up state before calculating exercise-header progress', () => {
    const progressQuery = section(
      hookSource,
      'const { data: allSessionSets } = useLiveQuery(',
      'const completedExercisesCount ='
    );

    expect(progressQuery).toContain('exerciseId: sets.exerciseId');
    expect(progressQuery).toContain('isWarmup: sets.isWarmup');
  });

  it('routes both progress paths through the shared warm-up-aware helper', () => {
    expect(hookSource).toContain('countCompletedRoutineExercises(');
    expect(sessionSource).toContain('countCompletedRoutineExercises(');
  });
});

import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('routine occurrence resume contract', () => {
  it('recovery dialog passes occurrence identity and rest to the exercise route', () => {
    const layout = read('app/_layout.tsx');

    expect(layout).toContain('routineExerciseId: recoverySession.routineExerciseId');
  });

  it('home resume banner passes occurrence identity and rest seconds', () => {
    const home = read('app/(tabs)/index.tsx');

    expect(home).toContain('routineExerciseId: incompleteSession.routineExerciseId');
    expect(home).toContain('restSeconds: incompleteSession.restSeconds?.toString()');
  });

  it('still persists occurrence identity in drafts and next navigation (locked, Sprint 12)', () => {
    const persistence = read('hooks/use-session-persistence.ts');
    const screen = read('app/session/exercise.tsx');
    const draft = read('src/utils/session-draft.ts');

    expect(persistence).toMatch(/routineExerciseId:\s*number/);
    expect(screen).toContain('routineExerciseId: nextExercise.routineExerciseId');
    expect(draft).toMatch(/routineExerciseId !== identity\.routineExerciseId/);
  });
});

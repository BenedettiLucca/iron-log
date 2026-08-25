import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const exerciseScreen = read('app/session/exercise.tsx');
const exerciseSetsHook = read('hooks/use-exercise-sets.ts');

describe('Sprint 5 pending-set recovery wiring', () => {
  it('protects back and gesture navigation until pending draft persistence succeeds', () => {
    expect(exerciseScreen).toContain("navigation.addListener('beforeRemove'");
    expect(exerciseScreen).toContain('hasPendingSessionDraft');
    expect(exerciseScreen).toContain('await saveSessionContext()');
    expect(exerciseScreen).toContain('navigation.dispatch(e.data.action)');
    expect(exerciseScreen).toMatch(
      /operationRef\.current !== 'idle'[\s\S]+e\.preventDefault\(\)/,
    );
  });

  it('keeps restored input from being overwritten by history prefill', () => {
    expect(exerciseSetsHook).toContain('restoreDraft');
    expect(exerciseSetsHook).toMatch(/data\.length === 0[^}]+!restoredDraftRef\.current/s);
  });

  it('does not apply late hydration after the user changes or saves the draft', () => {
    expect(exerciseScreen).toMatch(/hydrationGeneration[\s\S]+draftMutationGenerationRef\.current/);
  });

  it('blocks mutation and navigation while a set or navigation is being finalized', () => {
    expect(exerciseScreen).toContain("operationRef.current !== 'idle'");
    expect(exerciseScreen).toContain("operationRef.current = 'set-finalization'");
    expect(exerciseScreen).toContain("operationRef.current = 'session-mutation'");
    expect(exerciseScreen).toContain("operationRef.current = 'advance-navigation'");
    expect(exerciseScreen).toContain('hasPersistenceFailureRef');
  });

});

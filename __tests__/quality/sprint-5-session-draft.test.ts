import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

const exerciseScreen = read('app/session/exercise.tsx');
const exerciseSetsHook = read('hooks/use-exercise-sets.ts');


describe('Sprint 5 pending-set recovery wiring', () => {
  it('loads and applies a matching persisted draft on exercise mount', () => {
    expect(exerciseScreen).toContain('loadSessionContext');
    expect(exerciseScreen).toContain('resolveSessionDraft');
    expect(exerciseScreen).toContain('restoreDraft');
  });

  it('protects back and gesture navigation until pending draft persistence succeeds', () => {
    expect(exerciseScreen).toContain("navigation.addListener('beforeRemove'");
    expect(exerciseScreen).toContain('hasPendingSessionDraft');
    expect(exerciseScreen).toContain('await saveSessionContext()');
    expect(exerciseScreen).toContain('navigation.dispatch(e.data.action)');
    expect(exerciseScreen).toMatch(/e\.preventDefault\(\)[\s\S]+if \(isPersistingNavigationRef\.current\) return/);
  });

  it('keeps restored input from being overwritten by history prefill', () => {
    expect(exerciseSetsHook).toContain('restoreDraft');
    expect(exerciseSetsHook).toMatch(/data\.length === 0[^}]+!restoredDraftRef\.current/s);
  });

  it('does not apply late hydration after the user changes or saves the draft', () => {
    expect(exerciseScreen).toMatch(/hydrationGeneration[\s\S]+draftMutationGenerationRef\.current/);
  });

  it('blocks mutation and navigation while a set is being finalized', () => {
    expect(exerciseScreen).toContain('isFinalizingSetRef');
    expect(exerciseScreen).toContain('hasPersistenceFailureRef');
    expect(exerciseScreen).toMatch(/if \(isFinalizingSetRef\.current\)[\s\S]+e\.preventDefault\(\)/);
  });
});

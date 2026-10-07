import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('WIRING LANE — Issues #79 / #80 / #81 UI Wiring Contracts', () => {
  describe('Issue #80 — Freestyle Session Creation & Resume', () => {
    it('app/(tabs)/index.tsx offers "Treino livre" CTA and navigates with routineId="freestyle"', () => {
      const homeScreen = read('app/(tabs)/index.tsx');
      expect(homeScreen).toMatch(/home\.freestyleWorkout/);
      expect(homeScreen).toMatch(/home\.freestyleSubtitle/);
      expect(homeScreen).toMatch(/handleStartFreestyleWorkout/);
      expect(homeScreen).toMatch(/routineId:\s*['"]freestyle['"]/);
    });

    it('app/(tabs)/index.tsx handles resuming an incomplete session without routineId (freestyle)', () => {
      const homeScreen = read('app/(tabs)/index.tsx');
      expect(homeScreen).toMatch(/routineId(Str|Param)\s*=\s*incompleteSession\.routineId\s*\?\s*incompleteSession\.routineId\.toString\(\)\s*:\s*['"]freestyle['"]/);
    });

    it('app/session/[routineId].tsx delegates to FreestyleSessionService.startFreestyle when routineId="freestyle"', () => {
      const sessionScreen = read('app/session/[routineId].tsx');
      expect(sessionScreen).toMatch(/isFreestyle\s*=\s*rIdStr\s*===\s*['"]freestyle['"]/);
      expect(sessionScreen).toMatch(/FreestyleSessionService\.startFreestyle/);
    });
  });

  describe('Issue #79 — Superset Visual Grouping & Shared Rest', () => {
    it('app/session/[routineId].tsx loads queue via SessionOccurrenceService.getPendingQueue', () => {
      const sessionScreen = read('app/session/[routineId].tsx');
      expect(sessionScreen).toMatch(/SessionOccurrenceService\.getPendingQueue/);
    });

    it('app/session/[routineId].tsx ExerciseCard renders superset badge and visual grouping border', () => {
      const sessionScreen = read('app/session/[routineId].tsx');
      expect(sessionScreen).toMatch(/exercise\.supersetGroupId/);
      expect(sessionScreen).toMatch(/session\.superset/);
      expect(sessionScreen).toMatch(/border-l-4\s+border-l-secondary/);
    });

    it('components/session/ExerciseHeader.tsx renders superset badge and round rest indicator', () => {
      const header = read('components/session/ExerciseHeader.tsx');
      expect(header).toMatch(/isSuperset/);
      expect(header).toMatch(/isLastInGroup/);
      expect(header).toMatch(/session\.superset/);
    });

    it('hooks/use-exercise-sets.ts integrates useSharedRest and checks shouldTriggerRest', () => {
      const hookSource = read('hooks/use-exercise-sets.ts');
      expect(hookSource).toMatch(/useSharedRest/);
      expect(hookSource).toMatch(/consumePreservedRest/);
      expect(hookSource).toMatch(/sharedRest\.shouldTriggerRest/);
      expect(hookSource).toMatch(/isSuperset/);
      expect(hookSource).toMatch(/isLastInGroup/);
    });
  });

  describe('Issue #81 — Mid-session Add & Remove', () => {
    it('app/session/[routineId].tsx provides mid-session remove button with confirmation dialog', () => {
      const sessionScreen = read('app/session/[routineId].tsx');
      expect(sessionScreen).toMatch(/SessionOccurrenceService\.removeSessionExercise/);
      expect(sessionScreen).toMatch(/session\.removeExerciseConfirm/);
      expect(sessionScreen).toMatch(/exercise\.removeExerciseTitle/);
      expect(sessionScreen).toMatch(/onRemove/);
    });

    it('app/session/[routineId].tsx provides add exercise button and ExercisePickerModal', () => {
      const sessionScreen = read('app/session/[routineId].tsx');
      expect(sessionScreen).toMatch(/ExercisePickerModal/);
      expect(sessionScreen).toMatch(/session\.addExercise/);
      expect(sessionScreen).toMatch(/FreestyleSessionService\.addExerciseWithPrefill/);
      expect(sessionScreen).toMatch(/SessionOccurrenceService\.dissolveIfSingle/);
    });

    it('components/session/ExercisePickerModal.tsx implements search and exercise selection', () => {
      const picker = read('components/session/ExercisePickerModal.tsx');
      expect(picker).toMatch(/onSelectExercise/);
      expect(picker).toMatch(/session\.searchExercise/);
      expect(picker).toMatch(/FlatList/);
    });

    it('hooks/use-exercise-sets.ts prefills from FreestyleSessionService.getLastExecution', () => {
      const hookSource = read('hooks/use-exercise-sets.ts');
      expect(hookSource).toMatch(/FreestyleSessionService\.getLastExecution/);
    });
  });
});

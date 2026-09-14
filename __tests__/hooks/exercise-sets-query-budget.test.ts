import { renderHook, act } from '@testing-library/react-native';
import { eq, and, isNull } from 'drizzle-orm';
import { db, sqlite } from '../fixtures/database';
import { exercises, sessions, sets, routines, routineExercises } from '@/src/db/schema';
import { useExerciseSets } from '@/hooks/use-exercise-sets';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));
jest.mock('drizzle-orm/expo-sqlite', () => ({
  useLiveQuery: jest.fn(() => ({ data: [] })),
}));
jest.mock('@/services/NotificationService', () => ({
  scheduleRestNotification: jest.fn(),
  cancelRestNotification: jest.fn(),
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

describe('T23: Exercise Sets Query Budget & Structural Cache Invalidation', () => {
  let executedStatements: string[] = [];
  const originalPrepare = sqlite.prepare.bind(sqlite);

  beforeAll(() => {
    sqlite.prepare = jest.fn((sql: string) => {
      executedStatements.push(sql);
      return originalPrepare(sql);
    }) as any;
  });

  afterAll(() => {
    sqlite.prepare = originalPrepare as any;
  });

  beforeEach(() => {
    executedStatements = [];
    sqlite.exec(`
      DELETE FROM personal_records;
      DELETE FROM sets;
      DELETE FROM routine_exercises;
      DELETE FROM sessions;
      DELETE FROM routines;
      DELETE FROM exercises;
      DELETE FROM sqlite_sequence;
    `);

    // Seed baseline exercise and routine
    db.insert(exercises).values({ id: 1, name: 'Supino Reto', type: 'strength', defaultRestSeconds: 90 }).run();
    db.insert(exercises).values({ id: 2, name: 'Remada Curvada', type: 'strength', defaultRestSeconds: 90 }).run();
    db.insert(routines).values({ id: 10, name: 'Push Day' }).run();
    db.insert(routineExercises).values({ id: 101, routineId: 10, exerciseId: 1, orderIndex: 1, target: '3x10' }).run();
    db.insert(routineExercises).values({ id: 102, routineId: 10, exerciseId: 2, orderIndex: 2, target: '3x10' }).run();
    db.insert(sessions).values({ id: 50, routineId: 10, routineName: 'Push Day', startTime: 1000000 }).run();
  });

  const getQueriesMatching = (pattern: RegExp) => {
    return executedStatements.filter((sql) => pattern.test(sql));
  };

  const getStructuralQueries = () => {
    return getQueriesMatching(/\b(exercises|routine_exercises)\b/i);
  };

  describe('Query Budget on Hot Path (save, edit, delete)', () => {
    it('initial hydration reads exercises and routine_exercises', async () => {
      executedStatements = [];

      const { result } = renderHook(() => useExerciseSets({
        sessionId: 50,
        exerciseId: 1,
        routineExerciseId: 101,
        routineId: 10,
        exerciseName: 'Supino Reto',
        routineRest: 90,
      }));

      await act(async () => {
        await result.current.loadData();
      });

      const structuralQueries = getStructuralQueries();
      expect(structuralQueries.length).toBeGreaterThanOrEqual(2);
      expect(result.current.allExercises).toHaveLength(2);
      expect(result.current.nextExercise?.id).toBe(2);
    });

    it('saveSet does NOT re-read exercises or routine_exercises (budget: 0 structural queries)', async () => {
      const { result } = renderHook(() => useExerciseSets({
        sessionId: 50,
        exerciseId: 1,
        routineExerciseId: 101,
        routineId: 10,
        exerciseName: 'Supino Reto',
        routineRest: 90,
      }));

      await act(async () => {
        await result.current.loadData();
      });

      // Clear statements from initial hydration
      executedStatements = [];

      // Hot path: save set #1
      await act(async () => {
        result.current.setWeight('80');
        result.current.setReps('10');
      });

      let saveOk = false;
      await act(async () => {
        saveOk = await result.current.handleSaveSet(undefined, 'op-budget-save-1');
      });

      expect(saveOk).toBe(true);

      const structuralQueriesSave1 = getStructuralQueries();
      expect(structuralQueriesSave1).toEqual([]); // 0 structural queries!

      // Hot path: save set #2
      executedStatements = [];
      await act(async () => {
        result.current.setWeight('85');
        result.current.setReps('8');
      });

      await act(async () => {
        saveOk = await result.current.handleSaveSet(undefined, 'op-budget-save-2');
      });

      expect(saveOk).toBe(true);

      const structuralQueriesSave2 = getStructuralQueries();
      expect(structuralQueriesSave2).toEqual([]); // 0 structural queries!

      // Verify sets in state and in DB
      expect(result.current.sessionSets).toHaveLength(2);
      expect(result.current.sessionSets[0].weightKg).toBe(80);
      expect(result.current.sessionSets[1].weightKg).toBe(85);
    });

    it('editSet does NOT re-read exercises or routine_exercises (budget: 0 structural queries)', async () => {
      const { result } = renderHook(() => useExerciseSets({
        sessionId: 50,
        exerciseId: 1,
        routineExerciseId: 101,
        routineId: 10,
        exerciseName: 'Supino Reto',
        routineRest: 90,
      }));

      await act(async () => {
        await result.current.loadData();
      });

      // Save a set first
      await act(async () => {
        result.current.setWeight('80');
        result.current.setReps('10');
      });
      await act(async () => {
        await result.current.handleSaveSet(undefined, 'op-edit-test');
      });

      const savedSet = result.current.sessionSets[0];
      expect(savedSet).toBeDefined();

      // Open set editor
      await act(async () => {
        await result.current.handleEditSet(savedSet.id);
      });

      // Clear statements before save edited set
      executedStatements = [];

      let editOk = false;
      await act(async () => {
        editOk = await result.current.handleSaveEditedSet(82.5, 10);
      });

      expect(editOk).toBe(true);

      const structuralQueries = getStructuralQueries();
      expect(structuralQueries).toEqual([]); // 0 structural queries!

      // Verify edited set in state and in DB
      expect(result.current.sessionSets[0].weightKg).toBe(82.5);
      const dbSet = db.select().from(sets).where(eq(sets.id, savedSet.id)).all();
      expect(dbSet[0].weightKg).toBe(82.5);
      expect(dbSet[0].isEdited).toBe(true);
    });

    it('deleteSet does NOT re-read exercises or routine_exercises (budget: 0 structural queries)', async () => {
      const { result } = renderHook(() => useExerciseSets({
        sessionId: 50,
        exerciseId: 1,
        routineExerciseId: 101,
        routineId: 10,
        exerciseName: 'Supino Reto',
        routineRest: 90,
      }));

      await act(async () => {
        await result.current.loadData();
      });

      // Save 2 sets
      await act(async () => {
        result.current.setWeight('80');
        result.current.setReps('10');
      });
      await act(async () => {
        await result.current.handleSaveSet(undefined, 'op-del-1');
      });
      await act(async () => {
        result.current.setWeight('85');
        result.current.setReps('8');
      });
      await act(async () => {
        await result.current.handleSaveSet(undefined, 'op-del-2');
      });

      expect(result.current.sessionSets).toHaveLength(2);
      const toDelete = result.current.sessionSets[0];

      // Clear statements before delete
      executedStatements = [];

      await act(async () => {
        await result.current.handleDeleteSet(toDelete.id);
      });

      const structuralQueries = getStructuralQueries();
      expect(structuralQueries).toEqual([]); // 0 structural queries!

      // Verify remaining sets
      expect(result.current.sessionSets).toHaveLength(1);
      expect(result.current.sessionSets[0].id).not.toBe(toDelete.id);
    });
  });

  describe('A/B/A Occurrence Switching and Invalidation', () => {
    it('properly scopes sets and invalidates across A/B/A routine occurrences', async () => {
      // Add occurrence 3 of exercise 1 (Supino) after Remada
      db.insert(routineExercises).values({ id: 103, routineId: 10, exerciseId: 1, orderIndex: 3, target: '3x8' }).run();

      // Hook for occurrence 1 (re 101)
      const { result: occ1, rerender } = renderHook(
        (props: any) => useExerciseSets(props),
        {
          initialProps: {
            sessionId: 50,
            exerciseId: 1,
            routineExerciseId: 101,
            routineId: 10,
            exerciseName: 'Supino Reto',
            routineRest: 90,
          },
        }
      );

      await act(async () => {
        await occ1.current.loadData();
      });

      // Occurrence 1 nextExercise is Remada (re 102)
      expect(occ1.current.nextExercise?.routineExerciseId).toBe(102);

      // Save set in occurrence 1
      await act(async () => {
        occ1.current.setWeight('80');
        occ1.current.setReps('10');
      });
      await act(async () => {
        await occ1.current.handleSaveSet(undefined, 'occ1-set1');
      });

      expect(occ1.current.sessionSets).toHaveLength(1);
      expect(occ1.current.sessionSets[0].setNumber).toBe(1);

      // Switch occurrence to 103 (occurrence 2 of Supino Reto in A/B/A)
      rerender({
        sessionId: 50,
        exerciseId: 1,
        routineExerciseId: 103,
        routineId: 10,
        exerciseName: 'Supino Reto',
        routineRest: 90,
      });

      await act(async () => {
        await occ1.current.loadData();
      });

      // Occurrence 2 of Supino should have 0 sets logged so far
      expect(occ1.current.sessionSets).toHaveLength(0);
      // Occurrence 2 is the last exercise, so nextExercise should be null
      expect(occ1.current.nextExercise).toBeNull();

      // Save set in occurrence 2 -> setNumber must start at 1
      executedStatements = [];
      await act(async () => {
        occ1.current.setWeight('70');
        occ1.current.setReps('12');
      });
      await act(async () => {
        await occ1.current.handleSaveSet(undefined, 'occ2-set1');
      });

      expect(occ1.current.sessionSets).toHaveLength(1);
      expect(occ1.current.sessionSets[0].setNumber).toBe(1);
      expect(occ1.current.sessionSets[0].routineExerciseId).toBe(103);

      // Verify no structural queries during save in occurrence 2
      expect(getStructuralQueries()).toEqual([]);

      // Verify both occurrences have independent sets in DB
      const occ1Db = db.select().from(sets).where(and(eq(sets.sessionId, 50), eq(sets.routineExerciseId, 101), isNull(sets.deletedAt))).all();
      const occ2Db = db.select().from(sets).where(and(eq(sets.sessionId, 50), eq(sets.routineExerciseId, 103), isNull(sets.deletedAt))).all();

      expect(occ1Db).toHaveLength(1);
      expect(occ1Db[0].setNumber).toBe(1);
      expect(occ2Db).toHaveLength(1);
      expect(occ2Db[0].setNumber).toBe(1);
    });
  });

  describe('Benchmark: 3 trials query count comparison', () => {
    it('executes 3 trials of save/edit/delete verifying 0 structural queries per trial', async () => {
      const { result } = renderHook(() => useExerciseSets({
        sessionId: 50,
        exerciseId: 1,
        routineExerciseId: 101,
        routineId: 10,
        exerciseName: 'Supino Reto',
        routineRest: 90,
      }));

      await act(async () => {
        await result.current.loadData();
      });

      const trialStructuralQueryCounts: number[] = [];

      for (let trial = 1; trial <= 3; trial++) {
        executedStatements = [];

        // Save
        await act(async () => {
          result.current.setWeight(`${70 + trial * 5}`);
          result.current.setReps('8');
        });
        await act(async () => {
          await result.current.handleSaveSet(undefined, `trial-${trial}-save`);
        });

        // Edit
        const lastSet = result.current.sessionSets[result.current.sessionSets.length - 1];
        await act(async () => {
          await result.current.handleEditSet(lastSet.id);
          await result.current.handleSaveEditedSet(75 + trial * 5, 8);
        });

        // Delete
        await act(async () => {
          await result.current.handleDeleteSet(lastSet.id);
        });

        const trialStructural = getStructuralQueries();
        trialStructuralQueryCounts.push(trialStructural.length);
      }

      // All 3 trials must have exactly 0 structural queries
      expect(trialStructuralQueryCounts).toEqual([0, 0, 0]);
    });
  });
});

import { renderHook, act } from '@testing-library/react-native';
import { db, sqlite } from '../fixtures/database';
import { exercises, sessions, sets, routines, routineExercises } from '@/src/db/schema';
import { useSessionUndo } from '@/hooks/use-session-undo';

// Issue #150: the undo/restore path (hooks/use-session-undo.ts) has its own local
// refreshSessionSets and its own structural reads, separate from the hooks/use-exercise-sets.ts
// hot path budgeted by #130 (__tests__/hooks/exercise-sets-query-budget.test.ts). That test only
// exercises handleSaveSet/handleEditSet/handleDeleteSet; it never calls handleUndo or
// handleRestoreDeleted, so a regression here would go unnoticed.
jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

describe('Issue #150: Undo/Restore Structural Query Budget', () => {
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

    db.insert(exercises).values({ id: 1, name: 'Supino Reto', type: 'strength', defaultRestSeconds: 90 }).run();
    db.insert(routines).values({ id: 10, name: 'Push Day' }).run();
    db.insert(routineExercises).values({ id: 101, routineId: 10, exerciseId: 1, orderIndex: 1, target: '3x10' }).run();
    db.insert(sessions).values({ id: 50, routineId: 10, routineName: 'Push Day', startTime: 1000000 }).run();
    db.insert(sets).values({
      id: 500,
      sessionId: 50,
      exerciseId: 1,
      routineExerciseId: 101,
      setNumber: 1,
      weightKg: 80,
      reps: 10,
      createdAt: 1000100,
      operationId: 'op-undo-budget-1',
    }).run();
  });

  const getQueriesMatching = (pattern: RegExp) =>
    executedStatements.filter((sql) => pattern.test(sql));

  // "Structural" tables: the full exercise/routine catalog, as opposed to the hot `sets` rows
  // that change every undo/save. Re-reading these on every undo is the regression this test guards.
  const getStructuralQueries = () =>
    getQueriesMatching(/\b(exercises|routine_exercises)\b/i);

  // Budget: <=2 structural queries per undo call. The first undo of an occurrence reads
  // `exercises` once to restore `currentName` (behavior parity with the pre-#150 hook) plus
  // `routine_exercises` once to decide the null-`routineExerciseId` fallback when the scope has
  // no live sets. The per-(session, routineExerciseId) occurrence cache in
  // hooks/use-session-undo.ts refreshSessionSets makes a repeat undo of the same occurrence skip
  // the count lookup, so the second undo performs strictly fewer structural reads — asserted
  // directly by the cache tests below.
  const STRUCTURAL_QUERY_BUDGET = 2;

  it('handleUndo restores currentName from exercises and stays within budget', async () => {
    const { result } = renderHook(() => useSessionUndo());

    await act(async () => {
      result.current.setLastSavedSet({
        id: 500,
        sessionId: 50,
        exerciseId: 1,
        routineExerciseId: 101,
        setNumber: 1,
        weightKg: 80,
        reps: 10,
      } as any);
    });

    const setSessionSets = jest.fn();
    const setCurrentName = jest.fn();
    const setToast = jest.fn();

    executedStatements = [];

    await act(async () => {
      await result.current.handleUndo({
        exerciseId: 1,
        routineExerciseId: 101,
        routineId: 10,
        sessionId: 50,
        exerciseType: 'strength',
        setSessionSets,
        setCurrentName,
        setToast,
      });
    });

    const structuralQueries = getStructuralQueries();
    expect(structuralQueries.length).toBeLessThanOrEqual(STRUCTURAL_QUERY_BUDGET);

    // Behavior parity: undo restores the current exercise name, reading `exercises` exactly once.
    expect(getQueriesMatching(/\bexercises\b/i).filter((sql) => !/routine_exercises/i.test(sql))).toHaveLength(1);
    expect(setCurrentName).toHaveBeenCalledWith('Supino Reto');
  });

  it('handleRestoreDeleted stays within the structural query budget when scope is empty', async () => {
    // Soft-delete the only set so the scope's live sets list is empty, forcing refreshSessionSets
    // down the routine_exercises occurrence-count branch.
    sqlite.exec(`UPDATE sets SET deleted_at = ${Date.now()} WHERE id = 500`);

    const { result } = renderHook(() => useSessionUndo());

    await act(async () => {
      result.current.registerDeletedSet({
        id: 500,
        sessionId: 50,
        exerciseId: 1,
        routineExerciseId: 101,
        setNumber: 1,
        weightKg: 80,
        reps: 10,
      } as any);
    });

    const setSessionSets = jest.fn();
    const setToast = jest.fn();

    executedStatements = [];

    await act(async () => {
      await result.current.handleRestoreDeleted({
        exerciseId: 1,
        routineExerciseId: 101,
        routineId: 10,
        sessionId: 50,
        setSessionSets,
        setToast,
      });
    });

    const structuralQueries = getStructuralQueries();
    expect(structuralQueries.length).toBeLessThanOrEqual(STRUCTURAL_QUERY_BUDGET);
  });

  it('same undo twice: second undo performs strictly fewer structural reads (cache hit)', async () => {
    const { result } = renderHook(() => useSessionUndo());
    const setSessionSets = jest.fn();
    const setCurrentName = jest.fn();
    const setToast = jest.fn();

    const undoOnce = async (setId: number, setNumber: number) => {
      await act(async () => {
        result.current.setLastSavedSet({
          id: setId,
          sessionId: 50,
          exerciseId: 1,
          routineExerciseId: 101,
          setNumber,
          weightKg: 80,
          reps: 10,
        } as any);
      });

      executedStatements = [];
      await act(async () => {
        await result.current.handleUndo({
          exerciseId: 1,
          routineExerciseId: 101,
          routineId: 10,
          sessionId: 50,
          exerciseType: 'strength',
          setSessionSets,
          setCurrentName,
          setToast,
        });
      });

      return getStructuralQueries().length;
    };

    // First undo of the occurrence: scope empties (cache miss) -> exercises + routine_exercises.
    const firstCount = await undoOnce(500, 1);

    db.insert(sets).values({
      id: 600,
      sessionId: 50,
      exerciseId: 1,
      routineExerciseId: 101,
      setNumber: 2,
      weightKg: 80,
      reps: 10,
      createdAt: 1000200,
      operationId: 'op-undo-budget-2',
    }).run();

    // Second undo of the same occurrence: occurrence count must come from the cache, so only the
    // exercises read remains.
    const secondCount = await undoOnce(600, 2);

    expect(firstCount).toBe(2);
    expect(secondCount).toBe(1);
    expect(secondCount).toBeLessThan(firstCount);
  });

  it('changed state (new session, added occurrence): cache does not serve stale data', async () => {
    const { result } = renderHook(() => useSessionUndo());
    const setSessionSets = jest.fn();
    const setCurrentName = jest.fn();
    const setToast = jest.fn();

    // Session 50 with a single occurrence: undo populates the cache for (50, 101).
    await act(async () => {
      result.current.setLastSavedSet({
        id: 500,
        sessionId: 50,
        exerciseId: 1,
        routineExerciseId: 101,
        setNumber: 1,
        weightKg: 80,
        reps: 10,
      } as any);
    });

    executedStatements = [];
    await act(async () => {
      await result.current.handleUndo({
        exerciseId: 1,
        routineExerciseId: 101,
        routineId: 10,
        sessionId: 50,
        exerciseType: 'strength',
        setSessionSets,
        setCurrentName,
        setToast,
      });
    });

    // The routine now has TWO occurrences of exercise 1, and a second session reuses
    // occurrence 101. A stale "single occurrence" answer cached for session 50 must not be
    // served to session 51.
    db.insert(routineExercises).values({ id: 102, routineId: 10, exerciseId: 1, orderIndex: 2, target: '3x12' }).run();
    db.insert(sessions).values({ id: 51, routineId: 10, routineName: 'Push Day', startTime: 2000000 }).run();
    db.insert(sets).values({
      id: 501,
      sessionId: 51,
      exerciseId: 1,
      routineExerciseId: 101,
      setNumber: 1,
      weightKg: 60,
      reps: 12,
      createdAt: 2000100,
      operationId: 'op-undo-budget-51',
    }).run();
    // Legacy per-exercise set in the new session: would only be surfaced if a stale
    // "single occurrence" cache entry from session 50 leaked into session 51.
    db.insert(sets).values({
      id: 502,
      sessionId: 51,
      exerciseId: 1,
      routineExerciseId: null,
      setNumber: 2,
      weightKg: 60,
      reps: 12,
      createdAt: 2000200,
      operationId: 'op-undo-budget-52',
    }).run();

    await act(async () => {
      result.current.setLastSavedSet({
        id: 501,
        sessionId: 51,
        exerciseId: 1,
        routineExerciseId: 101,
        setNumber: 1,
        weightKg: 60,
        reps: 12,
      } as any);
    });

    executedStatements = [];
    await act(async () => {
      await result.current.handleUndo({
        exerciseId: 1,
        routineExerciseId: 101,
        routineId: 10,
        sessionId: 51,
        exerciseType: 'strength',
        setSessionSets,
        setCurrentName,
        setToast,
      });
    });

    // Cache is keyed by (sessionId, routineExerciseId): the occurrence count is re-read for
    // session 51 instead of serving the session-50 answer.
    expect(getQueriesMatching(/\broutine_exercises\b/i)).toHaveLength(1);

    // Two occurrences now -> no null-routineExerciseId fallback: the legacy per-exercise set must
    // NOT be surfaced as part of this scope.
    expect(setSessionSets).toHaveBeenLastCalledWith([]);
  });
});
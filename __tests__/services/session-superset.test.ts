/**
 * Issue #79: supersets (grouping + single rest) on top of #81.
 *
 * Contract invariants:
 *  - Groups belong to occurrences (routine_exercises.id), not global exercise IDs.
 *  - Plan-time grouping (routine_exercises) AND mid-session pairing (session_exercises).
 *  - Group back-to-back exercises to share ONE rest timer.
 *  - A group of one dissolves automatically; removing an exercise from a group
 *    leaves the rest intact for the remaining member.
 *  - Mid-session pairing preserves running rest timer once.
 *  - Logged sets are never deleted (history preserved).
 *  - Undo interaction with #81: restoreSessionExercise restores group membership too.
 *  - Crash-recovery snapshot / recovery keeps groups intact.
 */
import { renderHook, act } from '@testing-library/react-native';
import { and, eq, isNull } from 'drizzle-orm';
import { db, sqlite } from '../fixtures/database';
import { exercises, routines, routineExercises, sessions, sets, sessionExercises } from '@/src/db/schema';
import { useSessionPersistence } from '@/hooks/use-session-persistence';
import { useSharedRest } from '@/hooks/use-shared-rest';
import {
  createGroup,
  pairMidSession,
  dissolveIfSingle,
  removeFromGroup,
  getPendingQueue,
  removeSessionExercise,
  restoreSessionExercise,
  resolveRecoveryContext,
  resolveSharedRestSemantics,
  getPreservedRest,
  clearPreservedRest,
} from '@/services/SessionOccurrenceService';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

const mockStorage = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) => Promise.resolve(mockStorage.get(key) ?? null)),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      mockStorage.delete(key);
      return Promise.resolve();
    }),
  },
}));

jest.mock('react-native/Libraries/AppState/AppState', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));

const SESSION = 20;
const ROUTINE = 7;
const RE_A = 10;
const RE_B = 11;
const RE_C = 12;

function logSet(sessionId: number, routineExerciseId: number, exerciseId: number, setNumber: number) {
  db.insert(sets)
    .values({
      sessionId,
      exerciseId,
      routineExerciseId,
      setNumber,
      weightKg: 80,
      reps: 10,
      createdAt: 3000000 + setNumber,
    })
    .run();
}

const liveSetsOf = (sessionId: number, routineExerciseId: number) =>
  db
    .select()
    .from(sets)
    .where(
      and(
        eq(sets.sessionId, sessionId),
        eq(sets.routineExerciseId, routineExerciseId),
        isNull(sets.deletedAt)
      )
    )
    .all();

describe('Issue #79: supersets (grouping + shared rest)', () => {
  beforeEach(() => {
    mockStorage.clear();
    clearPreservedRest(SESSION);
    sqlite.exec(`
      DELETE FROM personal_records;
      DELETE FROM sets;
      DELETE FROM session_exercises;
      DELETE FROM sessions;
      DELETE FROM routine_exercises;
      DELETE FROM routines;
      DELETE FROM exercises;
      DELETE FROM sqlite_sequence;
    `);

    db.insert(exercises).values({ id: 1, name: 'Supino Reto', type: 'strength', defaultRestSeconds: 90 }).run();
    db.insert(exercises).values({ id: 2, name: 'Remada Curvada', type: 'strength', defaultRestSeconds: 90 }).run();
    db.insert(exercises).values({ id: 3, name: 'Elevação Lateral', type: 'strength', defaultRestSeconds: 60 }).run();
    db.insert(exercises).values({ id: 4, name: 'Rosca Direta', type: 'strength', defaultRestSeconds: 60 }).run();

    db.insert(routines).values({ id: ROUTINE, name: 'Treino Superset' }).run();
    db.insert(routineExercises)
      .values([
        { id: RE_A, routineId: ROUTINE, exerciseId: 1, orderIndex: 0, target: '3x10', restSeconds: 90 },
        { id: RE_B, routineId: ROUTINE, exerciseId: 2, orderIndex: 1, target: '3x10', restSeconds: 90 },
        { id: RE_C, routineId: ROUTINE, exerciseId: 3, orderIndex: 2, target: '3x12', restSeconds: 60 },
      ])
      .run();

    db.insert(sessions).values({ id: SESSION, routineId: ROUTINE, routineName: 'Treino Superset', startTime: 2000000 }).run();
  });

  describe('1. Plan-time grouping (routine template)', () => {
    it('creates a superset group for two occurrences in the routine template', async () => {
      const result = await createGroup([RE_A, RE_B], {}, db);

      expect(result.groupId).toBeDefined();
      expect(result.occurrenceIds).toEqual([RE_A, RE_B]);

      const reRows = db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, ROUTINE))
        .orderBy(routineExercises.orderIndex)
        .all();

      expect(reRows[0].supersetGroupId).toBe(result.groupId);
      expect(reRows[1].supersetGroupId).toBe(result.groupId);
      expect(reRows[2].supersetGroupId).toBeNull();

      const queue = await getPendingQueue(SESSION, db);
      expect(queue[0].supersetGroupId).toBe(result.groupId);
      expect(queue[1].supersetGroupId).toBe(result.groupId);
      expect(queue[2].supersetGroupId).toBeNull();
    });

    it('rejects creating a group with fewer than 2 occurrences', async () => {
      await expect(createGroup([RE_A], {}, db)).rejects.toThrow(
        'A superset group requires at least 2 exercise occurrences'
      );
    });
  });

  describe('2. Mid-session pairing (pairMidSession)', () => {
    it('pairs an existing occurrence with a new exercise mid-session without mutating template', async () => {
      const pairResult = await pairMidSession(
        {
          sessionId: SESSION,
          existingOccurrenceId: RE_A,
          newExercise: 4, // Rosca Direta
        },
        db
      );

      expect(pairResult.groupId).toBeDefined();
      expect(pairResult.existingOccurrenceId).toBe(RE_A);
      expect(pairResult.pairedOccurrenceId).toBeGreaterThan(0);
      expect(pairResult.exerciseId).toBe(4);
      expect(pairResult.position).toBe(1);

      // Template must be untouched (shared across sessions)
      const templateRows = db
        .select()
        .from(routineExercises)
        .where(eq(routineExercises.routineId, ROUTINE))
        .all();
      expect(templateRows).toHaveLength(3);

      // Session exercises queue now contains the paired exercise back-to-back
      const queue = await getPendingQueue(SESSION, db);
      expect(queue).toHaveLength(4);
      expect(queue[0].routineExerciseId).toBe(RE_A);
      expect(queue[0].supersetGroupId).toBe(pairResult.groupId);
      expect(queue[1].routineExerciseId).toBe(pairResult.pairedOccurrenceId);
      expect(queue[1].supersetGroupId).toBe(pairResult.groupId);
      expect(queue[1].exerciseId).toBe(4);
    });

    it('pairs two existing occurrences in the session mid-session', async () => {
      const pairResult = await pairMidSession(
        {
          sessionId: SESSION,
          existingOccurrenceId: RE_A,
          newExercise: RE_B,
        },
        db
      );

      expect(pairResult.groupId).toBeDefined();
      expect(pairResult.existingOccurrenceId).toBe(RE_A);
      expect(pairResult.pairedOccurrenceId).toBe(RE_B);

      const queue = await getPendingQueue(SESSION, db);
      expect(queue[0].supersetGroupId).toBe(pairResult.groupId);
      expect(queue[1].supersetGroupId).toBe(pairResult.groupId);
      expect(queue[2].supersetGroupId).toBeNull();
    });

    it('preserves running rest timer once when pairing mid-session', async () => {
      const targetTime = Date.now() + 75000;
      const runningTimer = {
        timerStatus: 'running' as const,
        timerTarget: targetTime,
        timerSeconds: 75,
      };

      const pairResult = await pairMidSession(
        {
          sessionId: SESSION,
          existingOccurrenceId: RE_A,
          newExercise: 4,
          timerState: runningTimer,
        },
        db
      );

      // Preserved rest is captured on the result
      expect(pairResult.preservedRest).toEqual(runningTimer);
      expect(pairResult.timerState).toEqual(runningTimer);
      expect(getPreservedRest(SESSION)).toEqual(runningTimer);

      // Assert via useSharedRest hook
      let targetSet: number | null = null;
      let statusSet: string | null = null;

      const { result } = renderHook(() =>
        useSharedRest({
          sessionId: SESSION,
          routineExerciseId: RE_A,
          timerStatus: 'running',
          timerTarget: targetTime,
          setTimerTarget: (t) => {
            targetSet = t;
          },
          setTimerStatus: (s) => {
            statusSet = s;
          },
          customDb: db,
        })
      );

      expect(result.current.preservedRest).toEqual(runningTimer);

      // Consuming preserved rest applies it and clears it once
      act(() => {
        const consumed = result.current.consumePreservedRest();
        expect(consumed).toEqual(runningTimer);
      });

      expect(targetSet).toBe(targetTime);
      expect(statusSet).toBe('running');
      expect(result.current.preservedRest).toBeNull();
      expect(getPreservedRest(SESSION)).toBeNull();
    });
  });

  describe('3. Shared-rest semantics hook (useSharedRest)', () => {
    it('skips rest timer on first exercise in superset, triggers rest timer on last exercise', async () => {
      const { groupId } = await createGroup([RE_A, RE_B], {}, db);

      const semA = await resolveSharedRestSemantics(
        { sessionId: SESSION, routineExerciseId: RE_A },
        db
      );
      expect(semA.isSuperset).toBe(true);
      expect(semA.groupId).toBe(groupId);
      expect(semA.isLastInGroup).toBe(false);
      expect(semA.shouldTriggerRest).toBe(false); // First exercise does NOT trigger rest

      const semB = await resolveSharedRestSemantics(
        { sessionId: SESSION, routineExerciseId: RE_B },
        db
      );
      expect(semB.isSuperset).toBe(true);
      expect(semB.groupId).toBe(groupId);
      expect(semB.isLastInGroup).toBe(true);
      expect(semB.shouldTriggerRest).toBe(true); // Last exercise DOES trigger shared rest

      const semC = await resolveSharedRestSemantics(
        { sessionId: SESSION, routineExerciseId: RE_C },
        db
      );
      expect(semC.isSuperset).toBe(false);
      expect(semC.shouldTriggerRest).toBe(true); // Non-superset exercise triggers normal rest
    });
  });

  describe('4. Automatic dissolution and dissolveIfSingle', () => {
    it('automatically dissolves group when only one member remains, leaving rest intact', async () => {
      await createGroup([RE_A, RE_B], {}, db);

      // Remove RE_B from session via #81 service
      await removeSessionExercise({ sessionId: SESSION, routineExerciseId: RE_B }, db);

      // Pending queue now has RE_A alone: group dissolved automatically
      const queue = await getPendingQueue(SESSION, db);
      expect(queue.find((q) => q.routineExerciseId === RE_A)?.supersetGroupId).toBeNull();

      // Semantics for RE_A: rest is intact for the remaining member
      const semA = await resolveSharedRestSemantics(
        { sessionId: SESSION, routineExerciseId: RE_A },
        db
      );
      expect(semA.isSuperset).toBe(false);
      expect(semA.shouldTriggerRest).toBe(true);
    });

    it('dissolveIfSingle explicitly dissolves single-member groups', async () => {
      const { groupId } = await createGroup([RE_A, RE_B], {}, db);

      // Before removal, group of 2 does not dissolve
      const checkBefore = await dissolveIfSingle({ sessionId: SESSION, groupId }, db);
      expect(checkBefore.dissolved).toBe(false);

      // Remove one member
      await removeSessionExercise({ sessionId: SESSION, routineExerciseId: RE_B }, db);

      // Now dissolveIfSingle dissolves it
      const checkAfter = await dissolveIfSingle({ sessionId: SESSION, groupId }, db);
      expect(checkAfter.dissolved).toBe(true);
      expect(checkAfter.dissolvedOccurrenceIds).toContain(RE_A);
    });

    it('removeFromGroup removes one occurrence and dissolves remaining group of 1', async () => {
      const { groupId } = await createGroup([RE_A, RE_B], {}, db);

      // Materialize session
      await removeSessionExercise({ sessionId: SESSION, routineExerciseId: RE_C }, db);

      const result = await removeFromGroup(
        { sessionId: SESSION, routineExerciseId: RE_A },
        db
      );

      expect(result.removedOccurrenceId).toBe(RE_A);
      expect(result.dissolvedGroupId).toBe(groupId);

      const queue = await getPendingQueue(SESSION, db);
      expect(queue.every((q) => q.supersetGroupId === null)).toBe(true);
    });
  });

  describe('5. Interaction with #81 (Undo & Sets Preservation)', () => {
    it('removing an exercise from a group preserves logged sets', async () => {
      await createGroup([RE_A, RE_B], {}, db);
      logSet(SESSION, RE_A, 1, 1);
      logSet(SESSION, RE_B, 2, 1);

      const removeResult = await removeSessionExercise(
        { sessionId: SESSION, routineExerciseId: RE_B },
        db
      );

      expect(removeResult.keptSetCount).toBe(1);
      const kept = liveSetsOf(SESSION, RE_B);
      expect(kept).toHaveLength(1);
      expect(kept[0].deletedAt).toBeNull();

      // Remaining member RE_A has its sets intact
      expect(liveSetsOf(SESSION, RE_A)).toHaveLength(1);
    });

    it('undo restores queue membership AND restores superset group membership', async () => {
      const { groupId } = await createGroup([RE_A, RE_B], {}, db);

      await removeSessionExercise({ sessionId: SESSION, routineExerciseId: RE_B }, db);

      let queue = await getPendingQueue(SESSION, db);
      expect(queue.find((q) => q.routineExerciseId === RE_A)?.supersetGroupId).toBeNull();

      // Undo removal of RE_B
      await restoreSessionExercise({ sessionId: SESSION, routineExerciseId: RE_B }, db);

      // Queue membership and original position restored
      queue = await getPendingQueue(SESSION, db);
      expect(queue.map((q) => q.routineExerciseId)).toEqual([RE_A, RE_B, RE_C]);

      // Both occurrences are back in the superset group together!
      expect(queue[0].supersetGroupId).toBe(groupId);
      expect(queue[1].supersetGroupId).toBe(groupId);
    });
  });

  describe('6. Crash-recovery snapshot / recovery keeps groups', () => {
    const baseOpts = {
      sessionId: SESSION,
      exerciseId: 1,
      routineExerciseId: RE_A,
      routineId: ROUTINE,
      exerciseName: 'Supino Reto',
      currentName: 'Supino Reto',
      exerciseType: 'strength',
      weight: '80',
      reps: '10',
      duration: '',
      rir: 1,
      isWarmupMode: false,
      isDirty: true,
      activeSetTime: 0,
      isActiveSetRunning: false,
      activeSetStartedAt: null,
      startTime: 2000000,
    };

    it('persists and restores snapshot with supersetGroupId', async () => {
      const { groupId } = await createGroup([RE_A, RE_B], {}, db);

      const { result } = renderHook(() =>
        useSessionPersistence({
          ...baseOpts,
          supersetGroupId: groupId,
        })
      );

      await act(async () => {
        await result.current.saveSessionContext();
      });

      const loaded = await result.current.loadSessionContext();
      expect(loaded).not.toBeNull();
      expect(loaded?.supersetGroupId).toBe(groupId);

      const resolution = await resolveRecoveryContext(
        loaded as unknown as Record<string, unknown>,
        db
      );

      expect(resolution.action).toBe('resume');
      expect(resolution.context?.supersetGroupId).toBe(groupId);
      expect(resolution.context?.routineExerciseId).toBe(RE_A);
    });

    it('advancing snapshot after removal resolves to next pending member preserving its group', async () => {
      const { groupId } = await createGroup([RE_A, RE_B], {}, db);

      const { result } = renderHook(() =>
        useSessionPersistence({
          ...baseOpts,
          supersetGroupId: groupId,
        })
      );

      await act(async () => {
        await result.current.saveSessionContext();
      });

      const loaded = await result.current.loadSessionContext();

      // Remove RE_A
      await removeSessionExercise({ sessionId: SESSION, routineExerciseId: RE_A }, db);

      const resolution = await resolveRecoveryContext(
        loaded as unknown as Record<string, unknown>,
        db
      );

      expect(resolution.action).toBe('advance');
      expect(resolution.context?.routineExerciseId).toBe(RE_B);
    });
  });
});

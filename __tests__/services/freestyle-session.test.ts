/**
 * Issue #80: Freestyle session with last-execution prefill.
 *
 * Contract & behavior tests:
 *  - Freestyle session: session started without a routine template (routineId IS NULL).
 *  - Exercises added on the fly to the session with #81 occurrence semantics.
 *  - Every added exercise prefills weight/reps/sets from the athlete's LAST execution
 *    of that exercise from real tables (sets joined sessions, non-deleted, most recent
 *    by started_at/created; tie-break documented).
 *  - Empty state (exercise never performed): sensible blank with hasHistory = false.
 *  - Add-remove-add cycle: removal then re-add prefills from LAST EXECUTION, NOT from
 *    the just-removed in-session state.
 *  - Snapshot / restore roundtrip: AsyncStorage persistence & crash-recovery resolution.
 */
import { renderHook, act } from '@testing-library/react-native';
import { and, eq, isNull } from 'drizzle-orm';
import { db, sqlite } from '../fixtures/database';
import { exercises, sessions, sets, sessionExercises } from '@/src/db/schema';
import { useSessionPersistence } from '@/hooks/use-session-persistence';
import {
  startFreestyle,
  addExerciseWithPrefill,
  getLastExecution,
  removeSessionExercise,
  restoreSessionExercise,
  getPendingQueue,
  resolveRecoveryContext,
} from '@/services/FreestyleSessionService';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

// In-memory AsyncStorage mock so snapshot save -> load is a real roundtrip
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
    clear: jest.fn(() => {
      mockStorage.clear();
      return Promise.resolve();
    }),
  },
}));

jest.mock('react-native/Libraries/AppState/AppState', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
}));

// Test exercise IDs
const EX_BENCH = 1;
const EX_ROW = 2;
const EX_SQUAT = 3;
const EX_UNPERFORMED = 4;

function logHistoricalSet(
  sessionId: number,
  exerciseId: number,
  setNumber: number,
  weightKg: number,
  reps: number,
  options?: {
    createdAt?: number;
    deletedAt?: number | null;
    rir?: number;
    isWarmup?: boolean;
    durationSeconds?: number;
  }
) {
  db.insert(sets)
    .values({
      sessionId,
      exerciseId,
      routineExerciseId: null,
      setNumber,
      weightKg,
      reps,
      rir: options?.rir ?? 2,
      isWarmup: options?.isWarmup ?? false,
      durationSeconds: options?.durationSeconds ?? null,
      createdAt: options?.createdAt ?? Date.now(),
      deletedAt: options?.deletedAt ?? null,
    })
    .run();
}

function getLiveSetsOf(sessionId: number, exerciseId: number) {
  return db
    .select()
    .from(sets)
    .where(
      and(
        eq(sets.sessionId, sessionId),
        eq(sets.exerciseId, exerciseId),
        isNull(sets.deletedAt)
      )
    )
    .all();
}

describe('Issue #80: Freestyle session with last-execution prefill', () => {
  beforeEach(() => {
    mockStorage.clear();
    sqlite.exec(`
      DELETE FROM personal_records;
      DELETE FROM session_exercises;
      DELETE FROM sets;
      DELETE FROM sessions;
      DELETE FROM routine_exercises;
      DELETE FROM routines;
      DELETE FROM exercises;
      DELETE FROM sqlite_sequence;
    `);

    db.insert(exercises).values([
      { id: EX_BENCH, name: 'Supino Reto', type: 'strength' },
      { id: EX_ROW, name: 'Remada Curvada', type: 'strength' },
      { id: EX_SQUAT, name: 'Agachamento', type: 'strength' },
      { id: EX_UNPERFORMED, name: 'Elevação Lateral', type: 'strength' },
    ]).run();
  });

  describe('startFreestyle', () => {
    it('starts a session without a routine template (routineId IS NULL)', async () => {
      const result = await startFreestyle(undefined, db);

      expect(result.id).toBeDefined();
      expect(result.sessionId).toBe(result.id);
      expect(result.routineId).toBeNull();
      expect(result.routineName).toBeNull();
      expect(result.endTime).toBeNull();

      // Verify in SQLite database
      const row = db
        .select()
        .from(sessions)
        .where(eq(sessions.id, result.id))
        .get();

      expect(row).toBeDefined();
      expect(row!.routineId).toBeNull();
      expect(row!.routineName).toBeNull();
      expect(row!.endTime).toBeNull();
      expect(row!.deletedAt).toBeNull();
    });

    it('allows custom options such as custom routineName label, bodyWeight, and notes', async () => {
      const result = await startFreestyle(
        {
          routineName: 'Treino Livre',
          bodyWeight: 82.5,
          notes: 'Foco em peito hoje',
          startTime: 1700000000,
        },
        db
      );

      expect(result.routineName).toBe('Treino Livre');
      expect(result.bodyWeight).toBe(82.5);
      expect(result.notes).toBe('Foco em peito hoje');
      expect(result.startTime).toBe(1700000000);
      expect(result.routineId).toBeNull();
    });
  });

  describe('prefill correctness (last execution resolution)', () => {
    it('last execution wins; old executions are ignored', async () => {
      // Historical session 1 (older, startTime 1000000): 40kg x 12
      const s1 = 101;
      db.insert(sessions).values({ id: s1, startTime: 1000000 }).run();
      logHistoricalSet(s1, EX_BENCH, 1, 40, 12);
      logHistoricalSet(s1, EX_BENCH, 2, 40, 12);

      // Historical session 2 (more recent, startTime 2000000): 60kg x 10, 60kg x 8, 65kg x 6
      const s2 = 102;
      db.insert(sessions).values({ id: s2, startTime: 2000000 }).run();
      logHistoricalSet(s2, EX_BENCH, 1, 60, 10, { rir: 2 });
      logHistoricalSet(s2, EX_BENCH, 2, 60, 8, { rir: 1 });
      logHistoricalSet(s2, EX_BENCH, 3, 65, 6, { rir: 0 });

      // Active freestyle session (startTime 3000000)
      const current = await startFreestyle({ startTime: 3000000 }, db);

      const added = await addExerciseWithPrefill(current.id, EX_BENCH, undefined, db);

      // Asserts last execution (s2) wins
      expect(added.prefill.hasHistory).toBe(true);
      expect(added.prefill.lastSessionId).toBe(s2);
      expect(added.prefill.lastSessionDate).toBe(2000000);
      expect(added.prefill.weight).toBe('60');
      expect(added.prefill.reps).toBe('10');
      expect(added.prefill.setCount).toBe(3);
      expect(added.prefill.sets).toEqual([
        expect.objectContaining({ setNumber: 1, weightKg: 60, reps: 10, rir: 2 }),
        expect.objectContaining({ setNumber: 2, weightKg: 60, reps: 8, rir: 1 }),
        expect.objectContaining({ setNumber: 3, weightKg: 65, reps: 6, rir: 0 }),
      ]);

      // Top-level convenience getters match prefill
      expect(added.weight).toBe('60');
      expect(added.reps).toBe('10');
      expect(added.sets).toHaveLength(3);
      expect(added.hasHistory).toBe(true);

      // Check session_exercises occurrence table
      const queue = await getPendingQueue(current.id, db);
      expect(queue).toHaveLength(1);
      expect(queue[0].exerciseId).toBe(EX_BENCH);
      expect(queue[0].position).toBe(0);
      expect(queue[0].routineExerciseId).toBeNull();
    });

    it('soft-deleted sessions are excluded from last-execution resolution', async () => {
      // Session 1 (valid, older): 50kg x 10
      const s1 = 101;
      db.insert(sessions).values({ id: s1, startTime: 1000000 }).run();
      logHistoricalSet(s1, EX_BENCH, 1, 50, 10);

      // Session 2 (newer, BUT soft-deleted): 100kg x 5
      const s2 = 102;
      db.insert(sessions).values({ id: s2, startTime: 2000000, deletedAt: 2500000 }).run();
      logHistoricalSet(s2, EX_BENCH, 1, 100, 5);

      const current = await startFreestyle({ startTime: 3000000 }, db);
      const added = await addExerciseWithPrefill(current.id, EX_BENCH, undefined, db);

      // Deleted s2 is excluded; s1 is the resolved last execution
      expect(added.prefill.hasHistory).toBe(true);
      expect(added.prefill.lastSessionId).toBe(s1);
      expect(added.prefill.weight).toBe('50');
      expect(added.prefill.reps).toBe('10');
    });

    it('soft-deleted sets are excluded from last-execution resolution', async () => {
      // Session 1 (valid, older): 50kg x 10
      const s1 = 101;
      db.insert(sessions).values({ id: s1, startTime: 1000000 }).run();
      logHistoricalSet(s1, EX_BENCH, 1, 50, 10);

      // Session 2 (newer): Set 1 is soft-deleted (90kg), Set 2 is live (70kg x 8)
      const s2 = 102;
      db.insert(sessions).values({ id: s2, startTime: 2000000 }).run();
      logHistoricalSet(s2, EX_BENCH, 1, 90, 5, { deletedAt: 2100000 });
      logHistoricalSet(s2, EX_BENCH, 2, 70, 8);

      const current = await startFreestyle({ startTime: 3000000 }, db);
      const added = await addExerciseWithPrefill(current.id, EX_BENCH, undefined, db);

      // Only live set in s2 is prefilled
      expect(added.prefill.hasHistory).toBe(true);
      expect(added.prefill.lastSessionId).toBe(s2);
      expect(added.prefill.weight).toBe('70');
      expect(added.prefill.reps).toBe('8');
      expect(added.prefill.setCount).toBe(1);
    });

    it('tie-break: resolves chronologically by set creation and session id when session start timestamps match', async () => {
      // Two sessions with identical startTime:
      // S1 (id: 101, created: 1000100): 50kg x 10
      // S2 (id: 102, created: 1000200): 55kg x 10
      const s1 = 101;
      const s2 = 102;
      db.insert(sessions).values({ id: s1, startTime: 1000000 }).run();
      logHistoricalSet(s1, EX_BENCH, 1, 50, 10, { createdAt: 1000100 });

      db.insert(sessions).values({ id: s2, startTime: 1000000 }).run();
      logHistoricalSet(s2, EX_BENCH, 1, 55, 10, { createdAt: 1000200 });

      const current = await startFreestyle({ startTime: 2000000 }, db);
      const added = await addExerciseWithPrefill(current.id, EX_BENCH, undefined, db);

      expect(added.prefill.lastSessionId).toBe(s2);
      expect(added.prefill.weight).toBe('55');
    });
  });

  describe('no-history blank (empty state)', () => {
    it('returns a sensible blank when exercise has never been performed', async () => {
      const current = await startFreestyle(undefined, db);

      const added = await addExerciseWithPrefill(current.id, EX_UNPERFORMED, undefined, db);

      expect(added.prefill.hasHistory).toBe(false);
      expect(added.prefill.lastSessionId).toBeNull();
      expect(added.prefill.lastSessionDate).toBeNull();
      expect(added.prefill.weight).toBe('');
      expect(added.prefill.reps).toBe('');
      expect(added.prefill.rir).toBe(0);
      expect(added.prefill.durationSeconds).toBeNull();
      expect(added.prefill.setCount).toBe(0);
      expect(added.prefill.sets).toEqual([]);

      // Top-level convenience getters are also blank
      expect(added.weight).toBe('');
      expect(added.reps).toBe('');
      expect(added.sets).toEqual([]);
      expect(added.hasHistory).toBe(false);

      // Occurrence was still created in session_exercises queue
      const queue = await getPendingQueue(current.id, db);
      expect(queue).toHaveLength(1);
      expect(queue[0].exerciseId).toBe(EX_UNPERFORMED);
      expect(queue[0].position).toBe(0);
      expect(queue[0].routineExerciseId).toBeNull();
    });

    it('getLastExecution directly returns empty state for unperformed exercise', async () => {
      const prefill = await getLastExecution(EX_UNPERFORMED, { customDb: db });

      expect(prefill).toEqual({
        hasHistory: false,
        lastSessionId: null,
        lastSessionDate: null,
        weight: '',
        reps: '',
        rir: 0,
        durationSeconds: null,
        setCount: 0,
        sets: [],
        firstSet: null,
        lastSet: null,
      });
    });
  });

  describe('add-remove-add cycle', () => {
    it('removal then re-add prefills from LAST EXECUTION, not from the just-removed in-session state', async () => {
      // Previous session S1 (athlete benchmark: 50kg x 10)
      const s1 = 101;
      db.insert(sessions).values({ id: s1, startTime: 1000000 }).run();
      logHistoricalSet(s1, EX_BENCH, 1, 50, 10);
      logHistoricalSet(s1, EX_BENCH, 2, 50, 10);

      // Active freestyle session S2
      const current = await startFreestyle({ startTime: 2000000 }, db);

      // 1. Add exercise: initial prefill comes from S1 (50kg)
      const add1 = await addExerciseWithPrefill(current.id, EX_BENCH, undefined, db);
      expect(add1.prefill.weight).toBe('50');
      expect(add1.prefill.reps).toBe('10');
      expect(add1.position).toBe(0);

      // 2. Athlete logs a set during the session (e.g. 75kg x 5)
      logHistoricalSet(current.id, EX_BENCH, 1, 75, 5);
      expect(getLiveSetsOf(current.id, EX_BENCH)).toHaveLength(1);

      // 3. Athlete removes the exercise from the session
      const removeRes = await removeSessionExercise(
        { sessionId: current.id, sessionExerciseId: add1.sessionExerciseId },
        db
      );

      // Contract #81: Logged sets in the session are strictly kept (history preserved)
      expect(removeRes.keptSetCount).toBe(1);
      expect(getLiveSetsOf(current.id, EX_BENCH)).toHaveLength(1);

      // Queue is now empty
      const queueAfterRemoval = await getPendingQueue(current.id, db);
      expect(queueAfterRemoval).toHaveLength(0);

      // 4. Athlete re-adds the exercise to the SAME session
      const add2 = await addExerciseWithPrefill(current.id, EX_BENCH, undefined, db);

      // Crucial assertion: Prefill MUST resolve to LAST EXECUTION (S1: 50kg),
      // NOT from the in-session state that was just removed (75kg)!
      expect(add2.prefill.lastSessionId).toBe(s1);
      expect(add2.prefill.weight).toBe('50');
      expect(add2.prefill.reps).toBe('10');
      expect(add2.prefill.setCount).toBe(2);

      // Queue now has the newly added occurrence
      const queueAfterReAdd = await getPendingQueue(current.id, db);
      expect(queueAfterReAdd).toHaveLength(1);
      expect(queueAfterReAdd[0].sessionExerciseId).toBe(add2.sessionExerciseId);
      expect(queueAfterReAdd[0].position).toBe(1);
    });
  });

  describe('crash-recovery snapshot & restore roundtrip', () => {
    it('snapshot of a freestyle session roundtrips with null routine', async () => {
      const current = await startFreestyle({ startTime: 1000000 }, db);
      const added = await addExerciseWithPrefill(current.id, EX_BENCH, undefined, db);

      const baseOpts = {
        sessionId: current.id,
        exerciseId: EX_BENCH,
        routineExerciseId: null,
        routineId: null,
        exerciseName: 'Supino Reto',
        currentName: 'Supino Reto',
        exerciseType: 'strength',
        weight: '60',
        reps: '10',
        duration: '',
        rir: 2,
        isWarmupMode: false,
        isDirty: true,
        activeSetTime: 0,
        isActiveSetRunning: false,
        activeSetStartedAt: null,
        startTime: 1000000,
      };

      const { result } = renderHook(() => useSessionPersistence(baseOpts));
      await act(async () => {
        await result.current.saveSessionContext();
      });

      const loaded = await result.current.loadSessionContext();
      expect(loaded).not.toBeNull();
      expect(loaded!.sessionId).toBe(current.id);
      expect(loaded!.routineId).toBeNull();
      expect(loaded!.routineExerciseId).toBeNull();
      expect(loaded!.weight).toBe('60');
      expect(loaded!.reps).toBe('10');
      expect(loaded!.isDirty).toBe(true);

      // Recovery resolution on live pending occurrence resumes unchanged
      const resolution = await resolveRecoveryContext(
        { ...loaded!, sessionExerciseId: added.sessionExerciseId },
        db
      );

      expect(resolution.action).toBe('resume');
      expect(resolution.context).toMatchObject({
        sessionId: current.id,
        routineId: null,
        routineExerciseId: null,
        weight: '60',
        reps: '10',
        isDirty: true,
      });
    });

    it('snapshot of a removed occurrence advances to next pending freestyle exercise', async () => {
      const current = await startFreestyle({ startTime: 1000000 }, db);
      const ex1 = await addExerciseWithPrefill(current.id, EX_BENCH, undefined, db);
      const ex2 = await addExerciseWithPrefill(current.id, EX_ROW, undefined, db);

      const snapshot = {
        sessionId: current.id,
        exerciseId: EX_BENCH,
        sessionExerciseId: ex1.sessionExerciseId,
        routineExerciseId: null,
        routineId: null,
        exerciseName: 'Supino Reto',
        exerciseType: 'strength',
        weight: '60',
        reps: '10',
        isDirty: true,
      };

      // Remove ex1
      await removeSessionExercise(
        { sessionId: current.id, sessionExerciseId: ex1.sessionExerciseId },
        db
      );

      // Resolve recovery: advances to ex2 and drops stale draft
      const resolution = await resolveRecoveryContext(snapshot, db);

      expect(resolution.action).toBe('advance');
      expect(resolution.context).toMatchObject({
        exerciseId: EX_ROW,
        exerciseName: 'Remada Curvada',
        routineExerciseId: null,
        sessionExerciseId: ex2.sessionExerciseId,
        weight: '',
        reps: '',
        isDirty: false,
      });
    });

    it('snapshot of a removed occurrence with nothing pending resolves to finish', async () => {
      const current = await startFreestyle({ startTime: 1000000 }, db);
      const ex1 = await addExerciseWithPrefill(current.id, EX_BENCH, undefined, db);

      const snapshot = {
        sessionId: current.id,
        exerciseId: EX_BENCH,
        sessionExerciseId: ex1.sessionExerciseId,
        routineExerciseId: null,
        routineId: null,
      };

      await removeSessionExercise(
        { sessionId: current.id, sessionExerciseId: ex1.sessionExerciseId },
        db
      );

      const resolution = await resolveRecoveryContext(snapshot, db);
      expect(resolution.action).toBe('finish');
      expect(resolution.context).toBeNull();
    });

    it('restoring removed occurrence before recovery makes snapshot resume again', async () => {
      const current = await startFreestyle({ startTime: 1000000 }, db);
      const ex1 = await addExerciseWithPrefill(current.id, EX_BENCH, undefined, db);

      const snapshot = {
        sessionId: current.id,
        exerciseId: EX_BENCH,
        sessionExerciseId: ex1.sessionExerciseId,
        routineExerciseId: null,
        routineId: null,
        weight: '70',
        reps: '8',
        isDirty: true,
      };

      await removeSessionExercise(
        { sessionId: current.id, sessionExerciseId: ex1.sessionExerciseId },
        db
      );
      await restoreSessionExercise(
        { sessionId: current.id, sessionExerciseId: ex1.sessionExerciseId },
        db
      );

      const resolution = await resolveRecoveryContext(snapshot, db);
      expect(resolution.action).toBe('resume');
      expect(resolution.context).toMatchObject({
        exerciseId: EX_BENCH,
        weight: '70',
        reps: '8',
      });
    });
  });

  describe('validation and error guards', () => {
    it('rejects adding an exercise to a non-existent session', async () => {
      await expect(
        addExerciseWithPrefill(9999, EX_BENCH, undefined, db)
      ).rejects.toThrow('Session 9999 not found');
    });

    it('rejects adding an exercise to an already finished session', async () => {
      const session = await startFreestyle(undefined, db);
      db.update(sessions)
        .set({ endTime: Date.now() })
        .where(eq(sessions.id, session.id))
        .run();

      await expect(
        addExerciseWithPrefill(session.id, EX_BENCH, undefined, db)
      ).rejects.toThrow(`Session ${session.id} is already finished`);
    });

    it('rejects adding an exercise to a deleted session', async () => {
      const session = await startFreestyle(undefined, db);
      db.update(sessions)
        .set({ deletedAt: Date.now() })
        .where(eq(sessions.id, session.id))
        .run();

      await expect(
        addExerciseWithPrefill(session.id, EX_BENCH, undefined, db)
      ).rejects.toThrow(`Session ${session.id} is deleted`);
    });

    it('rejects adding a non-existent exercise ID', async () => {
      const session = await startFreestyle(undefined, db);
      await expect(
        addExerciseWithPrefill(session.id, 99999, undefined, db)
      ).rejects.toThrow('Exercise 99999 not found');
    });

    it('preserves incremental position order when adding multiple exercises', async () => {
      const session = await startFreestyle(undefined, db);
      const ex1 = await addExerciseWithPrefill(session.id, EX_BENCH, undefined, db);
      const ex2 = await addExerciseWithPrefill(session.id, EX_ROW, undefined, db);
      const ex3 = await addExerciseWithPrefill(session.id, EX_SQUAT, undefined, db);

      expect(ex1.position).toBe(0);
      expect(ex2.position).toBe(1);
      expect(ex3.position).toBe(2);

      const queue = await getPendingQueue(session.id, db);
      expect(queue.map((q) => q.position)).toEqual([0, 1, 2]);
      expect(queue.map((q) => q.exerciseId)).toEqual([EX_BENCH, EX_ROW, EX_SQUAT]);
    });
  });
});

/**
 * Issue #81 - remove an exercise from the ACTIVE session without ending the workout.
 *
 * RED-ONLY contract tests (design slice). `services/SessionOccurrenceService` does not exist
 * yet, so every test fails today with "Cannot find module". The contract being pinned is
 * documented in docs/plans/il81-session-occurrence-contract.md.
 *
 * The module is loaded lazily through `loadService()` (instead of a static import) so that
 * (a) `npm run typecheck` stays green while the module is missing and (b) each test reports
 * its own RED failure rather than one suite-level failure.
 *
 * Contract invariants:
 *  - Identity of an in-session exercise is the OCCURRENCE (`routine_exercises.id`), not exercise_id
 *    (A/B/A routines have two occurrences of the same exercise).
 *  - Removal only shrinks the pending queue of THAT session. Logged sets are KEPT (history preserved),
 *    the routine template (`routine_exercises`) is never mutated.
 *  - Undo restores queue membership and original position.
 *  - Crash-recovery snapshot (`incomplete_session`) never resurrects a removed occurrence.
 */
import { renderHook, act } from '@testing-library/react-native';
import { and, eq, isNull } from 'drizzle-orm';
import { db, sqlite } from '../fixtures/database';
import { exercises, routines, routineExercises, sessions, sets } from '@/src/db/schema';
import { useSessionPersistence } from '@/hooks/use-session-persistence';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

// In-memory AsyncStorage so snapshot save -> load is a real roundtrip.
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

// ---- Contract (PROPOSED API; see docs/plans/il81-session-occurrence-contract.md) ----
interface QueueItem {
  routineExerciseId: number;
  exerciseId: number;
  position: number;
}
interface RemoveResult {
  routineExerciseId: number;
  exerciseId: number;
  position: number;
  keptSetCount: number;
}
type RecoveryAction = 'resume' | 'advance' | 'finish';
interface RecoveryResolution {
  action: RecoveryAction;
  context: { routineExerciseId: number | null; exerciseId: number | null; weight: string; reps: string; isDirty: boolean } | null;
}
interface SessionOccurrenceApi {
  getPendingQueue(sessionId: number, database?: unknown): Promise<QueueItem[]>;
  removeSessionExercise(
    params: { sessionId: number; routineExerciseId: number },
    database?: unknown,
  ): Promise<RemoveResult>;
  restoreSessionExercise(
    params: { sessionId: number; routineExerciseId: number },
    database?: unknown,
  ): Promise<void>;
  resolveRecoveryContext(
    context: Record<string, unknown>,
    database?: unknown,
  ): Promise<RecoveryResolution>;
}

function loadService(): SessionOccurrenceApi {
  return jest.requireActual('@/services/SessionOccurrenceService');
}

const SESSION = 10;
const OTHER_SESSION = 11;
const ROUTINE = 5;
// Occurrence ids (routine_exercises.id): RE_A1 (ex 1), RE_B (ex 2), RE_A2 (ex 1 again), RE_C (ex 3)
const RE_A1 = 1;
const RE_B = 2;
const RE_A2 = 3;
const RE_C = 4;

const queueIds = async (sessionId = SESSION) =>
  (await loadService().getPendingQueue(sessionId, db)).map((q) => q.routineExerciseId);

function logSet(sessionId: number, routineExerciseId: number, exerciseId: number, setNumber: number) {
  db.insert(sets)
    .values({
      sessionId,
      exerciseId,
      routineExerciseId,
      setNumber,
      weightKg: 80,
      reps: 8,
      createdAt: 2000000 + setNumber,
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
        isNull(sets.deletedAt),
      ),
    )
    .all();

describe('Issue #81: session exercise occurrence removal (contract)', () => {
  beforeEach(() => {
    mockStorage.clear();
    sqlite.exec(`
      DELETE FROM personal_records;
      DELETE FROM sets;
      DELETE FROM sessions;
      DELETE FROM routine_exercises;
      DELETE FROM routines;
      DELETE FROM exercises;
      DELETE FROM sqlite_sequence;
    `);
    db.insert(exercises).values({ id: 1, name: 'Supino Reto', type: 'strength' }).run();
    db.insert(exercises).values({ id: 2, name: 'Remada Curvada', type: 'strength' }).run();
    db.insert(exercises).values({ id: 3, name: 'Agachamento', type: 'strength' }).run();
    db.insert(routines).values({ id: ROUTINE, name: 'Treino A' }).run();
    db.insert(routineExercises)
      .values([
        { id: RE_A1, routineId: ROUTINE, exerciseId: 1, orderIndex: 0, target: '3x8' },
        { id: RE_B, routineId: ROUTINE, exerciseId: 2, orderIndex: 1, target: '3x8' },
        { id: RE_A2, routineId: ROUTINE, exerciseId: 1, orderIndex: 2, target: '3x8' },
        { id: RE_C, routineId: ROUTINE, exerciseId: 3, orderIndex: 3, target: '3x8' },
      ])
      .run();
    db.insert(sessions).values({ id: SESSION, routineId: ROUTINE, routineName: 'Treino A', startTime: 1000000 }).run();
    db.insert(sessions).values({ id: OTHER_SESSION, routineId: ROUTINE, routineName: 'Treino A', startTime: 1500000 }).run();
  });

  it('exposes the pending queue in routine order for a fresh session', async () => {
    expect(await queueIds()).toEqual([RE_A1, RE_B, RE_A2, RE_C]);
  });

  it('remove -> pending queue shrinks, session stays open, routine template untouched', async () => {
    const result = await loadService().removeSessionExercise(
      { sessionId: SESSION, routineExerciseId: RE_B },
      db,
    );

    expect(result).toEqual({ routineExerciseId: RE_B, exerciseId: 2, position: 1, keptSetCount: 0 });
    expect(await queueIds()).toEqual([RE_A1, RE_A2, RE_C]);

    const session = db.select().from(sessions).where(eq(sessions.id, SESSION)).get();
    expect(session?.endTime).toBeNull();
    expect(session?.deletedAt).toBeNull();
    // template (shared across sessions) must never be mutated by an in-session removal
    expect(db.select().from(routineExercises).where(eq(routineExercises.routineId, ROUTINE)).all()).toHaveLength(4);
  });

  it('removal is scoped to its session', async () => {
    await loadService().removeSessionExercise({ sessionId: SESSION, routineExerciseId: RE_B }, db);
    expect(await queueIds(OTHER_SESSION)).toEqual([RE_A1, RE_B, RE_A2, RE_C]);
  });

  it('KEEPS already-logged sets of the removed exercise (history preserved)', async () => {
    logSet(SESSION, RE_B, 2, 1);
    logSet(SESSION, RE_B, 2, 2);

    const result = await loadService().removeSessionExercise(
      { sessionId: SESSION, routineExerciseId: RE_B },
      db,
    );

    expect(result.keptSetCount).toBe(2);
    expect(await queueIds()).toEqual([RE_A1, RE_A2, RE_C]);
    const kept = liveSetsOf(SESSION, RE_B);
    expect(kept.map((s) => s.setNumber)).toEqual([1, 2]);
    expect(kept.every((s) => s.deletedAt === null)).toBe(true);
  });

  it('removing one occurrence of A/B/A keeps the other occurrence of the same exercise pending', async () => {
    logSet(SESSION, RE_A1, 1, 1);
    await loadService().removeSessionExercise({ sessionId: SESSION, routineExerciseId: RE_A1 }, db);

    expect(await queueIds()).toEqual([RE_B, RE_A2, RE_C]);
    expect(liveSetsOf(SESSION, RE_A1)).toHaveLength(1);
  });

  it('is idempotent: removing an already-removed occurrence does not throw or change the queue', async () => {
    const svc = loadService();
    await svc.removeSessionExercise({ sessionId: SESSION, routineExerciseId: RE_B }, db);
    await expect(
      svc.removeSessionExercise({ sessionId: SESSION, routineExerciseId: RE_B }, db),
    ).resolves.toBeDefined();
    expect(await queueIds()).toEqual([RE_A1, RE_A2, RE_C]);
  });

  it('rejects removal on a finished session', async () => {
    db.update(sessions).set({ endTime: 3000000 }).where(eq(sessions.id, SESSION)).run();
    await expect(
      loadService().removeSessionExercise({ sessionId: SESSION, routineExerciseId: RE_B }, db),
    ).rejects.toThrow();
  });

  it('rejects removal of an occurrence that is not part of the session routine', async () => {
    await expect(
      loadService().removeSessionExercise({ sessionId: SESSION, routineExerciseId: 999 }, db),
    ).rejects.toThrow();
  });

  it('undo restores queue membership AND original position, logged sets untouched', async () => {
    const svc = loadService();
    logSet(SESSION, RE_B, 2, 1);

    await svc.removeSessionExercise({ sessionId: SESSION, routineExerciseId: RE_B }, db);
    await svc.removeSessionExercise({ sessionId: SESSION, routineExerciseId: RE_C }, db);
    expect(await queueIds()).toEqual([RE_A1, RE_A2]);

    // undo out of order must still land each occurrence at its original slot
    await svc.restoreSessionExercise({ sessionId: SESSION, routineExerciseId: RE_C }, db);
    await svc.restoreSessionExercise({ sessionId: SESSION, routineExerciseId: RE_B }, db);

    expect(await queueIds()).toEqual([RE_A1, RE_B, RE_A2, RE_C]);
    expect(liveSetsOf(SESSION, RE_B)).toHaveLength(1);
  });

  describe('crash-recovery snapshot (incomplete_session)', () => {
    const baseOpts = {
      sessionId: SESSION,
      exerciseId: 2,
      routineExerciseId: RE_B,
      routineId: ROUTINE,
      exerciseName: 'Remada Curvada',
      currentName: 'Remada Curvada',
      exerciseType: 'strength',
      weight: '70',
      reps: '5',
      duration: '',
      rir: 2,
      isWarmupMode: false,
      isDirty: true,
      activeSetTime: 0,
      isActiveSetRunning: false,
      activeSetStartedAt: null,
      startTime: 1000000,
    };

    async function saveAndLoadSnapshot() {
      const { result } = renderHook(() => useSessionPersistence(baseOpts));
      await act(async () => {
        await result.current.saveSessionContext();
      });
      const loaded = await result.current.loadSessionContext();
      expect(loaded).not.toBeNull();
      return loaded as unknown as Record<string, unknown>;
    }

    it('snapshot of a live occurrence resumes unchanged (draft preserved)', async () => {
      const snapshot = await saveAndLoadSnapshot();
      const resolution = await loadService().resolveRecoveryContext(snapshot, db);

      expect(resolution.action).toBe('resume');
      expect(resolution.context).toMatchObject({ routineExerciseId: RE_B, weight: '70', reps: '5', isDirty: true });
    });

    it('snapshot of a REMOVED occurrence advances to the next pending one and drops the stale draft', async () => {
      const svc = loadService();
      logSet(SESSION, RE_B, 2, 1);
      const snapshot = await saveAndLoadSnapshot();
      await svc.removeSessionExercise({ sessionId: SESSION, routineExerciseId: RE_B }, db);

      const resolution = await svc.resolveRecoveryContext(snapshot, db);

      expect(resolution.action).toBe('advance');
      expect(resolution.context).toMatchObject({ routineExerciseId: RE_A2, exerciseId: 1, weight: '', reps: '', isDirty: false });
      // history of the removed occurrence is still there; recovery never resurrects it
      expect(liveSetsOf(SESSION, RE_B)).toHaveLength(1);
      expect(await queueIds()).not.toContain(RE_B);
    });

    it('snapshot of a removed occurrence with nothing pending resolves to finish', async () => {
      const svc = loadService();
      const snapshot = await saveAndLoadSnapshot();
      for (const re of [RE_A1, RE_B, RE_A2, RE_C]) {
        await svc.removeSessionExercise({ sessionId: SESSION, routineExerciseId: re }, db);
      }

      const resolution = await svc.resolveRecoveryContext(snapshot, db);
      expect(resolution.action).toBe('finish');
      expect(await queueIds()).toEqual([]);
    });

    it('undo before recovery makes the same snapshot resume again', async () => {
      const svc = loadService();
      const snapshot = await saveAndLoadSnapshot();
      await svc.removeSessionExercise({ sessionId: SESSION, routineExerciseId: RE_B }, db);
      await svc.restoreSessionExercise({ sessionId: SESSION, routineExerciseId: RE_B }, db);

      const resolution = await svc.resolveRecoveryContext(snapshot, db);
      expect(resolution.action).toBe('resume');
      expect(resolution.context).toMatchObject({ routineExerciseId: RE_B, weight: '70' });
    });
  });
});

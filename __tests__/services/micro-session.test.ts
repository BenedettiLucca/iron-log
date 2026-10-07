import { db, sqlite } from '../fixtures/database';
import { exercises, sessions, sets } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import {
  createMicroSession,
  addMicroSet,
  finishMicroSession,
  discardMicroSession,
  resumeMicroSession,
  MicroSessionAlreadyActiveError,
  MicroSetLimitError,
  MicroSessionNotFoundError,
  MICRO_SESSION_MARKER,
  type MicroSessionDraft,
} from '@/services/MicroSessionService';

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

/**
 * IL-66 Micro-Session Contract — Tests.
 *
 * Contract assertions are captured in test names / comments (desired semantics).
 */
describe('IL-66: Micro-Session Mode (RED)', () => {
  beforeEach(() => {
    sqlite.exec(`
      DELETE FROM personal_records;
      DELETE FROM sets;
      DELETE FROM routine_exercises;
      DELETE FROM routines;
      DELETE FROM sessions;
      DELETE FROM exercises;
      DELETE FROM sqlite_sequence;
    `);

    db.insert(exercises).values({ id: 1, name: 'Supino Reto', type: 'strength', defaultRestSeconds: 90 }).run();
    db.insert(exercises).values({ id: 2, name: 'Agachamento', type: 'strength', defaultRestSeconds: 120 }).run();
  });

  // 1. Persistence: micro session must persist to the SAME session tables mapping.
  it('createMicroSession persists through same sessions/sets tables (RED — not implemented)', () => {
    const draft: MicroSessionDraft = { routineName: 'Micro Treino', routineId: null };
    const sessionId = createMicroSession(draft); // throws; when green delivers sessionId
    expect(sessionId).toBeDefined(); // contract: returns session id mapping to `sessions`
    expect(typeof sessionId).toBe('number');

    // Verify row persisted in sessions table with micro marker
    const row = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
    expect(row).toBeDefined();
    expect(row?.routineName).toBe('Micro Treino');
    expect(row?.notes).toBe(MICRO_SESSION_MARKER);
    expect(row?.endTime).toBeNull();
    expect(row?.deletedAt).toBeNull();

    // Verify discovery finds it
    const active = resumeMicroSession();
    expect(active?.id).toBe(sessionId);

    // Verify cannot create another while open
    expect(() => createMicroSession(draft)).toThrow(MicroSessionAlreadyActiveError);
  });

  // 2. Single-set contract: addMicroSet MUST refuse a second set for same exercise.
  it('addMicroSet refuses second set for same exercise (single-set contract — RED)', () => {
    // First set allowed; second must be rejected by the service layer.
    addMicroSet({ exerciseId: 1, weightKg: 70, reps: 10 });
    expect(() => addMicroSet({ exerciseId: 1, weightKg: 75, reps: 8 })).toThrow(MicroSetLimitError); // contract violation → must throw

    // Verify set was persisted to sets table with contract fields
    const active = resumeMicroSession();
    expect(active).not.toBeNull();
    const setRows = db.select().from(sets).where(eq(sets.sessionId, active!.id)).all();
    expect(setRows).toHaveLength(1);
    expect(setRows[0].exerciseId).toBe(1);
    expect(setRows[0].weightKg).toBe(70);
    expect(setRows[0].reps).toBe(10);
    expect(setRows[0].setNumber).toBe(1);
    expect(setRows[0].routineExerciseId).toBeNull();

    // Different exercise is allowed
    const secondExerciseSet = addMicroSet({ exerciseId: 2, weightKg: 100, reps: 5 });
    expect(secondExerciseSet.exerciseId).toBe(2);
    expect(() => addMicroSet({ exerciseId: 2, weightKg: 105, reps: 5 })).toThrow(MicroSetLimitError);
  });

  // 3. Explicit finish only: never auto-finalize.
  it('finishMicroSession explicit only — no auto-finalize trigger (RED)', async () => {
    const draft: MicroSessionDraft = { routineName: 'Micro Treino' };
    const sessionId = createMicroSession(draft);

    // Must NOT auto-finalize; finish is explicit.
    const activeBefore = resumeMicroSession();
    expect(activeBefore?.id).toBe(sessionId);

    await finishMicroSession({ sessionId, startTime: 1, endTime: 2, weight: '78.5', sRpe: 8, notes: 'Micro' });

    // After explicit finish, no open micro session exists
    const activeAfter = resumeMicroSession();
    expect(activeAfter).toBeNull();

    const finished = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
    expect(finished?.endTime).toBe(2);
    expect(finished?.notes).toBe('Micro');
  });

  // 4. Summary shape equals normal session.
  it('finishMicroSession summary shape equals normal session (RED)', async () => {
    const microId = createMicroSession({ routineName: 'Micro Treino' });
    const summary = await finishMicroSession({
      sessionId: microId,
      startTime: 3000000,
      endTime: 3000000 + 20 * 60000,
      weight: '78.5',
      sRpe: 8,
      notes: 'Micro sessão',
    });

    expect(summary).toMatchObject({
      success: true,
      sessionId: microId,
      alreadyFinished: false,
    });

    // Discard contract verification
    const idToDiscard = createMicroSession({ routineName: 'Discard Me' });
    addMicroSet({ exerciseId: 1, weightKg: 50, reps: 10 });
    await discardMicroSession(idToDiscard);

    const discarded = db.select().from(sessions).where(eq(sessions.id, idToDiscard)).get();
    expect(discarded?.deletedAt).not.toBeNull();
    expect(resumeMicroSession()).toBeNull();
  });

  // 5. Micro discipline: a NORMAL session (no marker) must not be finishable via finishMicroSession.
  it('finishMicroSession rejects NORMAL session id — MICRO_SESSION_NOT_FOUND, normal session untouched', async () => {
    const draft: MicroSessionDraft = { routineName: 'Micro Treino' };
    const microId = createMicroSession(draft);
    // Normal session created directly without marker, not finished.
    db.insert(sessions).values({
      id: 99999,
      routineName: 'Normal Workout',
      startTime: 1,
      endTime: null,
      bodyWeight: null,
      sRpe: null,
      notes: 'not micro',
      durationMinutes: null,
      deletedAt: null,
    }).run();

    await expect(
      finishMicroSession({ sessionId: 99999, startTime: 1, endTime: 2, weight: '78.5', sRpe: 8, notes: 'x' })
    ).rejects.toThrow(MicroSessionNotFoundError);
    expect(
      finishMicroSession({ sessionId: 99999, startTime: 1, endTime: 2, weight: '78.5', sRpe: 8, notes: 'x' })
    ).rejects.toHaveProperty('code', 'MICRO_SESSION_NOT_FOUND');

    // Normal session must remain untouched: endTime still null.
    const normal = db.select().from(sessions).where(eq(sessions.id, 99999)).get();
    expect(normal?.endTime).toBeNull();
    expect(normal?.routineName).toBe('Normal Workout');
    expect(normal?.notes).toBe('not micro');

    // Micro session must still be open afterwards (finish never mutated anything).
    const active = resumeMicroSession();
    expect(active?.id).toBe(microId);
  });

  // 6. finishMicroSession with a non-existent id must throw MICRO_SESSION_NOT_FOUND — never fabricates.
  it('finishMicroSession rejects non-existent id — MICRO_SESSION_NOT_FOUND (no fabrication)', async () => {
    await expect(
      finishMicroSession({ sessionId: 999999, startTime: 1, endTime: 2, weight: '78.5', sRpe: 8, notes: 'x' })
    ).rejects.toThrow(MicroSessionNotFoundError);
    expect(
      finishMicroSession({ sessionId: 999999, startTime: 1, endTime: 2, weight: '78.5', sRpe: 8, notes: 'x' })
    ).rejects.toHaveProperty('code', 'MICRO_SESSION_NOT_FOUND');

    // Verify no row was fabricated.
    const fabricated = db.select().from(sessions).where(eq(sessions.id, 999999)).get();
    expect(fabricated).toBeUndefined();
    expect(resumeMicroSession()).toBeNull();
  });
});

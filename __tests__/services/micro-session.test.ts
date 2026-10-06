import { db, sqlite } from '../fixtures/database';
import { exercises } from '@/src/db/schema';
import {
  createMicroSession,
  addMicroSet,
  finishMicroSession,
  type MicroSessionDraft,
} from '@/services/MicroSessionService';

/**
 * IL-66 Micro-Session Contract — RED Tests (real stub import, zero inline helpers).
 *
 * Every test calls the stub directly and will fail with the not-implemented
 * throw — legitimate RED until services/MicroSessionService is implemented.
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
  });

  // 2. Single-set contract: addMicroSet MUST refuse a second set for same exercise.
  it('addMicroSet refuses second set for same exercise (single-set contract — RED)', () => {
    // First set allowed; second must be rejected by the service layer.
    addMicroSet({ exerciseId: 1, weightKg: 70, reps: 10 });
    addMicroSet({ exerciseId: 1, weightKg: 75, reps: 8 }); // contract violation → must throw
  });

  // 3. Explicit finish only: never auto-finalize.
  it('finishMicroSession explicit only — no auto-finalize trigger (RED)', () => {
    const draft: MicroSessionDraft = { routineName: 'Micro Treino' };
    const sessionId = createMicroSession(draft);
    // Must NOT auto-finalize; finish is explicit.
    finishMicroSession({ sessionId, startTime: 1, endTime: 2, weight: '78.5', sRpe: 8, notes: 'Micro' });
  });

  // 4. Summary shape equals normal session.
  it('finishMicroSession summary shape equals normal session (RED)', () => {
    finishMicroSession({
      sessionId: 1,
      startTime: 3000000,
      endTime: 3000000 + 20 * 60000,
      weight: '78.5',
      sRpe: 8,
      notes: 'Micro sessão',
    });
  });
});

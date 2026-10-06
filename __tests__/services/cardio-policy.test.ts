import { db, sqlite } from '../fixtures/database';
import { exercises, sets, sessions, personalRecords } from '@/src/db/schema';
import { checkPersonalRecordsSync } from '@/hooks/use-personal-records';
import { AnalyticsService } from '@/services/AnalyticsService';
import { eq, and } from 'drizzle-orm';

// The production PR + analytics policies resolve their db handle via
// `@/src/db/client`. Redirect that to the in-memory fixture so the REAL
// production code runs against our synthetic DB (same pattern used by
// personal-record-reconcile.test.ts and analytics-database.test.ts).
jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

const since = Date.UTC(2026, 0, 5);

/**
 * CONTRACT IL82 — "cardio as exercise type" (RED / TDD).
 *
 * These tests import and exercise REAL production functions/policies:
 *   - the `sets` Drizzle model (src/db/schema.ts)
 *   - `checkPersonalRecordsSync` (hooks/use-personal-records.ts)
 *   - `AnalyticsService.calculateVolumeTrends` (services/AnalyticsService.ts)
 *
 * They are RED today: the cardio contract (canonical distance field,
 * distance-based PR semantics, cardio line in weekly report) does not exist
 * yet. No production code or schema migration is introduced by this lane —
 * the tests merely capture the gap. See docs/plans/il82-cardio-contract.md.
 */
describe('Contract IL82 — cardio as exercise type (RED)', () => {
  beforeEach(() => {
    sqlite.exec(
      'DELETE FROM personal_records; DELETE FROM sets; DELETE FROM sessions; DELETE FROM exercises; DELETE FROM sqlite_sequence;'
    );
  });
  afterAll(() => sqlite.close());

  // ────────────────────────────────────────────────────────────────────
  // RED #1 — record cardio set -> canonical fields
  // The model persists duration but has NO canonical distance field,
  // so a 5k "distance" cannot round-trip through the `sets` table.
  // ────────────────────────────────────────────────────────────────────
  it('records a cardio set with canonical distance + duration fields', () => {
    db.insert(exercises).values({ id: 1, name: '5K Run', type: 'duration' }).run();
    db.insert(sessions).values({ id: 1, routineName: 'Cardio Day', startTime: since, endTime: since + 60000 }).run();

    // Record the cardio set the way the current model allows: time only.
    const recorded = db
      .insert(sets)
      .values({
        sessionId: 1,
        exerciseId: 1,
        exerciseName: '5K Run',
        setNumber: 1,
        weightKg: 0, // canonical for pure cardio
        reps: 0, // canonical for pure cardio
        durationSeconds: 1200, // 20:00
        isWarmup: false,
        createdAt: since + 1000,
      })
      .returning()
      .get();

    // durationSeconds persists today (passing — documented current behavior)
    expect(recorded.durationSeconds).toBe(1200);

    // CONTRACT: a cardio set must persist a canonical distance (meters)
    // alongside duration. The model has no distance_meters column, so the
    // 5000m distance cannot round-trip. RED: distanceMeters is undefined.
    expect((recorded as unknown as { distanceMeters?: number }).distanceMeters).toBe(5000);
  });

  // ────────────────────────────────────────────────────────────────────
  // RED #2 — PR detection for a standard distance
  // For a fixed distance (5k), the PR should be the FASTEST time (min).
  // The real `checkPersonalRecordsSync` only writes recordType='duration'
  // with MAX-time semantics (plank-style), so a faster 5k does not upgrade
  // the PR — it still holds the slower time.
  // ────────────────────────────────────────────────────────────────────
  it('detects a distance-based PR (fastest time for a standard 5k)', async () => {
    db.insert(exercises).values({ id: 1, name: '5K Run', type: 'duration' }).run();
    db.insert(sessions).values({ id: 1, routineName: 'Cardio Day', startTime: since, endTime: since + 60000 }).run();

    // 1st 5k: 20:00 = 1200s
    const slow = db
      .insert(sets)
      .values({
        sessionId: 1, exerciseId: 1, exerciseName: '5K Run', setNumber: 1,
        weightKg: 0, reps: 0, durationSeconds: 1200, isWarmup: false, createdAt: since + 1000,
      })
      .returning()
      .get();
    await checkPersonalRecordsSync({ exerciseId: 1, sessionId: 1, savedSet: slow, isWarmup: false });

    // 2nd 5k: 18:00 = 1080s — FASTER. For a fixed distance this should beat the PR.
    const fast = db
      .insert(sets)
      .values({
        sessionId: 1, exerciseId: 1, exerciseName: '5K Run', setNumber: 2,
        weightKg: 0, reps: 0, durationSeconds: 1080, isWarmup: false, createdAt: since + 2000,
      })
      .returning()
      .get();
    await checkPersonalRecordsSync({ exerciseId: 1, sessionId: 1, savedSet: fast, isWarmup: false });

    const pr = db
      .select()
      .from(personalRecords)
      .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'duration')))
      .get();

    // Documented current behavior (PASSES): the 'duration' PR keeps the MAX
    // time (1200s) because checkPersonalRecordsSync only ever promotes to a
    // larger duration (plank/hang semantics) — it has no distance awareness.
    expect(pr?.value).toBe(1200);

    // CONTRACT: for a standard distance the PR should be the FASTEST time.
    // A faster 5k (1080s) must win. RED: it does not — 1080 !== 1200.
    expect(pr?.value).toBe(1080);
  });

  // ────────────────────────────────────────────────────────────────────
  // RED #3 — cardio vs strength aggregates
  // Documented current behavior: cardio contributes 0 to strength volume
  // (weightKg*reps = 0). Correct by design — cardio is not strength tonnage.
  // CONTRACT (desired): a weekly report should surface a cardio line
  // (e.g. distance covered) that the strength aggregate does not carry.
  // ────────────────────────────────────────────────────────────────────
  it('excludes cardio from strength volume but surfaces it as a cardio report line', async () => {
    db.insert(exercises).values([
      { id: 1, name: 'Bench Press', type: 'strength' },
      { id: 2, name: 'Run', type: 'duration' },
    ]).run();
    db.insert(sessions).values({ id: 1, routineName: 'Mixed Day', startTime: since, endTime: since + 120000 }).run();

    // Strength set: 100kg x 10 reps = 1000 volume
    db.insert(sets).values({
      sessionId: 1, exerciseId: 1, exerciseName: 'Bench Press', setNumber: 1,
      weightKg: 100, reps: 10, isWarmup: false, createdAt: since + 1000,
    }).run();
    // Cardio set: 5k in 10:00 (weightKg/reps = 0)
    db.insert(sets).values({
      sessionId: 1, exerciseId: 2, exerciseName: 'Run', setNumber: 1,
      weightKg: 0, reps: 0, durationSeconds: 600, isWarmup: false, createdAt: since + 2000,
    }).run();

    const trends = await AnalyticsService.calculateVolumeTrends(since);

    // Documented current behavior (PASSES): strength volume counts only
    // weight*reps, so the cardio set contributes 0 -> totalVolume = 1000.
    expect(trends[0].totalVolume).toBe(1000);

    // CONTRACT (desired): the weekly aggregate should carry a cardio distance
    // line (5000m for the 5k). No such metric exists on VolumeTrend today.
    // RED: cardioDistanceMeters is undefined.
    expect((trends[0] as unknown as { cardioDistanceMeters?: number }).cardioDistanceMeters).toBe(5000);
  });
});

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
 * CONTRACT IL82 — "cardio as exercise type".
 *
 * These tests import and exercise REAL production functions/policies:
 *   - the `sets` Drizzle model (src/db/schema.ts)
 *   - `checkPersonalRecordsSync` (hooks/use-personal-records.ts)
 *   - `AnalyticsService.calculateVolumeTrends` (services/AnalyticsService.ts)
 *
 * PR semantics (owner decision 2026-10-06): distance is an editable input per
 * session — there is NO fixed list of standard distances. PR = fastest time
 * for the EXACT distance_meters value recorded; longest-distance-per-duration
 * stays unchanged. See docs/plans/il82-cardio-contract.md.
 */
describe('Contract IL82 — cardio as exercise type', () => {
  beforeEach(() => {
    sqlite.exec(
      'DELETE FROM personal_records; DELETE FROM sets; DELETE FROM sessions; DELETE FROM exercises; DELETE FROM sqlite_sequence;'
    );
  });
  afterAll(() => sqlite.close());

  // ────────────────────────────────────────────────────────────────────
  // #1 — record cardio set -> canonical fields
  // The model persists duration alongside canonical distance_meters,
  // so a 5000m distance round-trips through the `sets` table.
  // ────────────────────────────────────────────────────────────────────
  it('records a cardio set with canonical distance + duration fields', () => {
    db.insert(exercises).values({ id: 1, name: '5K Run', type: 'duration' }).run();
    db.insert(sessions).values({ id: 1, routineName: 'Cardio Day', startTime: since, endTime: since + 60000 }).run();

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
        distanceMeters: 5000,
        isWarmup: false,
        createdAt: since + 1000,
      })
      .returning()
      .get();

    // durationSeconds persists
    expect(recorded.durationSeconds).toBe(1200);

    // CONTRACT: a cardio set must persist a canonical distance (meters)
    // alongside duration.
    expect(recorded.distanceMeters).toBe(5000);
  });

  // ────────────────────────────────────────────────────────────────────
  // #2 — PR detection: exact distance matching (no standard list)
  // For a new cardio set (distance_meters, duration_seconds), find prior
  // sets with the SAME distance_meters value and flag PR if strictly faster.
  // Different distances do not compete — each tracks its own PR.
  // Longest-distance-per-duration stays as-is (covered by longest-distance logic).
  // ────────────────────────────────────────────────────────────────────
  it('detects exact-distance PR: same distance (5k vs 5k) -> faster time wins', async () => {
    db.insert(exercises).values({ id: 1, name: '5K Run', type: 'duration' }).run();
    db.insert(sessions).values({ id: 1, routineName: 'Cardio Day', startTime: since, endTime: since + 60000 }).run();

    // 1st 5k: 20:00 = 1200s
    const slow = db
      .insert(sets)
      .values({
        sessionId: 1, exerciseId: 1, exerciseName: '5K Run', setNumber: 1,
        weightKg: 0, reps: 0, durationSeconds: 1200, distanceMeters: 5000, isWarmup: false, createdAt: since + 1000,
      })
      .returning()
      .get();
    await checkPersonalRecordsSync({ exerciseId: 1, sessionId: 1, savedSet: slow, isWarmup: false });

    const pr1 = db
      .select()
      .from(personalRecords)
      .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'duration')))
      .get();
    expect(pr1?.value).toBe(1200);

    // 2nd 5k: 18:00 = 1080s — FASTER. Same exact distance -> should beat PR.
    const fast = db
      .insert(sets)
      .values({
        sessionId: 1, exerciseId: 1, exerciseName: '5K Run', setNumber: 2,
        weightKg: 0, reps: 0, durationSeconds: 1080, distanceMeters: 5000, isWarmup: false, createdAt: since + 2000,
      })
      .returning()
      .get();
    await checkPersonalRecordsSync({ exerciseId: 1, sessionId: 1, savedSet: fast, isWarmup: false });

    const pr = db
      .select()
      .from(personalRecords)
      .where(and(eq(personalRecords.exerciseId, 1), eq(personalRecords.recordType, 'duration')))
      .get();

    // CONTRACT: for the SAME exact distance, faster time wins PR.
    expect(pr?.value).toBe(1080);
  });

  it('exact-distance PR: different distance (5.2k vs 5k) does NOT match', async () => {
    const getPR = () =>
      db
        .select()
        .from(personalRecords)
        .where(and(eq(personalRecords.exerciseId, 2), eq(personalRecords.recordType, 'duration')))
        .get();
    const prDistance = (row: { setDetails?: string | null } | null | undefined): number | null => {
      if (!row?.setDetails) return null;
      try {
        const p = JSON.parse(row.setDetails);
        return typeof p.distanceMeters === 'number' ? p.distanceMeters : null;
      } catch {
        return null;
      }
    };

    db.insert(exercises).values({ id: 2, name: 'Run', type: 'duration' }).run();
    db.insert(sessions).values({ id: 2, routineName: 'Cardio Day', startTime: since, endTime: since + 60000 }).run();

    // 1st: 5k at 20:00 -> PR tracks the 5000m benchmark
    const set5k = db
      .insert(sets)
      .values({
        sessionId: 2, exerciseId: 2, exerciseName: 'Run', setNumber: 1,
        weightKg: 0, reps: 0, durationSeconds: 1200, distanceMeters: 5000, isWarmup: false, createdAt: since + 1000,
      })
      .returning()
      .get();
    await checkPersonalRecordsSync({ exerciseId: 2, sessionId: 2, savedSet: set5k, isWarmup: false });

    const pr5k = getPR();
    expect(pr5k?.value).toBe(1200);
    expect(prDistance(pr5k)).toBe(5000);

    // 2nd: 5.2k (5200m, faster time) — a DIFFERENT distance value. It does not
    // match the 5k benchmark; per the unchanged longest-distance rule the row
    // moves to its own 5200m benchmark.
    const set52k = db
      .insert(sets)
      .values({
        sessionId: 2, exerciseId: 2, exerciseName: 'Run', setNumber: 2,
        weightKg: 0, reps: 0, durationSeconds: 1000, distanceMeters: 5200, isWarmup: false, createdAt: since + 2000,
      })
      .returning()
      .get();
    await checkPersonalRecordsSync({ exerciseId: 2, sessionId: 2, savedSet: set52k, isWarmup: false });

    const pr52k = getPR();
    expect(pr52k?.value).toBe(1000);
    expect(prDistance(pr52k)).toBe(5200); // 5.2k set up its own benchmark; it did not "match" the 5k one

    // 3rd: 5k at 18:30 — faster than the original 5k (1200s), but 5000m does
    // not match the 5200m benchmark (nor is it longer) -> no PR update.
    const set5kAgain = db
      .insert(sets)
      .values({
        sessionId: 2, exerciseId: 2, exerciseName: 'Run', setNumber: 3,
        weightKg: 0, reps: 0, durationSeconds: 1110, distanceMeters: 5000, isWarmup: false, createdAt: since + 3000,
      })
      .returning()
      .get();
    await checkPersonalRecordsSync({ exerciseId: 2, sessionId: 2, savedSet: set5kAgain, isWarmup: false });

    const prUnchanged = getPR();
    expect(prUnchanged?.value).toBe(1000);
    expect(prDistance(prUnchanged)).toBe(5200);
  });

  it('exact-distance PR: two 10k sessions -> faster one is PR', async () => {
    db.insert(exercises).values({ id: 3, name: '10K Run', type: 'duration' }).run();
    db.insert(sessions).values({ id: 3, routineName: 'Cardio Day', startTime: since, endTime: since + 60000 }).run();

    // 1st 10k: 50:00 = 3000s
    const slow10k = db
      .insert(sets)
      .values({
        sessionId: 3, exerciseId: 3, exerciseName: '10K Run', setNumber: 1,
        weightKg: 0, reps: 0, durationSeconds: 3000, distanceMeters: 10000, isWarmup: false, createdAt: since + 1000,
      })
      .returning()
      .get();
    await checkPersonalRecordsSync({ exerciseId: 3, sessionId: 3, savedSet: slow10k, isWarmup: false });

    const pr1 = db
      .select()
      .from(personalRecords)
      .where(and(eq(personalRecords.exerciseId, 3), eq(personalRecords.recordType, 'duration')))
      .get();
    expect(pr1?.value).toBe(3000);

    // 2nd 10k: 45:00 = 2700s — FASTER
    const fast10k = db
      .insert(sets)
      .values({
        sessionId: 3, exerciseId: 3, exerciseName: '10K Run', setNumber: 2,
        weightKg: 0, reps: 0, durationSeconds: 2700, distanceMeters: 10000, isWarmup: false, createdAt: since + 2000,
      })
      .returning()
      .get();
    await checkPersonalRecordsSync({ exerciseId: 3, sessionId: 3, savedSet: fast10k, isWarmup: false });

    const pr = db
      .select()
      .from(personalRecords)
      .where(and(eq(personalRecords.exerciseId, 3), eq(personalRecords.recordType, 'duration')))
      .get();

    // CONTRACT: for same 10k distance, faster time wins.
    expect(pr?.value).toBe(2700);
  });

  // ────────────────────────────────────────────────────────────────────
  // #3 — cardio vs strength aggregates
  // Cardio contributes 0 to strength volume (weightKg*reps = 0) — correct
  // by design. The weekly aggregate carries a separate cardio distance line.
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
      weightKg: 0, reps: 0, durationSeconds: 600, distanceMeters: 5000, isWarmup: false, createdAt: since + 2000,
    }).run();

    const trends = await AnalyticsService.calculateVolumeTrends(since);

    // Documented current behavior (PASSES): strength volume counts only
    // weight*reps, so the cardio set contributes 0 -> totalVolume = 1000.
    expect(trends[0].totalVolume).toBe(1000);

    // CONTRACT (desired): the weekly aggregate should carry a cardio distance
    // line (5000m for the 5k).
    expect(trends[0].cardioDistanceMeters).toBe(5000);
  });
});

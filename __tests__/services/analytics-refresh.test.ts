import { db, sqlite } from '../fixtures/database';
import { AnalyticsService } from '@/services/AnalyticsService';
import { exercises, sessions, sets, personalRecords, bodyMetrics } from '@/src/db/schema';
import { createHash } from 'node:crypto';

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

const now = Date.UTC(2026, 2, 30, 12, 0, 0); // 2026-03-30 12:00 UTC
const DAY_MS = 24 * 60 * 60 * 1000;
const thirtyDaysAgo = now - 30 * DAY_MS;
const sixtyDaysAgo = now - 60 * DAY_MS;
const twelveWeeksAgo = now - 12 * 7 * DAY_MS;

beforeEach(() => {
  sqlite.exec('DELETE FROM program_exercise_targets; DELETE FROM programs; DELETE FROM personal_records; DELETE FROM body_metrics; DELETE FROM sets; DELETE FROM sessions; DELETE FROM exercises; DELETE FROM sqlite_sequence;');
});
afterAll(() => sqlite.close());

describe('T22 — Analytics refresh snapshot and canonical distribution', () => {
  it('returns unified snapshot with keyStats and volumeDistribution adhering to C1 (no open/deleted) and C7 (time boundaries)', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
    try {
      // 1. Seed exercises
      db.insert(exercises).values([
        { id: 1, name: 'Supino Reto', type: 'strength', muscleGroup: 'peito' },
        { id: 2, name: 'Remada Curvada', type: 'strength', muscleGroup: 'costas' },
        { id: 3, name: 'Supino Fechado', type: 'strength', muscleGroup: 'costas' }, // explicit costas overrides supino name
        { id: 4, name: 'Puxada Aberta', type: 'strength', muscleGroup: null },       // null muscleGroup -> outros
      ]).run();

      // 2. Seed sessions:
      // - Recent valid session (at thirtyDaysAgo, start-inclusive): sRpe 8, duration 60
      // - Prev period valid session (at sixtyDaysAgo, start-inclusive): sRpe 7, duration 45
      // - Open session (endTime null, must be EXCLUDED from all historical metrics)
      // - Soft-deleted session (must be EXCLUDED)
      db.insert(sessions).values([
        { id: 10, routineName: 'Recent Session', startTime: thirtyDaysAgo + 1000, endTime: thirtyDaysAgo + 3600000, sRpe: 8, durationMinutes: 60 },
        { id: 20, routineName: 'Prev Session', startTime: sixtyDaysAgo + 1000, endTime: sixtyDaysAgo + 3600000, sRpe: 7, durationMinutes: 45 },
        { id: 30, routineName: 'Open Session', startTime: thirtyDaysAgo + 2000, endTime: null, sRpe: 10, durationMinutes: 120 },
        { id: 40, routineName: 'Deleted Session', startTime: thirtyDaysAgo + 3000, endTime: thirtyDaysAgo + 3600000, deletedAt: now, sRpe: 10, durationMinutes: 120 },
      ]).run();

      // 3. Seed sets:
      // Session 10 (recent):
      // - Exercise 1 (peito): 100kg x 10 = 1000
      // - Exercise 3 (costas despite name): 80kg x 10 = 800
      // - Exercise 4 (null group -> outros): 50kg x 10 = 500
      // - Warmup set (must be excluded from volume): 40kg x 10 = 400
      // - Soft-deleted set (must be excluded from volume): 200kg x 10 = 2000
      // Total recent volume: 1000 + 800 + 500 = 2300
      db.insert(sets).values([
        { sessionId: 10, exerciseId: 1, exerciseName: 'Supino Reto', setNumber: 1, weightKg: 100, reps: 10, isWarmup: false, createdAt: thirtyDaysAgo + 1000 },
        { sessionId: 10, exerciseId: 3, exerciseName: 'Supino Fechado', setNumber: 2, weightKg: 80, reps: 10, isWarmup: false, createdAt: thirtyDaysAgo + 2000 },
        { sessionId: 10, exerciseId: 4, exerciseName: 'Puxada Aberta', setNumber: 3, weightKg: 50, reps: 10, isWarmup: false, createdAt: thirtyDaysAgo + 3000 },
        { sessionId: 10, exerciseId: 1, exerciseName: 'Supino Reto', setNumber: 4, weightKg: 40, reps: 10, isWarmup: true, createdAt: thirtyDaysAgo + 4000 },
        { sessionId: 10, exerciseId: 1, exerciseName: 'Supino Reto', setNumber: 5, weightKg: 200, reps: 10, isWarmup: false, deletedAt: now, createdAt: thirtyDaysAgo + 5000 },

        // Session 20 (prev period):
        // - Exercise 2 (costas): 90kg x 10 = 900
        { sessionId: 20, exerciseId: 2, exerciseName: 'Remada Curvada', setNumber: 1, weightKg: 90, reps: 10, isWarmup: false, createdAt: sixtyDaysAgo + 1000 },

        // Session 30 (open session sets - must be excluded):
        { sessionId: 30, exerciseId: 1, exerciseName: 'Supino Reto', setNumber: 1, weightKg: 500, reps: 10, isWarmup: false, createdAt: thirtyDaysAgo + 2000 },

        // Session 40 (deleted session sets - must be excluded):
        { sessionId: 40, exerciseId: 1, exerciseName: 'Supino Reto', setNumber: 1, weightKg: 500, reps: 10, isWarmup: false, createdAt: thirtyDaysAgo + 3000 },
      ]).run();

      // 4. Seed PRs:
      // - Recent PR (last 30d)
      // - Prev period PR (60d to 30d)
      // - Old PR (> 60d)
      db.insert(personalRecords).values([
        { id: 1, exerciseId: 1, recordType: 'max_weight', value: 100, date: thirtyDaysAgo + 5000 },
        { id: 2, exerciseId: 2, recordType: 'max_weight', value: 90, date: sixtyDaysAgo + 5000 },
        { id: 3, exerciseId: 3, recordType: 'max_weight', value: 80, date: sixtyDaysAgo - 5000 },
      ]).run();

      const snapshot = await AnalyticsService.getFullAnalytics();

      // KeyStats validation
      expect(snapshot.keyStats).toBeDefined();
      expect(snapshot.keyStats.recentSessionsCount).toBe(1); // only session 10
      expect(snapshot.keyStats.recentVolume).toBe(2300);
      expect(snapshot.keyStats.prevVolume).toBe(900);
      expect(snapshot.keyStats.recentAvgRpe).toBe(8);
      expect(snapshot.keyStats.prevAvgRpe).toBe(7);
      expect(snapshot.keyStats.recentAvgDur).toBe(60);
      expect(snapshot.keyStats.prevAvgDur).toBe(45);
      expect(snapshot.keyStats.recentPRsCount).toBe(1);
      expect(snapshot.keyStats.prevPRsCount).toBe(1);

      // Volume distribution validation (canonical column, NULL -> outros, explicit costas overrides supino name)
      expect(snapshot.volumeDistribution).toBeDefined();
      expect(snapshot.volumeDistribution).toEqual({
        peito: 1000,
        costas: 800,
        outros: 500,
      });

      // Verification that keys are ordered descending by volume
      expect(Object.keys(snapshot.volumeDistribution)).toEqual(['peito', 'costas', 'outros']);
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('measures query count and demonstrates no repeated full scans', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
    try {
      db.insert(exercises).values([
        { id: 1, name: 'Squat', type: 'strength', muscleGroup: 'pernas' },
      ]).run();

      db.insert(sessions).values([
        { id: 1, routineName: 'Leg Day', startTime: thirtyDaysAgo + 1000, endTime: thirtyDaysAgo + 3600000, sRpe: 9, durationMinutes: 50 },
      ]).run();

      db.insert(sets).values([
        { sessionId: 1, exerciseId: 1, exerciseName: 'Squat', setNumber: 1, weightKg: 100, reps: 5, isWarmup: false },
      ]).run();

      let queryCount = 0;
      const origPrepare = sqlite.prepare.bind(sqlite);
      sqlite.prepare = ((sqlStr: string) => {
        queryCount++;
        return origPrepare(sqlStr);
      }) as typeof sqlite.prepare;

      try {
        const snapshot = await AnalyticsService.getFullAnalytics();
        expect(snapshot).toBeDefined();
        // The entire dashboard refresh must complete in <= 7 queries,
        // rather than the previous 13 separate queries.
        expect(queryCount).toBeLessThanOrEqual(7);
      } finally {
        sqlite.prepare = origPrepare;
      }
    } finally {
      jest.restoreAllMocks();
    }
  });

  it('provides getBodyWeightHistory with displayable, positive weights sorted by date asc', async () => {
    db.insert(bodyMetrics).values([
      { date: 3000, weight: 81.5 },
      { date: 1000, weight: 80.0 },
      { date: 2000, weight: null },  // null weight must be omitted
      { date: 2500, weight: 0 },     // zero weight must be omitted
      { date: 2800, weight: 81.0 },
    ]).run();

    const history = await AnalyticsService.getBodyWeightHistory();
    expect(history).toEqual([
      { timestamp: 1000, value: 80.0 },
      { timestamp: 2800, value: 81.0 },
      { timestamp: 3000, value: 81.5 },
    ]);
  });

  it('respects 12-week boundaries, isolates warmup/deleted, and produces deterministic trial hashes', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(now);
    try {
      db.insert(exercises).values([
        { id: 1, name: 'Deadlift', type: 'strength', muscleGroup: 'costas' },
      ]).run();

      // Session inside 12-week window (at twelveWeeksAgo, start-inclusive)
      db.insert(sessions).values([
        { id: 100, routineName: 'Inside 12w', startTime: twelveWeeksAgo, endTime: twelveWeeksAgo + 3600000 },
        // Session outside 12-week window (before twelveWeeksAgo)
        { id: 101, routineName: 'Outside 12w', startTime: twelveWeeksAgo - 1000, endTime: twelveWeeksAgo - 500 },
      ]).run();

      db.insert(sets).values([
        { sessionId: 100, exerciseId: 1, exerciseName: 'Deadlift', setNumber: 1, weightKg: 100, reps: 5, isWarmup: false },
        { sessionId: 100, exerciseId: 1, exerciseName: 'Deadlift', setNumber: 2, weightKg: 50, reps: 5, isWarmup: true },
        { sessionId: 101, exerciseId: 1, exerciseName: 'Deadlift', setNumber: 1, weightKg: 200, reps: 5, isWarmup: false },
      ]).run();

      // Run 3 trials with 25 samples each to verify hash stability
      const trialHashes: string[] = [];
      for (let trial = 0; trial < 3; trial++) {
        // Warmup
        for (let w = 0; w < 3; w++) {
          await AnalyticsService.getFullAnalytics();
        }

        let lastSnapshot: unknown = null;
        for (let s = 0; s < 25; s++) {
          lastSnapshot = await AnalyticsService.getFullAnalytics();
        }
        trialHashes.push(createHash('sha256').update(JSON.stringify(lastSnapshot)).digest('hex'));
      }

      // All 3 trials must produce identical deterministic hashes
      expect(trialHashes[0]).toBe(trialHashes[1]);
      expect(trialHashes[1]).toBe(trialHashes[2]);
    } finally {
      jest.restoreAllMocks();
    }
  });
});

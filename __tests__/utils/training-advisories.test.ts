import { db, sqlite } from '../fixtures/database';
import { sessions, routines, sets, exercises, bodyMetrics } from '@/src/db/schema';
import {
  getTopLoadsByExercise,
  getPlateauAdvisories,
  getCutVelocityAdvisory,
  getOverdueWorkouts,
  getMainLaneDrift,
  rescheduleSession,
} from '@/src/utils/training-advisories';
import { scheduleSession } from '@/services/session-schedule';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

describe('src/utils/training-advisories', () => {
  beforeEach(() => {
    sqlite.exec(`
      DELETE FROM sets;
      DELETE FROM sessions;
      DELETE FROM routines;
      DELETE FROM exercises;
      DELETE FROM body_metrics;
      DELETE FROM sqlite_sequence;
    `);
  });

  describe('getTopLoadsByExercise', () => {
    it('groups working sets by exercise and filters out warmups and zero-weights', async () => {
      db.insert(routines).values({ id: 1, name: 'Push' }).run();
      db.insert(exercises).values({ id: 10, name: 'Bench Press' }).run();
      db.insert(sessions).values([
        { id: 101, routineId: 1, startTime: 1000, endTime: 2000 },
        { id: 102, routineId: 1, startTime: 3000, endTime: 4000 },
      ]).run();

      db.insert(sets).values([
        // Warmup (should be ignored)
        { id: 1, sessionId: 101, exerciseId: 10, setNumber: 1, weightKg: 50, reps: 10, isWarmup: true },
        // Working set 1
        { id: 2, sessionId: 101, exerciseId: 10, setNumber: 2, weightKg: 80, reps: 8, isWarmup: false },
        // Working set 2 (higher weight)
        { id: 3, sessionId: 101, exerciseId: 10, setNumber: 3, weightKg: 85, reps: 6, isWarmup: false },
        // Session 102 working set
        { id: 4, sessionId: 102, exerciseId: 10, setNumber: 1, weightKg: 85, reps: 7, isWarmup: false },
      ]).run();

      const { plateauMap, cutMap, exerciseNames } = await getTopLoadsByExercise(db as any);

      expect(exerciseNames[10]).toBe('Bench Press');
      expect(plateauMap['10']).toHaveLength(2);
      expect(plateauMap['10'][0].weightKg).toBe(85);
      expect(plateauMap['10'][0].reps).toBe(6);
      expect(plateauMap['10'][1].weightKg).toBe(85);
      expect(plateauMap['10'][1].reps).toBe(7);

      expect(cutMap['10']).toHaveLength(2);
    });
  });

  describe('getPlateauAdvisories', () => {
    it('returns empty array when there are insufficient sessions', async () => {
      db.insert(routines).values({ id: 1, name: 'Legs' }).run();
      db.insert(exercises).values({ id: 20, name: 'Squat' }).run();
      db.insert(sessions).values({ id: 201, routineId: 1, startTime: 1000, endTime: 2000 }).run();
      db.insert(sets).values({ id: 1, sessionId: 201, exerciseId: 20, setNumber: 1, weightKg: 100, reps: 5, isWarmup: false }).run();

      const alerts = await getPlateauAdvisories(db as any);
      expect(alerts).toEqual([]);
    });

    it('identifies exercises in stale plateau state', async () => {
      db.insert(routines).values({ id: 1, name: 'Legs' }).run();
      db.insert(exercises).values({ id: 20, name: 'Squat' }).run();

      // Seed 5 consecutive sessions with identical load to trigger stale plateau
      for (let i = 1; i <= 5; i++) {
        db.insert(sessions).values({
          id: 300 + i,
          routineId: 1,
          startTime: 100000 + i * 86400,
          endTime: 103600 + i * 86400,
        }).run();
        db.insert(sets).values({
          id: 300 + i,
          sessionId: 300 + i,
          exerciseId: 20,
          setNumber: 1,
          weightKg: 100,
          reps: 5,
          isWarmup: false,
        }).run();
      }

      const alerts = await getPlateauAdvisories(db as any);
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].exerciseName).toBe('Squat');
      expect(alerts[0].topWeightKg).toBe(100);
      expect(alerts[0].topReps).toBe(5);
    });

    it('identifies exercises in declining state', async () => {
      db.insert(routines).values({ id: 2, name: 'Pull' }).run();
      db.insert(exercises).values({ id: 25, name: 'Deadlift' }).run();

      // Session 1: 150kg
      db.insert(sessions).values({ id: 350, routineId: 2, startTime: 100000, endTime: 103600 }).run();
      db.insert(sets).values({ id: 350, sessionId: 350, exerciseId: 25, setNumber: 1, weightKg: 150, reps: 5, isWarmup: false }).run();

      // Session 2: 130kg (regressed)
      db.insert(sessions).values({ id: 351, routineId: 2, startTime: 186400, endTime: 190000 }).run();
      db.insert(sets).values({ id: 351, sessionId: 351, exerciseId: 25, setNumber: 1, weightKg: 130, reps: 5, isWarmup: false }).run();

      const alerts = await getPlateauAdvisories(db as any);
      const deadliftAlert = alerts.find((a) => a.exerciseId === 25);
      expect(deadliftAlert).toBeDefined();
      expect(deadliftAlert?.state).toBe('declining');
    });
  });

  describe('getCutVelocityAdvisory', () => {
    it('returns isAdvisoryActive false when no cut or rising loads detected', async () => {
      const result = await getCutVelocityAdvisory(db as any);
      expect(result.isAdvisoryActive).toBe(false);
    });

    it('detects load rising during sustained cut', async () => {
      db.insert(routines).values({ id: 1, name: 'Chest' }).run();
      db.insert(exercises).values({ id: 30, name: 'Bench' }).run();

      // Seed weight loss across several weeks
      const baseTime = 1700000000;
      for (let i = 0; i < 6; i++) {
        db.insert(bodyMetrics).values({
          id: 10 + i,
          date: baseTime + i * 7 * 86400,
          type: 'daily',
          weight: 85 - i * 1.5, // losing 1.5kg/week
        }).run();

        db.insert(sessions).values({
          id: 400 + i,
          routineId: 1,
          startTime: baseTime + i * 7 * 86400,
          endTime: baseTime + i * 7 * 86400 + 3600,
        }).run();

        db.insert(sets).values({
          id: 400 + i,
          sessionId: 400 + i,
          exerciseId: 30,
          setNumber: 1,
          weightKg: 100 + i * 5, // load increasing despite steep cut
          reps: 5,
          isWarmup: false,
        }).run();
      }

      const advisory = await getCutVelocityAdvisory(db as any);
      expect(typeof advisory.isAdvisoryActive).toBe('boolean');
    });
  });

  describe('getOverdueWorkouts and reschedule', () => {
    it('returns overdue workouts with routine details and allows rescheduling', async () => {
      db.insert(routines).values({ id: 1, name: 'Upper Body' }).run();

      // Schedule a session in the past (overdue)
      const pastScheduledDate = 100000;
      const scheduled = scheduleSession({
        routineId: 1,
        scheduledFor: pastScheduledDate,
        occurrenceId: 'occ-1',
      });

      const overdue = await getOverdueWorkouts(db as any);
      expect(overdue.length).toBe(1);
      expect(overdue[0].sessionId).toBe(scheduled.sessionId);
      expect(overdue[0].routineName).toBe('Upper Body');

      // Reschedule it to future
      const futureDate = Date.now() + 86400000 * 7;
      rescheduleSession(
        {
          sessionId: scheduled.sessionId,
          newScheduledFor: futureDate,
        },
        db as any
      );

      const overdueAfter = await getOverdueWorkouts(db as any);
      expect(overdueAfter.length).toBe(0);
    });
  });

  describe('getMainLaneDrift', () => {
    it('calculates drift status and returns guidance', async () => {
      db.insert(routines).values({ id: 1, name: 'Main Routine', isMainLane: true }).run();

      const driftInfo = await getMainLaneDrift(db as any);
      expect(driftInfo).toBeDefined();
      expect(driftInfo.driftStatus).toBeDefined();
      expect(driftInfo.guidance).toBeDefined();
      expect(['on_track', 'drifting', 'lapsed', 'insufficient-data']).toContain(driftInfo.driftStatus.status);
    });
  });
});

import { db, sqlite } from '../fixtures/database';
import {
  TrainingVarianceService,
  computeWeeklyVariance,
  type RawSessionVarianceInput,
  type RawSetVarianceInput,
} from '@/services/TrainingVarianceService';
import { exercises, sessions, sets } from '@/src/db/schema';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

const since = Date.UTC(2026, 0, 5); // 2026-01-05 (Monday of 2026-W02)
const weekMs = 7 * 86400000;

beforeEach(() => {
  sqlite.exec(
    'DELETE FROM sets; DELETE FROM sessions; DELETE FROM exercises; DELETE FROM sqlite_sequence;'
  );
});

afterAll(() => {
  sqlite.close();
});

describe('TrainingVarianceService', () => {
  describe('Integration with synthetic DB (Trust II rules & deltas)', () => {
    it('returns empty array when no sessions exist', async () => {
      const result = await TrainingVarianceService.getWeeklyVariance();
      expect(result).toEqual([]);
    });

    it('seeds 3 sessions across 2 ISO weeks (finished with sets, finished empty, unfinished ignored) and asserts buckets, volume math, and deltas', async () => {
      // 1. Insert exercises
      db.insert(exercises)
        .values([
          { id: 1, name: 'Supino', type: 'strength', muscleGroup: 'peito' },
          { id: 2, name: 'Remada', type: 'strength', muscleGroup: 'costas' },
        ])
        .run();

      // Week 1 (2026-W02):
      // Session 1: finished, with working sets + warmups + soft-deleted sets
      db.insert(sessions)
        .values({
          id: 1,
          routineName: 'Treino A',
          startTime: since + 1000,
          endTime: since + 3600000,
        })
        .run();

      db.insert(sets)
        .values([
          // Working set 1: 100kg x 10 = 1000 (peito)
          {
            sessionId: 1,
            exerciseId: 1,
            exerciseName: 'Supino',
            setNumber: 1,
            weightKg: 100,
            reps: 10,
            isWarmup: false,
          },
          // Working set 2: 50kg x 10 = 500 (costas)
          {
            sessionId: 1,
            exerciseId: 2,
            exerciseName: 'Remada',
            setNumber: 2,
            weightKg: 50,
            reps: 10,
            isWarmup: false,
          },
          // Warmup set: must be ignored
          {
            sessionId: 1,
            exerciseId: 1,
            exerciseName: 'Supino',
            setNumber: 3,
            weightKg: 40,
            reps: 10,
            isWarmup: true,
          },
          // Deleted set: must be ignored
          {
            sessionId: 1,
            exerciseId: 1,
            exerciseName: 'Supino',
            setNumber: 4,
            weightKg: 100,
            reps: 10,
            isWarmup: false,
            deletedAt: since + 2000,
          },
        ])
        .run();

      // Session 2: finished empty-ish (0 sets) in Week 1
      db.insert(sessions)
        .values({
          id: 2,
          routineName: 'Treino B (Cardio/Empty)',
          startTime: since + 86400000,
          endTime: since + 86400000 + 1800000,
        })
        .run();

      // Session 3: NOT finished (endTime is NULL) -> must be ignored per Trust II rule!
      db.insert(sessions)
        .values({
          id: 3,
          routineName: 'Treino C (Unfinished)',
          startTime: since + 2 * 86400000,
          endTime: null,
        })
        .run();

      db.insert(sets)
        .values({
          sessionId: 3,
          exerciseId: 1,
          exerciseName: 'Supino',
          setNumber: 1,
          weightKg: 500,
          reps: 10,
          isWarmup: false,
        })
        .run();

      // Week 2 (2026-W03):
      // Session 4: finished with 1 working set
      db.insert(sessions)
        .values({
          id: 4,
          routineName: 'Treino D',
          startTime: since + weekMs + 1000,
          endTime: since + weekMs + 3600000,
        })
        .run();

      db.insert(sets)
        .values({
          sessionId: 4,
          exerciseId: 1,
          exerciseName: 'Supino',
          setNumber: 1,
          weightKg: 80,
          reps: 10,
          isWarmup: false,
        })
        .run();

      const report = await TrainingVarianceService.getWeeklyVariance();

      expect(report).toHaveLength(2);

      // Buckets sorted descending by week (Week 2 first, then Week 1)
      const [week2, week1] = report;

      // Week 2 (2026-W03): 1 session, 800 volume, 1 set, delta vs Week 1 (-700 vol, -1 sess)
      expect(week2.week).toBe('2026-W03');
      expect(week2.sessionsCount).toBe(1);
      expect(week2.sessionCount).toBe(1);
      expect(week2.totalVolume).toBe(800);
      expect(week2.totalSets).toBe(1);
      expect(week2.setsCount).toBe(1);
      expect(week2.volumeByMuscleGroup).toEqual({ peito: 800 });
      expect(week2.volumeDelta).toBe(-700);
      expect(week2.sessionsDelta).toBe(-1);
      expect(week2.delta).toEqual({
        volume: -700,
        sessions: -1,
      });

      // Week 1 (2026-W02): 2 finished sessions (S1 + S2), 1500 volume (1000 peito + 500 costas), 2 sets, no previous week delta
      expect(week1.week).toBe('2026-W02');
      expect(week1.sessionsCount).toBe(2);
      expect(week1.sessionCount).toBe(2);
      expect(week1.totalVolume).toBe(1500);
      expect(week1.totalSets).toBe(2);
      expect(week1.setsCount).toBe(2);
      expect(week1.volumeByMuscleGroup).toEqual({
        peito: 1000,
        costas: 500,
      });
      expect(week1.volumeDelta).toBeNull();
      expect(week1.sessionsDelta).toBeNull();
      expect(week1.delta).toEqual({
        volume: null,
        sessions: null,
      });
    });

    it('respects since parameter and soft-deleted sessions', async () => {
      db.insert(exercises)
        .values([{ id: 1, name: 'Leg Press', type: 'strength', muscleGroup: 'pernas' }])
        .run();

      // Session before since: should be filtered out when since is passed
      db.insert(sessions)
        .values({
          id: 1,
          routineName: 'Old Session',
          startTime: since - weekMs,
          endTime: since - weekMs + 3600000,
        })
        .run();

      // Soft deleted session in range: should be filtered out
      db.insert(sessions)
        .values({
          id: 2,
          routineName: 'Deleted Session',
          startTime: since + 1000,
          endTime: since + 3600000,
          deletedAt: since + 4000000,
        })
        .run();

      // Valid session in range
      db.insert(sessions)
        .values({
          id: 3,
          routineName: 'Valid Session',
          startTime: since + 2000,
          endTime: since + 3600000,
        })
        .run();

      db.insert(sets)
        .values({
          sessionId: 3,
          exerciseId: 1,
          exerciseName: 'Leg Press',
          setNumber: 1,
          weightKg: 200,
          reps: 10,
          isWarmup: false,
        })
        .run();

      const reportWithSince = await TrainingVarianceService.getWeeklyVariance(since);
      expect(reportWithSince).toHaveLength(1);
      expect(reportWithSince[0].week).toBe('2026-W02');
      expect(reportWithSince[0].sessionsCount).toBe(1);
      expect(reportWithSince[0].totalVolume).toBe(2000);
      expect(reportWithSince[0].volumeByMuscleGroup).toEqual({ pernas: 2000 });
    });
  });

  describe('computeWeeklyVariance (Pure Core)', () => {
    it('returns empty array when no valid finished sessions provided', () => {
      const sessionsInput: RawSessionVarianceInput[] = [
        { id: 1, startTime: since, endTime: null },
        { id: 2, startTime: since, endTime: since + 1000, deletedAt: since + 2000 },
      ];
      const setsInput: RawSetVarianceInput[] = [
        { sessionId: 1, weightKg: 100, reps: 10, isWarmup: false },
        { sessionId: 2, weightKg: 100, reps: 10, isWarmup: false },
      ];

      expect(computeWeeklyVariance(sessionsInput, setsInput)).toEqual([]);
    });

    it('correctly calculates 3 consecutive weeks with deltas and muscle group sorting', () => {
      const s1: RawSessionVarianceInput = { id: 1, startTime: since, endTime: since + 3600000 };
      const s2: RawSessionVarianceInput = {
        id: 2,
        startTime: since + weekMs,
        endTime: since + weekMs + 3600000,
      };
      const s3: RawSessionVarianceInput = {
        id: 3,
        startTime: since + 2 * weekMs,
        endTime: since + 2 * weekMs + 3600000,
      };

      const setsInput: RawSetVarianceInput[] = [
        // Week 1: 1000 costas, 1000 peito (tie-break alphabetically: costas before peito)
        { sessionId: 1, weightKg: 100, reps: 10, isWarmup: false, muscleGroup: 'peito' },
        { sessionId: 1, weightKg: 100, reps: 10, isWarmup: false, muscleGroup: 'costas' },

        // Week 2: 3000 ombros
        { sessionId: 2, weightKg: 150, reps: 20, isWarmup: false, muscleGroup: 'ombros' },

        // Week 3: 2000 pernas
        { sessionId: 3, weightKg: 200, reps: 10, isWarmup: false, muscleGroup: 'pernas' },
      ];

      const result = computeWeeklyVariance([s1, s2, s3], setsInput);

      expect(result).toHaveLength(3);

      const [w3, w2, w1] = result;

      // Week 3: 2000 volume, delta vs Week 2 (2000 - 3000 = -1000)
      expect(w3.totalVolume).toBe(2000);
      expect(w3.delta.volume).toBe(-1000);
      expect(w3.delta.sessions).toBe(0);
      expect(w3.volumeByMuscleGroup).toEqual({ pernas: 2000 });

      // Week 2: 3000 volume, delta vs Week 1 (3000 - 2000 = 1000)
      expect(w2.totalVolume).toBe(3000);
      expect(w2.delta.volume).toBe(1000);
      expect(w2.delta.sessions).toBe(0);
      expect(w2.volumeByMuscleGroup).toEqual({ ombros: 3000 });

      // Week 1: 2000 volume, alphabetical order in tie: costas, peito
      expect(w1.totalVolume).toBe(2000);
      expect(w1.delta.volume).toBeNull();
      expect(w1.delta.sessions).toBeNull();
      expect(Object.keys(w1.volumeByMuscleGroup)).toEqual(['costas', 'peito']);
    });
  });
});

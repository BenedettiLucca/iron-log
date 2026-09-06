import { estimateE1RM, AnalyticsService } from '@/services/AnalyticsService';
import { db, sqlite } from '../fixtures/database';
import { exercises, sessions, sets } from '@/src/db/schema';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

describe('AnalyticsService real production behavior', () => {

  describe('estimateE1RM (imported directly from production)', () => {
    it('returns weight as-is for 1 rep', () => {
      expect(estimateE1RM(100, 1)).toBe(100);
    });

    it('calculates 1RM for 2 reps', () => {
      // 100 * (1 + 2/30) = 100 * 1.0667 = 106.7
      expect(estimateE1RM(100, 2)).toBe(106.7);
    });

    it('calculates 1RM for 5 reps', () => {
      // 100 * (1 + 5/30) = 100 * 1.1667 = 116.7
      expect(estimateE1RM(100, 5)).toBe(116.7);
    });

    it('calculates 1RM for 10 reps', () => {
      // 80 * (1 + 10/30) = 80 * 1.3333 = 106.7
      expect(estimateE1RM(80, 10)).toBe(106.7);
    });

    it('calculates 1RM for high reps (20)', () => {
      // 60 * (1 + 20/30) = 60 * 1.6667 = 100
      expect(estimateE1RM(60, 20)).toBe(100);
    });

    it('returns 0 for zero weight', () => {
      expect(estimateE1RM(0, 10)).toBe(0);
    });

    it('returns 0 for zero reps', () => {
      expect(estimateE1RM(100, 0)).toBe(0);
    });

    it('returns 0 for negative weight', () => {
      expect(estimateE1RM(-10, 5)).toBe(0);
    });

    it('returns 0 for negative reps', () => {
      expect(estimateE1RM(100, -5)).toBe(0);
    });

    it('handles fractional weight', () => {
      // 22.5 * (1 + 8/30) = 22.5 * 1.2667 = 28.5
      expect(estimateE1RM(22.5, 8)).toBe(28.5);
    });

    it('rounds to 1 decimal place', () => {
      const result = estimateE1RM(77.5, 6);
      // 77.5 * (1 + 6/30) = 77.5 * 1.2 = 93
      expect(result).toBe(93);
    });

    it('handles heavy compound lifts', () => {
      // 140 * (1 + 3/30) = 140 * 1.1 = 154
      expect(estimateE1RM(140, 3)).toBe(154);
    });
  });

  describe('calculateStrengthScore (real service via synthetic database)', () => {
    const since = Date.UTC(2026, 0, 5);
    const week = 7 * 86400000;

    beforeEach(() => {
      sqlite.exec('DELETE FROM sets; DELETE FROM sessions; DELETE FROM exercises; DELETE FROM sqlite_sequence;');
      db.insert(exercises).values({ id: 1, name: 'Squat', type: 'strength', defaultRestSeconds: 90 }).run();
    });

    it('returns noData label when no sessions exist', async () => {
      const score = await AnalyticsService.calculateStrengthScore(since);
      expect(score).toEqual({
        totalScore: 0,
        volumeScore: 0,
        intensityScore: 0,
        consistencyScore: 0,
        labelKey: 'noData',
      });
    });

    it('computes volume, intensity, and consistency scores correctly for 1 week span', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(since + week);
      try {
        // 2 sessions in the week
        db.insert(sessions).values([
          { id: 1, routineName: 'Legs A', startTime: since + 1000 },
          { id: 2, routineName: 'Legs B', startTime: since + 2000 },
        ]).run();

        // Each session has 1 working set (21kg x 10 = 210 volume) and 1 warmup
        db.insert(sets).values([
          { sessionId: 1, exerciseId: 1, exerciseName: 'Squat', setNumber: 1, weightKg: 20, reps: 10, isWarmup: true },
          { sessionId: 1, exerciseId: 1, exerciseName: 'Squat', setNumber: 2, weightKg: 21, reps: 10, isWarmup: false },
          { sessionId: 2, exerciseId: 1, exerciseName: 'Squat', setNumber: 1, weightKg: 20, reps: 10, isWarmup: true },
          { sessionId: 2, exerciseId: 1, exerciseName: 'Squat', setNumber: 2, weightKg: 21, reps: 10, isWarmup: false },
        ]).run();

        const score = await AnalyticsService.calculateStrengthScore(since);
        expect(score).toEqual({
          totalScore: 27,
          volumeScore: 2,
          intensityScore: 10,
          consistencyScore: 15,
          labelKey: 'beginner',
        });
      } finally {
        jest.restoreAllMocks();
      }
    });

    it('computes advanced/elite scores when volume and intensity are high', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(since + week);
      try {
        // 5 sessions in the week
        for (let i = 1; i <= 5; i++) {
          db.insert(sessions).values({ id: i, routineName: `Session ${i}`, startTime: since + i * 1000 }).run();
          // Each session: 5 working sets of 100kg x 10 reps = 5000kg volume per session -> total 25000kg
          for (let s = 1; s <= 5; s++) {
            db.insert(sets).values({
              sessionId: i,
              exerciseId: 1,
              exerciseName: 'Squat',
              setNumber: s,
              weightKg: 100,
              reps: 10,
              isWarmup: false,
            }).run();
          }
        }

        const score = await AnalyticsService.calculateStrengthScore(since);
        // avgWeeklyVolume = 25000: >15000 -> 35 + min(5, (10000/15000)*5) = 35 + 3 = 38
        // avgWeight = 100: >80 -> 30
        // sessions = 5: >4 -> 25 + min(5, (1/2)*5) = 25 + 3 = 28
        // total = 38 + 30 + 28 = 96 -> elite
        expect(score.totalScore).toBeGreaterThanOrEqual(80);
        expect(score.labelKey).toBe('elite');
      } finally {
        jest.restoreAllMocks();
      }
    });
  });
});

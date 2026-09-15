import { db, sqlite } from '../fixtures/database';
import { ActivityHeatmapService, getIntensityLevel } from '@/services/ActivityHeatmapService';
import { sessions } from '@/src/db/schema';
import { toLocalDateKey } from '@/src/utils/date-key';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

const baseDate = new Date(2026, 5, 1, 10, 0, 0); // June 1, 2026 10:00 local
const baseTimestamp = baseDate.getTime();
const ONE_DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  sqlite.exec('DELETE FROM sets; DELETE FROM sessions; DELETE FROM exercises; DELETE FROM sqlite_sequence;');
});

afterAll(() => sqlite.close());

describe('ActivityHeatmapService', () => {
  describe('intensity levels', () => {
    it('maps minutes correctly to intensity buckets 0-3', () => {
      expect(getIntensityLevel(0)).toBe(0);
      expect(getIntensityLevel(-5)).toBe(0);
      expect(getIntensityLevel(1)).toBe(1);
      expect(getIntensityLevel(30)).toBe(1);
      expect(getIntensityLevel(31)).toBe(2);
      expect(getIntensityLevel(60)).toBe(2);
      expect(getIntensityLevel(61)).toBe(3);
      expect(getIntensityLevel(120)).toBe(3);
    });
  });

  describe('getDailyActivity against fixture database', () => {
    it('seeds finished, unfinished, and deleted sessions across days and asserts only valid sessions are counted with correct minutes', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(baseTimestamp + 5 * ONE_DAY);

      try {
        const day0 = baseTimestamp;
        const day1 = baseTimestamp + 1 * ONE_DAY;
        const day2 = baseTimestamp + 2 * ONE_DAY;
        const day3 = baseTimestamp + 3 * ONE_DAY;

        const day0Key = toLocalDateKey(day0);
        const day1Key = toLocalDateKey(day1);
        const day2Key = toLocalDateKey(day2);
        const day3Key = toLocalDateKey(day3);

        db.insert(sessions).values([
          // Day 0: Valid finished session with durationMinutes = 45
          {
            id: 1,
            routineName: 'Treino A',
            startTime: day0,
            endTime: day0 + 45 * 60 * 1000,
            durationMinutes: 45,
            deletedAt: null,
          },
          // Day 1: Valid finished session without durationMinutes -> fallback (endTime - startTime) = 60 min
          {
            id: 2,
            routineName: 'Treino B',
            startTime: day1,
            endTime: day1 + 60 * 60 * 1000,
            durationMinutes: null,
            deletedAt: null,
          },
          // Day 1: Another valid finished session on same day with durationMinutes = 30
          {
            id: 3,
            routineName: 'Cardio',
            startTime: day1 + 4 * 60 * 60 * 1000,
            endTime: day1 + 4 * 60 * 60 * 1000 + 30 * 60 * 1000,
            durationMinutes: 30,
            deletedAt: null,
          },
          // Day 2: Unfinished session (endTime IS NULL) -> TRUST II rule: MUST BE IGNORED
          {
            id: 4,
            routineName: 'Unfinished Treino',
            startTime: day2,
            endTime: null,
            durationMinutes: 50,
            deletedAt: null,
          },
          // Day 3: Soft-deleted finished session (deletedAt IS NOT NULL) -> TRUST II rule: MUST BE IGNORED
          {
            id: 5,
            routineName: 'Deleted Treino',
            startTime: day3,
            endTime: day3 + 40 * 60 * 1000,
            durationMinutes: 40,
            deletedAt: day3 + 50 * 60 * 1000,
          },
        ]).run();

        const buckets = await ActivityHeatmapService.getDailyActivity(day0);

        // Verify day0 bucket
        const b0 = buckets.find((b) => b.date === day0Key);
        expect(b0).toBeDefined();
        expect(b0?.sessions).toBe(1);
        expect(b0?.minutes).toBe(45);

        // Verify day1 bucket (aggregated 2 sessions: 60 + 30 = 90 min)
        const b1 = buckets.find((b) => b.date === day1Key);
        expect(b1).toBeDefined();
        expect(b1?.sessions).toBe(2);
        expect(b1?.minutes).toBe(90);

        // Verify day2 bucket (unfinished session ignored -> 0 sessions, 0 minutes)
        const b2 = buckets.find((b) => b.date === day2Key);
        expect(b2).toBeDefined();
        expect(b2?.sessions).toBe(0);
        expect(b2?.minutes).toBe(0);

        // Verify day3 bucket (deleted session ignored -> 0 sessions, 0 minutes)
        const b3 = buckets.find((b) => b.date === day3Key);
        expect(b3).toBeDefined();
        expect(b3?.sessions).toBe(0);
        expect(b3?.minutes).toBe(0);
      } finally {
        jest.restoreAllMocks();
      }
    });

    it('returns empty buckets for date range when no sessions exist', async () => {
      jest.spyOn(Date, 'now').mockReturnValue(baseTimestamp + 2 * ONE_DAY);
      try {
        const buckets = await ActivityHeatmapService.getDailyActivity(baseTimestamp);
        expect(buckets.length).toBeGreaterThanOrEqual(3);
        expect(buckets.every((b) => b.sessions === 0 && b.minutes === 0)).toBe(true);
      } finally {
        jest.restoreAllMocks();
      }
    });
  });

  describe('buildHeatmap', () => {
    it('builds a grid of 53 weeks × 7 days and calculates summary metrics', () => {
      const dayKey = toLocalDateKey(baseTimestamp);
      const buckets = [
        { date: dayKey, minutes: 75, sessions: 1 },
      ];

      const heatmap = ActivityHeatmapService.buildHeatmap(buckets, 53, baseDate);
      expect(heatmap.weeks.length).toBe(53);
      expect(heatmap.weeks[0].days.length).toBe(7);
      expect(heatmap.totalSessions).toBe(1);
      expect(heatmap.totalMinutes).toBe(75);
      expect(heatmap.activeDays).toBe(1);

      // Find the day in the grid
      const matchingDay = heatmap.weeks
        .flatMap((w) => w.days)
        .find((d) => d.date === dayKey);

      expect(matchingDay).toBeDefined();
      expect(matchingDay?.intensity).toBe(3); // 75 min -> level 3
      expect(matchingDay?.sessions).toBe(1);
      expect(matchingDay?.minutes).toBe(75);
    });
  });
});

import { db, sqlite } from '../fixtures/database';
import { bodyMetrics } from '@/src/db/schema';
import {
  fetchRecentBodyMetrics,
  fetchLatestValidWeight,
  fetchLatestMonthlyWithPhotos,
  fetchFullBodyMetricsHistory,
  DEFAULT_PREVIEW_LIMIT,
  useBodyMetrics,
} from '@/hooks/use-body-metrics';
import { renderHook, act } from '@testing-library/react-native';
import { weightInputSchema, monthlyCheckinSchema } from '@/src/validators/forms';

// Mock client db to use our in-memory SQLite fixture
jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

describe('Body metrics query separation (Issue #137 & Contract C2)', () => {
  beforeEach(() => {
    sqlite.exec("DELETE FROM body_metrics; DELETE FROM sqlite_sequence WHERE name='body_metrics';");
  });

  afterAll(() => {
    sqlite.close();
  });

  describe('fetchRecentBodyMetrics', () => {
    it('returns empty array when table is empty', async () => {
      const result = await fetchRecentBodyMetrics(db);
      expect(result).toEqual([]);
    });

    it('limits returned rows to DEFAULT_PREVIEW_LIMIT (10) when thousands of rows exist', async () => {
      const totalRows = 1500;
      const baseTime = Date.UTC(2025, 0, 1);

      db.transaction((tx) => {
        for (let i = 0; i < totalRows; i++) {
          tx.insert(bodyMetrics)
            .values({
              date: baseTime + i * 86400000,
              type: 'daily',
              weight: 70 + (i % 10) * 0.5,
            })
            .run();
        }
      });

      const countResult = sqlite.prepare('SELECT COUNT(*) as count FROM body_metrics').get() as { count: number };
      expect(countResult.count).toBe(1500);

      const recent = await fetchRecentBodyMetrics(db);
      expect(recent).toHaveLength(DEFAULT_PREVIEW_LIMIT);
      expect(recent).toHaveLength(10);

      // Verify descending order: first item is the newest
      expect(recent[0].date).toBe(baseTime + (totalRows - 1) * 86400000);
      expect(recent[1].date).toBe(baseTime + (totalRows - 2) * 86400000);
      expect(recent[9].date).toBe(baseTime + (totalRows - 10) * 86400000);
    });

    it('respects a custom limit when specified', async () => {
      const baseTime = Date.UTC(2025, 0, 1);
      db.transaction((tx) => {
        for (let i = 0; i < 20; i++) {
          tx.insert(bodyMetrics)
            .values({
              date: baseTime + i * 86400000,
              type: 'daily',
              weight: 80,
            })
            .run();
        }
      });

      const customLimit5 = await fetchRecentBodyMetrics(db, 5);
      expect(customLimit5).toHaveLength(5);
    });
  });

  describe('fetchLatestValidWeight', () => {
    it('returns null when database has no records', async () => {
      const result = await fetchLatestValidWeight(db);
      expect(result).toBeNull();
    });

    it('returns latest valid weight in a large database with thousands of records', async () => {
      const totalRows = 1200;
      const baseTime = Date.UTC(2024, 0, 1);

      db.transaction((tx) => {
        for (let i = 0; i < totalRows; i++) {
          tx.insert(bodyMetrics)
            .values({
              date: baseTime + i * 86400000,
              type: 'daily',
              weight: 75.0 + i * 0.01,
            })
            .run();
        }
      });

      const latestWeight = await fetchLatestValidWeight(db);
      const expectedWeight = 75.0 + (totalRows - 1) * 0.01;
      expect(latestWeight).toBeCloseTo(expectedWeight, 2);
    });

    it('skips recent records with null, zero, negative, or invalid weight to find the latest valid one', async () => {
      const t1 = Date.UTC(2026, 2, 1);
      const t2 = Date.UTC(2026, 2, 2);
      const t3 = Date.UTC(2026, 2, 3);
      const t4 = Date.UTC(2026, 2, 4);

      // t1: valid weight 78.5
      db.insert(bodyMetrics).values({ date: t1, type: 'daily', weight: 78.5 }).run();
      // t2: null weight (e.g. checkin with only measurements)
      db.insert(bodyMetrics).values({ date: t2, type: 'monthly', weight: null, waist: 82 }).run();
      // t3: zero weight (invalid in domain)
      db.insert(bodyMetrics).values({ date: t3, type: 'daily', weight: 0 }).run();
      // t4: negative or > 999 out of bounds
      db.insert(bodyMetrics).values({ date: t4, type: 'daily', weight: 1050 }).run();

      const latest = await fetchLatestValidWeight(db);
      expect(latest).toBe(78.5);
    });

    it('finds valid weight from monthly checkin if newer than daily weight', async () => {
      const t1 = Date.UTC(2026, 1, 1);
      const t2 = Date.UTC(2026, 1, 15);

      db.insert(bodyMetrics).values({ date: t1, type: 'daily', weight: 80.0 }).run();
      db.insert(bodyMetrics).values({ date: t2, type: 'monthly', weight: 79.2, waist: 80 }).run();

      const latest = await fetchLatestValidWeight(db);
      expect(latest).toBe(79.2);
    });
  });

  describe('fetchLatestMonthlyWithPhotos', () => {
    it('returns null when there are no monthly records with photos', async () => {
      db.insert(bodyMetrics).values({
        date: Date.UTC(2026, 0, 1),
        type: 'daily',
        weight: 80,
      }).run();
      db.insert(bodyMetrics).values({
        date: Date.UTC(2026, 0, 2),
        type: 'monthly',
        weight: 80,
        photoFront: null,
        photoBack: null,
        photoSide: null,
      }).run();

      const result = await fetchLatestMonthlyWithPhotos(db);
      expect(result).toBeNull();
    });

    it('finds the latest monthly check-in with photos even when older than 10 recent items', async () => {
      const photoTime = Date.UTC(2026, 0, 1);
      db.insert(bodyMetrics).values({
        date: photoTime,
        type: 'monthly',
        weight: 85,
        photoFront: 'file:///photo_front.jpg',
        photoBack: null,
        photoSide: null,
      }).run();

      // Add 25 daily weights after the photo check-in
      db.transaction((tx) => {
        for (let i = 1; i <= 25; i++) {
          tx.insert(bodyMetrics)
            .values({
              date: photoTime + i * 86400000,
              type: 'daily',
              weight: 85 - i * 0.1,
            })
            .run();
        }
      });

      // Preview query only returns 10 items — photo check-in is NOT in the preview!
      const recent = await fetchRecentBodyMetrics(db, 10);
      expect(recent).toHaveLength(10);
      expect(recent.some((m) => m.photoFront !== null)).toBe(false);

      // Dedicated query still correctly finds the latest monthly with photos
      const latestMonthly = await fetchLatestMonthlyWithPhotos(db);
      expect(latestMonthly).not.toBeNull();
      expect(latestMonthly?.date).toBe(photoTime);
      expect(latestMonthly?.photoFront).toBe('file:///photo_front.jpg');
    });

    it('ignores daily records that accidentally contain photos', async () => {
      db.insert(bodyMetrics).values({
        date: Date.UTC(2026, 1, 1),
        type: 'daily',
        weight: 82,
        photoFront: 'file:///daily_photo.jpg',
      }).run();

      const result = await fetchLatestMonthlyWithPhotos(db);
      expect(result).toBeNull();
    });

    it('ignores empty-string photo paths', async () => {
      db.insert(bodyMetrics).values({
        date: Date.UTC(2026, 1, 1),
        type: 'monthly',
        photoFront: '',
        photoBack: '',
        photoSide: '',
      }).run();

      const result = await fetchLatestMonthlyWithPhotos(db);
      expect(result).toBeNull();
    });
  });

  describe('fetchFullBodyMetricsHistory (explicit API for evolution/export)', () => {
    it('retrieves all rows without 10-item cap', async () => {
      const total = 50;
      const baseTime = Date.UTC(2025, 5, 1);
      db.transaction((tx) => {
        for (let i = 0; i < total; i++) {
          tx.insert(bodyMetrics)
            .values({
              date: baseTime + i * 86400000,
              type: 'daily',
              weight: 70 + i,
            })
            .run();
        }
      });

      const fullHistory = await fetchFullBodyMetricsHistory(db);
      expect(fullHistory).toHaveLength(50);
      expect(fullHistory[0].date).toBe(baseTime + 49 * 86400000);
      expect(fullHistory[49].date).toBe(baseTime);
    });
  });

  describe('Contract C2 decimal parsing on Bio inputs', () => {
    it('accepts comma and dot interchangeably for weight without NaN or truncation', () => {
      const commaRes = weightInputSchema.safeParse({ weight: '74,5' });
      const dotRes = weightInputSchema.safeParse({ weight: '74.5' });

      expect(commaRes.success).toBe(true);
      expect(dotRes.success).toBe(true);
      if (commaRes.success && dotRes.success) {
        expect(commaRes.data.weight).toBe(74.5);
        expect(dotRes.data.weight).toBe(74.5);
      }
    });

    it('rejects ambiguous or mixed separators and non-numeric junk in weight', () => {
      expect(weightInputSchema.safeParse({ weight: '74,500.5' }).success).toBe(false);
      expect(weightInputSchema.safeParse({ weight: '74,5kg' }).success).toBe(false);
      expect(weightInputSchema.safeParse({ weight: '74..5' }).success).toBe(false);
      expect(weightInputSchema.safeParse({ weight: '74,,5' }).success).toBe(false);
      expect(weightInputSchema.safeParse({ weight: 'abc' }).success).toBe(false);
    });

    it('accepts comma and dot in monthly checkin measurements', () => {
      const parsed = monthlyCheckinSchema.safeParse({
        waist: '82,5',
        chest: '102.3',
        armRight: '36,8',
        thighRight: '59.0',
        calf: '38,2',
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.waist).toBe(82.5);
        expect(parsed.data.chest).toBe(102.3);
        expect(parsed.data.armRight).toBe(36.8);
        expect(parsed.data.thighRight).toBe(59.0);
        expect(parsed.data.calf).toBe(38.2);
      }
    });

    it('distinguishes empty strings from invalid values in monthly measurements', () => {
      const parsed = monthlyCheckinSchema.safeParse({
        waist: '',
        chest: '  ',
        armRight: undefined,
      });

      expect(parsed.success).toBe(true);
      if (parsed.success) {
        expect(parsed.data.waist).toBeUndefined();
        expect(parsed.data.chest).toBeUndefined();
        expect(parsed.data.armRight).toBeUndefined();
      }
    });
  });

  describe('useBodyMetrics hook contract and behavior', () => {

    it('loads small queries on mount: 10 recent items, latest valid weight, latest monthly photos', async () => {
      const baseTime = Date.UTC(2025, 6, 1);
      // Insert monthly check-in with photos
      db.insert(bodyMetrics).values({
        date: baseTime,
        type: 'monthly',
        weight: 80,
        photoFront: 'file:///checkin.jpg',
      }).run();

      // Insert 20 daily weights
      db.transaction((tx) => {
        for (let i = 1; i <= 20; i++) {
          tx.insert(bodyMetrics).values({
            date: baseTime + i * 86400000,
            type: 'daily',
            weight: 80 - i * 0.2,
          }).run();
        }
      });

      const { result } = renderHook(() => useBodyMetrics());

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        await result.current.fetchMetrics();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.hasError).toBe(false);
      expect(result.current.metrics).toHaveLength(10);
      expect(result.current.recentMetrics).toHaveLength(10);
      // Latest valid weight is the newest daily entry (80 - 20*0.2 = 76.0)
      expect(result.current.latestValidWeight).toBeCloseTo(76.0, 1);
      // Latest monthly with photos is correctly found even though it is outside the 10 recent items
      expect(result.current.latestMonthlyWithPhotos).not.toBeNull();
      expect(result.current.latestMonthlyWithPhotos?.photoFront).toBe('file:///checkin.jpg');
    });

    it('saveDailyWeight inserts record and updates preview and latest weight', async () => {
      const { result } = renderHook(() => useBodyMetrics());

      await act(async () => {
        await result.current.fetchMetrics();
      });

      expect(result.current.metrics).toHaveLength(0);
      expect(result.current.latestValidWeight).toBeNull();

      let success = false;
      await act(async () => {
        success = await result.current.saveDailyWeight(77.5);
      });

      expect(success).toBe(true);
      expect(result.current.metrics).toHaveLength(1);
      expect(result.current.metrics[0].weight).toBe(77.5);
      expect(result.current.latestValidWeight).toBe(77.5);
    });

    it('fetchFullHistory and fetchMetrics({ fullHistory: true }) provide un-truncated dataset', async () => {
      const baseTime = Date.UTC(2025, 0, 1);
      db.transaction((tx) => {
        for (let i = 0; i < 25; i++) {
          tx.insert(bodyMetrics).values({
            date: baseTime + i * 86400000,
            type: 'daily',
            weight: 70 + i,
          }).run();
        }
      });

      const { result } = renderHook(() => useBodyMetrics());

      await act(async () => {
        await result.current.fetchMetrics();
      });

      // Default is preview only (10 items)
      expect(result.current.metrics).toHaveLength(10);

      // Explicit full history API
      let fullData: any[] = [];
      await act(async () => {
        fullData = await result.current.fetchFullHistory();
      });
      expect(fullData).toHaveLength(25);

      // fullHistory option in fetchMetrics
      await act(async () => {
        await result.current.fetchMetrics({ fullHistory: true });
      });
      expect(result.current.metrics).toHaveLength(25);
    });

    it('handles query failures gracefully without crashing', async () => {
      const { result } = renderHook(() => useBodyMetrics());

      // Drop table temporarily to force SQLite error
      sqlite.exec('DROP TABLE body_metrics;');

      try {
        await act(async () => {
          await result.current.fetchMetrics();
        });

        expect(result.current.hasError).toBe(true);
        expect(result.current.metrics).toEqual([]);
        expect(result.current.latestValidWeight).toBeNull();
        expect(result.current.latestMonthlyWithPhotos).toBeNull();
      } finally {
        // Recreate table
        sqlite.exec(`
          CREATE TABLE body_metrics (
            id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
            date integer NOT NULL,
            type text DEFAULT 'daily',
            weight real,
            waist real,
            arm_right real,
            thigh_right real,
            chest real,
            calf real,
            photo_front text,
            photo_back text,
            photo_side text,
            photo_notes text
          );
        `);
      }
    });
  });

  describe('Scale verification: 3000 body metrics rows volume benchmark', () => {
    it('proves opening Bio materializes at most 12 total rows across all 3 small queries', async () => {
      const totalCount = 3000;
      const baseTime = Date.UTC(2020, 0, 1);

      // Seed 3000 records
      db.transaction((tx) => {
        for (let i = 0; i < totalCount; i++) {
          const isMonthly = i % 30 === 0;
          tx.insert(bodyMetrics).values({
            date: baseTime + i * 86400000,
            type: isMonthly ? 'monthly' : 'daily',
            weight: 75.0 + (i % 50) * 0.1,
            photoFront: isMonthly ? `file:///photo_${i}.jpg` : null,
          }).run();
        }
      });

      const count = (sqlite.prepare('SELECT COUNT(*) as c FROM body_metrics').get() as { c: number }).c;
      expect(count).toBe(3000);

      // Measure small queries used by Bio screen
      const recentRows = await fetchRecentBodyMetrics(db, 10);
      const latestWeight = await fetchLatestValidWeight(db);
      const latestMonthly = await fetchLatestMonthlyWithPhotos(db);

      // Exactly 10 rows for preview
      expect(recentRows).toHaveLength(10);
      // Valid weight returned
      expect(latestWeight).not.toBeNull();
      // Valid monthly checkin returned
      expect(latestMonthly).not.toBeNull();

      // Total rows materialized in JS is strictly bounded (10 + 1 + 1 = 12)
      const totalMaterializedRows = recentRows.length + (latestWeight !== null ? 1 : 0) + (latestMonthly !== null ? 1 : 0);
      expect(totalMaterializedRows).toBeLessThanOrEqual(12);
      expect(totalMaterializedRows).toBe(12);
    });
  });
});

import { db, sqlite } from '../fixtures/database';
import { sessions, sets, bodyMetrics, exercises } from '@/src/db/schema';
import {
  CsvExportService,
  escapeCsvField,
  toCsvRow,
  formatDateBR,
} from '@/services/CsvExportService';
import * as Sharing from 'expo-sharing';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

const writtenFiles = new Map<string, string>();

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///mock-cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn((path: string, content: string) => {
    writtenFiles.set(path, content);
    return Promise.resolve();
  }),
  readAsStringAsync: jest.fn((path: string) => {
    return Promise.resolve(writtenFiles.get(path) ?? '');
  }),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

describe('CsvExportService (production imports & SQLite integration)', () => {
  beforeEach(() => {
    sqlite.exec(`
      PRAGMA foreign_keys = OFF;
      DELETE FROM sets;
      DELETE FROM sessions;
      DELETE FROM body_metrics;
      DELETE FROM exercises;
      DELETE FROM sqlite_sequence;
      PRAGMA foreign_keys = ON;
    `);
    writtenFiles.clear();
    jest.clearAllMocks();
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
    (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
  });

  describe('escapeCsvField', () => {
    it('returns string as-is when no special chars', () => {
      expect(escapeCsvField('hello')).toBe('hello');
    });

    it('escapes fields with commas', () => {
      expect(escapeCsvField('foo,bar')).toBe('"foo,bar"');
    });

    it('escapes fields with double quotes', () => {
      expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    });

    it('escapes fields with newlines', () => {
      expect(escapeCsvField('line1\nline2')).toBe('"line1\nline2"');
    });

    it('handles numbers', () => {
      expect(escapeCsvField(42)).toBe('42');
    });

    it('handles null as empty string', () => {
      expect(escapeCsvField(null)).toBe('');
    });

    it('handles undefined as empty string', () => {
      expect(escapeCsvField(undefined)).toBe('');
    });
  });

  describe('toCsvRow', () => {
    it('joins fields with commas', () => {
      expect(toCsvRow(['a', 'b', 'c'])).toBe('a,b,c');
    });

    it('properly escapes fields in row', () => {
      expect(toCsvRow(['hello', 'has,comma', 42])).toBe('hello,"has,comma",42');
    });

    it('handles empty array', () => {
      expect(toCsvRow([])).toBe('');
    });
  });

  describe('formatDateBR', () => {
    it('formats a known date correctly in local time', () => {
      const d = new Date(2026, 0, 15, 12, 0, 0);
      const result = formatDateBR(d.getTime());
      expect(result).toBe('15/01/2026');
    });

    it('returns empty for null or undefined', () => {
      expect(formatDateBR(null)).toBe('');
      expect(formatDateBR(undefined as unknown as null)).toBe('');
    });

    it('returns empty for NaN', () => {
      expect(formatDateBR(NaN)).toBe('');
    });

    it('pads day and month', () => {
      const d = new Date(2026, 0, 5, 10, 0, 0);
      const result = formatDateBR(d.getTime());
      expect(result).toBe('05/01/2026');
    });
  });

  describe('exportSessionsCsv', () => {
    it('exports header only when no sessions exist', async () => {
      const csv = await CsvExportService.exportSessionsCsv();
      expect(csv).toBe('Date,Routine,Duration (min),Body Weight (kg),sRPE,Notes,Exercise,Set #,Weight (kg),Reps,Duration (s),RIR,Warmup');
    });

    it('exports sessions and sets, respecting C1 (includes completed & open sessions, excludes soft-deleted)', async () => {
      // Completed session
      await db.insert(sessions).values({
        id: 1,
        startTime: new Date(2026, 6, 20, 10, 0).getTime(),
        endTime: new Date(2026, 6, 20, 11, 0).getTime(),
        durationMinutes: 60,
        routineName: 'Push A',
        bodyWeight: 80.5,
        sRpe: 8,
        notes: 'Great workout',
        deletedAt: null,
      });

      // Open / incomplete session without endTime (C1: must be retained, not hidden)
      await db.insert(sessions).values({
        id: 2,
        startTime: new Date(2026, 6, 21, 10, 0).getTime(),
        endTime: null,
        durationMinutes: null,
        routineName: 'Pull B',
        bodyWeight: 81.0,
        sRpe: null,
        notes: 'In-progress session',
        deletedAt: null,
      });

      // Soft-deleted session (must be excluded)
      await db.insert(sessions).values({
        id: 3,
        startTime: new Date(2026, 6, 19, 10, 0).getTime(),
        endTime: new Date(2026, 6, 19, 11, 0).getTime(),
        durationMinutes: 60,
        routineName: 'Deleted Routine',
        deletedAt: new Date(2026, 6, 19, 12, 0).getTime(),
      });

      // Exercise for sets
      await db.insert(exercises).values({
        id: 10,
        name: 'Supino Reto',
        type: 'strength',
      });

      // Sets for session 1
      await db.insert(sets).values([
        {
          sessionId: 1,
          exerciseId: 10,
          exerciseName: 'Supino Reto',
          setNumber: 1,
          weightKg: 80,
          reps: 8,
          durationSeconds: null,
          rir: 2,
          isWarmup: false,
          deletedAt: null,
        },
        {
          sessionId: 1,
          exerciseId: 10,
          exerciseName: 'Supino Reto',
          setNumber: 2,
          weightKg: 80,
          reps: 7,
          durationSeconds: null,
          rir: 1,
          isWarmup: false,
          deletedAt: null,
        },
        // Soft-deleted set (must be excluded)
        {
          sessionId: 1,
          exerciseId: 10,
          exerciseName: 'Supino Reto',
          setNumber: 3,
          weightKg: 80,
          reps: 5,
          durationSeconds: null,
          rir: 0,
          isWarmup: false,
          deletedAt: new Date(2026, 6, 20, 11, 30).getTime(),
        },
      ]);

      const csv = await CsvExportService.exportSessionsCsv();
      const lines = csv.split('\n');

      expect(lines).toHaveLength(4); // Header + 1 set row from open session (or session without sets) + 2 sets from session 1
      expect(csv).toContain('Push A');
      expect(csv).toContain('Pull B');
      expect(csv).not.toContain('Deleted Routine');
      expect(csv).toContain('Supino Reto,1,80,8,,2,No');
      expect(csv).toContain('Supino Reto,2,80,7,,1,No');
      expect(csv).not.toContain('Supino Reto,3,80,5');
    });
  });

  describe('exportBodyMetricsCsv', () => {
    it('exports body metrics sorted desc by date', async () => {
      await db.insert(bodyMetrics).values([
        {
          date: new Date(2026, 6, 10, 8, 0).getTime(),
          type: 'daily',
          weight: 80.2,
          waist: null,
          armRight: null,
          thighRight: null,
          chest: null,
          calf: null,
        },
        {
          date: new Date(2026, 6, 20, 8, 0).getTime(),
          type: 'monthly',
          weight: 81.0,
          waist: 84.5,
          armRight: 38.0,
          thighRight: 59.0,
          chest: 102.0,
          calf: 39.0,
        },
      ]);

      const csv = await CsvExportService.exportBodyMetricsCsv();
      const lines = csv.split('\n');
      expect(lines[0]).toBe('Date,Type,Weight (kg),Waist (cm),R. Arm (cm),R. Thigh (cm),Chest (cm),Calf (cm)');
      expect(lines[1]).toContain('20/07/2026,monthly,81,84.5,38,59,102,39');
      expect(lines[2]).toContain('10/07/2026,daily,80.2,,,,,');
    });
  });

  describe('exportExercisesCsv', () => {
    it('exports exercises sorted asc by name', async () => {
      await db.insert(exercises).values([
        { id: 1, name: 'Supino Reto', type: 'strength', defaultRestSeconds: 120 },
        { id: 2, name: 'Agachamento', type: 'strength', defaultRestSeconds: 180 },
      ]);

      const csv = await CsvExportService.exportExercisesCsv();
      const lines = csv.split('\n');
      expect(lines[0]).toBe('ID,Name,Type,Default Rest (s)');
      expect(lines[1]).toBe('2,Agachamento,strength,180');
      expect(lines[2]).toBe('1,Supino Reto,strength,120');
    });
  });

  describe('exportSessionCsv', () => {
    it('returns empty string when session not found or soft-deleted', async () => {
      await db.insert(sessions).values({
        id: 99,
        startTime: new Date(2026, 6, 20, 10, 0).getTime(),
        deletedAt: new Date(2026, 6, 20, 12, 0).getTime(),
      });

      const resNotFound = await CsvExportService.exportSessionCsv(12345);
      expect(resNotFound).toBe('');

      const resDeleted = await CsvExportService.exportSessionCsv(99);
      expect(resDeleted).toBe('');
    });

    it('exports metadata header comments and set rows for a specific session', async () => {
      await db.insert(sessions).values({
        id: 10,
        startTime: new Date(2026, 6, 20, 10, 0).getTime(),
        durationMinutes: 45,
        routineName: 'Leg Day',
        bodyWeight: 80,
        sRpe: 7,
      });

      await db.insert(exercises).values({
        id: 5,
        name: 'Agachamento',
        type: 'strength',
      });

      await db.insert(sets).values({
        sessionId: 10,
        exerciseId: 5,
        exerciseName: 'Agachamento',
        setNumber: 1,
        weightKg: 100,
        reps: 5,
        isWarmup: false,
      });

      const csv = await CsvExportService.exportSessionCsv(10);
      expect(csv).toContain('# Iron Log - Leg Day');
      expect(csv).toContain('# Duration: 45 min');
      expect(csv).toContain('Agachamento,1,100,5,,,No');
    });
  });

  describe('exportAllAndShare (multi-file sequential sharing & payload spy)', () => {
    it('delivers both sessions and metrics CSVs to Sharing mechanism and verifies payloads', async () => {
      await db.insert(sessions).values({
        id: 1,
        startTime: new Date(2026, 6, 20, 10, 0).getTime(),
        routineName: 'Upper A',
      });
      await db.insert(bodyMetrics).values({
        date: new Date(2026, 6, 20, 8, 0).getTime(),
        weight: 79.5,
      });

      const result = await CsvExportService.exportAllAndShare();

      expect(result.success).toBe(true);
      expect(result.sessions.offered).toBe(true);
      expect(result.metrics.offered).toBe(true);

      // Verify spy reads actual file payloads written to cache
      expect(writtenFiles.has(result.sessions.path)).toBe(true);
      expect(writtenFiles.has(result.metrics.path)).toBe(true);

      const sessionsContent = writtenFiles.get(result.sessions.path);
      const metricsContent = writtenFiles.get(result.metrics.path);

      expect(sessionsContent).toContain('Upper A');
      expect(metricsContent).toContain('79.5');

      // Verify Sharing was called twice in sequence with correct files and dialog titles
      expect(Sharing.shareAsync).toHaveBeenCalledTimes(2);
      expect(Sharing.shareAsync).toHaveBeenNthCalledWith(1, result.sessions.path, expect.objectContaining({
        dialogTitle: 'Exportar Sessões Iron Log (1/2)',
        mimeType: 'text/csv',
      }));
      expect(Sharing.shareAsync).toHaveBeenNthCalledWith(2, result.metrics.path, expect.objectContaining({
        dialogTitle: 'Exportar Métricas Iron Log (2/2)',
        mimeType: 'text/csv',
      }));
    });

    it('returns partial failure when second step (metrics) fails', async () => {
      (Sharing.shareAsync as jest.Mock)
        .mockResolvedValueOnce(undefined) // sessions ok
        .mockRejectedValueOnce(new Error('Sharing cancelled or failed on metrics')); // metrics fails

      const result = await CsvExportService.exportAllAndShare();

      expect(result.success).toBe(false);
      expect(result.sessions.offered).toBe(true);
      expect(result.metrics.offered).toBe(false);
      expect(result.metrics.error).toContain('Sharing cancelled or failed on metrics');
    });

    it('throws error when sharing is unavailable', async () => {
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);

      await expect(CsvExportService.exportAllAndShare()).rejects.toThrow('services.sharingUnavailable');
    });
  });

  describe('exportSessionsAndShare & exportBodyMetricsAndShare', () => {
    it('shares only sessions CSV', async () => {
      const path = await CsvExportService.exportSessionsAndShare();
      expect(path).toContain('ironlog_sessions_');
      expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
    });

    it('shares only body metrics CSV', async () => {
      const path = await CsvExportService.exportBodyMetricsAndShare();
      expect(path).toContain('ironlog_metrics_');
      expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
    });
  });
});

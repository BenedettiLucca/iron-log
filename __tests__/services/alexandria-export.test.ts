import { db, sqlite } from '../fixtures/database';
import { sessions, sets, bodyMetrics, personalRecords, measurementGoals, exercises } from '@/src/db/schema';
import {
  AlexandriaExportService,
  formatEpochISO,
  formatEpochDate,
  computeWorkoutType,
  computeVolume,
  computeDurationSeconds,
  buildSessionRecord,
  buildMetricRecord,
  buildPRRecord,
  buildGoalRecord,
  AlexandriaExport,
} from '@/services/AlexandriaExportService';
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


describe('AlexandriaExportService \u2014 pure functions', () => {

  // =========================================================================
  describe('formatEpochISO', () => {
    it('returns null for null', () => {
      expect(formatEpochISO(null)).toBeNull();
    });

    it('returns null for 0 (falsy)', () => {
      expect(formatEpochISO(0)).toBeNull();
    });

    it('formats a known epoch to ISO string', () => {
      const result = formatEpochISO(1700000000000);
      expect(result).toBe('2023-11-14T22:13:20.000Z');
    });

    it('includes timezone Z suffix', () => {
      const result = formatEpochISO(1714000000000);
      expect(result).toMatch(/Z$/);
    });
  });

  // =========================================================================
  describe('formatEpochDate', () => {
    it('returns null for null', () => {
      expect(formatEpochDate(null)).toBeNull();
    });

    it('returns null for NaN or invalid epoch', () => {
      expect(formatEpochDate(NaN)).toBeNull();
    });

    it('returns local calendar date in YYYY-MM-DD format', () => {
      const d = new Date(2025, 0, 5, 12, 0, 0);
      const result = formatEpochDate(d.getTime());
      expect(result).toBe('2025-01-05');
    });

    it('preserves local calendar date near midnight', () => {
      const lateNight = new Date(2026, 6, 20, 23, 45, 0).getTime();
      expect(formatEpochDate(lateNight)).toBe('2026-07-20');

      const earlyMorning = new Date(2026, 6, 20, 0, 15, 0).getTime();
      expect(formatEpochDate(earlyMorning)).toBe('2026-07-20');
    });
  });

  // =========================================================================
  describe('computeWorkoutType', () => {
    it('returns "strength" for strength only', () => {
      expect(computeWorkoutType(['strength', 'strength'])).toBe('strength');
    });

    it('returns "cardio" for duration only', () => {
      expect(computeWorkoutType(['duration'])).toBe('cardio');
    });

    it('returns "other" for mixed', () => {
      expect(computeWorkoutType(['strength', 'duration'])).toBe('other');
    });

    it('returns "strength" for empty array', () => {
      expect(computeWorkoutType([])).toBe('strength');
    });

    it('returns "other" regardless of order', () => {
      expect(computeWorkoutType(['duration', 'strength'])).toBe('other');
    });
  });

  // =========================================================================
  describe('computeVolume', () => {
    it('returns 0 for empty array', () => {
      expect(computeVolume([])).toBe(0);
    });

    it('calculates total volume excluding warmup sets', () => {
      const sets = [
        { weightKg: 60, reps: 10, isWarmup: true },
        { weightKg: 80, reps: 5, isWarmup: false },
        { weightKg: 80, reps: 5, isWarmup: false },
        { weightKg: 40, reps: 8, isWarmup: false },
      ];
      expect(computeVolume(sets)).toBe(1120);
    });

    it('returns 0 if all sets are warmup', () => {
      const sets = [
        { weightKg: 40, reps: 10, isWarmup: true },
        { weightKg: 60, reps: 5, isWarmup: true },
      ];
      expect(computeVolume(sets)).toBe(0);
    });

    it('handles zero weight/reps gracefully', () => {
      const sets = [
        { weightKg: 0, reps: 10, isWarmup: false },
        { weightKg: 100, reps: 0, isWarmup: false },
      ];
      expect(computeVolume(sets)).toBe(0);
    });
  });

  // =========================================================================
  describe('computeDurationSeconds', () => {
    it('calculates from start and end timestamps', () => {
      const result = computeDurationSeconds(1700000000000, 1700003600000, null);
      expect(result).toBe(3600);
    });

    it('falls back to durationMinutes * 60', () => {
      const result = computeDurationSeconds(null, null, 45);
      expect(result).toBe(2700);
    });

    it('prefers timestamps over durationMinutes', () => {
      const result = computeDurationSeconds(1700000000000, 1700003600000, 45);
      expect(result).toBe(3600);
    });

    it('returns null when all inputs are null', () => {
      expect(computeDurationSeconds(null, null, null)).toBeNull();
    });

    it('returns null when endTime <= startTime', () => {
      expect(computeDurationSeconds(1700003600000, 1700000000000, null)).toBeNull();
      expect(computeDurationSeconds(1700000000000, 1700000000000, null)).toBeNull();
    });
  });

  // =========================================================================
  describe('buildSessionRecord', () => {
    const mockSession = {
      id: 42,
      routineId: 1,
      routineName: 'Push Day',
      startTime: new Date(2023, 10, 14, 15, 0, 0).getTime(),
      endTime: new Date(2023, 10, 14, 16, 0, 0).getTime(),
      durationMinutes: null as number | null,
      bodyWeight: 80.5,
      sRpe: 8 as number | null,
      notes: 'Bom treino' as string | null,
    };

    const mockSets = [
      { exerciseName: 'Supino Reto', exerciseId: 1, setNumber: 1, weightKg: 80, reps: 5, durationSeconds: null as number | null, rir: 1 as number | null, isWarmup: false },
      { exerciseName: 'Supino Reto', exerciseId: 1, setNumber: 2, weightKg: 80, reps: 5, durationSeconds: null as number | null, rir: 0 as number | null, isWarmup: false },
      { exerciseName: 'OHP', exerciseId: 2, setNumber: 1, weightKg: 40, reps: 8, durationSeconds: null as number | null, rir: 2 as number | null, isWarmup: false },
    ];

    const exerciseTypes = new Map([
      [1, 'strength'],
      [2, 'strength'],
    ]);

    it('builds correct external_id', () => {
      const result = buildSessionRecord(mockSession, mockSets, exerciseTypes, 'Push Day');
      expect(result.external_id).toBe('session-42');
    });

    it('formats workout_date as YYYY-MM-DD', () => {
      const result = buildSessionRecord(mockSession, mockSets, exerciseTypes, 'Push Day');
      expect(result.workout_date).toBe('2023-11-14');
    });

    it('computes workout_type from exercise types', () => {
      const result = buildSessionRecord(mockSession, mockSets, exerciseTypes, 'Push Day');
      expect(result.workout_type).toBe('strength');
    });

    it('uses routine name as session name', () => {
      const result = buildSessionRecord(mockSession, mockSets, exerciseTypes, 'Push Day');
      expect(result.name).toBe('Push Day');
    });

    it('groups sets by exercise name', () => {
      const result = buildSessionRecord(mockSession, mockSets, exerciseTypes, 'Push Day');
      expect(result.exercises).toHaveLength(2);
      const bench = result.exercises.find(e => e.name === 'Supino Reto');
      expect(bench?.sets).toHaveLength(2);
    });

    it('computes volume excluding warmups', () => {
      const result = buildSessionRecord(mockSession, mockSets, exerciseTypes, 'Push Day');
      expect(result.volume_kg).toBe(1120);
    });

    it('includes metadata with routine info', () => {
      const result = buildSessionRecord(mockSession, mockSets, exerciseTypes, 'Push Day');
      expect(result.metadata.routine_id).toBe(1);
      expect(result.metadata.routine_name).toBe('Push Day');
      expect(result.metadata.body_weight).toBe(80.5);
      expect(result.metadata.set_count).toBe(3);
    });

    it('handles empty sets', () => {
      const result = buildSessionRecord(mockSession, [], exerciseTypes, 'Push Day');
      expect(result.exercises).toHaveLength(0);
      expect(result.volume_kg).toBeNull();
      expect(result.metadata.set_count).toBe(0);
    });

    it('handles mixed strength + cardio exercises', () => {
      const mixedTypes = new Map([[1, 'strength'], [2, 'duration']]);
      const result = buildSessionRecord(mockSession, mockSets, mixedTypes, 'Full Body');
      expect(result.workout_type).toBe('other');
    });

    it('tags include iron-log and workout type', () => {
      const result = buildSessionRecord(mockSession, mockSets, exerciseTypes, 'Push Day');
      expect(result.tags).toContain('iron-log');
      expect(result.tags).toContain('strength');
    });

    it('falls back to notes when no routine name', () => {
      const noName = { ...mockSession, routineName: null };
      const result = buildSessionRecord(noName, mockSets, exerciseTypes, null);
      expect(result.name).toBe('Bom treino');
    });
  });

  // =========================================================================
  describe('buildMetricRecord', () => {
    it('builds weight entry when weight is present', () => {
      const result = buildMetricRecord({
        id: 1, date: 1700000000000, weight: 80.5,
        waist: null, armRight: null, thighRight: null, chest: null, calf: null, type: 'daily',
      });
      expect(result.weight).toBeDefined();
      expect(result.weight!.entry_type).toBe('weight');
      expect(result.weight!.numeric_value).toBe(80.5);
      expect(result.weight!.external_id).toBe('metric-1700000000000');
      expect(result.body_composition).toBeUndefined();
    });

    it('builds body_composition when measurements present', () => {
      const result = buildMetricRecord({
        id: 1, date: 1700000000000, weight: 80,
        waist: 85, armRight: 33, thighRight: 58, chest: 100, calf: 38, type: 'monthly',
      });
      expect(result.body_composition).toBeDefined();
      expect(result.body_composition!.entry_type).toBe('body_composition');
      expect(result.body_composition!.value).toEqual({
        waist: 85, arm_right: 33, thigh_right: 58, chest: 100, calf: 38,
      });
      expect(result.body_composition!.external_id).toBe('metric-1700000000000-measurements');
    });

    it('builds both weight and body_composition', () => {
      const result = buildMetricRecord({
        id: 1, date: 1700000000000, weight: 80.5,
        waist: 85, armRight: null, thighRight: null, chest: null, calf: null, type: 'monthly',
      });
      expect(result.weight).toBeDefined();
      expect(result.body_composition).toBeDefined();
    });

    it('returns empty object when no weight and no measurements', () => {
      const result = buildMetricRecord({
        id: 1, date: 1700000000000, weight: null,
        waist: null, armRight: null, thighRight: null, chest: null, calf: null, type: null,
      });
      expect(result.weight).toBeUndefined();
      expect(result.body_composition).toBeUndefined();
    });

    it('body_composition numeric_value is weight when available', () => {
      const result = buildMetricRecord({
        id: 1, date: 1700000000000, weight: 80.5,
        waist: 85, armRight: null, thighRight: null, chest: null, calf: null, type: 'monthly',
      });
      expect(result.body_composition!.numeric_value).toBe(80.5);
    });
  });

  // =========================================================================
  describe('buildPRRecord', () => {
    it('builds correct weight PR record', () => {
      const result = buildPRRecord({
        id: 1, exerciseId: 5, exerciseName: 'Supino Reto (Barra)',
        recordType: 'weight', value: 100, weightKg: 100, reps: null, estimated1RM: null,
        date: 1714000000000,
      });
      expect(result.external_id).toBe('pr-weight-1');
      expect(result.exercise_name).toBe('Supino Reto (Barra)');
      expect(result.record_type).toBe('weight');
      expect(result.value).toBe(100);
      expect(result.date).toBe('2024-04-24T23:06:40.000Z');
    });

    it('builds reps PR with null weight', () => {
      const result = buildPRRecord({
        id: 2, exerciseId: 5, exerciseName: 'Supino Reto (Barra)',
        recordType: 'reps', value: 12, weightKg: null, reps: 12, estimated1RM: null,
        date: 1714000000000,
      });
      expect(result.record_type).toBe('reps');
      expect(result.weight_kg).toBeNull();
      expect(result.reps).toBe(12);
    });
  });

  // =========================================================================
  describe('buildGoalRecord', () => {
    it('builds correct goal record', () => {
      const result = buildGoalRecord({
        id: 1, type: 'waist', targetValue: 80,
        startDate: Date.UTC(2026, 0, 1, 12, 0, 0),
        targetDate: Date.UTC(2026, 5, 30, 12, 0, 0),
        achieved: false,
      });
      expect(result.external_id).toBe('goal-waist-1');
      expect(result.type).toBe('waist');
      expect(result.target_value).toBe(80);
      expect(result.achieved).toBe(false);
      expect(result.start_date).toMatch(/2026-01-01/);
      expect(result.target_date).toMatch(/2026-06-30/);
    });

    it('marks achieved goals', () => {
      const result = buildGoalRecord({
        id: 2, type: 'weight', targetValue: 75,
        startDate: 1700000000000, targetDate: 1714000000000, achieved: true,
      });
      expect(result.achieved).toBe(true);
    });
  });

  // =========================================================================
  describe('AlexandriaExportService (database integration & sharing)', () => {
    beforeEach(() => {
      sqlite.exec(`
        PRAGMA foreign_keys = OFF;
        DELETE FROM sets;
        DELETE FROM sessions;
        DELETE FROM exercises;
        DELETE FROM body_metrics;
        DELETE FROM personal_records;
        DELETE FROM measurement_goals;
        DELETE FROM sqlite_sequence;
        PRAGMA foreign_keys = ON;
      `);
      writtenFiles.clear();
      jest.clearAllMocks();
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
      (Sharing.shareAsync as jest.Mock).mockResolvedValue(undefined);
    });

    it('exports structured JSON matching Alexandria schema, respecting C1', async () => {
      // Exercises
      await db.insert(exercises).values([
        { id: 1, name: 'Supino Reto', type: 'strength' },
        { id: 2, name: 'Corrida', type: 'duration' },
      ]);

      // Completed session
      await db.insert(sessions).values({
        id: 1,
        startTime: new Date(2026, 6, 20, 18, 0).getTime(),
        endTime: new Date(2026, 6, 20, 19, 0).getTime(),
        durationMinutes: 60,
        routineName: 'Upper Body',
        bodyWeight: 80.0,
        sRpe: 8,
        notes: 'Good session',
        deletedAt: null,
      });

      // Open session (endTime null, C1: retained)
      await db.insert(sessions).values({
        id: 2,
        startTime: new Date(2026, 6, 21, 10, 0).getTime(),
        endTime: null,
        durationMinutes: null,
        routineName: 'Open Workout',
        bodyWeight: null,
        deletedAt: null,
      });

      // Soft-deleted session (must be excluded)
      await db.insert(sessions).values({
        id: 3,
        startTime: new Date(2026, 6, 19, 10, 0).getTime(),
        routineName: 'Deleted Workout',
        deletedAt: new Date(2026, 6, 19, 12, 0).getTime(),
      });

      // Sets for session 1
      await db.insert(sets).values([
        {
          sessionId: 1,
          exerciseId: 1,
          exerciseName: 'Supino Reto',
          setNumber: 1,
          weightKg: 80,
          reps: 8,
          isWarmup: false,
          deletedAt: null,
        },
        // Soft-deleted set (must be excluded)
        {
          sessionId: 1,
          exerciseId: 1,
          exerciseName: 'Supino Reto',
          setNumber: 2,
          weightKg: 80,
          reps: 6,
          isWarmup: false,
          deletedAt: new Date(2026, 6, 20, 18, 30).getTime(),
        },
      ]);

      // Body metrics
      await db.insert(bodyMetrics).values({
        date: new Date(2026, 6, 20, 8, 0).getTime(),
        weight: 80.0,
        waist: 84,
      });

      // Personal records
      await db.insert(personalRecords).values({
        id: 1,
        exerciseId: 1,
        recordType: 'weight',
        value: 100,
        date: new Date(2026, 6, 20, 18, 30).getTime(),
      });

      // Goals
      await db.insert(measurementGoals).values({
        id: 1,
        type: 'weight',
        targetValue: 78,
        startDate: new Date(2026, 6, 1).getTime(),
        targetDate: new Date(2026, 11, 31).getTime(),
        achieved: false,
      });

      const jsonStr = await AlexandriaExportService.exportAlexandriaJson();
      const exportData: AlexandriaExport = JSON.parse(jsonStr);

      expect(exportData.export_version).toBe(1);
      expect(exportData.sessions).toHaveLength(2); // session 1 and session 2 (open)
      expect(exportData.sessions.find(s => s.external_id === 'session-1')).toBeDefined();
      expect(exportData.sessions.find(s => s.external_id === 'session-2')).toBeDefined();
      expect(exportData.sessions.find(s => s.external_id === 'session-3')).toBeUndefined();

      const s1 = exportData.sessions.find(s => s.external_id === 'session-1')!;
      expect(s1.workout_date).toBe('2026-07-20');
      expect(s1.exercises).toHaveLength(1);
      expect(s1.exercises[0].sets).toHaveLength(1); // soft-deleted set excluded

      expect(exportData.body_metrics.length).toBeGreaterThan(0);
      expect(exportData.personal_records).toHaveLength(1);
      expect(exportData.personal_records[0].exercise_name).toBe('Supino Reto');
      expect(exportData.measurement_goals).toHaveLength(1);
    });

    it('exports and shares JSON via FileSystem and Sharing with spy payload verification', async () => {
      await db.insert(sessions).values({
        id: 1,
        startTime: new Date(2026, 6, 20, 18, 0).getTime(),
        routineName: 'Upper Body',
      });

      await AlexandriaExportService.exportAndShare();

      expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        expect.stringContaining('ironlog_alexandria_'),
        expect.objectContaining({
          dialogTitle: 'Exportar para Alexandria',
          mimeType: 'application/json',
        }),
      );

      // Verify written payload via spy
      const filePath = (Sharing.shareAsync as jest.Mock).mock.calls[0][0];
      expect(writtenFiles.has(filePath)).toBe(true);
      const content = JSON.parse(writtenFiles.get(filePath)!);
      expect(content.export_version).toBe(1);
      expect(content.sessions).toHaveLength(1);
    });

    it('throws error when sharing is unavailable', async () => {
      (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);

      await expect(AlexandriaExportService.exportAndShare()).rejects.toThrow('services.sharingUnavailable');
    });
  });
});

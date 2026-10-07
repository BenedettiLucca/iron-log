import AsyncStorage from '@react-native-async-storage/async-storage';
import { db, sqlite } from '../fixtures/database';
import { exercises, sessions, sets, bodyMetrics } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import {
  finishSession,
  type FinishSessionParams,
} from '@/services/SessionLifecycleService';
import {
  buildSessionSummary,
  type SummarySession,
  type SummarySet,
} from '@/src/utils/session-summary';
import { buildSessionRecord } from '@/services/AlexandriaExportService';
import { CsvExportService } from '@/services/CsvExportService';
import { NotionExportService } from '@/services/NotionExportService';
import { executeImport } from '@/services/importers/db-executor';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn().mockResolvedValue(true),
  getStringAsync: jest.fn().mockResolvedValue(''),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///mock-cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
}));

/**
 * Extended params interface representing the desired contract for Issue #147.
 * When weight is borrowed (carried over from previous measurements) rather than
 * measured during the current workout, the system must not persist it as a
 * measured session weight, nor fabricate a synthetic body_metrics row.
 */
interface ProvenanceFinishSessionParams extends FinishSessionParams {
  weightProvenance?: 'measured' | 'borrowed';
  isWeightMeasured?: boolean;
}

interface ProvenanceSummarySession extends SummarySession {
  borrowedWeight?: number | null;
  borrowedWeightDate?: number | null;
  weightProvenance?: 'measured' | 'borrowed' | null;
}

const mockTranslate = (key: string, vars?: Record<string, string | number>): string => {
  if (key === 'summary.workoutReport') return `WORKOUT ${vars?.name ?? 'Iron Log'}`;
  if (key === 'summary.reportWeight') return 'Weight';
  if (key === 'summary.reportDuration') return 'Duration';
  if (key === 'summary.reportSrpe') return 'sRPE';
  if (key === 'reports.md.workout') return 'Workout';
  if (key === 'reports.md.unknown') return 'Unknown';
  if (key === 'reports.md.set') return 'Set';
  if (key === 'reports.md.weightKg') return 'Weight (kg)';
  if (key === 'reports.md.reps') return 'Reps';
  return key;
};

describe('Issue #147: Body-weight provenance contract (RED tests)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sqlite.exec(`
      DELETE FROM personal_records;
      DELETE FROM body_metrics;
      DELETE FROM sets;
      DELETE FROM sessions;
      DELETE FROM exercises;
      DELETE FROM sqlite_sequence;
    `);

    // Seed exercise fixture
    db.insert(exercises)
      .values({
        id: 1,
        name: 'Supino Reto',
        type: 'strength',
        defaultRestSeconds: 90,
      })
      .run();
  });

  describe('Contract Rule (a): sessions.body_weight stays NULL when not measured this session', () => {
    it('keeps sessions.body_weight NULL when weight is borrowed rather than measured in this session', async () => {
      const PREV_MEASURED_TIME = 1000000;
      const SESSION_START_TIME = 2000000;
      const SESSION_END_TIME = 2000000 + 45 * 60000;

      // Seed previous ground-truth measurement in bodyMetrics
      db.insert(bodyMetrics)
        .values({
          id: 1,
          date: PREV_MEASURED_TIME,
          type: 'daily',
          weight: 78.5,
        })
        .run();

      // Seed active session
      db.insert(sessions)
        .values({
          id: 100,
          routineName: 'Treino A',
          startTime: SESSION_START_TIME,
          bodyWeight: null,
        })
        .run();

      const finishParams: ProvenanceFinishSessionParams = {
        sessionId: 100,
        startTime: SESSION_START_TIME,
        endTime: SESSION_END_TIME,
        weight: '78.5',
        weightProvenance: 'borrowed',
        isWeightMeasured: false,
        sRpe: 8,
        notes: 'Treino sem pesagem no dia',
      };

      await finishSession(finishParams as FinishSessionParams);

      const session = db.select().from(sessions).where(eq(sessions.id, 100)).get();

      // CONTRACT RULE (a): sessions.body_weight stays NULL when not measured this session
      // Current behavior fails: finishSession blindly parses params.weight and updates sessions.bodyWeight = 78.5
      expect(session?.bodyWeight).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('incomplete_session');
    });

    it('preserves measured weight behavior: persists session.body_weight when explicitly measured', async () => {
      const SESSION_START_TIME = 3000000;
      const SESSION_END_TIME = 3000000 + 50 * 60000;

      db.insert(sessions)
        .values({
          id: 200,
          routineName: 'Treino B',
          startTime: SESSION_START_TIME,
          bodyWeight: null,
        })
        .run();

      const finishParams: ProvenanceFinishSessionParams = {
        sessionId: 200,
        startTime: SESSION_START_TIME,
        endTime: SESSION_END_TIME,
        weight: '79.2',
        weightProvenance: 'measured',
        isWeightMeasured: true,
        sRpe: 7,
      };

      await finishSession(finishParams as FinishSessionParams);

      const session = db.select().from(sessions).where(eq(sessions.id, 200)).get();

      // Explicitly measured weights MUST continue to be recorded in session
      expect(session?.bodyWeight).toBe(79.2);
    });
  });

  describe('Contract Rule (c): NEVER insert a synthetic body_metrics row for borrowed weight', () => {
    it('NEVER inserts a synthetic body_metrics row when weight is borrowed during session finish', async () => {
      const PREV_MEASURED_TIME = 1000000;
      const SESSION_START_TIME = 2000000;
      const SESSION_END_TIME = 2000000 + 45 * 60000;

      // Seed previous ground-truth measurement in bodyMetrics
      db.insert(bodyMetrics)
        .values({
          id: 1,
          date: PREV_MEASURED_TIME,
          type: 'daily',
          weight: 78.5,
        })
        .run();

      // Seed active session
      db.insert(sessions)
        .values({
          id: 101,
          routineName: 'Treino A',
          startTime: SESSION_START_TIME,
          bodyWeight: null,
        })
        .run();

      const finishParams: ProvenanceFinishSessionParams = {
        sessionId: 101,
        startTime: SESSION_START_TIME,
        endTime: SESSION_END_TIME,
        weight: '78.5',
        weightProvenance: 'borrowed',
        isWeightMeasured: false,
        sRpe: 8,
      };

      await finishSession(finishParams as FinishSessionParams);

      const allMetrics = db.select().from(bodyMetrics).all();

      // CONTRACT RULE (c): NEVER insert a synthetic body_metrics row for borrowed weight
      // Current behavior fails: finishSession inserts a duplicate daily bodyMetrics record at SESSION_END_TIME
      expect(allMetrics).toHaveLength(1);
      expect(allMetrics[0].date).toBe(PREV_MEASURED_TIME);
      expect(allMetrics[0].weight).toBe(78.5);
    });

    it('writes body_metrics row when weight was explicitly measured during session', async () => {
      const SESSION_START_TIME = 4000000;
      const SESSION_END_TIME = 4000000 + 40 * 60000;

      db.insert(sessions)
        .values({
          id: 201,
          routineName: 'Treino C',
          startTime: SESSION_START_TIME,
          bodyWeight: null,
        })
        .run();

      const finishParams: ProvenanceFinishSessionParams = {
        sessionId: 201,
        startTime: SESSION_START_TIME,
        endTime: SESSION_END_TIME,
        weight: '81.0',
        weightProvenance: 'measured',
        isWeightMeasured: true,
        sRpe: 8,
      };

      await finishSession(finishParams as FinishSessionParams);

      const allMetrics = db.select().from(bodyMetrics).all();

      // Explicitly measured weight writes a legitimate ground-truth bio-metric entry
      expect(allMetrics).toHaveLength(1);
      expect(allMetrics[0].weight).toBe(81.0);
      expect(allMetrics[0].date).toBe(SESSION_END_TIME);
    });
  });

  describe('Contract Rule (b): Reports display most recent MEASURED weight with explicit provenance', () => {
    it('displays most recent measured weight with explicit provenance (borrowed/carried marker) when session weight is NULL', () => {
      const session: ProvenanceSummarySession = {
        routineId: 1,
        routineName: 'Treino A',
        startTime: 1714000000000,
        bodyWeight: null, // Not measured this session
        borrowedWeight: 78.5,
        borrowedWeightDate: 1713500000000,
        weightProvenance: 'borrowed',
        sRpe: 8,
        notes: null,
        durationMinutes: 45,
      };

      const setsData: SummarySet[] = [
        {
          exerciseId: 1,
          exerciseName: 'Supino Reto',
          setNumber: 1,
          weightKg: 80,
          reps: 8,
          durationSeconds: null,
          rir: 2,
          isWarmup: false,
        },
      ];

      const summary = buildSessionSummary({
        session: session as SummarySession,
        setsData,
        targetsMap: new Map(),
        t: mockTranslate,
        locale: 'pt-BR',
      });

      // CONTRACT RULE (b): Reports display most recent measured weight with explicit provenance
      // Current behavior fails: buildSessionSummary renders "Weight: N/A kg" when bodyWeight is null
      expect(summary.report).toMatch(/78\.5\s*kg\s*(\(borrowed\)|\(carried\)|\(anterior\)|\(medido em)/i);
    });
  });

  describe('Contract Rule (d): Exporters mark borrowed values with provenance indicators', () => {
    it('AlexandriaExportService marks borrowed weight in session metadata', () => {
      const session = {
        id: 100,
        routineId: 1,
        routineName: 'Treino A',
        startTime: 1714000000000,
        endTime: 1714003600000,
        durationMinutes: 60,
        bodyWeight: 78.5,
        weightProvenance: 'borrowed' as const,
        sRpe: 8,
        notes: null,
      };

      const sessionSets = [
        {
          exerciseId: 1,
          exerciseName: 'Supino Reto',
          setNumber: 1,
          weightKg: 80,
          reps: 8,
          durationSeconds: null,
          rir: 2,
          isWarmup: false,
        },
      ];

      const record = buildSessionRecord(
        session,
        sessionSets,
        new Map([[1, 'strength']]),
        'Treino A'
      );

      // CONTRACT RULE (d): Alexandria export marks borrowed values
      // Current behavior fails: record.metadata does not include body_weight_provenance
      expect(record.metadata).toHaveProperty('body_weight_provenance', 'borrowed');
    });

    it('CsvExportService: borrowed session (bodyWeight NULL + prior bodyMetrics) produces NO synthetic export label; report provenance lives in weekly layer', async () => {
      // Previous ground-truth measurement (borrowed from here)
      db.insert(bodyMetrics).values({
        id: 1,
        date: 1713500000000,
        type: 'daily',
        weight: 78.5,
      }).run();

      // Session finished without measurement -> bodyWeight stays NULL (Invariant a)
      db.insert(sessions).values({
        id: 100,
        routineName: 'Treino A',
        startTime: 1714000000000,
        endTime: 1714003600000,
        durationMinutes: 60,
        bodyWeight: null,
        sRpe: 8,
        notes: null,
      }).run();

      db.insert(sets).values({
        id: 1,
        sessionId: 100,
        exerciseId: 1,
        exerciseName: 'Supino Reto',
        setNumber: 1,
        weightKg: 80,
        reps: 8,
        isWarmup: false,
      }).run();

      const csvContent = await CsvExportService.exportSessionCsv(100);

      // Option 1: session's own export contains NO synthetic borrowing label (there is no stored borrowed value to label)
      expect(csvContent).toMatch(/# Peso: - kg/i);
      expect(csvContent).not.toMatch(/\(borrowed\)/i);

      // Provenance markers live in REPORTS (which read bodyMetrics history), not in per-session exports
      // Under Option 1, per-session export labels are REMOVED; this is consistent with the zero-migration design
      const session = db.select().from(sessions).where(eq(sessions.id, 100)).get();
      expect(session?.bodyWeight).toBeNull();

      // Report-layer resolution of carried weight is a missing capability (legitimate RED under Option 1)
      const sessionForReport = {
        routineId: 1,
        routineName: 'Treino A',
        startTime: 1714000000000,
        bodyWeight: null,
        borrowedWeight: 78.5,
        borrowedWeightDate: 1713500000000,
        weightProvenance: 'borrowed',
        sRpe: 8,
        notes: null,
        durationMinutes: 60,
      } as ProvenanceSummarySession;

      const setsData: SummarySet[] = [{
        exerciseId: 1,
        exerciseName: 'Supino Reto',
        setNumber: 1,
        weightKg: 80,
        reps: 8,
        durationSeconds: null,
        rir: 2,
        isWarmup: false,
      }];

      const summary = buildSessionSummary({
        session: sessionForReport as SummarySession,
        setsData,
        targetsMap: new Map(),
        t: mockTranslate,
        locale: 'pt-BR',
      });

      // Weekly/report provenance: buildSessionSummary MUST resolve carried weight with marker (missing capability)
      expect(summary.report).toMatch(/78\.5\s*kg\s*(\(borrowed\)|\(carried\)|\(anterior\)|\(medido em)/i);
    });

    it('NotionExportService: borrowed session (bodyWeight NULL + prior bodyMetrics) produces NO synthetic export label; report provenance lives in weekly layer', async () => {
      // Previous ground-truth measurement (borrowed from here)
      db.insert(bodyMetrics).values({
        id: 1,
        date: 1713500000000,
        type: 'daily',
        weight: 78.5,
      }).run();

      // Session finished without measurement -> bodyWeight stays NULL (Invariant a)
      db.insert(sessions).values({
        id: 100,
        routineName: 'Treino A',
        startTime: 1714000000000,
        endTime: 1714003600000,
        durationMinutes: 60,
        bodyWeight: null,
        sRpe: 8,
        notes: null,
      }).run();

      db.insert(sets).values({
        id: 1,
        sessionId: 100,
        exerciseId: 1,
        exerciseName: 'Supino Reto',
        setNumber: 1,
        weightKg: 80,
        reps: 8,
        isWarmup: false,
      }).run();

      const markdown = await NotionExportService.exportSessionMarkdown(100, mockTranslate);

      // Option 1: session's own export contains NO synthetic borrowing label (there is no stored borrowed value to label)
      expect(markdown).toMatch(/body_weight: -/i);
      expect(markdown).not.toMatch(/body_weight_provenance:/i);

      // Provenance markers live in REPORTS (which read bodyMetrics history), not in per-session exports
      // Under Option 1, per-session export labels are REMOVED; this is consistent with the zero-migration design
      const session = db.select().from(sessions).where(eq(sessions.id, 100)).get();
      expect(session?.bodyWeight).toBeNull();

      // Report-layer resolution of carried weight is a missing capability (legitimate RED under Option 1)
      const sessionForReport = {
        routineId: 1,
        routineName: 'Treino A',
        startTime: 1714000000000,
        bodyWeight: null,
        borrowedWeight: 78.5,
        borrowedWeightDate: 1713500000000,
        weightProvenance: 'borrowed',
        sRpe: 8,
        notes: null,
        durationMinutes: 60,
      } as ProvenanceSummarySession;

      const setsData: SummarySet[] = [{
        exerciseId: 1,
        exerciseName: 'Supino Reto',
        setNumber: 1,
        weightKg: 80,
        reps: 8,
        durationSeconds: null,
        rir: 2,
        isWarmup: false,
      }];

      const summary = buildSessionSummary({
        session: sessionForReport as SummarySession,
        setsData,
        targetsMap: new Map(),
        t: mockTranslate,
        locale: 'pt-BR',
      });

      // Weekly/report provenance: buildSessionSummary MUST resolve carried weight with marker (missing capability)
      expect(summary.report).toMatch(/78\.5\s*kg\s*(\(borrowed\)|\(carried\)|\(anterior\)|\(medido em)/i);
    });
  });

  describe('Contract Rule (e): Restore & import compatibility rule', () => {
    it('preserves NULL body_weight on import and does not fabricate synthetic body_metrics rows', () => {
      // Import a workout with unmeasured body weight
      const parsedGroups = [
        {
          routineName: 'Imported Routine',
          startTime: 5000000,
          endTime: 5000000 + 3600000,
          durationMinutes: 60,
          notes: 'Workout imported from external tracker',
          bodyWeight: null,
          sRpe: 7,
          sets: [
            {
              exerciseName: 'Supino Reto',
              weightKg: 70,
              reps: 10,
              setNumber: 1,
              isWarmup: false,
              rir: 2,
              durationSeconds: null,
            },
          ],
        },
      ];

      const result = executeImport(parsedGroups, db);
      expect(result.sessionsCreated).toBe(1);

      const importedSession = db.select().from(sessions).where(eq(sessions.startTime, 5000000)).get();
      const metrics = db.select().from(bodyMetrics).all();

      // Rule (e): Imported workouts without weight maintain bodyWeight: null and insert 0 synthetic bodyMetrics
      expect(importedSession?.bodyWeight).toBeNull();
      expect(metrics).toHaveLength(0);
    });
  });
});

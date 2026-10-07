import { db as defaultDb } from '@/src/db/client';
import { sessions, sets, exercises, bodyMetrics, routines } from '@/src/db/schema';
import { and, asc, eq, isNull, isNotNull, sql, inArray } from 'drizzle-orm';
import {
  detectPlateaus,
  type PlateauSessionLoad,
} from '@/services/plateau-detection';
import {
  detectCutVelocityAdvisories,
  type MeasuredWeightEntry,
  type SessionTopLoad,
  type MultiExerciseCutAdvisoryResult,
  type CutVelocityResult,
} from '@/services/cut-velocity';
import {
  computeDriftStatus,
  buildReentryGuidance,
  DEFAULT_DRIFT_THRESHOLD_DAYS,
  type DriftStatus,
  type ReentryGuidance,
  type PerformedSessionSummary,
  type LaneType,
} from '@/services/lane-drift';
import {
  queryOverdueSessions,
  rescheduleSession,
  deviceLocalMidnightToday,
  type OverdueQueryResult,
} from '@/services/session-schedule';

export interface PlateauAlertItem {
  exerciseId: number;
  exerciseName: string;
  state: 'stale' | 'declining';
  staleSessions?: number;
  topWeightKg: number;
  topReps: number;
}

export interface CutAdvisoryState {
  isAdvisoryActive: boolean;
  result: CutVelocityResult;
}

export interface OverdueWorkoutItem {
  sessionId: number;
  routineId: number | null;
  routineName: string;
  scheduledFor: number;
  occurrenceId: string | null;
}

export interface MainLaneDriftInfo {
  driftStatus: DriftStatus;
  guidance: ReentryGuidance;
}

type AppDatabase = typeof defaultDb;

/**
 * Fetch top working-set loads grouped by exercise for plateau and cut analysis.
 */
export async function getTopLoadsByExercise(
  dbInstance: AppDatabase = defaultDb
): Promise<{
  plateauMap: Record<string, PlateauSessionLoad[]>;
  cutMap: Record<string, SessionTopLoad[]>;
  exerciseNames: Record<number, string>;
}> {
  const rows = await dbInstance
    .select({
      sessionId: sets.sessionId,
      exerciseId: sets.exerciseId,
      exerciseName: exercises.name,
      weightKg: sets.weightKg,
      reps: sets.reps,
      rir: sets.rir,
      deletedAt: sets.deletedAt,
      startTime: sessions.startTime,
    })
    .from(sets)
    .innerJoin(sessions, eq(sets.sessionId, sessions.id))
    .innerJoin(exercises, eq(sets.exerciseId, exercises.id))
    .where(
      and(
        isNull(sets.deletedAt),
        isNull(sessions.deletedAt),
        sql`NOT ${sets.isWarmup}`,
        sql`${sets.weightKg} > 0`,
        sql`${sets.reps} > 0`
      )
    )
    .orderBy(asc(sessions.startTime), asc(sets.sessionId));

  const bestBySessionAndEx = new Map<string, typeof rows[0]>();
  const exerciseNames: Record<number, string> = {};

  for (const r of rows) {
    exerciseNames[r.exerciseId] = r.exerciseName;
    const key = `${r.exerciseId}:${r.sessionId}`;
    const existing = bestBySessionAndEx.get(key);
    if (!existing) {
      bestBySessionAndEx.set(key, r);
    } else {
      if (
        r.weightKg > existing.weightKg ||
        (r.weightKg === existing.weightKg && r.reps > existing.reps)
      ) {
        bestBySessionAndEx.set(key, r);
      }
    }
  }

  const plateauMap: Record<string, PlateauSessionLoad[]> = {};
  const cutMap: Record<string, SessionTopLoad[]> = {};

  for (const r of bestBySessionAndEx.values()) {
    const exKey = String(r.exerciseId);
    if (!plateauMap[exKey]) {
      plateauMap[exKey] = [];
      cutMap[exKey] = [];
    }

    plateauMap[exKey].push({
      sessionId: r.sessionId,
      startTime: r.startTime,
      weightKg: r.weightKg,
      reps: r.reps,
      rir: r.rir ?? null,
      deletedAt: null,
    });

    cutMap[exKey].push({
      sessionId: r.sessionId,
      startTime: r.startTime,
      weightKg: r.weightKg,
      reps: r.reps,
      rir: r.rir ?? null,
      deletedAt: null,
      exerciseId: r.exerciseId,
    });
  }

  // Sort chronologically
  for (const k of Object.keys(plateauMap)) {
    plateauMap[k].sort((a, b) => a.startTime - b.startTime || a.sessionId - b.sessionId);
    cutMap[k].sort((a, b) => a.startTime - b.startTime || a.sessionId - b.sessionId);
  }

  return { plateauMap, cutMap, exerciseNames };
}

/**
 * Detects exercises with stale or declining progression for non-clinical advisory alerts.
 */
export async function getPlateauAdvisories(
  dbInstance: AppDatabase = defaultDb
): Promise<PlateauAlertItem[]> {
  const { plateauMap, exerciseNames } = await getTopLoadsByExercise(dbInstance);
  const detected = detectPlateaus(plateauMap);

  const alerts: PlateauAlertItem[] = [];

  for (const [exIdStr, state] of Object.entries(detected)) {
    const exId = Number(exIdStr);
    const name = exerciseNames[exId] || `Exercise ${exId}`;

    if (state.state === 'stale') {
      alerts.push({
        exerciseId: exId,
        exerciseName: name,
        state: 'stale',
        staleSessions: state.staleSessions,
        topWeightKg: state.topLoad.weightKg,
        topReps: state.topLoad.reps,
      });
    } else if (state.state === 'declining') {
      alerts.push({
        exerciseId: exId,
        exerciseName: name,
        state: 'declining',
        topWeightKg: state.topLoad.weightKg,
        topReps: state.topLoad.reps,
      });
    }
  }

  return alerts;
}

/**
 * Detects whether top loads are rising during sustained weight cut (non-clinical advisory).
 */
export async function getCutVelocityAdvisory(
  dbInstance: AppDatabase = defaultDb
): Promise<CutAdvisoryState> {
  const { cutMap } = await getTopLoadsByExercise(dbInstance);

  const weightRows = await dbInstance
    .select({
      date: bodyMetrics.date,
      weightKg: bodyMetrics.weight,
    })
    .from(bodyMetrics)
    .where(and(eq(bodyMetrics.type, 'daily'), isNotNull(bodyMetrics.weight)))
    .orderBy(asc(bodyMetrics.date));

  const weightEntries: MeasuredWeightEntry[] = weightRows
    .filter((w): w is { date: number; weightKg: number } => w.weightKg !== null)
    .map((w) => ({
      date: w.date,
      weightKg: w.weightKg,
      provenance: 'measured',
      isWeightMeasured: true,
    }));

  const multiResult: MultiExerciseCutAdvisoryResult = detectCutVelocityAdvisories(
    weightEntries,
    cutMap
  );

  return {
    isAdvisoryActive: multiResult.overall.advisory === 'load_rising_during_cut',
    result: multiResult.overall,
  };
}

/**
 * Queries overdue sessions with routine metadata and scheduled date.
 */
export async function getOverdueWorkouts(
  dbInstance: AppDatabase = defaultDb
): Promise<OverdueWorkoutItem[]> {
  const overdueRaw: OverdueQueryResult[] = queryOverdueSessions(dbInstance);
  if (!overdueRaw || overdueRaw.length === 0) return [];

  const sessionIds = overdueRaw.map((o) => o.sessionId);
  interface SessionOverdueRow {
    id: number;
    routineId: number | null;
    routineName: string | null;
    routineNameFromRoutine: string | null;
    scheduledFor: number | null;
    occurrenceId: string | null;
  }

  const rows = (await dbInstance
    .select({
      id: sessions.id,
      routineId: sessions.routineId,
      routineName: sessions.routineName,
      routineNameFromRoutine: routines.name,
      scheduledFor: sessions.scheduledFor,
      occurrenceId: sessions.occurrenceId,
    })
    .from(sessions)
    .leftJoin(routines, eq(sessions.routineId, routines.id))
    .where(inArray(sessions.id, sessionIds))) as SessionOverdueRow[];

  const byId = new Map<number, SessionOverdueRow>(rows.map((r) => [r.id, r]));

  return overdueRaw.map((raw) => {
    const row = byId.get(raw.sessionId);
    return {
      sessionId: raw.sessionId,
      routineId: row?.routineId ?? null,
      routineName: row?.routineName || row?.routineNameFromRoutine || 'Treino',
      scheduledFor: raw.scheduledFor,
      occurrenceId: raw.occurrenceId,
    };
  });
}

/**
 * Evaluates main-lane drift and builds advisory re-entry guidance.
 */
export async function getMainLaneDrift(
  dbInstance: AppDatabase = defaultDb
): Promise<MainLaneDriftInfo> {
  const activeSessions = await dbInstance
    .select({
      id: sessions.id,
      startTime: sessions.startTime,
      endTime: sessions.endTime,
      routineId: sessions.routineId,
      isMainLane: routines.isMainLane,
    })
    .from(sessions)
    .leftJoin(routines, eq(sessions.routineId, routines.id))
    .where(and(isNull(sessions.deletedAt), sql`${sessions.startTime} > 0`))
    .orderBy(asc(sessions.startTime));

  const performed: PerformedSessionSummary[] = activeSessions.map((s) => ({
    sessionId: s.id,
    startTime: s.startTime,
    endTime: s.endTime,
    isMainLane: Boolean(s.isMainLane),
    lane: (s.isMainLane ? 'main' : 'accessory') as LaneType,
  }));

  const overdue = queryOverdueSessions(dbInstance);
  const driftStatus = computeDriftStatus(
    performed,
    DEFAULT_DRIFT_THRESHOLD_DAYS,
    { overdueSessions: overdue }
  );

  const guidance = buildReentryGuidance({ driftStatus });

  return { driftStatus, guidance };
}

export { rescheduleSession, deviceLocalMidnightToday };

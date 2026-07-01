import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { db } from '@/src/db/client';
import { sessions, sets, bodyMetrics, personalRecords, measurementGoals, exercises } from '@/src/db/schema';
import { formatEpochDate as sharedFormatEpochDate } from '@/src/utils/date-utils';
import { desc, asc, isNull, eq } from 'drizzle-orm';

/**
 * Alexandria Export Service for Iron Log
 * Generates a structured JSON file for import into Alexandria (personal context MCP server).
 *
 * Export format: { export_version, exported_at, sessions, body_metrics, personal_records, measurement_goals }
 * Each record includes external_id for upsert-based dedup on the Alexandria side.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AlexandriaExport {
  export_version: number;
  exported_at: string;
  sessions: AlexandriaSession[];
  body_metrics: AlexandriaMetric[];
  personal_records: AlexandriaPR[];
  measurement_goals: AlexandriaGoal[];
}

export interface AlexandriaSession {
  external_id: string;
  workout_date: string;
  workout_type: string;
  name: string;
  exercises: {
    name: string;
    sets: {
      set_number: number;
      weight_kg: number | null;
      reps: number | null;
      duration_s: number | null;
      rir: number | null;
      is_warmup: boolean;
    }[];
  }[];
  duration_s: number | null;
  volume_kg: number | null;
  rpe: number | null;
  notes: string | null;
  tags: string[];
  metadata: {
    routine_id: number | null;
    routine_name: string | null;
    body_weight: number | null;
    set_count: number;
  };
}

export interface AlexandriaMetric {
  external_id: string;
  entry_type: string;
  timestamp: string;
  numeric_value: number | null;
  value: Record<string, unknown>;
  source: string;
  tags: string[];
}

export interface AlexandriaPR {
  external_id: string;
  exercise_name: string;
  record_type: string;
  value: number;
  weight_kg: number | null;
  reps: number | null;
  estimated_1rm: number | null;
  date: string;
}

export interface AlexandriaGoal {
  external_id: string;
  type: string;
  target_value: number;
  start_date: string;
  target_date: string;
  achieved: boolean;
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for testing)
// ---------------------------------------------------------------------------

export function formatEpochISO(epoch: number | null): string | null {
  if (!epoch) return null;
  return new Date(epoch).toISOString();
}

export const formatEpochDate = sharedFormatEpochDate;

export function computeWorkoutType(
  exerciseTypes: string[]
): string {
  const hasCardio = exerciseTypes.includes('duration');
  const hasStrength = exerciseTypes.includes('strength');
  if (hasCardio && hasStrength) return 'other';
  if (hasCardio) return 'cardio';
  return 'strength';
}

export function computeVolume(
  sessionSets: { weightKg: number; reps: number; isWarmup: boolean }[]
): number {
  return sessionSets
    .filter(s => !s.isWarmup)
    .reduce((sum, s) => sum + (s.weightKg || 0) * (s.reps || 0), 0);
}

export function computeDurationSeconds(
  startTime: number | null,
  endTime: number | null,
  durationMinutes: number | null
): number | null {
  if (startTime && endTime && endTime > startTime) {
    return Math.round((endTime - startTime) / 1000);
  }
  if (durationMinutes) {
    return durationMinutes * 60;
  }
  return null;
}

export function buildSessionRecord(
  session: {
    id: number;
    routineId: number | null;
    routineName: string | null;
    startTime: number;
    endTime: number | null;
    durationMinutes: number | null;
    bodyWeight: number | null;
    sRpe: number | null;
    notes: string | null;
  },
  sessionSets: {
    exerciseName: string | null;
    exerciseId: number;
    setNumber: number;
    weightKg: number;
    reps: number;
    durationSeconds: number | null;
    rir: number | null;
    isWarmup: boolean;
  }[],
  exerciseTypes: Map<number, string>,
  routineName: string | null
): AlexandriaSession {
  // Group sets by exercise
  const byExercise = new Map<string, {
    name: string;
    sets: AlexandriaSession['exercises'][0]['sets'];
  }>();

  for (const s of sessionSets) {
    const name = s.exerciseName || 'Unknown';
    if (!byExercise.has(name)) {
      byExercise.set(name, { name, sets: [] });
    }
    byExercise.get(name)!.sets.push({
      set_number: s.setNumber,
      weight_kg: s.weightKg,
      reps: s.reps,
      duration_s: s.durationSeconds,
      rir: s.rir,
      is_warmup: s.isWarmup,
    });
  }

  const uniqueExerciseTypes = [...new Set(
    sessionSets.map(s => exerciseTypes.get(s.exerciseId) || 'strength')
  )];
  const workoutType = computeWorkoutType(uniqueExerciseTypes);
  const volume = computeVolume(sessionSets);
  const duration = computeDurationSeconds(
    session.startTime, session.endTime, session.durationMinutes
  );

  return {
    external_id: `session-${session.id}`,
    workout_date: formatEpochDate(session.startTime) || '',
    workout_type: workoutType,
    name: routineName || session.notes || 'Workout',
    exercises: [...byExercise.values()],
    duration_s: duration,
    volume_kg: Math.round(volume * 100) / 100 || null,
    rpe: session.sRpe ?? null,
    notes: session.notes,
    tags: ['iron-log', workoutType],
    metadata: {
      routine_id: session.routineId ?? null,
      routine_name: routineName ?? null,
      body_weight: session.bodyWeight ?? null,
      set_count: sessionSets.length,
    },
  };
}

export function buildMetricRecord(
  metric: {
    id: number;
    date: number;
    weight: number | null;
    waist: number | null;
    armRight: number | null;
    thighRight: number | null;
    chest: number | null;
    calf: number | null;
    type: string | null;
  }
): { weight?: AlexandriaMetric; body_composition?: AlexandriaMetric } {
  const result: { weight?: AlexandriaMetric; body_composition?: AlexandriaMetric } = {};
  const ts = formatEpochISO(metric.date);
  const extId = `metric-${metric.date}`;

  if (metric.weight) {
    result.weight = {
      external_id: extId,
      entry_type: 'weight',
      timestamp: ts || '',
      numeric_value: metric.weight,
      value: { weight_kg: metric.weight },
      source: 'iron-log',
      tags: ['iron-log'],
    };
  }

  if (metric.waist || metric.armRight || metric.thighRight || metric.chest || metric.calf) {
    const measurements: Record<string, number> = {};
    if (metric.waist) measurements.waist = metric.waist;
    if (metric.armRight) measurements.arm_right = metric.armRight;
    if (metric.thighRight) measurements.thigh_right = metric.thighRight;
    if (metric.chest) measurements.chest = metric.chest;
    if (metric.calf) measurements.calf = metric.calf;

    result.body_composition = {
      external_id: `${extId}-measurements`,
      entry_type: 'body_composition',
      timestamp: ts || '',
      numeric_value: metric.weight ?? null,
      value: measurements,
      source: 'iron-log',
      tags: ['iron-log', 'body-measurements'],
    };
  }

  return result;
}

export function buildPRRecord(
  pr: {
    id: number;
    exerciseId: number;
    exerciseName: string;
    recordType: string;
    value: number;
    weightKg: number | null;
    reps: number | null;
    estimated1RM: number | null;
    date: number;
  }
): AlexandriaPR {
  return {
    external_id: `pr-${pr.recordType}-${pr.id}`,
    exercise_name: pr.exerciseName,
    record_type: pr.recordType,
    value: pr.value,
    weight_kg: pr.weightKg,
    reps: pr.reps,
    estimated_1rm: pr.estimated1RM,
    date: formatEpochISO(pr.date) || '',
  };
}

export function buildGoalRecord(
  goal: {
    id: number;
    type: string;
    targetValue: number;
    startDate: number;
    targetDate: number;
    achieved: boolean;
  }
): AlexandriaGoal {
  return {
    external_id: `goal-${goal.type}-${goal.id}`,
    type: goal.type,
    target_value: goal.targetValue,
    start_date: formatEpochISO(goal.startDate) || '',
    target_date: formatEpochISO(goal.targetDate) || '',
    achieved: goal.achieved,
  };
}

// ---------------------------------------------------------------------------
// Export orchestrator
// ---------------------------------------------------------------------------

export const AlexandriaExportService = {
  async exportAlexandriaJson(): Promise<string> {
    // 1. Sessions + Sets (non-deleted)
    const allSessions = await db.select()
      .from(sessions)
      .where(isNull(sessions.deletedAt))
      .orderBy(desc(sessions.startTime));

    const allSets = await db.select()
      .from(sets)
      .where(isNull(sets.deletedAt))
      .orderBy(asc(sets.sessionId), asc(sets.setNumber));

    const setsBySession = new Map<number, typeof allSets>();
    allSets.forEach(s => {
      const list = setsBySession.get(s.sessionId) || [];
      list.push(s);
      setsBySession.set(s.sessionId, list);
    });

    // Load exercise types for workout_type classification
    const allExercises = await db.select().from(exercises);
    const exerciseTypes = new Map(allExercises.map(e => [e.id, e.type]));

    // Build session records
    const sessionRecords: AlexandriaSession[] = allSessions.map(session => {
      const sessionSets = setsBySession.get(session.id) || [];
      return buildSessionRecord(session, sessionSets, exerciseTypes, session.routineName);
    });

    // 2. Body metrics
    const allMetrics = await db.select()
      .from(bodyMetrics)
      .orderBy(desc(bodyMetrics.date));

    const metricRecords: AlexandriaMetric[] = [];
    for (const m of allMetrics) {
      const built = buildMetricRecord(m);
      if (built.weight) metricRecords.push(built.weight);
      if (built.body_composition) metricRecords.push(built.body_composition);
    }

    // 3. Personal records — join with exercises for name
    const allPRs = await db.select({
      id: personalRecords.id,
      exerciseId: personalRecords.exerciseId,
      exerciseName: exercises.name,
      recordType: personalRecords.recordType,
      value: personalRecords.value,
      date: personalRecords.date,
    })
      .from(personalRecords)
      .innerJoin(exercises, eq(personalRecords.exerciseId, exercises.id))
      .orderBy(desc(personalRecords.date));

    const prRecords: AlexandriaPR[] = allPRs.map(pr => {
      // Parse weight/reps from the PR record
      // PRs store: weight-based → value=weight, reps-based → value=reps
      const isWeightPR = pr.recordType === 'weight';
      const isRepsPR = pr.recordType === 'reps';
      return buildPRRecord({
        ...pr,
        weightKg: isWeightPR ? pr.value : null,
        reps: isRepsPR ? Math.round(pr.value) : null,
        estimated1RM: null, // not stored in PR table
      });
    });

    // 4. Measurement goals
    const allGoals = await db.select().from(measurementGoals);
    const goalRecords: AlexandriaGoal[] = allGoals.map(buildGoalRecord);

    // 5. Assemble export
    const exportData: AlexandriaExport = {
      export_version: 1,
      exported_at: new Date().toISOString(),
      sessions: sessionRecords,
      body_metrics: metricRecords,
      personal_records: prRecords,
      measurement_goals: goalRecords,
    };

    return JSON.stringify(exportData, null, 2);
  },

  async exportAndShare(): Promise<void> {
    const json = await this.exportAlexandriaJson();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `ironlog_alexandria_${timestamp}.json`;
    const filePath = FileSystem.cacheDirectory + fileName;

    await FileSystem.writeAsStringAsync(filePath, json, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(filePath, {
        dialogTitle: 'Exportar para Alexandria',
        mimeType: 'application/json',
        UTI: 'public.json',
      });
    } else {
      throw new Error('services.sharingUnavailable');
    }
  },
};

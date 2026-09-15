import { db } from '@/src/db/client';
import { sessions, sets, exercises } from '@/src/db/schema';
import { desc, isNull, and, sql, gte, inArray, eq } from 'drizzle-orm';
import { logger } from '@/services/logger';
import { getISOWeek, getWeekStart } from '@/src/utils/date-utils';

/**
 * Weekly Training Variance Service for Iron Log (#71)
 * Computes weekly volume, set count, finished sessions count,
 * muscle group volume aggregation, and week-over-week deltas.
 *
 * Trust II Rules:
 * - Only completed sessions (endTime IS NOT NULL, deletedAt IS NULL)
 * - Only live sets (deletedAt IS NULL, NOT isWarmup)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RawSessionVarianceInput {
  id: number;
  startTime: number;
  endTime?: number | null;
  deletedAt?: number | null;
}

export interface RawSetVarianceInput {
  id?: number;
  sessionId: number;
  exerciseId?: number;
  weightKg: number;
  reps: number;
  isWarmup?: boolean | number;
  deletedAt?: number | null;
  muscleGroup?: string | null;
}

export interface WeekOverWeekDelta {
  volume: number | null;
  sessions: number | null;
}

export interface WeeklyVarianceBucket {
  week: string;
  weekStart: number;
  sessionsCount: number;
  sessionCount: number;
  totalVolume: number;
  totalSets: number;
  setsCount: number;
  volumeByMuscleGroup: Record<string, number>;
  volumeDelta: number | null;
  sessionsDelta: number | null;
  delta: WeekOverWeekDelta;
}

// ---------------------------------------------------------------------------
// Pure Computation Core
// ---------------------------------------------------------------------------

/**
 * Computes weekly variance buckets from raw sessions and sets in pure memory.
 * - Filters by Trust II rules: finished sessions (endTime != null, deletedAt == null),
 *   live working sets (deletedAt == null, !isWarmup).
 * - Aggregates total volume, session count, set count, and volume per muscle group.
 * - Sorts muscle groups descending by volume, then ascending alphabetically.
 * - Calculates week-over-week delta (current - previous week) across chronological weeks.
 * - Returns buckets sorted descending by week (latest first).
 */
export function computeWeeklyVariance(
  sessionsList: RawSessionVarianceInput[],
  setsList: RawSetVarianceInput[]
): WeeklyVarianceBucket[] {
  const validSessions = sessionsList.filter(
    (s) => s.endTime != null && s.deletedAt == null && typeof s.startTime === 'number'
  );

  if (validSessions.length === 0) {
    return [];
  }

  const validSessionMap = new Map<number, RawSessionVarianceInput>();
  for (const session of validSessions) {
    validSessionMap.set(session.id, session);
  }

  // Filter sets according to Trust II rules
  const validSets = setsList.filter(
    (set) =>
      set.deletedAt == null &&
      !set.isWarmup &&
      validSessionMap.has(set.sessionId) &&
      set.weightKg > 0 &&
      set.reps > 0
  );

  // Group finished sessions and valid sets by ISO week
  interface WeekAccumulator {
    week: string;
    weekStart: number;
    sessionIds: Set<number>;
    sets: RawSetVarianceInput[];
  }

  const weekMap = new Map<string, WeekAccumulator>();

  for (const session of validSessions) {
    const week = getISOWeek(session.startTime);
    const weekStart = getWeekStart(session.startTime);
    let acc = weekMap.get(week);
    if (!acc) {
      acc = {
        week,
        weekStart,
        sessionIds: new Set<number>(),
        sets: [],
      };
      weekMap.set(week, acc);
    }
    acc.sessionIds.add(session.id);
  }

  for (const set of validSets) {
    const session = validSessionMap.get(set.sessionId);
    if (!session) continue;
    const week = getISOWeek(session.startTime);
    const acc = weekMap.get(week);
    if (acc) {
      acc.sets.push(set);
    }
  }

  // Sort chronological (ascending) to compute week-over-week deltas
  const chronologicalWeeks = Array.from(weekMap.values()).sort(
    (a, b) => a.weekStart - b.weekStart || a.week.localeCompare(b.week)
  );

  interface RawBucketDraft {
    week: string;
    weekStart: number;
    sessionsCount: number;
    totalVolume: number;
    totalSets: number;
    volumeByMuscleGroup: Record<string, number>;
  }

  const drafts: RawBucketDraft[] = chronologicalWeeks.map((w) => {
    let totalVolume = 0;
    const muscleGroupTotals: Record<string, number> = {};

    for (const s of w.sets) {
      const setVolume = Number(s.weightKg) * Number(s.reps);
      totalVolume += setVolume;

      const mg = s.muscleGroup?.trim();
      if (mg) {
        muscleGroupTotals[mg] = (muscleGroupTotals[mg] || 0) + setVolume;
      }
    }

    // Sort muscle groups descending by volume, then alphabetically by name
    const sortedEntries = Object.entries(muscleGroupTotals).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    });

    const volumeByMuscleGroup: Record<string, number> = {};
    for (const [group, vol] of sortedEntries) {
      volumeByMuscleGroup[group] = vol;
    }

    return {
      week: w.week,
      weekStart: w.weekStart,
      sessionsCount: w.sessionIds.size,
      totalVolume: Math.round(totalVolume * 100) / 100,
      totalSets: w.sets.length,
      volumeByMuscleGroup,
    };
  });

  const buckets: WeeklyVarianceBucket[] = drafts.map((draft, i) => {
    let volumeDelta: number | null = null;
    let sessionsDelta: number | null = null;

    if (i > 0) {
      const prev = drafts[i - 1];
      volumeDelta = Math.round((draft.totalVolume - prev.totalVolume) * 100) / 100;
      sessionsDelta = draft.sessionsCount - prev.sessionsCount;
    }

    const delta: WeekOverWeekDelta = {
      volume: volumeDelta,
      sessions: sessionsDelta,
    };

    return {
      week: draft.week,
      weekStart: draft.weekStart,
      sessionsCount: draft.sessionsCount,
      sessionCount: draft.sessionsCount,
      totalVolume: draft.totalVolume,
      totalSets: draft.totalSets,
      setsCount: draft.totalSets,
      volumeByMuscleGroup: draft.volumeByMuscleGroup,
      volumeDelta,
      sessionsDelta,
      delta,
    };
  });

  // Return sorted descending (most recent week first)
  return buckets.reverse();
}

// ---------------------------------------------------------------------------
// Service Layer (DB Access)
// ---------------------------------------------------------------------------

/**
 * Fetches weekly training variance report from DB.
 * Only finished sessions (endTime IS NOT NULL, deletedAt IS NULL) and
 * live working sets (deletedAt IS NULL, NOT isWarmup) are included.
 */
export async function getWeeklyVariance(since?: number): Promise<WeeklyVarianceBucket[]> {
  try {
    const conditions = [
      isNull(sessions.deletedAt),
      sql`${sessions.endTime} IS NOT NULL`,
    ];

    if (since !== undefined) {
      conditions.push(gte(sessions.startTime, since));
    }

    const finishedSessions = await db
      .select({
        id: sessions.id,
        startTime: sessions.startTime,
        endTime: sessions.endTime,
        deletedAt: sessions.deletedAt,
      })
      .from(sessions)
      .where(and(...conditions))
      .orderBy(desc(sessions.startTime));

    if (finishedSessions.length === 0) {
      return [];
    }

    const sessionIds = finishedSessions.map((s) => s.id);

    const liveSets = await db
      .select({
        id: sets.id,
        sessionId: sets.sessionId,
        exerciseId: sets.exerciseId,
        weightKg: sets.weightKg,
        reps: sets.reps,
        isWarmup: sets.isWarmup,
        deletedAt: sets.deletedAt,
        muscleGroup: exercises.muscleGroup,
      })
      .from(sets)
      .leftJoin(exercises, eq(sets.exerciseId, exercises.id))
      .where(
        and(
          isNull(sets.deletedAt),
          sql`NOT ${sets.isWarmup}`,
          inArray(sets.sessionId, sessionIds)
        )
      );

    return computeWeeklyVariance(finishedSessions, liveSets);
  } catch (e) {
    logger.error('Failed to get weekly training variance report', e);
    return [];
  }
}

export const TrainingVarianceService = {
  getWeeklyVariance,
  computeWeeklyVariance,
};

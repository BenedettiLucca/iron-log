import { db } from '@/src/db/client';
import { sessions, sets, personalRecords, exercises, bodyMetrics } from '@/src/db/schema';
import { desc, asc, isNull, and, sql, gte, inArray, eq } from 'drizzle-orm';
import { logger } from '@/services/logger';
import { getISOWeek, getWeekStart } from '@/src/utils/date-utils';
import { isDisplayableBodyMetricValue } from '@/src/utils/body-metrics';

/**
 * Analytics Service for Iron Log
 * Computes Strength Score, Consistency Score, volume trends, and PR tracking.
 * Only completed / finished sessions (endTime IS NOT NULL) are counted in scores.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StrengthScore {
  totalScore: number;       // 0-100
  volumeScore: number;      // 0-40 (based on weekly volume)
  intensityScore: number;   // 0-30 (based on average weight lifted)
  consistencyScore: number; // 0-30 (based on training frequency)
  labelKey: string;         // translation key for strength level
}

export interface ConsistencyData {
  weeklyFrequency: number;     // sessions per week (avg last 12 weeks)
  currentStreak: number;       // consecutive weeks with ≥1 session
  longestStreak: number;       // best streak ever
  totalSessions: number;       // all time
  sessionsThisWeek: number;
  sessionsThisMonth: number;
}

export interface VolumeTrend {
  week: string;           // ISO week label (e.g., "2026-W17")
  totalVolume: number;    // kg
  totalSets: number;
  sessionCount: number;
  avgVolumePerSession: number;
}

export interface ExerciseProgression {
  exerciseId: number;
  exerciseName: string;
  currentMaxWeight: number;
  previousMaxWeight: number | null;
  progress: number | null;       // percentage change
}

export interface Estimated1RMSetInput {
  exerciseId: number;
  exerciseName?: string | null;
  weightKg: number;
  reps: number;
  sessionId: number;
  createdAt?: number | null;
  date?: number | null;
}

export interface RankedEstimated1RM {
  exerciseId: number;
  exercise: string;
  estimated1RM: number;
  weightKg: number;
  reps: number;
  sessionId: number;
  date: number | null;
}

export interface KeyStats {
  recentVolume: number;
  recentSessionsCount: number;
  recentAvgRpe: number | null;
  recentAvgDur: number | null;
  recentPRsCount: number;
  prevVolume: number;
  prevAvgRpe: number | null;
  prevAvgDur: number | null;
  prevPRsCount: number;
}

export interface DashboardAnalytics {
  strengthScore: StrengthScore;
  consistency: ConsistencyData;
  volumeTrends: VolumeTrend[];
  topExercises: ExerciseProgression[];
  totalPRs: number;
  estimated1RM: RankedEstimated1RM[];
  keyStats: KeyStats;
  volumeDistribution: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate estimated 1RM using Epley formula: weight × (1 + reps/30).
 * Valid only for 1 <= reps <= 12 and weight > 0.
 * Returns 0 for non-positive input or reps > 12.
 */
export function estimateE1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0 || reps > 12) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function isBetterEstimatedSet(candidate: RankedEstimated1RM, existing: RankedEstimated1RM): boolean {
  if (candidate.estimated1RM !== existing.estimated1RM) {
    return candidate.estimated1RM > existing.estimated1RM;
  }
  if (candidate.weightKg !== existing.weightKg) {
    return candidate.weightKg > existing.weightKg;
  }
  if (candidate.reps !== existing.reps) {
    return candidate.reps < existing.reps;
  }
  const cTime = candidate.date ?? -Infinity;
  const eTime = existing.date ?? -Infinity;
  if (cTime !== eTime) {
    return cTime > eTime;
  }
  return candidate.sessionId > existing.sessionId;
}

/**
 * Ranks estimated 1RM sets per exercise.
 * - Filters out invalid inputs (empty exercise name, non-positive weight/reps, reps > 12, missing exerciseId).
 * - Selects the best set for each exercise based on highest valid e1RM grouped by exerciseId.
 * - Deterministic tie-break when e1RM is equal:
 *   1. Higher raw weight (closer to true 1RM)
 *   2. Lower reps
 *   3. More recent date (descending, non-null before null)
 *   4. Higher sessionId
 * - Preserves the display name from the winning set.
 * - Output is sorted by estimated1RM descending, then raw weight descending, then exercise name alphabetically, then exerciseId.
 */
export function rankEstimated1RMSets(setsList: Estimated1RMSetInput[]): RankedEstimated1RM[] {
  const bestByExercise = new Map<number, RankedEstimated1RM>();

  for (const set of setsList) {
    if (set.exerciseId == null || typeof set.exerciseId !== 'number') continue;

    const exerciseName = set.exerciseName?.trim();
    if (!exerciseName) continue;

    const e1rm = estimateE1RM(set.weightKg, set.reps);
    if (e1rm <= 0) continue;

    const setDate = set.date ?? set.createdAt ?? null;
    const candidate: RankedEstimated1RM = {
      exerciseId: set.exerciseId,
      exercise: exerciseName,
      estimated1RM: e1rm,
      weightKg: set.weightKg,
      reps: set.reps,
      sessionId: set.sessionId,
      date: setDate,
    };

    const existing = bestByExercise.get(set.exerciseId);
    if (!existing || isBetterEstimatedSet(candidate, existing)) {
      bestByExercise.set(set.exerciseId, candidate);
    }
  }

  return Array.from(bestByExercise.values()).sort((a, b) => {
    if (b.estimated1RM !== a.estimated1RM) {
      return b.estimated1RM - a.estimated1RM;
    }
    if (b.weightKg !== a.weightKg) {
      return b.weightKg - a.weightKg;
    }
    const nameCmp = a.exercise.localeCompare(b.exercise);
    if (nameCmp !== 0) {
      return nameCmp;
    }
    return a.exerciseId - b.exerciseId;
  });
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;
const TWELVE_WEEKS_MS = 12 * MS_PER_WEEK;

// ---------------------------------------------------------------------------
// Pure Computation Helpers
// ---------------------------------------------------------------------------

export function computeStrengthScoreFromData(
  recentSessions: { id: number; startTime: number }[],
  allSets: { sessionId: number; weightKg: number; reps: number; isWarmup: boolean }[],
  since: number,
  now = Date.now(),
): StrengthScore {
  const sessionIds = recentSessions.map(s => s.id);

  if (sessionIds.length === 0) {
    return { totalScore: 0, volumeScore: 0, intensityScore: 0, consistencyScore: 0, labelKey: 'noData' };
  }

  // Volume Score (0-40): Based on average weekly volume
  const totalVolume = allSets
    .filter(s => !s.isWarmup && s.reps > 0 && s.weightKg > 0)
    .reduce((sum, s) => sum + (s.weightKg * s.reps), 0);

  const weeksSpan = Math.max(1, Math.ceil((now - since) / MS_PER_WEEK));
  const avgWeeklyVolume = totalVolume / weeksSpan;

  // Volume scoring: 0kg=0, 5000kg=20, 15000kg=35, 30000+=40
  const volumeScore = Math.min(40, Math.round(
    avgWeeklyVolume <= 5000 ? (avgWeeklyVolume / 5000) * 20 :
    avgWeeklyVolume <= 15000 ? 20 + ((avgWeeklyVolume - 5000) / 10000) * 15 :
    35 + Math.min(5, ((avgWeeklyVolume - 15000) / 15000) * 5)
  ));

  // Intensity Score (0-30): Based on avg weight per set
  const workingSets = allSets.filter(s => !s.isWarmup && s.weightKg > 0);
  const avgWeight = workingSets.length > 0
    ? workingSets.reduce((sum, s) => sum + s.weightKg, 0) / workingSets.length
    : 0;

  // Intensity scoring: 0kg=0, 20kg=10, 50kg=20, 80+=30
  const intensityScore = Math.min(30, Math.round(
    avgWeight <= 20 ? (avgWeight / 20) * 10 :
    avgWeight <= 50 ? 10 + ((avgWeight - 20) / 30) * 10 :
    20 + Math.min(10, ((avgWeight - 50) / 30) * 10)
  ));

  // Consistency Score (0-30): Based on sessions per week
  const avgSessionsPerWeek = recentSessions.length / weeksSpan;
  const consistencyScore = Math.min(30, Math.round(
    avgSessionsPerWeek <= 2 ? (avgSessionsPerWeek / 2) * 15 :
    avgSessionsPerWeek <= 4 ? 15 + ((avgSessionsPerWeek - 2) / 2) * 10 :
    25 + Math.min(5, ((avgSessionsPerWeek - 4) / 2) * 5)
  ));

  const totalScore = volumeScore + intensityScore + consistencyScore;

  let labelKey: string;
  if (totalScore >= 80) labelKey = 'elite';
  else if (totalScore >= 60) labelKey = 'advanced';
  else if (totalScore >= 35) labelKey = 'intermediate';
  else labelKey = 'beginner';

  return { totalScore, volumeScore, intensityScore, consistencyScore, labelKey };
}

export function computeConsistencyFromData(
  allActiveSessions: { startTime: number }[],
  since: number,
  now = Date.now(),
): ConsistencyData {
  const recentSessions = allActiveSessions.filter(s => s.startTime >= since);

  // Weekly frequency (last 12 weeks)
  const weeksSpan = Math.max(1, Math.ceil((now - since) / MS_PER_WEEK));
  const weeklyFrequency = Math.round((recentSessions.length / weeksSpan) * 10) / 10;

  // Current streak
  const weekStart = getWeekStart(now);
  let currentStreak = 0;
  let checkWeek = weekStart;

  const sessionWeeks = new Set(allActiveSessions.map(s => getWeekStart(s.startTime)));

  while (sessionWeeks.has(checkWeek)) {
    currentStreak++;
    checkWeek -= MS_PER_WEEK;
  }

  // Longest streak
  const sortedWeeks = Array.from(sessionWeeks).sort((a, b) => a - b);
  let longestStreak = 0;
  if (sortedWeeks.length > 0) {
    longestStreak = 1;
    let tempStreak = 1;
    for (let i = 1; i < sortedWeeks.length; i++) {
      if (sortedWeeks[i] - sortedWeeks[i - 1] === MS_PER_WEEK) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak);
  }

  // This week / month
  const weekStartMs = getWeekStart(now);
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthStartMs = monthStart.getTime();

  const sessionsThisWeek = allActiveSessions.filter(s => s.startTime >= weekStartMs).length;
  const sessionsThisMonth = allActiveSessions.filter(s => s.startTime >= monthStartMs).length;

  return {
    weeklyFrequency,
    currentStreak,
    longestStreak,
    totalSessions: allActiveSessions.length,
    sessionsThisWeek,
    sessionsThisMonth,
  };
}

export function computeVolumeTrendsFromData(
  recentSessions: { id: number; startTime: number }[],
  allSets: { sessionId: number; weightKg: number; reps: number; isWarmup: boolean }[],
  since: number,
): VolumeTrend[] {
  if (recentSessions.length === 0) return [];

  // Group by ISO week
  const weekMap = new Map<string, { volume: number; sets: number; sessions: Set<number> }>();

  // Initialize all weeks in range
  const start = new Date(since);
  for (let i = 0; i <= 12; i++) {
    const weekDate = new Date(start.getTime() + i * MS_PER_WEEK);
    const weekKey = getISOWeek(weekDate.getTime());
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { volume: 0, sets: 0, sessions: new Set() });
    }
  }

  const setsBySession = new Map<number, typeof allSets>();
  for (const set of allSets) {
    if (set.isWarmup) continue;
    const list = setsBySession.get(set.sessionId);
    if (list) {
      list.push(set);
    } else {
      setsBySession.set(set.sessionId, [set]);
    }
  }

  for (const session of recentSessions) {
    const weekKey = getISOWeek(session.startTime);
    const entry = weekMap.get(weekKey);
    if (!entry) continue;
    entry.sessions.add(session.id);

    const sessionSets = setsBySession.get(session.id);
    if (sessionSets) {
      for (const set of sessionSets) {
        entry.volume += (set.weightKg * set.reps);
        entry.sets++;
      }
    }
  }

  return Array.from(weekMap.entries()).map(([week, data]) => ({
    week,
    totalVolume: Math.round(data.volume),
    totalSets: data.sets,
    sessionCount: data.sessions.size,
    avgVolumePerSession: data.sessions.size > 0 ? Math.round(data.volume / data.sessions.size) : 0,
  }));
}

export function computeKeyStatsFromData(
  allActiveSessions: { id: number; startTime: number; sRpe?: number | null; durationMinutes?: number | null }[],
  allSets: { sessionId: number; weightKg: number; reps: number; isWarmup: boolean }[],
  prs: { date: number }[],
  thirtyDaysAgoMs: number,
  sixtyDaysAgoMs: number,
): KeyStats {
  const recentSessions = allActiveSessions.filter(s => s.startTime >= thirtyDaysAgoMs);
  const prevSessions = allActiveSessions.filter(s => s.startTime >= sixtyDaysAgoMs && s.startTime < thirtyDaysAgoMs);

  const recentSessionIds = new Set(recentSessions.map(s => s.id));
  const prevSessionIds = new Set(prevSessions.map(s => s.id));

  const recentVolume = allSets
    .filter(set => recentSessionIds.has(set.sessionId) && !set.isWarmup)
    .reduce((sum, set) => sum + (set.weightKg * set.reps), 0);

  const prevVolume = allSets
    .filter(set => prevSessionIds.has(set.sessionId) && !set.isWarmup)
    .reduce((sum, set) => sum + (set.weightKg * set.reps), 0);

  const recentRpeSessions = recentSessions.filter(s => s.sRpe != null && s.sRpe > 0);
  const prevRpeSessions = prevSessions.filter(s => s.sRpe != null && s.sRpe > 0);

  const recentAvgRpe = recentRpeSessions.length > 0
    ? recentRpeSessions.reduce((sum, s) => sum + s.sRpe!, 0) / recentRpeSessions.length
    : null;
  const prevAvgRpe = prevRpeSessions.length > 0
    ? prevRpeSessions.reduce((sum, s) => sum + s.sRpe!, 0) / prevRpeSessions.length
    : null;

  const recentDurSessions = recentSessions.filter(s => s.durationMinutes != null && s.durationMinutes > 0);
  const prevDurSessions = prevSessions.filter(s => s.durationMinutes != null && s.durationMinutes > 0);

  const recentAvgDur = recentDurSessions.length > 0
    ? recentDurSessions.reduce((sum, s) => sum + s.durationMinutes!, 0) / recentDurSessions.length
    : null;
  const prevAvgDur = prevDurSessions.length > 0
    ? prevDurSessions.reduce((sum, s) => sum + s.durationMinutes!, 0) / prevDurSessions.length
    : null;

  const recentPRsCount = prs.filter(pr => pr.date >= thirtyDaysAgoMs).length;
  const prevPRsCount = prs.filter(pr => pr.date >= sixtyDaysAgoMs && pr.date < thirtyDaysAgoMs).length;

  return {
    recentVolume,
    recentSessionsCount: recentSessions.length,
    recentAvgRpe,
    recentAvgDur,
    recentPRsCount,
    prevVolume,
    prevAvgRpe,
    prevAvgDur,
    prevPRsCount,
  };
}

// ---------------------------------------------------------------------------
// Main Analytics Computation
// ---------------------------------------------------------------------------

export const AnalyticsService = {

  async getFullAnalytics(): Promise<DashboardAnalytics> {
    const now = Date.now();
    const TWELVE_WEEKS_AGO = now - TWELVE_WEEKS_MS;
    const thirtyDaysAgoMs = now - 30 * MS_PER_DAY;
    const sixtyDaysAgoMs = now - 60 * MS_PER_DAY;

    // Directed aggregations and snapshot queries in parallel
    const [allActiveSessions, topExercises, totalPRs, estimated1RM, volumeDistribution, recentPRs] = await Promise.all([
      db.select({
        id: sessions.id,
        startTime: sessions.startTime,
        sRpe: sessions.sRpe,
        durationMinutes: sessions.durationMinutes,
      })
        .from(sessions)
        .where(and(
          isNull(sessions.deletedAt),
          sql`${sessions.endTime} IS NOT NULL`
        ))
        .orderBy(desc(sessions.startTime)),
      this.calculateTopExerciseProgressions(TWELVE_WEEKS_AGO),
      this.countTotalPRs(),
      this.calculateEstimated1RMs(),
      this.volumeByMuscleGroup(thirtyDaysAgoMs),
      db.select({
        date: personalRecords.date,
      })
        .from(personalRecords)
        .where(gte(personalRecords.date, sixtyDaysAgoMs)),
    ]);

    const recentSessionsDesc = allActiveSessions.filter(s => s.startTime >= TWELVE_WEEKS_AGO);
    const sessionIds12w = recentSessionsDesc.map(s => s.id);

    const sets12w = sessionIds12w.length > 0
      ? await db.select({
          id: sets.id,
          sessionId: sets.sessionId,
          weightKg: sets.weightKg,
          reps: sets.reps,
          isWarmup: sets.isWarmup,
        })
          .from(sets)
          .where(and(
            isNull(sets.deletedAt),
            inArray(sets.sessionId, sessionIds12w),
          ))
      : [];

    const recentSessionsAsc = [...recentSessionsDesc].reverse();

    const strengthScore = computeStrengthScoreFromData(recentSessionsDesc, sets12w, TWELVE_WEEKS_AGO, now);
    const consistency = computeConsistencyFromData(allActiveSessions, TWELVE_WEEKS_AGO, now);
    const volumeTrends = computeVolumeTrendsFromData(recentSessionsAsc, sets12w, TWELVE_WEEKS_AGO);
    const keyStats = computeKeyStatsFromData(allActiveSessions, sets12w, recentPRs, thirtyDaysAgoMs, sixtyDaysAgoMs);

    return {
      strengthScore,
      consistency,
      volumeTrends,
      topExercises,
      totalPRs,
      estimated1RM,
      keyStats,
      volumeDistribution,
    };
  },

  /**
   * Strength Score (0-100)
   * - Volume (0-40): Weekly volume relative to bodyweight
   * - Intensity (0-30): Average weight relative to benchmarks
   * - Consistency (0-30): Training frequency score
   *
   * Only completed sessions with endTime IS NOT NULL are included.
   */
  async calculateStrengthScore(since: number): Promise<StrengthScore> {
    try {
      const recentSessions = await db.select({
        id: sessions.id,
        startTime: sessions.startTime,
      })
        .from(sessions)
        .where(and(
          isNull(sessions.deletedAt),
          sql`${sessions.endTime} IS NOT NULL`,
          gte(sessions.startTime, since)
        ))
        .orderBy(desc(sessions.startTime));

      const sessionIds = recentSessions.map(s => s.id);

      if (sessionIds.length === 0) {
        return { totalScore: 0, volumeScore: 0, intensityScore: 0, consistencyScore: 0, labelKey: 'noData' };
      }

      // Get all sets for these sessions
      const allSets = await db.select({
        sessionId: sets.sessionId,
        weightKg: sets.weightKg,
        reps: sets.reps,
        isWarmup: sets.isWarmup,
      })
        .from(sets)
        .where(and(
          isNull(sets.deletedAt),
          inArray(sets.sessionId, sessionIds),
        ));

      return computeStrengthScoreFromData(recentSessions, allSets, since);
    } catch (e) {
      logger.error('Failed to calculate strength score', e);
      return { totalScore: 0, volumeScore: 0, intensityScore: 0, consistencyScore: 0, labelKey: 'error' };
    }
  },

  /**
   * Consistency metrics
   * Only completed sessions with endTime IS NOT NULL are counted.
   */
  async calculateConsistency(since: number): Promise<ConsistencyData> {
    try {
      const allActiveSessions = await db.select({
        id: sessions.id,
        startTime: sessions.startTime,
      })
        .from(sessions)
        .where(and(
          isNull(sessions.deletedAt),
          sql`${sessions.endTime} IS NOT NULL`
        ))
        .orderBy(desc(sessions.startTime));

      return computeConsistencyFromData(allActiveSessions, since);
    } catch (e) {
      logger.error('Failed to calculate consistency', e);
      throw e;
    }
  },

  /**
   * Volume trends by week (last 12 weeks)
   */
  async calculateVolumeTrends(since: number): Promise<VolumeTrend[]> {
    try {
      const recentSessions = await db.select({
        id: sessions.id,
        startTime: sessions.startTime,
      })
        .from(sessions)
        .where(and(
          isNull(sessions.deletedAt),
          sql`${sessions.endTime} IS NOT NULL`,
          gte(sessions.startTime, since)
        ))
        .orderBy(asc(sessions.startTime));

      const sessionIds = recentSessions.map(s => s.id);
      if (sessionIds.length === 0) return [];

      const allSets = await db.select({
        sessionId: sets.sessionId,
        weightKg: sets.weightKg,
        reps: sets.reps,
        isWarmup: sets.isWarmup,
      })
        .from(sets)
        .where(and(
          isNull(sets.deletedAt),
          inArray(sets.sessionId, sessionIds),
        ));

      return computeVolumeTrendsFromData(recentSessions, allSets, since);
    } catch (e) {
      logger.error('Failed to calculate volume trends', e);
      throw e;
    }
  },

  /**
   * Top 5 exercise progressions (max weight, last 12 weeks vs previous 12 weeks)
   */
  async calculateTopExerciseProgressions(since: number): Promise<ExerciseProgression[]> {
    try {
      const PREV_SINCE = since - TWELVE_WEEKS_MS;
      const effectiveTime = sql`COALESCE(${sets.createdAt}, ${sessions.startTime})`;

      const combinedSets = await db.select({
        exerciseId: sets.exerciseId,
        exerciseName: sql<string>`COALESCE(${sets.exerciseName}, ${exercises.name})`,
        weightKg: sets.weightKg,
        createdAt: sets.createdAt,
        effectiveTime: sql<number>`${effectiveTime}`,
      })
        .from(sets)
        .innerJoin(sessions, eq(sets.sessionId, sessions.id))
        .leftJoin(exercises, eq(sets.exerciseId, exercises.id))
        .where(and(
          isNull(sets.deletedAt),
          sql`NOT ${sets.isWarmup}`,
          isNull(sessions.deletedAt),
          sql`${sessions.endTime} IS NOT NULL`,
          sql`${effectiveTime} >= ${PREV_SINCE}`,
        ));

      // Current max weight per exercise
      const currentMax = new Map<number, { name: string; maxWeight: number }>();
      const previousMax = new Map<number, number>();

      for (const s of combinedSets) {
        if (!s.exerciseName) continue;
        if (s.effectiveTime >= since) {
          const existing = currentMax.get(s.exerciseId);
          if (!existing || s.weightKg > existing.maxWeight) {
            currentMax.set(s.exerciseId, { name: s.exerciseName, maxWeight: s.weightKg });
          }
        } else if (s.effectiveTime >= PREV_SINCE && s.effectiveTime < since) {
          const existing = previousMax.get(s.exerciseId);
          if (existing === undefined || s.weightKg > existing) {
            previousMax.set(s.exerciseId, s.weightKg);
          }
        }
      }

      // Build progressions
      const progressions: ExerciseProgression[] = [];
      for (const [exerciseId, data] of currentMax) {
        const prevMax = previousMax.get(exerciseId) ?? null;
        const progress = prevMax !== null && prevMax > 0
          ? Math.round(((data.maxWeight - prevMax) / prevMax) * 100)
          : null;
        progressions.push({
          exerciseId,
          exerciseName: data.name,
          currentMaxWeight: data.maxWeight,
          previousMaxWeight: prevMax,
          progress,
        });
      }

      // Sort deterministically: numeric progress first (descending), then nulls last
      return progressions.sort((a, b) => {
        if (a.progress !== null && b.progress !== null) {
          if (b.progress !== a.progress) {
            return b.progress - a.progress;
          }
          return a.exerciseId - b.exerciseId;
        }
        if (a.progress !== null) return -1;
        if (b.progress !== null) return 1;
        return a.exerciseId - b.exerciseId;
      }).slice(0, 5);
    } catch (e) {
      logger.error('Failed to calculate exercise progressions', e);
      throw e;
    }
  },

  /** Count total PRs */
  async countTotalPRs(): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(personalRecords);
      return result[0]?.count ?? 0;
    } catch (e) {
      logger.error('Failed to count personal records', e);
      throw e;
    }
  },

  /** Estimate 1RM for top exercises */
  async calculateEstimated1RMs(): Promise<RankedEstimated1RM[]> {
    try {
      const activeSets = await db.select({
        exerciseId: sets.exerciseId,
        exerciseName: sql<string>`COALESCE(${sets.exerciseName}, ${exercises.name})`,
        weightKg: sets.weightKg,
        reps: sets.reps,
        sessionId: sets.sessionId,
        createdAt: sets.createdAt,
        date: sql<number | null>`COALESCE(${sets.createdAt}, ${sessions.startTime})`,
      })
        .from(sets)
        .innerJoin(sessions, eq(sets.sessionId, sessions.id))
        .leftJoin(exercises, eq(sets.exerciseId, exercises.id))
        .where(and(
          isNull(sets.deletedAt),
          sql`NOT ${sets.isWarmup}`,
          isNull(sessions.deletedAt),
          sql`${sessions.endTime} IS NOT NULL`
        ));

      return rankEstimated1RMSets(activeSets).slice(0, 10);
    } catch (e) {
      logger.error('Failed to calculate estimated 1RMs', e);
      throw e;
    }
  },

  /**
   * Volume by muscle group
   * Single-pass aggregation joining sets -> exercises -> sessions, volume = weightKg * reps.
   * Only live sets (isNull deletedAt, NOT isWarmup) in completed, non-deleted sessions.
   * Exercises with NULL or empty muscleGroup are categorized as 'outros'.
   * Explicitly stored muscleGroup column prevails over exercise name.
   * Returns `{ [group]: volume }` sorted descending by volume.
   */
  async volumeByMuscleGroup(since?: number): Promise<Record<string, number>> {
    try {
      const conditions = [
        isNull(sets.deletedAt),
        sql`NOT ${sets.isWarmup}`,
        isNull(sessions.deletedAt),
        sql`${sessions.endTime} IS NOT NULL`,
      ];

      if (since !== undefined) {
        conditions.push(sql`COALESCE(${sets.createdAt}, ${sessions.startTime}) >= ${since}`);
      }

      const groupCol = sql<string>`COALESCE(NULLIF(TRIM(${exercises.muscleGroup}), ''), 'outros')`;
      const volumeSum = sql<number>`SUM(${sets.weightKg} * ${sets.reps})`;

      const rows = await db
        .select({
          muscleGroup: groupCol,
          volume: volumeSum,
        })
        .from(sets)
        .innerJoin(exercises, eq(sets.exerciseId, exercises.id))
        .innerJoin(sessions, eq(sets.sessionId, sessions.id))
        .where(and(...conditions))
        .groupBy(groupCol)
        .orderBy(desc(volumeSum), asc(groupCol));

      const result: Record<string, number> = {};
      for (const row of rows) {
        if (row.muscleGroup) {
          result[row.muscleGroup] = Number(row.volume) || 0;
        }
      }

      return result;
    } catch (e) {
      logger.error('Failed to calculate volume by muscle group', e);
      return {};
    }
  },

  /** Get body weight history for charting, sorted by date asc */
  async getBodyWeightHistory(): Promise<{ timestamp: number; value: number }[]> {
    try {
      const rows = await db
        .select({
          date: bodyMetrics.date,
          weight: bodyMetrics.weight,
        })
        .from(bodyMetrics)
        .where(and(
          sql`${bodyMetrics.weight} IS NOT NULL`,
          sql`${bodyMetrics.weight} > 0`
        ))
        .orderBy(asc(bodyMetrics.date));

      return rows
        .filter(r => isDisplayableBodyMetricValue(r.weight) && r.weight! > 0)
        .map(r => ({
          timestamp: r.date,
          value: r.weight!,
        }));
    } catch (e) {
      logger.error('Failed to get body weight history', e);
      return [];
    }
  },
};

import { db } from '@/src/db/client';
import { sessions, sets, personalRecords } from '@/src/db/schema';
import { desc, asc, isNull, and, sql, gt, inArray } from 'drizzle-orm';
import { logger } from '@/services/logger';

/**
 * Analytics Service for Iron Log
 * Computes Strength Score, Consistency Score, volume trends, and PR tracking.
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
  previousMaxWeight: number;
  progress: number;       // percentage change

}

export interface DashboardAnalytics {
  strengthScore: StrengthScore;
  consistency: ConsistencyData;
  volumeTrends: VolumeTrend[];
  topExercises: ExerciseProgression[];
  totalPRs: number;
  estimated1RM: { exercise: string; estimated1RM: number }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Calculate estimated 1RM using Epley formula: weight × (1 + reps/30) */
export function estimateE1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

/** Get the ISO week string for a timestamp */
function getISOWeek(epoch: number): string {
  const d = new Date(epoch);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / MS_PER_DAY) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

/** Get the Monday of the week for a given date */
function getWeekStart(epoch: number): number {
  const d = new Date(epoch);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.setDate(diff)).setHours(0, 0, 0, 0);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;
const TWELVE_WEEKS_MS = 12 * MS_PER_WEEK;

// ---------------------------------------------------------------------------
// Main Analytics Computation
// ---------------------------------------------------------------------------

export const AnalyticsService = {

  async getFullAnalytics(): Promise<DashboardAnalytics> {
    const TWELVE_WEEKS_AGO = Date.now() - TWELVE_WEEKS_MS;

    const [strengthScore, consistency, volumeTrends, topExercises, totalPRs, estimated1RM] = await Promise.all([
      this.calculateStrengthScore(TWELVE_WEEKS_AGO),
      this.calculateConsistency(TWELVE_WEEKS_AGO),
      this.calculateVolumeTrends(TWELVE_WEEKS_AGO),
      this.calculateTopExerciseProgressions(TWELVE_WEEKS_AGO),
      this.countTotalPRs(),
      this.calculateEstimated1RMs(),
    ]);

    return { strengthScore, consistency, volumeTrends, topExercises, totalPRs, estimated1RM };
  },

  /**
   * Strength Score (0-100)
   * - Volume (0-40): Weekly volume relative to bodyweight
   * - Intensity (0-30): Average weight relative to benchmarks
   * - Consistency (0-30): Training frequency score
   */
  async calculateStrengthScore(since: number): Promise<StrengthScore> {
    try {
      const recentSessions = await db.select()
        .from(sessions)
        .where(and(
          isNull(sessions.deletedAt),
          gt(sessions.startTime, since)
        ))
        .orderBy(desc(sessions.startTime));

      const sessionIds = recentSessions.map(s => s.id);

      if (sessionIds.length === 0) {
        return { totalScore: 0, volumeScore: 0, intensityScore: 0, consistencyScore: 0, labelKey: 'noData' };
      }

      // Get all sets for these sessions
      const allSets = await db.select()
        .from(sets)
        .where(and(
          isNull(sets.deletedAt),
          inArray(sets.sessionId, sessionIds),
        ));

      // Volume Score (0-40): Based on average weekly volume
      const totalVolume = allSets
        .filter(s => !s.isWarmup && s.reps > 0 && s.weightKg > 0)
        .reduce((sum, s) => sum + (s.weightKg * s.reps), 0);

      const weeksSpan = Math.max(1, Math.ceil((Date.now() - since) / (MS_PER_WEEK)));
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
    } catch (e) {
      logger.error('Failed to calculate strength score', e);
      return { totalScore: 0, volumeScore: 0, intensityScore: 0, consistencyScore: 0, labelKey: 'error' };
    }
  },

  /**
   * Consistency metrics
   */
  async calculateConsistency(since: number): Promise<ConsistencyData> {
    try {
      const allActiveSessions = await db.select()
        .from(sessions)
        .where(isNull(sessions.deletedAt))
        .orderBy(desc(sessions.startTime));

      const recentSessions = allActiveSessions.filter(s => s.startTime >= since);

      // Weekly frequency (last 12 weeks)
      const weeksSpan = Math.max(1, Math.ceil((Date.now() - since) / (MS_PER_WEEK)));
      const weeklyFrequency = Math.round((recentSessions.length / weeksSpan) * 10) / 10;

      // Current streak
      const now = Date.now();
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

      // This week / month
      const weekStartMs = getWeekStart(now);
      const monthStart = new Date();
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
    } catch (e) {
      logger.error('Failed to calculate consistency', e);
      return {
        weeklyFrequency: 0, currentStreak: 0, longestStreak: 0,
        totalSessions: 0, sessionsThisWeek: 0, sessionsThisMonth: 0,
      };
    }
  },

  /**
   * Volume trends by week (last 12 weeks)
   */
  async calculateVolumeTrends(since: number): Promise<VolumeTrend[]> {
    try {
      const recentSessions = await db.select()
        .from(sessions)
        .where(and(isNull(sessions.deletedAt), gt(sessions.startTime, since)))
        .orderBy(asc(sessions.startTime));

      const sessionIds = recentSessions.map(s => s.id);
      if (sessionIds.length === 0) return [];

      const allSets = await db.select()
        .from(sets)
        .where(and(
          isNull(sets.deletedAt),
          inArray(sets.sessionId, sessionIds),
        ));

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

      for (const session of recentSessions) {
        const weekKey = getISOWeek(session.startTime);
        const entry = weekMap.get(weekKey);
        if (!entry) continue;
        entry.sessions.add(session.id);

        const sessionSets = allSets.filter(s => s.sessionId === session.id && !s.isWarmup);
        for (const set of sessionSets) {
          entry.volume += (set.weightKg * set.reps);
          entry.sets++;
        }
      }

      return Array.from(weekMap.entries()).map(([week, data]) => ({
        week,
        totalVolume: Math.round(data.volume),
        totalSets: data.sets,
        sessionCount: data.sessions.size,
        avgVolumePerSession: data.sessions.size > 0 ? Math.round(data.volume / data.sessions.size) : 0,
      }));
    } catch (e) {
      logger.error('Failed to calculate volume trends', e);
      return [];
    }
  },

  /**
   * Top 5 exercise progressions (max weight, last 12 weeks vs previous 12 weeks)
   */
  async calculateTopExerciseProgressions(since: number): Promise<ExerciseProgression[]> {
    try {
      const PREV_SINCE = since - TWELVE_WEEKS_MS;

      // Recent period
      const recentSets = await db.select({
        exerciseId: sets.exerciseId,
        exerciseName: sets.exerciseName,
        weightKg: sets.weightKg,
        createdAt: sets.createdAt,
      })
        .from(sets)
        .where(and(isNull(sets.deletedAt), gt(sql`COALESCE(${sets.createdAt}, ${sets.id})`, since), sql`NOT ${sets.isWarmup}`));

      // Previous period
      const prevSets = await db.select({
        exerciseId: sets.exerciseId,
        exerciseName: sets.exerciseName,
        weightKg: sets.weightKg,
        createdAt: sets.createdAt,
      })
        .from(sets)
        .where(and(isNull(sets.deletedAt), gt(sql`COALESCE(${sets.createdAt}, ${sets.id})`, PREV_SINCE), sql`${sets.createdAt} <= ${since}`, sql`NOT ${sets.isWarmup}`));

      // Current max weight per exercise
      const currentMax = new Map<number, { name: string; maxWeight: number }>();
      for (const s of recentSets) {
        if (!s.exerciseName) continue;
        const existing = currentMax.get(s.exerciseId);
        if (!existing || s.weightKg > existing.maxWeight) {
          currentMax.set(s.exerciseId, { name: s.exerciseName, maxWeight: s.weightKg });
        }
      }

      // Previous max weight per exercise
      const previousMax = new Map<number, number>();
      for (const s of prevSets) {
        const existing = previousMax.get(s.exerciseId);
        if (existing === undefined || s.weightKg > existing) {
          previousMax.set(s.exerciseId, s.weightKg);
        }
      }

      // Build progressions
      const progressions: ExerciseProgression[] = [];
      for (const [exerciseId, data] of currentMax) {
        const prevMax = previousMax.get(exerciseId) || 0;
        const progress = prevMax > 0 ? Math.round(((data.maxWeight - prevMax) / prevMax) * 100) : 100;
        progressions.push({
          exerciseId,
          exerciseName: data.name,
          currentMaxWeight: data.maxWeight,
          previousMaxWeight: prevMax,
          progress,
        });
      }

      // Sort by progress descending, top 5
      return progressions.sort((a, b) => b.progress - a.progress).slice(0, 5);
    } catch (e) {
      logger.error('Failed to calculate exercise progressions', e);
      return [];
    }
  },

  /** Count total PRs */
  async countTotalPRs(): Promise<number> {
    try {
      const result = await db.select({ count: sql<number>`count(*)` })
        .from(personalRecords);
      return result[0]?.count ?? 0;
    } catch {
      return 0;
    }
  },

  /** Estimate 1RM for top exercises */
  async calculateEstimated1RMs(): Promise<{ exercise: string; estimated1RM: number }[]> {
    try {
      // Get the heaviest set for each exercise (max weight with lowest reps)
      const recentSets = await db.select({
        exerciseName: sets.exerciseName,
        weightKg: sets.weightKg,
        reps: sets.reps,
      })
        .from(sets)
        .where(and(isNull(sets.deletedAt), sql`NOT ${sets.isWarmup}`))
        .orderBy(desc(sets.weightKg));

      const bestByExercise = new Map<string, { weight: number; reps: number }>();
      for (const s of recentSets) {
        if (!s.exerciseName || s.reps <= 0) continue;
        const existing = bestByExercise.get(s.exerciseName);
        if (!existing || s.weightKg > existing.weight) {
          bestByExercise.set(s.exerciseName, { weight: s.weightKg, reps: s.reps });
        }
      }

      return Array.from(bestByExercise.entries())
        .map(([exercise, data]) => ({
          exercise,
          estimated1RM: estimateE1RM(data.weight, data.reps),
        }))
        .sort((a, b) => b.estimated1RM - a.estimated1RM)
        .slice(0, 10);
    } catch (e) {
      logger.error('Failed to calculate estimated 1RMs', e);
      return [];
    }
  },
};

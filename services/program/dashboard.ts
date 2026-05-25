import { db } from '@/src/db/client';
import { programWeeks, sets, sessions } from '@/src/db/schema';
import { eq, and, desc, between, sql } from 'drizzle-orm';
import { logger } from '../logger';
import type { Program, ProgramWeek, ProgramPhase, Session } from '@/src/types';

/** Cast a raw DB row to the ProgramWeek type (phase: string → ProgramPhase) */
function castProgramWeek(row: Record<string, unknown>): ProgramWeek {
  return { ...(row as Omit<ProgramWeek, 'phase'>), phase: row.phase as ProgramPhase };
}

/**
 * Calculate the current week number of the program
 */
export function getCurrentWeek(program: Program): number {
  const now = Date.now();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const elapsed = now - program.startDate;
  return Math.min(Math.floor(elapsed / msPerWeek) + 1, program.weeksDuration);
}

/**
 * Get weeks until deload
 */
export function getWeeksUntilDeload(program: Program): number | null {
  if (!program.deloadWeek) return null;
  const current = getCurrentWeek(program);
  return Math.max(0, program.deloadWeek - current);
}

/**
 * Determine the current phase based on week number
 */
export function getCurrentPhase(program: Program): string {
  const current = getCurrentWeek(program);
  if (program.deloadWeek && current >= program.deloadWeek) return 'deload';
  const firstHalf = Math.floor(program.weeksDuration / 2);
  if (current <= firstHalf) return 'accumulation';
  return 'intensification';
}

/**
 * Get total volume for the current week of a program
 */
export async function getWeeklyVolume(program: Program): Promise<number> {
  try {
    const current = getCurrentWeek(program);
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const weekStart = program.startDate + (current - 1) * msPerWeek;
    const weekEnd = weekStart + msPerWeek;

    const result = await db
      .select({
        totalVolume: sql<number>`COALESCE(SUM(${sets.weightKg} * ${sets.reps}), 0)`,
      })
      .from(sets)
      .innerJoin(sessions, eq(sets.sessionId, sessions.id))
      .where(
        and(
          between(sessions.startTime, weekStart, weekEnd),
          eq(sets.isWarmup, false),
          sql`${sessions.deletedAt} IS NULL`
        )
      );

    return result[0]?.totalVolume ?? 0;
  } catch (e) {
    logger.error('Failed to get weekly volume', e);
    return 0;
  }
}

/**
 * Get average weekly volume for the last N weeks of a program
 */
export async function getAverageWeeklyVolume(program: Program, weeks: number = 4): Promise<number> {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const start = now - (weeks * msPerWeek);

  const result = await db
    .select({
      totalVolume: sql<number>`COALESCE(SUM(${sets.weightKg} * ${sets.reps}), 0)`,
      weekCount: sql<number>`COUNT(DISTINCT CAST((${sessions.startTime} - ${program.startDate}) / ${msPerWeek} AS INTEGER))`,
    })
    .from(sets)
    .innerJoin(sessions, eq(sets.sessionId, sessions.id))
    .where(
      and(
        between(sessions.startTime, start, now),
        eq(sets.isWarmup, false),
        sql`${sessions.deletedAt} IS NULL`
      )
    );

  const total = result[0]?.totalVolume ?? 0;
  const weekCount = result[0]?.weekCount ?? 1;
  return weekCount > 0 ? Math.round(total / weekCount) : 0;
}

/**
 * Get average sRPE for the current program
 */
export async function getAverageSRPE(program: Program): Promise<number | null> {
  const result = await db
    .select({ avgRpe: sql<number>`AVG(${sessions.sRpe})` })
    .from(sessions)
    .where(
      and(
        between(sessions.startTime, program.startDate, program.endDate),
        sql`${sessions.sRpe} IS NOT NULL`,
        sql`${sessions.deletedAt} IS NULL`
      )
    );

  return result[0]?.avgRpe ? Math.round(result[0].avgRpe * 10) / 10 : null;
}

/**
 * Get completion status for each week of a program.
 * Returns a map: weekNumber -> 'done' | 'missed' | 'deload' | 'future'
 */
export async function getWeekCompletionMap(program: Program): Promise<Map<number, 'done' | 'missed' | 'deload' | 'future'>> {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const currentWeek = getCurrentWeek(program);
  
  // Local implementation of getProgramWeeks to stay self-contained
  const weeksRows = await db
    .select()
    .from(programWeeks)
    .where(eq(programWeeks.programId, program.id))
    .orderBy(programWeeks.weekNumber);
  const weeks = weeksRows.map(r => castProgramWeek(r as unknown as Record<string, unknown>));

  const weekMap = new Map<number, 'done' | 'missed' | 'deload' | 'future'>();

  for (const w of weeks) {
    if (w.weekNumber > currentWeek) {
      weekMap.set(w.weekNumber, 'future');
      continue;
    }

    if (w.phase === 'deload') {
      weekMap.set(w.weekNumber, 'deload');
      continue;
    }

    // Check if any session exists in this week
    const weekStart = program.startDate + (w.weekNumber - 1) * msPerWeek;
    const weekEnd = weekStart + msPerWeek;

    const sessionCount = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(sessions)
      .where(
        and(
          between(sessions.startTime, weekStart, weekEnd),
          sql`${sessions.deletedAt} IS NULL`
        )
      );

    weekMap.set(w.weekNumber, (sessionCount[0]?.count ?? 0) > 0 ? 'done' : 'missed');
  }

  return weekMap;
}

/**
 * Get sessions for a specific week of a program
 */
export async function getSessionsForWeek(program: Program, weekNumber: number): Promise<Session[]> {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weekStart = program.startDate + (weekNumber - 1) * msPerWeek;
  const weekEnd = weekStart + msPerWeek;

  return db
    .select()
    .from(sessions)
    .where(
      and(
        between(sessions.startTime, weekStart, weekEnd),
        sql`${sessions.deletedAt} IS NULL`
      )
    )
    .orderBy(desc(sessions.startTime)) as unknown as Promise<Session[]>;
}

/**
 * Get key lift data: top exercises by volume in the program, with weekly progression
 */
export async function getKeyLifts(program: Program, limit: number = 5): Promise<{
  exerciseId: number;
  name: string;
  trend: 'up' | 'flat' | 'down';
  currentWeight: number;
  history: { week: number; maxWeight: number }[];
}[]> {
  // Get all sets in program timeframe
  const programSets = await db
    .select({
      exerciseId: sets.exerciseId,
      exerciseName: sets.exerciseName,
      weightKg: sets.weightKg,
      reps: sets.reps,
      startTime: sessions.startTime,
    })
    .from(sets)
    .innerJoin(sessions, eq(sets.sessionId, sessions.id))
    .where(
      and(
        between(sessions.startTime, program.startDate, program.endDate),
        eq(sets.isWarmup, false),
        sql`${sessions.deletedAt} IS NULL`,
        sql`${sets.deletedAt} IS NULL`
      )
    );

  // Group by exercise, calculate total volume
  const exerciseMap = new Map<number, { name: string; totalVolume: number; sets: typeof programSets }>();
  for (const s of programSets) {
    const existing = exerciseMap.get(s.exerciseId);
    if (existing) {
      existing.totalVolume += s.weightKg * s.reps;
      existing.sets.push(s);
    } else {
      exerciseMap.set(s.exerciseId, {
        name: s.exerciseName ?? `Exercise #${s.exerciseId}`,
        totalVolume: s.weightKg * s.reps,
        sets: [s],
      });
    }
  }

  // Sort by volume, take top N
  const top = Array.from(exerciseMap.entries())
    .sort((a, b) => b[1].totalVolume - a[1].totalVolume)
    .slice(0, limit);

  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  return top.map(([exerciseId, data]) => {
    // Group sets by week
    const weekMap = new Map<number, number>();
    for (const s of data.sets) {
      const week = Math.floor((s.startTime - program.startDate) / msPerWeek) + 1;
      const current = weekMap.get(week) ?? 0;
      weekMap.set(week, Math.max(current, s.weightKg));
    }

    const history = Array.from(weekMap.entries())
      .map(([week, maxWeight]) => ({ week, maxWeight }))
      .sort((a, b) => a.week - b.week);

    // Determine trend from last 2 weeks
    let trend: 'up' | 'flat' | 'down' = 'flat';
    if (history.length >= 2) {
      const last = history[history.length - 1].maxWeight;
      const prev = history[history.length - 2].maxWeight;
      if (last > prev + 0.5) trend = 'up';
      else if (last < prev - 0.5) trend = 'down';
    }

    return {
      exerciseId,
      name: data.name,
      trend,
      currentWeight: history.length > 0 ? history[history.length - 1].maxWeight : 0,
      history,
    };
  });
}

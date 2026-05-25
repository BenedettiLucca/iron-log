import { db } from '@/src/db/client';
import { programExerciseTargets, sets, sessions } from '@/src/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { logger } from './logger';
import type { DoubleProgressionStatus } from '@/src/types';

/**
 * Check double progression status for an exercise in a program.
 * Returns whether the user hit the top of the rep range across all working sets.
 */
export async function getDoubleProgressionStatus(
  programId: number,
  exerciseId: number,
  exerciseName: string
): Promise<DoubleProgressionStatus | null> {
  try {
    const targets = await db
      .select()
      .from(programExerciseTargets)
      .where(
        and(
          eq(programExerciseTargets.programId, programId),
          eq(programExerciseTargets.exerciseId, exerciseId)
        )
      );

    if (!targets.length) return null;
    const target = targets[0];

    // Get last 3 sessions with this exercise
    const recentSets = await db
      .select({
        weight: sets.weightKg,
        reps: sets.reps,
        setNum: sets.setNumber,
        sessionId: sets.sessionId,
        isWarmup: sets.isWarmup,
      })
      .from(sets)
      .innerJoin(sessions, eq(sets.sessionId, sessions.id))
      .where(
        and(
          eq(sets.exerciseId, exerciseId),
          eq(sets.isWarmup, false),
          sql`${sets.deletedAt} IS NULL`
        )
      )
      .orderBy(desc(sets.createdAt))
      .limit(target.targetSets * 3); // enough for 3 sessions

    let lastPerformance: DoubleProgressionStatus['lastPerformance'] = null;
    let isAtTop = false;
    let trend: 'up' | 'flat' | 'down' = 'flat';

    if (recentSets.length > 0) {
      // Group by session
      const sessionMap = new Map<number, { weight: number; reps: number }[]>();
      for (const s of recentSets) {
        if (!sessionMap.has(s.sessionId)) sessionMap.set(s.sessionId, []);
        sessionMap.get(s.sessionId)!.push({ weight: s.weight, reps: s.reps });
      }

      const sessionList = Array.from(sessionMap.entries());

      // Last session performance
      const lastSessionSets = sessionList[0]?.[1] ?? [];
      if (lastSessionSets.length > 0) {
        const avgWeight = lastSessionSets.reduce((s, x) => s + x.weight, 0) / lastSessionSets.length;
        const minReps = Math.min(...lastSessionSets.map(x => x.reps));
        lastPerformance = {
          weight: Math.round(avgWeight * 10) / 10,
          reps: minReps,
          sets: lastSessionSets.length,
        };

        // Check if all sets hit the top of the rep range
        isAtTop = lastSessionSets.every(s => s.reps >= target.targetRepsMax);
      }

      // Trend: compare last 2 sessions
      if (sessionList.length >= 2) {
        const prevSessionSets = sessionList[1]?.[1] ?? [];
        if (prevSessionSets.length > 0 && lastSessionSets.length > 0) {
          const prevAvg = prevSessionSets.reduce((s, x) => s + x.weight, 0) / prevSessionSets.length;
          const lastAvg = lastSessionSets.reduce((s, x) => s + x.weight, 0) / lastSessionSets.length;
          if (lastAvg > prevAvg + 0.5) trend = 'up';
          else if (lastAvg < prevAvg - 0.5) trend = 'down';
        }
      }
    }

    return {
      exerciseId,
      exerciseName,
      targetRepsMin: target.targetRepsMin,
      targetRepsMax: target.targetRepsMax,
      targetSets: target.targetSets,
      lastPerformance,
      isAtTop,
      trend,
    };
  } catch (e) {
    logger.error('Failed to get double progression status', e);
    return null;
  }
}

import { db } from '@/src/db/client';
import { programs, programWeeks, programExerciseTargets, exercises, sets, sessions } from '@/src/db/schema';
import { eq, and, desc, between, sql } from 'drizzle-orm';
import { logger } from './logger';
import type { Program, ProgramWeek, ProgramExerciseTarget, DoubleProgressionStatus, ProgramGoal, ProgramPhase, Session } from '@/src/types';

/** Cast a raw DB row to the Program type (goal: string → ProgramGoal) */
function castProgram(row: Record<string, unknown>): Program {
  return { ...(row as Omit<Program, 'goal'>), goal: row.goal as ProgramGoal };
}

/** Cast a raw DB row to the ProgramWeek type (phase: string → ProgramPhase) */
function castProgramWeek(row: Record<string, unknown>): ProgramWeek {
  return { ...(row as Omit<ProgramWeek, 'phase'>), phase: row.phase as ProgramPhase };
}

// ---------------------------------------------------------------------------
// Program CRUD
// ---------------------------------------------------------------------------

export const ProgramService = {
  /**
   * Get the currently active program (there should be at most one)
   */
  async getActiveProgram(): Promise<Program | null> {
    try {
      const result = await db
        .select()
        .from(programs)
        .where(eq(programs.isActive, true))
        .limit(1);
      return result[0] ? castProgram(result[0] as unknown as Record<string, unknown>) : null;
    } catch (e) {
      logger.error('Failed to get active program', e);
      return null;
    }
  },

  /**
   * Get all programs (active and archived)
   */
  async getAllPrograms(): Promise<Program[]> {
    try {
      const rows = await db.select().from(programs).orderBy(desc(programs.createdAt));
      return rows.map(r => castProgram(r as unknown as Record<string, unknown>));
    } catch (e) {
      logger.error('Failed to get all programs', e);
      return [];
    }
  },

  /**
   * Get a program by ID
   */
  async getProgram(id: number): Promise<Program | null> {
    try {
      const result = await db.select().from(programs).where(eq(programs.id, id));
      return result[0] ? castProgram(result[0] as unknown as Record<string, unknown>) : null;
    } catch (e) {
      logger.error('Failed to get program', e);
      return null;
    }
  },

  /**
   * Create a new program. Deactivates any currently active program first.
   */
  async createProgram(data: {
    name: string;
    description?: string;
    startDate: number;
    endDate: number;
    weeksDuration: number;
    deloadWeek?: number;
    goal: string;
  }): Promise<Program | null> {
    try {
      // Deactivate current active program
      await db.update(programs).set({ isActive: false }).where(eq(programs.isActive, true));

      const result = await db.insert(programs).values({
        name: data.name,
        description: data.description ?? null,
        startDate: data.startDate,
        endDate: data.endDate,
        weeksDuration: data.weeksDuration,
        deloadWeek: data.deloadWeek ?? null,
        goal: data.goal,
        isActive: true,
      }).returning();

      return result[0] ? castProgram(result[0] as unknown as Record<string, unknown>) : null;
    } catch (e) {
      logger.error('Failed to create program', e);
      return null;
    }
  },

  /**
   * Update a program
   */
  async updateProgram(id: number, data: Partial<Program>): Promise<boolean> {
    try {
      await db.update(programs).set(data).where(eq(programs.id, id));
      return true;
    } catch (e) {
      logger.error('Failed to update program', e);
      return false;
    }
  },

  /**
   * Delete a program and all associated weeks/targets
   */
  async deleteProgram(id: number): Promise<boolean> {
    try {
      await db.delete(programExerciseTargets).where(eq(programExerciseTargets.programId, id));
      await db.delete(programWeeks).where(eq(programWeeks.programId, id));
      await db.delete(programs).where(eq(programs.id, id));
      return true;
    } catch (e) {
      logger.error('Failed to delete program', e);
      return false;
    }
  },

  /**
   * Deactivate a program (archive it)
   */
  async archiveProgram(id: number): Promise<boolean> {
    try {
      await db.update(programs).set({ isActive: false }).where(eq(programs.id, id));
      return true;
    } catch (e) {
      logger.error('Failed to archive program', e);
      return false;
    }
  },

  // ---------------------------------------------------------------------------
  // Program Weeks
  // ---------------------------------------------------------------------------

  /**
   * Get all weeks for a program
   */
  async getProgramWeeks(programId: number): Promise<ProgramWeek[]> {
    try {
      const rows = await db
        .select()
        .from(programWeeks)
        .where(eq(programWeeks.programId, programId))
        .orderBy(programWeeks.weekNumber);
      return rows.map(r => castProgramWeek(r as unknown as Record<string, unknown>));
    } catch (e) {
      logger.error('Failed to get program weeks', e);
      return [];
    }
  },

  /**
   * Set the routine for a specific week
   */
  async setWeekRoutine(
    programId: number,
    weekNumber: number,
    routineId: number | null,
    phase: string = 'accumulation',
    rirTarget: number = 0,
    intensityMod: number = 1.0
  ): Promise<ProgramWeek | null> {
    try {
      const existing = await db
        .select()
        .from(programWeeks)
        .where(and(eq(programWeeks.programId, programId), eq(programWeeks.weekNumber, weekNumber)));

      if (existing.length > 0) {
        const result = await db
          .update(programWeeks)
          .set({ routineId, phase, rirTarget, intensityMod })
          .where(eq(programWeeks.id, existing[0].id))
          .returning();
        return result[0] ? castProgramWeek(result[0] as unknown as Record<string, unknown>) : null;
      } else {
        const result = await db
          .insert(programWeeks)
          .values({ programId, weekNumber, routineId, phase, rirTarget, intensityMod })
          .returning();
        return result[0] ? castProgramWeek(result[0] as unknown as Record<string, unknown>) : null;
      }
    } catch (e) {
      logger.error('Failed to set week routine', e);
      return null;
    }
  },

  /**
   * Bulk-set weeks for a program (replaces all existing weeks)
   */
  async setAllWeeks(
    programId: number,
    weeks: {
      weekNumber: number;
      routineId: number | null;
      phase: string;
      rirTarget: number;
      intensityMod: number;
    }[]
  ): Promise<boolean> {
    try {
      await db.delete(programWeeks).where(eq(programWeeks.programId, programId));
      if (weeks.length > 0) {
        await db.insert(programWeeks).values(weeks.map(w => ({ programId, ...w })));
      }
      return true;
    } catch (e) {
      logger.error('Failed to set all weeks', e);
      return false;
    }
  },

  // ---------------------------------------------------------------------------
  // Exercise Targets (Double Progression)
  // ---------------------------------------------------------------------------

  /**
   * Get all exercise targets for a program
   */
  async getExerciseTargets(programId: number): Promise<ProgramExerciseTarget[]> {
    try {
      const rows = await db
        .select({
          id: programExerciseTargets.id,
          programId: programExerciseTargets.programId,
          exerciseId: programExerciseTargets.exerciseId,
          targetRepsMin: programExerciseTargets.targetRepsMin,
          targetRepsMax: programExerciseTargets.targetRepsMax,
          targetSets: programExerciseTargets.targetSets,
          exerciseName: exercises.name,
        })
        .from(programExerciseTargets)
        .leftJoin(exercises, eq(programExerciseTargets.exerciseId, exercises.id))
        .where(eq(programExerciseTargets.programId, programId));

      return rows.map(row => ({
        id: row.id,
        programId: row.programId,
        exerciseId: row.exerciseId,
        targetRepsMin: row.targetRepsMin,
        targetRepsMax: row.targetRepsMax,
        targetSets: row.targetSets,
        exerciseName: row.exerciseName ?? undefined,
      }));
    } catch (e) {
      logger.error('Failed to get exercise targets', e);
      return [];
    }
  },

  /**
   * Set or update exercise target
   */
  async setExerciseTarget(
    programId: number,
    exerciseId: number,
    targetRepsMin: number,
    targetRepsMax: number,
    targetSets: number
  ): Promise<boolean> {
    try {
      const existing = await db
        .select()
        .from(programExerciseTargets)
        .where(
          and(
            eq(programExerciseTargets.programId, programId),
            eq(programExerciseTargets.exerciseId, exerciseId)
          )
        );

      if (existing.length > 0) {
        await db
          .update(programExerciseTargets)
          .set({ targetRepsMin, targetRepsMax, targetSets })
          .where(eq(programExerciseTargets.id, existing[0].id));
      } else {
        await db
          .insert(programExerciseTargets)
          .values({ programId, exerciseId, targetRepsMin, targetRepsMax, targetSets });
      }
      return true;
    } catch (e) {
      logger.error('Failed to set exercise target', e);
      return false;
    }
  },

  /**
   * Remove exercise target
   */
  async removeExerciseTarget(programId: number, exerciseId: number): Promise<boolean> {
    try {
      await db
        .delete(programExerciseTargets)
        .where(
          and(
            eq(programExerciseTargets.programId, programId),
            eq(programExerciseTargets.exerciseId, exerciseId)
          )
        );
      return true;
    } catch (e) {
      logger.error('Failed to remove exercise target', e);
      return false;
    }
  },

  // ---------------------------------------------------------------------------
  // Double Progression Logic
  // ---------------------------------------------------------------------------

  /**
   * Check double progression status for an exercise in a program.
   * Returns whether the user hit the top of the rep range across all working sets.
   */
  async getDoubleProgressionStatus(
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
  },

  // ---------------------------------------------------------------------------
  // Program Dashboard Helpers
  // ---------------------------------------------------------------------------

  /**
   * Calculate the current week number of the program
   */
  getCurrentWeek(program: Program): number {
    const now = Date.now();
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const elapsed = now - program.startDate;
    return Math.min(Math.floor(elapsed / msPerWeek) + 1, program.weeksDuration);
  },

  /**
   * Get weeks until deload
   */
  getWeeksUntilDeload(program: Program): number | null {
    if (!program.deloadWeek) return null;
    const current = this.getCurrentWeek(program);
    return Math.max(0, program.deloadWeek - current);
  },

  /**
   * Determine the current phase based on week number
   */
  getCurrentPhase(program: Program): string {
    const current = this.getCurrentWeek(program);
    if (program.deloadWeek && current >= program.deloadWeek) return 'deload';
    const firstHalf = Math.floor(program.weeksDuration / 2);
    if (current <= firstHalf) return 'accumulation';
    return 'intensification';
  },

  /**
   * Get total volume for the current week of a program
   */
  async getWeeklyVolume(program: Program): Promise<number> {
    try {
      const current = this.getCurrentWeek(program);
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
  },

  /**
   * Get average weekly volume for the last N weeks of a program
   */
  async getAverageWeeklyVolume(program: Program, weeks: number = 4): Promise<number> {
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
  },

  /**
   * Get average sRPE for the current program
   */
  async getAverageSRPE(program: Program): Promise<number | null> {
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
  },

  /**
   * Get completion status for each week of a program.
   * Returns a map: weekNumber -> 'done' | 'missed' | 'deload' | 'future'
   */
  async getWeekCompletionMap(program: Program): Promise<Map<number, 'done' | 'missed' | 'deload' | 'future'>> {
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const currentWeek = this.getCurrentWeek(program);
    const weeks = await this.getProgramWeeks(program.id);
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
  },

  /**
   * Get sessions for a specific week of a program
   */
  async getSessionsForWeek(program: Program, weekNumber: number): Promise<Session[]> {
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
  },

  /**
   * Get key lift data: top exercises by volume in the program, with weekly progression
   */
  async getKeyLifts(program: Program, limit: number = 5): Promise<{
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
  },
};

import { db } from '@/src/db/client';
import { programs, programWeeks, programExerciseTargets, sets, sessions } from '@/src/db/schema';
import { eq, and, desc, between, sql } from 'drizzle-orm';
import { logger } from './logger';
import type { Program, ProgramWeek, ProgramExerciseTarget, DoubleProgressionStatus, ProgramGoal, ProgramPhase } from '@/src/types';

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
      return await db
        .select()
        .from(programExerciseTargets)
        .where(eq(programExerciseTargets.programId, programId));
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
};

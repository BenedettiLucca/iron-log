import { db } from '@/src/db/client';
import { programWeeks } from '@/src/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../logger';
import type { ProgramWeek, ProgramPhase } from '@/src/types';

/** Cast a raw DB row to the ProgramWeek type (phase: string → ProgramPhase) */
function castProgramWeek(row: Record<string, unknown>): ProgramWeek {
  return { ...(row as Omit<ProgramWeek, 'phase'>), phase: row.phase as ProgramPhase };
}

/**
 * Get all weeks for a program
 */
export async function getProgramWeeks(programId: number): Promise<ProgramWeek[]> {
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
}

/**
 * Set the routine for a specific week
 */
export async function setWeekRoutine(
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
}

/**
 * Bulk-set weeks for a program (replaces all existing weeks)
 */
export async function setAllWeeks(
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
}

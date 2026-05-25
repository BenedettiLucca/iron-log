import { db } from '@/src/db/client';
import { programs, programWeeks, programExerciseTargets } from '@/src/db/schema';
import { eq, desc } from 'drizzle-orm';
import { logger } from '../logger';
import type { Program, ProgramGoal } from '@/src/types';

/** Cast a raw DB row to the Program type (goal: string → ProgramGoal) */
function castProgram(row: Record<string, unknown>): Program {
  return { ...(row as Omit<Program, 'goal'>), goal: row.goal as ProgramGoal };
}

/**
 * Get the currently active program (there should be at most one)
 */
export async function getActiveProgram(): Promise<Program | null> {
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
}

/**
 * Get all programs (active and archived)
 */
export async function getAllPrograms(): Promise<Program[]> {
  try {
    const rows = await db.select().from(programs).orderBy(desc(programs.createdAt));
    return rows.map(r => castProgram(r as unknown as Record<string, unknown>));
  } catch (e) {
    logger.error('Failed to get all programs', e);
    return [];
  }
}

/**
 * Get a program by ID
 */
export async function getProgram(id: number): Promise<Program | null> {
  try {
    const result = await db.select().from(programs).where(eq(programs.id, id));
    return result[0] ? castProgram(result[0] as unknown as Record<string, unknown>) : null;
  } catch (e) {
    logger.error('Failed to get program', e);
    return null;
  }
}

/**
 * Create a new program. Deactivates any currently active program first.
 */
export async function createProgram(data: {
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
}

/**
 * Update a program
 */
export async function updateProgram(id: number, data: Partial<Program>): Promise<boolean> {
  try {
    await db.update(programs).set(data).where(eq(programs.id, id));
    return true;
  } catch (e) {
    logger.error('Failed to update program', e);
    return false;
  }
}

/**
 * Delete a program and all associated weeks/targets
 */
export async function deleteProgram(id: number): Promise<boolean> {
  try {
    await db.delete(programExerciseTargets).where(eq(programExerciseTargets.programId, id));
    await db.delete(programWeeks).where(eq(programWeeks.programId, id));
    await db.delete(programs).where(eq(programs.id, id));
    return true;
  } catch (e) {
    logger.error('Failed to delete program', e);
    return false;
  }
}

/**
 * Deactivate a program (archive it)
 */
export async function archiveProgram(id: number): Promise<boolean> {
  try {
    await db.update(programs).set({ isActive: false }).where(eq(programs.id, id));
    return true;
  } catch (e) {
    logger.error('Failed to archive program', e);
    return false;
  }
}

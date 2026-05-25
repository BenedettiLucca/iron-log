import { db } from '@/src/db/client';
import { programExerciseTargets, exercises } from '@/src/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../logger';
import type { ProgramExerciseTarget } from '@/src/types';

/**
 * Get all exercise targets for a program
 */
export async function getExerciseTargets(programId: number): Promise<ProgramExerciseTarget[]> {
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
}

/**
 * Set or update exercise target
 */
export async function setExerciseTarget(
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
}

/**
 * Remove exercise target
 */
export async function removeExerciseTarget(programId: number, exerciseId: number): Promise<boolean> {
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
}

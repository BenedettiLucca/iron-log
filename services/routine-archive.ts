import { db as defaultDb } from '@/src/db/client';
import { routines } from '@/src/db/schema';
import { eq, ne } from 'drizzle-orm';
import { logger } from './logger';
import { Routine } from '@/src/types';

export type RoutineArchiveErrorCode = 'ROUTINE_NOT_FOUND' | 'DATABASE_ERROR' | 'ROUTINE_NAME_CONFLICT';

export interface RoutineArchiveResult {
  success: boolean;
  errorCode?: RoutineArchiveErrorCode;
}

/**
 * Soft-archives a routine: sets is_archived = true atomically.
 * Idempotent: archiving an already-archived routine succeeds (no-op).
 * Fails with ROUTINE_NOT_FOUND when the id does not exist.
 */
export async function archiveRoutine(
  id: number,
  database?: typeof defaultDb
): Promise<RoutineArchiveResult> {
  const db = database || defaultDb;
  try {
    return db.transaction((tx) => {
      const routine = tx
        .select({ id: routines.id })
        .from(routines)
        .where(eq(routines.id, id))
        .get();
      if (!routine) {
        return { success: false, errorCode: 'ROUTINE_NOT_FOUND' as const };
      }

      tx.update(routines).set({ isArchived: true }).where(eq(routines.id, id)).run();

      const updated = tx
        .select({ isArchived: routines.isArchived })
        .from(routines)
        .where(eq(routines.id, id))
        .get();
      if (!updated || updated.isArchived !== true) {
        return { success: false, errorCode: 'DATABASE_ERROR' as const };
      }
      return { success: true };
    });
  } catch (error) {
    logger.error('Failed to archive routine', error);
    return { success: false, errorCode: 'DATABASE_ERROR' };
  }
}

/**
 * Restores an archived routine: sets is_archived = false atomically.
 * Idempotent: unarchiving a non-archived routine succeeds (no-op).
 * Fails with ROUTINE_NOT_FOUND when the id does not exist.
 */
export async function unarchiveRoutine(
  id: number,
  database?: typeof defaultDb
): Promise<RoutineArchiveResult> {
  const db = database || defaultDb;
  try {
    return db.transaction((tx) => {
      const routine = tx
        .select({ id: routines.id })
        .from(routines)
        .where(eq(routines.id, id))
        .get();
      if (!routine) {
        return { success: false, errorCode: 'ROUTINE_NOT_FOUND' as const };
      }

      tx.update(routines).set({ isArchived: false }).where(eq(routines.id, id)).run();

      const updated = tx
        .select({ isArchived: routines.isArchived })
        .from(routines)
        .where(eq(routines.id, id))
        .get();
      if (!updated || updated.isArchived !== false) {
        return { success: false, errorCode: 'DATABASE_ERROR' as const };
      }
      return { success: true };
    });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('UNIQUE constraint failed') || error.message.includes('routines_name_unique'))) {
      return { success: false, errorCode: 'ROUTINE_NAME_CONFLICT' };
    }
    logger.error('Failed to unarchive routine', error);
    return { success: false, errorCode: 'DATABASE_ERROR' };
}
  }

/**
 * Returns only archived routines, ordered by id.
 */
export async function getArchivedRoutines(
  database?: typeof defaultDb
): Promise<Routine[]> {
  const db = database || defaultDb;
  const rows = await db.select().from(routines).where(eq(routines.isArchived, true));
  return rows;
}

/**
 * Returns all routines regardless of archive status, ordered by id.
 */
export async function getAllRoutinesIncludingArchived(
  database?: typeof defaultDb
): Promise<Routine[]> {
  const db = database || defaultDb;
  const rows = await db.select().from(routines);
  return rows;
}

/**
 * Returns active (non-archived) routines — the default listing — ordered by id.
 */
export async function getActiveRoutines(
  database?: typeof defaultDb
): Promise<Routine[]> {
  const db = database || defaultDb;
  const rows = await db.select().from(routines).where(ne(routines.isArchived, true));
  return rows;
}

/**
 * Returns the next available routine name given the set of already-used names.
 * If the base name is free, returns it as-is. Otherwise returns "Base (2)", "Base (3)", etc.
 * Collision matching is case-insensitive and whitespace-trimmed.
 *
 * Pure function: does not touch the database. The caller must collect all routine names
 * (active AND archived) and pass them as a `Set<string>`.
 */
export function getNextAvailableRoutineName(existingNames: Set<string>, baseName: string): string {
  const trimmed = baseName.trim();

  if (!existingNames.has(trimmed.toLowerCase())) {
    return trimmed;
  }

  let counter = 2;
  while (existingNames.has(`${trimmed} (${counter})`.toLowerCase())) {
    counter++;
  }
  return `${trimmed} (${counter})`;
}

export const RoutineArchiveService = {
  archiveRoutine,
  unarchiveRoutine,
  getArchivedRoutines,
  getAllRoutinesIncludingArchived,
  getActiveRoutines,
  getNextAvailableRoutineName,
};
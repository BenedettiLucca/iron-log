import { db, sqlite } from '../fixtures/database';
import { routines, routineExercises, exercises, sessions } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import {
  archiveRoutine,
  unarchiveRoutine,
  getArchivedRoutines,
  getAllRoutinesIncludingArchived,
  getActiveRoutines,
  getNextAvailableRoutineName,
} from '@/services/routine-archive';

/**
 * Collects all routine names (active and archived) into a case-insensitive Set
 * for use with getNextAvailableRoutineName.
 */
function collectAllRoutineNames(
  database: { select: (source?: any) => { from: (table: any) => { all: () => Array<Record<string, any>> } } }
): Set<string> {
  const allRoutines = database
    .select({ name: routines.name })
    .from(routines)
    .all() as Array<{ name: string }>;
  return new Set<string>(allRoutines.map((r) => r.name.trim().toLowerCase()));
}

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

// Re-seed test database before each test
beforeEach(() => {
  sqlite.exec(
    'DELETE FROM sets; DELETE FROM sessions; DELETE FROM routine_exercises; DELETE FROM routines; DELETE FROM exercises; DELETE FROM sqlite_sequence;'
  );
});



describe('RoutineArchiveService (RED - functions not yet implemented)', () => {
  describe('archiveRoutine', () => {
    it('should archive an existing routine', async () => {
      // Arrange: create a routine
      const routineRow = db
        .insert(routines)
        .values({
          name: 'Treino A',
          description: 'Push day routine',
          folder: 'Geral',
        })
        .returning()
        .get();

      // Act: archive the routine
      const result = await archiveRoutine(routineRow.id);

      // Assert
      expect(result.success).toBe(true);
      
      // Verify routine is marked as archived in DB
      const archivedRoutine = db.select().from(routines).where(eq(routines.id, routineRow.id)).get();
      expect(archivedRoutine?.isArchived).toBe(true);
    });

    it('should be idempotent: archiving already archived routine succeeds', async () => {
      // Arrange: create and archive a routine
      const routineRow = db
        .insert(routines)
        .values({ name: 'Treino B', folder: 'Geral' })
        .returning()
        .get();
      
      await archiveRoutine(routineRow.id);

      // Act: archive again
      const result = await archiveRoutine(routineRow.id);

      // Assert: should succeed (idempotent)
      expect(result.success).toBe(true);
      
      // Verify still archived
      const archivedRoutine = db.select().from(routines).where(eq(routines.id, routineRow.id)).get();
      expect(archivedRoutine?.isArchived).toBe(true);
    });

    it('should return failure for non-existent routine', async () => {
      // Act: archive non-existent routine
      const result = await archiveRoutine(999);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('ROUTINE_NOT_FOUND');
    });
  });

  describe('unarchiveRoutine', () => {
    it('should restore an archived routine to active', async () => {
      // Arrange: create and archive a routine
      const routineRow = db
        .insert(routines)
        .values({ name: 'Treino C', folder: 'Geral' })
        .returning()
        .get();
      
      await archiveRoutine(routineRow.id);

      // Act: unarchive
      const result = await unarchiveRoutine(routineRow.id);

      // Assert
      expect(result.success).toBe(true);
      
      // Verify routine is no longer archived
      const restoredRoutine = db.select().from(routines).where(eq(routines.id, routineRow.id)).get();
      expect(restoredRoutine?.isArchived).toBe(false);
    });

    it('should be idempotent: unarchiving non-archived routine succeeds', async () => {
      // Arrange: create a non-archived routine
      const routineRow = db
        .insert(routines)
        .values({ name: 'Treino D', folder: 'Geral' })
        .returning()
        .get();

      // Act: unarchive (no-op)
      const result = await unarchiveRoutine(routineRow.id);

      // Assert
      expect(result.success).toBe(true);
      
      // Verify still not archived
      const routine = db.select().from(routines).where(eq(routines.id, routineRow.id)).get();
      expect(routine?.isArchived).toBe(false);
    });

    it('should return failure for non-existent routine', async () => {
      // Act: unarchive non-existent routine
      const result = await unarchiveRoutine(999);

      // Assert
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('ROUTINE_NOT_FOUND');
    });
  });

  describe('getArchivedRoutines', () => {
    it('should return only archived routines', async () => {
      // Arrange: create 2 active, 1 archived
      db.insert(routines).values({ name: 'Active 1', folder: 'Geral' }).returning().get();
      db.insert(routines).values({ name: 'Active 2', folder: 'Geral' }).returning().get();
      const archived = db.insert(routines).values({ name: 'Archived 1', folder: 'Geral' }).returning().get();
      await archiveRoutine(archived.id);

      // Act
      const result = await getArchivedRoutines();

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(archived.id);
      expect(result[0].isArchived).toBe(true);
    });

    it('should return empty array when no archived routines exist', async () => {
      // Arrange: only active routines
      db.insert(routines).values({ name: 'Active 1', folder: 'Geral' }).returning().get();
      db.insert(routines).values({ name: 'Active 2', folder: 'Geral' }).returning().get();

      // Act
      const result = await getArchivedRoutines();

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('getAllRoutinesIncludingArchived', () => {
    it('should return all routines regardless of archive status', async () => {
      // Arrange: create 2 active, 1 archived
      const active1 = db.insert(routines).values({ name: 'Active 1', folder: 'Geral' }).returning().get();
      const active2 = db.insert(routines).values({ name: 'Active 2', folder: 'Geral' }).returning().get();
      const archived = db.insert(routines).values({ name: 'Archived 1', folder: 'Geral' }).returning().get();
      await archiveRoutine(archived.id);

      // Act
      const result = await getAllRoutinesIncludingArchived();

      // Assert
      expect(result).toHaveLength(3);
      
      const activeIds = result.filter((r) => !r.isArchived).map((r) => r.id);
      const archivedIds = result.filter((r) => r.isArchived).map((r) => r.id);
      
      expect(activeIds).toContain(active1.id);
      expect(activeIds).toContain(active2.id);
      expect(archivedIds).toContain(archived.id);
    });
  });

  describe('Data preservation on archive', () => {
    it('should preserve sessions referencing archived routine', async () => {
      // Arrange: create routine, session, and exercises
      const routineRow = db.insert(routines).values({ name: 'Treino E', folder: 'Geral' }).returning().get();
      db.insert(exercises).values({ name: 'Supino', type: 'strength' }).returning().get();
      
      const sessionRow = db
        .insert(sessions)
        .values({
          routineId: routineRow.id,
          routineName: 'Treino E',
          startTime: Date.now(),
          durationMinutes: 60,
        })
        .returning()
        .get();

      // Act: archive the routine
      await archiveRoutine(routineRow.id);

      // Assert: session still exists and references routine
      const session = db.select().from(sessions).where(eq(sessions.id, sessionRow.id)).get();
      expect(session).toBeDefined();
      expect(session?.routineId).toBe(routineRow.id);
      expect(session?.routineName).toBe('Treino E');

      // Assert: routine still exists and is marked archived
      const routine = db.select().from(routines).where(eq(routines.id, routineRow.id)).get();
      expect(routine?.isArchived).toBe(true);
    });

    it('should preserve routine exercises on archive', async () => {
      // Arrange: create routine with exercises
      const routineRow = db.insert(routines).values({ name: 'Treino F', folder: 'Geral' }).returning().get();
      const exercise = db.insert(exercises).values({ name: 'Agachamento', type: 'strength' }).returning().get();
      
      db.insert(routineExercises).values({
        routineId: routineRow.id,
        exerciseId: exercise.id,
        orderIndex: 0,
        target: '3x10',
      }).run();

      // Act: archive the routine
      await archiveRoutine(routineRow.id);

      // Assert: routine exercises preserved
      const routineExercisesRows = db.select().from(routineExercises).where(eq(routineExercises.routineId, routineRow.id)).all();
      expect(routineExercisesRows).toHaveLength(1);
      expect(routineExercisesRows[0].exerciseId).toBe(exercise.id);
    });

    it('should preserve sessions after unarchive cycle', async () => {
      // Arrange: create routine and session
      const routineRow = db.insert(routines).values({ name: 'Treino G', folder: 'Geral' }).returning().get();
      const sessionRow = db
        .insert(sessions)
        .values({
          routineId: routineRow.id,
          routineName: 'Treino G',
          startTime: Date.now(),
          durationMinutes: 45,
        })
        .returning()
        .get();

      // Act: archive then unarchive
      await archiveRoutine(routineRow.id);
      await unarchiveRoutine(routineRow.id);

      // Assert: session still exists and references routine
      const session = db.select().from(sessions).where(eq(sessions.id, sessionRow.id)).get();
      expect(session).toBeDefined();
      expect(session?.routineId).toBe(routineRow.id);

      // Assert: routine is active again
      const routine = db.select().from(routines).where(eq(routines.id, routineRow.id)).get();
      expect(routine?.isArchived).toBe(false);
    });
  });
  describe('Archive interaction with name uniqueness', () => {
    it('should allow creating routine with same name as archived routine', async () => {
      // Arrange: create and archive a routine
      const archived = db.insert(routines).values({ name: 'Treino X', folder: 'Geral' }).returning().get();
      await archiveRoutine(archived.id);

      // Act: create new routine with same name
      const newRoutine = db
        .insert(routines)
        .values({ name: 'Treino X', folder: 'Geral' })
        .returning()
        .get();

      // Assert: should succeed (archived routines don't block names)
      expect(newRoutine).toBeDefined();
      expect(newRoutine?.name).toBe('Treino X');
      expect(newRoutine?.isArchived).toBe(false);
    });

    it('should NOT allow creating routine with same name as active routine', () => {
      // Arrange: create an active routine
      db.insert(routines).values({ name: 'Treino Y', folder: 'Geral' }).returning().get();

      // Act & Assert: creating duplicate should fail
      expect(() => {
        db.insert(routines).values({ name: 'Treino Y', folder: 'Geral' }).returning().get();
      }).toThrow(/UNIQUE constraint failed: routines.name/);
    });
  });

  describe('getActiveRoutines', () => {
    it('returns only non-archived routines', async () => {
      // Arrange: create 2 active, 1 archived
      const active1 = db.insert(routines).values({ name: 'Active A', folder: 'Geral' }).returning().get();
      const active2 = db.insert(routines).values({ name: 'Active B', folder: 'Geral' }).returning().get();
      const archived = db.insert(routines).values({ name: 'Archived A', folder: 'Geral' }).returning().get();
      await archiveRoutine(archived.id);

      // Act
      const result = await getActiveRoutines();

      // Assert
      expect(result).toHaveLength(2);
      expect(result.map(r => r.id)).toContain(active1.id);
      expect(result.map(r => r.id)).toContain(active2.id);
      expect(result.map(r => r.id)).not.toContain(archived.id);
    });

    it('excludes isArchived=true routines from active list', async () => {
      // Arrange: create one active, one archived
      const active = db.insert(routines).values({ name: 'Active', folder: 'Geral' }).returning().get();
      const archived = db.insert(routines).values({ name: 'Archived', folder: 'Geral' }).returning().get();
      await archiveRoutine(archived.id);

      // Act
      const result = await getActiveRoutines();

      // Assert: archived one appears in getArchivedRoutines, not in active
      const archivedResult = await getArchivedRoutines();
      expect(archivedResult).toHaveLength(1);
      expect(archivedResult[0].id).toBe(archived.id);

      const activeIds = result.map(r => r.id);
      expect(activeIds).toContain(active.id);
      expect(activeIds).not.toContain(archived.id);
    });

    it('returns empty array when all routines are archived', async () => {
      // Arrange: create and archive two routines
      const r1 = db.insert(routines).values({ name: 'R1', folder: 'Geral' }).returning().get();
      const r2 = db.insert(routines).values({ name: 'R2', folder: 'Geral' }).returning().get();
      await archiveRoutine(r1.id);
      await archiveRoutine(r2.id);

      // Act
      const result = await getActiveRoutines();

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('unarchiveRoutine name conflict', () => {
    it('returns ROUTINE_NAME_CONFLICT when unarchiving a routine whose name is now taken by an active routine', async () => {
      // Arrange: archive A, create new active A
      const archivedA = db.insert(routines).values({ name: 'Treino A', folder: 'Geral' }).returning().get();
      await archiveRoutine(archivedA.id);
      
      const activeA = db.insert(routines).values({ name: 'Treino A', folder: 'Geral' }).returning().get();

      // Act: try to unarchive the old archived routine
      const result = await unarchiveRoutine(archivedA.id);

      // Assert: should fail with ROUTINE_NAME_CONFLICT
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe('ROUTINE_NAME_CONFLICT');

      // Assert: state unchanged — archivedA still archived, activeA still active
      const dbArchivedA = db.select().from(routines).where(eq(routines.id, archivedA.id)).get();
      expect(dbArchivedA?.isArchived).toBe(true);
      const dbActiveA = db.select().from(routines).where(eq(routines.id, activeA.id)).get();
      expect(dbActiveA?.isArchived).toBe(false);
    });

    it('succeeds when unarchiving and no name conflict exists', async () => {
      // Arrange: archive A
      const archivedA = db.insert(routines).values({ name: 'Treino Z', folder: 'Geral' }).returning().get();
      await archiveRoutine(archivedA.id);

      // Act
      const result = await unarchiveRoutine(archivedA.id);

      // Assert
      expect(result.success).toBe(true);
      const restored = db.select().from(routines).where(eq(routines.id, archivedA.id)).get();
      expect(restored?.isArchived).toBe(false);
    });
  });

  describe('getNextAvailableRoutineName (IL-64 suffixing on import)', () => {
    it('returns base name when free across active and archived rows', async () => {
      db.insert(routines).values({ name: 'Active A', folder: 'Geral' }).returning().get();
      const archived = db.insert(routines).values({ name: 'Archived X', folder: 'Geral' }).returning().get();
      await archiveRoutine(archived.id);

      const existing = collectAllRoutineNames(db);
      const name = getNextAvailableRoutineName(existing, 'Fresh Name');
      expect(name).toBe('Fresh Name');
    });

    it('suffices when only an archived routine collides', async () => {
      const archived = db.insert(routines).values({ name: 'Legacy', folder: 'Geral' }).returning().get();
      await archiveRoutine(archived.id);

      const existing = collectAllRoutineNames(db);
      const name = getNextAvailableRoutineName(existing, 'Legacy');
      expect(name).toBe('Legacy (2)');
    });

    it('skips an existing suffixed archived row and returns the next counter', async () => {
      const archived = db.insert(routines).values({ name: 'Legacy', folder: 'Geral' }).returning().get();
      const archivedSuffix = db.insert(routines).values({ name: 'Legacy (2)', folder: 'Geral' }).returning().get();
      await archiveRoutine(archived.id);
      await archiveRoutine(archivedSuffix.id);

      const existing = collectAllRoutineNames(db);
      const name = getNextAvailableRoutineName(existing, 'Legacy');
      expect(name).toBe('Legacy (3)');
    });

    it('checks BOTH active and archived rows for global uniqueness', async () => {
      const active = db.insert(routines).values({ name: 'Legacy', folder: 'Geral' }).returning().get();
      const archived = db.insert(routines).values({ name: 'Legacy (2)', folder: 'Geral' }).returning().get();
      await archiveRoutine(archived.id);

      const existing = collectAllRoutineNames(db);
      const name = getNextAvailableRoutineName(existing, 'Legacy');
      expect(name).toBe('Legacy (3)');
    });

    it('is case-insensitive when resolving collisions', async () => {
      const archived = db.insert(routines).values({ name: 'legacy', folder: 'Geral' }).returning().get();
      await archiveRoutine(archived.id);

      const existing = collectAllRoutineNames(db);
      const name = getNextAvailableRoutineName(existing, 'Legacy');
      expect(name).toBe('Legacy (2)');
    });

    it('preserves the original trimmable whitespace in returned name', async () => {
      db.insert(routines).values({ name: 'Trimmed', folder: 'Geral' }).returning().get();
      const existing = collectAllRoutineNames(db);
      const result = getNextAvailableRoutineName(existing, '  Trimmed  ');
      expect(result).toBe('Trimmed (2)');
    });
  });
});
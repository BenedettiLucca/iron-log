import { useState, useCallback, useMemo } from 'react';
import { db } from '@/src/db/client';
import { routines, routineExercises, exercises } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/services/logger';
import { Routine } from '@/src/types';

export function useRoutines() {
  const [allRoutines, setAllRoutines] = useState<Routine[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchRoutines = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await db.select().from(routines);
      setAllRoutines(data);
    } catch (e) {
      logger.error('Failed to fetch routines', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const deleteRoutine = useCallback(async (id: number): Promise<boolean> => {
    try {
      await db.delete(routineExercises).where(eq(routineExercises.routineId, id));
      await db.delete(routines).where(eq(routines.id, id));
      await fetchRoutines();
      return true;
    } catch (e) {
      logger.error('Failed to delete routine', e);
      return false;
    }
  }, [fetchRoutines]);

  const duplicateRoutine = useCallback(async (id: number, newName: string): Promise<boolean> => {
    try {
      const original = await db.select().from(routines).where(eq(routines.id, id));
      if (!original.length) return false;

      const newRoutine = await db.insert(routines).values({
        name: newName,
        description: original[0].description,
        folder: original[0].folder,
        isTemplate: false,
      }).returning();

      const exs = await db.select().from(routineExercises).where(eq(routineExercises.routineId, id));
      if (exs.length && newRoutine.length) {
        await db.insert(routineExercises).values(
          exs.map(ex => ({
            routineId: newRoutine[0].id,
            exerciseId: ex.exerciseId,
            orderIndex: ex.orderIndex,
            target: ex.target,
            notes: ex.notes,
            restSeconds: ex.restSeconds,
          }))
        );
      }

      await fetchRoutines();
      return true;
    } catch (e) {
      logger.error('Failed to duplicate routine', e);
      return false;
    }
  }, [fetchRoutines]);

  const getRoutineWithExercises = useCallback(async (id: number) => {
    try {
      const routineData = await db.select().from(routines).where(eq(routines.id, id));
      if (!routineData.length) return null;

      const joins = await db.select({
        id: exercises.id,
        name: exercises.name,
        order: routineExercises.orderIndex,
        target: routineExercises.target,
        notes: routineExercises.notes,
        restSeconds: routineExercises.restSeconds,
      })
        .from(routineExercises)
        .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
        .where(eq(routineExercises.routineId, id));

      return { routine: routineData[0], exercises: joins };
    } catch (e) {
      logger.error('Failed to get routine with exercises', e);
      return null;
    }
  }, []);

  const folders = useMemo(() => {
    return ['Todos', ...Array.from(new Set(allRoutines.map(r => r.folder || 'Geral')))];
  }, [allRoutines]);

  const getFilteredRoutines = useCallback((selectedFolder: string): Routine[] => {
    if (selectedFolder === 'Todos') return allRoutines;
    return allRoutines.filter(r => (r.folder || 'Geral') === selectedFolder);
  }, [allRoutines]);

  return {
    allRoutines,
    isLoading,
    folders,
    fetchRoutines,
    deleteRoutine,
    duplicateRoutine,
    getRoutineWithExercises,
    getFilteredRoutines,
  };
}

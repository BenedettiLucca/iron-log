import { useState, useCallback } from 'react';
import { db } from '@/src/db/client';
import { sets, exercises } from '@/src/db/schema';
import { eq, and, isNull, desc } from 'drizzle-orm';
import { logger } from '@/services/logger';
import { Set } from '@/src/types';

interface ExerciseHistory {
  weight: number;
  reps: number;
  rir: number | null;
}

export function useSessionExercise(sessionId: number, exerciseId: number) {
  const [sessionSets, setSessionSets] = useState<Set[]>([]);
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistory[]>([]);
  const [exerciseType, setExerciseType] = useState('strength');
  const [isLoading, setIsLoading] = useState(true);

  const loadSessionSets = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await db.select()
        .from(sets)
        .where(and(
          eq(sets.sessionId, sessionId),
          eq(sets.exerciseId, exerciseId),
          isNull(sets.deletedAt)
        ))
        .orderBy(sets.setNumber);
      setSessionSets(data);

      // Also fetch exercise type
      const exData = await db.select().from(exercises).where(eq(exercises.id, exerciseId)).limit(1);
      if (exData.length) {
        setExerciseType(exData[0].type);
      }
    } catch (e) {
      logger.error('Failed to load session sets', e);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, exerciseId]);

  const loadExerciseHistory = useCallback(async () => {
    try {
      // Get last 5 sessions with this exercise
      const historySets = await db.select({
        weight: sets.weightKg,
        reps: sets.reps,
        rir: sets.rir,
        sessionId: sets.sessionId,
        isWarmup: sets.isWarmup,
      })
        .from(sets)
        .where(and(
          eq(sets.exerciseId, exerciseId),
          isNull(sets.deletedAt)
        ))
        .orderBy(desc(sets.createdAt));

      // Only working sets (not warmup), limit to last 5 distinct sessions
      const workingSets = historySets.filter(s => !s.isWarmup);
      const seenSessions = new Set<number>();
      const limitedSets = workingSets.filter(s => {
        if (seenSessions.has(s.sessionId)) return true;
        if (seenSessions.size < 5) {
          seenSessions.add(s.sessionId);
          return true;
        }
        return false;
      });
      setExerciseHistory(limitedSets.map(s => ({
        weight: s.weight,
        reps: s.reps,
        rir: s.rir,
      })));
    } catch (e) {
      logger.error('Failed to load exercise history', e);
    }
  }, [exerciseId]);

  const addSet = useCallback(async (setData: {
    setNumber: number;
    weightKg: number;
    reps: number;
    durationSeconds?: number | null;
    rir?: number | null;
    isWarmup: boolean;
    exerciseName?: string | null;
  }): Promise<Set | null> => {
    try {
      const result = await db.insert(sets).values({
        sessionId,
        exerciseId,
        exerciseName: setData.exerciseName || null,
        setNumber: setData.setNumber,
        weightKg: setData.weightKg,
        reps: setData.reps,
        durationSeconds: setData.durationSeconds || null,
        rir: setData.rir ?? null,
        isWarmup: setData.isWarmup,
        isEdited: false,
      }).returning();

      await loadSessionSets();
      return result[0] || null;
    } catch (e) {
      logger.error('Failed to add set', e);
      return null;
    }
  }, [sessionId, exerciseId, loadSessionSets]);

  const updateSet = useCallback(async (setId: number, updates: Partial<Set>): Promise<boolean> => {
    try {
      await db.update(sets)
        .set({ ...updates, isEdited: true })
        .where(eq(sets.id, setId));
      await loadSessionSets();
      return true;
    } catch (e) {
      logger.error('Failed to update set', e);
      return false;
    }
  }, [loadSessionSets]);

  const deleteSet = useCallback(async (setId: number): Promise<boolean> => {
    try {
      await db.update(sets)
        .set({ deletedAt: Date.now() })
        .where(eq(sets.id, setId));
      await loadSessionSets();
      return true;
    } catch (e) {
      logger.error('Failed to delete set', e);
      return false;
    }
  }, [loadSessionSets]);

  const getNextSetNumber = useCallback((): number => {
    if (sessionSets.length === 0) return 1;
    return Math.max(...sessionSets.map(s => s.setNumber)) + 1;
  }, [sessionSets]);

  return {
    sessionSets,
    exerciseHistory,
    exerciseType,
    isLoading,
    loadSessionSets,
    loadExerciseHistory,
    addSet,
    updateSet,
    deleteSet,
    getNextSetNumber,
  };
}

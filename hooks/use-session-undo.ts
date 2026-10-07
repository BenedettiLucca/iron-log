import { useState, useRef, useEffect, useCallback } from 'react';
import { db } from '../src/db/client';
import { sets, exercises, routineExercises } from '../src/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { logger } from '../services/logger';
import { Set } from '../src/types';
import { useI18n } from '../src/i18n';
import { reconcilePersonalRecordsSync } from './use-personal-records';

type ToastSetter = (toast: {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}) => void;

type SessionSetState = {
  exerciseId: number;
  routineExerciseId: number | null;
  routineId: number | null;
  sessionId: number;
  setSessionSets: React.Dispatch<React.SetStateAction<Set[]>>;
  setToast?: ToastSetter;
};

interface UseSessionUndoReturn {
  lastSavedSet: Set | null;
  setLastSavedSet: (set: Set | null) => void;
  lastDeletedSet: Set | null;
  registerDeletedSet: (set: Set) => void;
  undoTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>;
  handleUndo: (opts: SessionSetState & {
    exerciseType: string;
    setCurrentName?: (name: string) => void;
  }) => Promise<void>;
  handleRestoreDeleted: (opts: SessionSetState) => Promise<void>;
}

export function useSessionUndo(): UseSessionUndoReturn {
  const { t } = useI18n();
  const [lastSavedSet, setLastSavedSet] = useState<Set | null>(null);
  const [lastDeletedSet, setLastDeletedSet] = useState<Set | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const restoreTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Caches the routine_exercises occurrence-count lookup that decides the null-
  // `routineExerciseId` fallback in refreshSessionSets: when a scope has no live sets, a
  // single routine occurrence means the legacy per-exercise sets (routineExerciseId IS NULL)
  // belong to this scope, and no routine occurrence means they do not. Re-reading
  // `routine_exercises` on every undo of the same occurrence is the regression this cache
  // avoids (mirrors the isSingleOccurrenceRef cache in hooks/use-exercise-sets.ts
  // loadStructure/refreshSessionSets).
  // Scoped by (sessionId, routineExerciseId) — the only values that change on the
  // session/history screens — so a new session cannot serve a stale occurrence count from a
  // previous one. The hook instance lives for one exercise occurrence (single consumer,
  // hooks/use-exercise-sets.ts), which bounds entry count for the session lifetime.
  const isSingleOccurrenceCacheRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => () => {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    if (restoreTimeoutRef.current) clearTimeout(restoreTimeoutRef.current);
  }, []);

  const refreshSessionSets = useCallback(async (opts: SessionSetState) => {
    let data = await db.select()
      .from(sets)
      .where(and(
        eq(sets.sessionId, opts.sessionId),
        opts.routineExerciseId != null
          ? eq(sets.routineExerciseId, opts.routineExerciseId)
          : eq(sets.exerciseId, opts.exerciseId),
        isNull(sets.deletedAt),
      ))
      .orderBy(sets.setNumber);

    if (data.length === 0) {
      const cache = isSingleOccurrenceCacheRef.current;
      const cacheKey = `${opts.sessionId}:${opts.routineExerciseId ?? opts.exerciseId}`;
      let isSingle = cache.get(cacheKey);

      if (isSingle === undefined) {
        if (!opts.routineId || opts.routineExerciseId == null) {
          isSingle = true;
        } else {
          const routineOccurrences = await db.select({ id: routineExercises.id })
            .from(routineExercises)
            .where(and(
              eq(routineExercises.routineId, opts.routineId),
              eq(routineExercises.exerciseId, opts.exerciseId),
            ));
          isSingle = routineOccurrences.length === 1;
        }
        cache.set(cacheKey, isSingle);
      }

      if (isSingle) {
        data = await db.select()
          .from(sets)
          .where(and(
            eq(sets.sessionId, opts.sessionId),
            eq(sets.exerciseId, opts.exerciseId),
            isNull(sets.routineExerciseId),
            isNull(sets.deletedAt),
          ))
          .orderBy(sets.setNumber);
      }
    }
    opts.setSessionSets(data);
  }, []);

  const registerDeletedSet = useCallback((deletedSet: Set) => {
    if (lastSavedSet?.id === deletedSet.id) setLastSavedSet(null);
    setLastDeletedSet(deletedSet);
    if (restoreTimeoutRef.current) clearTimeout(restoreTimeoutRef.current);
    restoreTimeoutRef.current = setTimeout(() => setLastDeletedSet(null), 10000);
  }, [lastSavedSet]);

  const handleUndo = useCallback(async (opts: SessionSetState & {
    exerciseType: string;
    setCurrentName?: (name: string) => void;
  }) => {
    if (!lastSavedSet) return;

    try {
      db.transaction((tx) => {
        tx.update(sets).set({ deletedAt: Date.now() }).where(eq(sets.id, lastSavedSet.id)).run();
        reconcilePersonalRecordsSync({ exerciseId: opts.exerciseId, sessionId: opts.sessionId, tx });
      });
      setLastSavedSet(null);

      const exData = await db.select().from(exercises).where(eq(exercises.id, opts.exerciseId));
      if (exData.length > 0 && opts.setCurrentName) {
        opts.setCurrentName(exData[0].name);
      }

      await refreshSessionSets(opts);
      opts.setToast?.({ visible: true, message: t('exercise.lastSetRemoved'), type: 'success' });
    } catch (e) {
      logger.error(t('common.operationError'), e);
      opts.setToast?.({ visible: true, message: t('exercise.undoError'), type: 'error' });
    }
  }, [lastSavedSet, refreshSessionSets, t]);

  const handleRestoreDeleted = useCallback(async (opts: SessionSetState) => {
    if (!lastDeletedSet) return;

    try {
      db.transaction((tx) => {
        tx.update(sets).set({ deletedAt: null }).where(eq(sets.id, lastDeletedSet.id)).run();
        reconcilePersonalRecordsSync({ exerciseId: opts.exerciseId, sessionId: opts.sessionId, tx });
      });
      setLastDeletedSet(null);
      if (restoreTimeoutRef.current) clearTimeout(restoreTimeoutRef.current);
      await refreshSessionSets(opts);
      opts.setToast?.({ visible: true, message: t('exercise.setRestored'), type: 'success' });
    } catch (e) {
      logger.error(t('common.operationError'), e);
      opts.setToast?.({ visible: true, message: t('exercise.restoreSetError'), type: 'error' });
    }
  }, [lastDeletedSet, refreshSessionSets, t]);

  return {
    lastSavedSet,
    setLastSavedSet,
    lastDeletedSet,
    registerDeletedSet,
    undoTimeoutRef,
    handleUndo,
    handleRestoreDeleted,
  };
}

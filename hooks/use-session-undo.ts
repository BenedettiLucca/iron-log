import { useState, useRef, useEffect, useCallback } from 'react';
import { db } from '../src/db/client';
import { sets, exercises } from '../src/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { logger } from '../services/logger';
import { Set } from '../src/types';
import { useI18n } from '../src/i18n';

type ToastSetter = (toast: {
  visible: boolean;
  message: string;
  type: 'success' | 'error' | 'info';
}) => void;

type SessionSetState = {
  exerciseId: number;
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

  useEffect(() => () => {
    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    if (restoreTimeoutRef.current) clearTimeout(restoreTimeoutRef.current);
  }, []);

  const refreshSessionSets = useCallback(async (opts: SessionSetState) => {
    const data = await db.select()
      .from(sets)
      .where(and(
        eq(sets.sessionId, opts.sessionId),
        eq(sets.exerciseId, opts.exerciseId),
        isNull(sets.deletedAt),
      ))
      .orderBy(sets.setNumber);
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
      await db.update(sets).set({ deletedAt: Date.now() }).where(eq(sets.id, lastSavedSet.id));
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
      await db.update(sets).set({ deletedAt: null }).where(eq(sets.id, lastDeletedSet.id));
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

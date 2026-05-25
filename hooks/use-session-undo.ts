import { useState, useRef, useEffect, useCallback } from 'react';
import { db } from '../src/db/client';
import { sets, exercises } from '../src/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { logger } from '../services/logger';
import { Set } from '../src/types';
import { useI18n } from '../src/i18n';

interface UseSessionUndoReturn {
  lastSavedSet: Set | null;
  setLastSavedSet: (s: Set | null) => void;
  undoTimeoutRef: React.MutableRefObject<ReturnType<typeof setTimeout> | undefined>;
  handleUndo: (opts: {
    exerciseId: number;
    sessionId: number;
    exerciseType: string;
    setSessionSets: React.Dispatch<React.SetStateAction<Set[]>>;
    setCurrentName?: (name: string) => void;
    setToast?: (t: { visible: boolean; message: string; type: 'success' | 'error' | 'info' }) => void;
  }) => Promise<void>;
}

export function useSessionUndo(): UseSessionUndoReturn {
  const { t } = useI18n();
  const [lastSavedSet, setLastSavedSet] = useState<Set | null>(null);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Cleanup undo timeout
  useEffect(() => {
    const ref = undoTimeoutRef;
    return () => {
      if (ref.current) {
        clearTimeout(ref.current);
      }
    };
  }, []);

  const handleUndo = useCallback(async (opts: {
    exerciseId: number;
    sessionId: number;
    exerciseType: string;
    setSessionSets: React.Dispatch<React.SetStateAction<Set[]>>;
    setCurrentName?: (name: string) => void;
    setToast?: (t: { visible: boolean; message: string; type: 'success' | 'error' | 'info' }) => void;
  }) => {
    const { exerciseId, sessionId, setSessionSets, setCurrentName, setToast } = opts;
    if (!lastSavedSet) return;

    try {
      // Soft delete the set
      await db.update(sets).set({ deletedAt: Date.now() }).where(eq(sets.id, lastSavedSet.id));
      setLastSavedSet(null);

      // Restore state (similar to loadData)
      const exData = await db.select().from(exercises).where(eq(exercises.id, exerciseId));
      if (exData.length > 0 && setCurrentName) {
        setCurrentName(exData[0].name);
      }

      const data = await db.select()
        .from(sets)
        .where(and(eq(sets.sessionId, sessionId), eq(sets.exerciseId, exerciseId), isNull(sets.deletedAt)))
        .orderBy(sets.setNumber);
      setSessionSets(data);

      if (setToast) {
        setToast({ visible: true, message: t('exercise.lastSetRemoved'), type: 'success' });
      }
    } catch (e) {
      logger.error(t('common.operationError'), e);
      if (setToast) {
        setToast({ visible: true, message: t('exercise.undoError'), type: 'error' });
      }
    }
  }, [lastSavedSet, t]);

  return {
    lastSavedSet,
    setLastSavedSet,
    undoTimeoutRef,
    handleUndo,
  };
}

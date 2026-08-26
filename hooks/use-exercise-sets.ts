import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../src/db/client';
import { sets, exercises, sessions, routineExercises } from '../src/db/schema';
import { eq, and, desc, isNull, ne } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { countCompletedRoutineExercises } from '../src/utils/exercise';
import { logger } from '../services/logger';
import { Set } from '../src/types';
import { setInputSchema } from '../src/validators/forms';
import { useI18n } from '../src/i18n/index';
import { useHaptics } from './use-haptics';
import { checkPersonalRecords } from './use-personal-records';
import { useSessionTimer } from './use-session-timer';
import { useSessionUndo } from './use-session-undo';
import { SessionDraft } from '../src/utils/session-draft';

export interface RoutineExerciseListItem {
  id: number;
  name: string;
  type: string;
  target: string | null;
  notes: string | null;
  restSeconds: number | null;
}

export interface UseExerciseSetsProps {
  sessionId: number;
  exerciseId: number;
  routineId: number | null;
  exerciseName: string;
  routineRest: number | null;
}

export function useExerciseSets({
  sessionId,
  exerciseId,
  routineId,
  exerciseName,
  routineRest,
}: UseExerciseSetsProps) {
  const { t, language } = useI18n();
  const { trigger } = useHaptics();

  const restoredDraftRef = useRef(false);

  const [exerciseType, setExerciseType] = useState('strength');
  const [currentName, setCurrentName] = useState(exerciseName);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [duration, setDuration] = useState('');
  const [rir, setRir] = useState(2);
  const [sessionSets, setSessionSets] = useState<Set[]>([]);
  const [hasLoadedSessionSets, setHasLoadedSessionSets] = useState(false);
  const [nextExercise, setNextExercise] = useState<RoutineExerciseListItem | null>(null);
  const [allExercises, setAllExercises] = useState<RoutineExerciseListItem[]>([]);
  const [isWarmupMode, setIsWarmupMode] = useState(false);

  /** True once the user has manually edited any strength input field. */
  const [isDirty, setIsDirtyState] = useState(false);
  const setIsDirty = useCallback((dirty: boolean) => {
    if (dirty) restoredDraftRef.current = true;
    setIsDirtyState(dirty);
  }, []);

  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyData, setHistoryData] = useState<{ sessionId: number; date: number; weight: number | null; reps: number | null; duration: number | null; rir: number | null }[]>([]);

  // Timer Hook
  const timer = useSessionTimer();
  const { 
    timerSeconds, timerStatus, 
    setTimerSeconds, setTimerTarget, setTimerStatus, 
    addTime, activeSetStart, activeSetTime,
    isActiveSetRunning, toggleActiveSet,
    restoreActiveSetTime, resetActiveSet
  } = timer;

  const restoreDraft = useCallback((draft: SessionDraft) => {
    restoredDraftRef.current = true;
    setWeight(draft.weight);
    setReps(draft.reps);
    setDuration(draft.duration);
    setRir(draft.rir);
    setIsWarmupMode(draft.isWarmupMode);
    setIsDirty(draft.isDirty);
    restoreActiveSetTime(
      draft.activeSetTime,
      draft.activeSetStartedAt,
    );
  }, [restoreActiveSetTime, setIsDirty]);

  // Undo Hook
  const { 
    lastSavedSet, setLastSavedSet, lastDeletedSet, registerDeletedSet,
    undoTimeoutRef, handleUndo: hookHandleUndo, handleRestoreDeleted,
  } = useSessionUndo();

  // Loading state
  const [isSaving, setIsSaving] = useState(false);

  // Toast state
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  // Set Editor state
  const [editingSet, setEditingSet] = useState<Set | null>(null);
  const [showSetEditor, setShowSetEditor] = useState(false);

  // Count completed exercises (based on target sets met)
  const { data: allSessionSets } = useLiveQuery(
    db.select({ exerciseId: sets.exerciseId, isWarmup: sets.isWarmup })
      .from(sets)
      .where(and(eq(sets.sessionId, sessionId), isNull(sets.deletedAt)))
  );

  const completedExercisesCount = countCompletedRoutineExercises(
    allExercises,
    allSessionSets || []
  );

  const loadData = useCallback(async () => {
    try {
      setNextExercise(null);

      const exData = await db.select().from(exercises).where(eq(exercises.id, exerciseId));
      if (exData.length > 0) {
        setExerciseType(exData[0].type);
        setCurrentName(exData[0].name);
      }

      const data = await db.select()
        .from(sets)
        .where(and(eq(sets.sessionId, sessionId), eq(sets.exerciseId, exerciseId), isNull(sets.deletedAt)))
        .orderBy(sets.setNumber);
      setSessionSets(data);
      setHasLoadedSessionSets(true);

      if (data.length === 0 && !restoredDraftRef.current) {
        const lastSet = await db.select({ weight: sets.weightKg })
          .from(sets)
          .where(and(eq(sets.exerciseId, exerciseId), isNull(sets.deletedAt)))
          .orderBy(desc(sets.createdAt))
          .limit(1);

        if (lastSet.length > 0 && lastSet[0].weight && !restoredDraftRef.current) {
          // Pre-fill from history: does NOT mark dirty
          setWeight(lastSet[0].weight.toString());
        }
      }

      if (routineId) {
        const routineList = await db.select({
          id: exercises.id,
          name: exercises.name,
          type: exercises.type,
          target: routineExercises.target,
          notes: routineExercises.notes,
          restSeconds: routineExercises.restSeconds
        })
          .from(routineExercises)
          .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
          .where(eq(routineExercises.routineId, routineId))
          .orderBy(routineExercises.orderIndex);

        setAllExercises(routineList);

        const currentIndex = routineList.findIndex(e => e.id === exerciseId);
        if (currentIndex !== -1 && currentIndex < routineList.length - 1) {
          const next = routineList[currentIndex + 1];
          setNextExercise(next);
        }
      }
    } catch (e) {
      logger.error(t('common.operationError'), e);
    }
  }, [sessionId, exerciseId, routineId, t]);

  const loadHistory = useCallback(async () => {
    try {
      const history = await db.select({
        sessionId: sets.sessionId,
        date: sessions.startTime,
        weight: sets.weightKg,
        reps: sets.reps,
        duration: sets.durationSeconds,
        rir: sets.rir
      })
        .from(sets)
        .innerJoin(sessions, eq(sets.sessionId, sessions.id))
        .where(and(
          eq(sets.exerciseId, exerciseId),
          ne(sets.sessionId, sessionId),
          isNull(sets.deletedAt),
          isNull(sessions.deletedAt)
        ))
        .limit(20);

      history.sort((a, b) => b.date - a.date);
      setHistoryData(history);
    } catch (e) {
      logger.error(t("exercise.sqlHistoryError"), e);
    }
  }, [exerciseId, sessionId, t]);

  useEffect(() => {
    setHasLoadedSessionSets(false);
    loadData();
    loadHistory();
  }, [loadData, loadHistory]);

  const handleSaveSet = useCallback(async (overrideDuration?: number): Promise<boolean> => {
    if (isSaving) return false;

    const isDuration = exerciseType === 'duration';

    const finalDuration = overrideDuration !== undefined ? overrideDuration : (duration ? Number(duration) : 0);
    const finalReps = reps ? Number(reps) : 0;

    // Validate with Zod
    const setValidation = setInputSchema.safeParse({
      weightKg: Number(weight),
      reps: isDuration ? 0 : finalReps,
      durationSeconds: isDuration ? finalDuration : null,
      rir: isDuration ? null : Number(rir),
      isWarmup: isWarmupMode,
    });
    if (!setValidation.success) {
      setToast({ visible: true, message: t('common.invalidData'), type: 'error' });
      return false;
    }
    // Extra business logic validation
    if (isDuration && finalDuration <= 0) {
      setToast({ visible: true, message: t('exercise.enterDuration'), type: 'error' });
      return false;
    }
    if (!isDuration && finalReps <= 0) {
      setToast({ visible: true, message: t('exercise.enterReps'), type: 'error' });
      return false;
    }
    if (!isDuration && !weight) {
      setToast({ visible: true, message: t('exercise.enterWeight'), type: 'error' });
      return false;
    }

    setIsSaving(true);

    try {
      const nextSetNumber = (sessionSets?.length || 0) + 1;

      const result = await db.insert(sets).values({
        sessionId,
        exerciseId,
        exerciseName: currentName,
        setNumber: nextSetNumber,
        weightKg: setValidation.data.weightKg,
        reps: isDuration ? 0 : finalReps,
        durationSeconds: isDuration ? finalDuration : null,
        rir: isDuration ? null : Number(rir),
        isWarmup: isWarmupMode,
      }).returning();

      // Store for undo
      setLastSavedSet(result[0]);

      // Clear undo after 10 seconds
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
      undoTimeoutRef.current = setTimeout(() => {
        setLastSavedSet(null);
      }, 10000);

      await loadData();

      // Check for Personal Records (only for non-warmup strength sets)
      if (!isWarmupMode && !isDuration && result[0]) {
        const prResult = await checkPersonalRecords({
          exerciseId,
          sessionId,
          savedSet: result[0],
          isWarmup: isWarmupMode,
        });

        if (prResult.isWeightPR || prResult.isRepsPR) {
          trigger('success');
          setToast({ visible: true, message: t('finish.prText'), type: 'success' });
        }
      }

      setReps('');
      setDuration('');
      // Clear dirty after successful save
      setIsDirty(false);
      resetActiveSet();

      if (!isDuration) {
        const restTime = routineRest || 90;
        setTimerTarget(Date.now() + restTime * 1000);
        setTimerStatus('running');
      }

      return true;
    } catch (e) {
      logger.error(t('common.operationError'), e);
      setToast({ visible: true, message: t('exercise.saveSetError'), type: 'error' });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, exerciseType, duration, reps, weight, rir, sessionId, exerciseId, currentName, sessionSets, routineRest, undoTimeoutRef, loadData, isWarmupMode, t, trigger, setLastSavedSet, setTimerStatus, setTimerTarget, resetActiveSet, setIsDirty]);

  const handleUndo = useCallback(async () => {
    await hookHandleUndo({
      exerciseId,
      sessionId,
      exerciseType,
      setSessionSets,
      setCurrentName,
      setToast,
    });
  }, [hookHandleUndo, exerciseId, sessionId, exerciseType, setSessionSets, setCurrentName, setToast]);

  const handleDeleteSet = useCallback(async (setId: number) => {
    try {
      const deletedSet = sessionSets.find(set => set.id === setId);
      await db.update(sets).set({ deletedAt: Date.now() }).where(eq(sets.id, setId));
      if (deletedSet) registerDeletedSet(deletedSet);
      await loadData();
      setToast({ visible: true, message: t('exercise.setDeleted'), type: 'success' });
    } catch (e) {
      logger.error(t('common.operationError'), e);
      setToast({ visible: true, message: t('exercise.deleteSetError'), type: 'error' });
    }
  }, [loadData, registerDeletedSet, sessionSets, t]);

  const handleRestoreDeletedSet = useCallback(async () => {
    await handleRestoreDeleted({ exerciseId, sessionId, setSessionSets, setToast });
  }, [exerciseId, handleRestoreDeleted, sessionId]);

  const handleEditSet = useCallback(async (setId: number) => {
    try {
      const setData = await db.select().from(sets).where(and(eq(sets.id, setId), isNull(sets.deletedAt)));
      if (setData.length > 0) {
        setEditingSet(setData[0]);
        setShowSetEditor(true);
      }
    } catch (e) {
      logger.error(t('common.operationError'), e);
      setToast({ visible: true, message: t('exercise.loadSetError'), type: 'error' });
    }
  }, [t]);

  const handleSaveEditedSet = useCallback(async (weight: number, reps?: number, duration?: number, rir?: number): Promise<boolean> => {
    if (!editingSet) return false;
    
    try {
      await db.update(sets)
        .set({
          weightKg: weight,
          // Use ?? (not ||) so valid zero values (e.g. RIR=0) are not replaced by the old value
          reps: reps ?? editingSet.reps,
          durationSeconds: duration ?? editingSet.durationSeconds,
          rir: rir ?? editingSet.rir,
          isEdited: true,
        })
        .where(eq(sets.id, editingSet.id));
      
      await loadData();
      setShowSetEditor(false);
      setEditingSet(null);
      setToast({ visible: true, message: t('exercise.setEdited'), type: 'success' });
      return true;
    } catch (e) {
      logger.error(t('common.operationError'), e);
      setToast({ visible: true, message: t('exercise.editSetError'), type: 'error' });
      return false;
    }
  }, [editingSet, loadData, t]);

  return {
    isDirty,
    setIsDirty,
    exerciseType,
    setExerciseType,
    currentName,
    setCurrentName,
    weight,
    setWeight,
    reps,
    setReps,
    duration,
    setDuration,
    rir,
    setRir,
    sessionSets,
    setSessionSets,
    nextExercise,
    setNextExercise,
    allExercises,
    setAllExercises,
    isWarmupMode,
    setIsWarmupMode,
    historyVisible,
    setHistoryVisible,
    historyData,
    setHistoryData,
    timerSeconds,
    timerStatus,
    setTimerSeconds,
    setTimerStatus,
    addTime,
    activeSetStart,
    activeSetTime,
    isActiveSetRunning,
    toggleActiveSet,
    lastSavedSet,
    handleUndo,
    lastDeletedSet,
    handleRestoreDeletedSet,
    isSaving,
    toast,
    setToast,
    editingSet,
    setEditingSet,
    showSetEditor,
    setShowSetEditor,
    hasLoadedSessionSets,
    completedExercisesCount,
    handleSaveSet,
    handleDeleteSet,
    handleEditSet,
    handleSaveEditedSet,
    loadData,
    loadHistory,
    restoreDraft,
    t,
    language,
  };
}

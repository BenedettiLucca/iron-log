import { useState, useEffect, useCallback } from 'react';
import { db } from '../src/db/client';
import { sets, exercises, sessions, routineExercises } from '../src/db/schema';
import { eq, and, desc, isNull, ne } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { parseTargetSets } from '../src/utils/exercise';
import { logger } from '../services/logger';
import { Set } from '../src/types';
import { setInputSchema } from '../src/validators/forms';
import { useI18n } from '../src/i18n/index';
import { useHaptics } from './use-haptics';
import { checkPersonalRecords } from './use-personal-records';
import { useSessionTimer } from './use-session-timer';
import { useSessionUndo } from './use-session-undo';

export interface RoutineExerciseListItem {
  id: number;
  name: string;
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

  const [exerciseType, setExerciseType] = useState('strength');
  const [currentName, setCurrentName] = useState(exerciseName);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [duration, setDuration] = useState('');
  const [rir, setRir] = useState(2);
  const [sessionSets, setSessionSets] = useState<Set[]>([]);
  const [nextExercise, setNextExercise] = useState<RoutineExerciseListItem | null>(null);
  const [allExercises, setAllExercises] = useState<RoutineExerciseListItem[]>([]);
  const [isWarmupMode, setIsWarmupMode] = useState(false);

  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyData, setHistoryData] = useState<{ sessionId: number; date: number; weight: number | null; reps: number | null; duration: number | null; rir: number | null }[]>([]);

  // Timer Hook
  const timer = useSessionTimer();
  const { 
    timerSeconds, timerStatus, 
    setTimerSeconds, setTimerTarget, setTimerStatus, 
    addTime, activeSetTime, 
    isActiveSetRunning, toggleActiveSet 
  } = timer;

  // Undo Hook
  const { 
    lastSavedSet, setLastSavedSet, undoTimeoutRef, handleUndo: hookHandleUndo 
  } = useSessionUndo();

  // Loading state
  const [isSaving, setIsSaving] = useState(false);

  // Toast state
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  // Set Editor state
  const [editingSet, setEditingSet] = useState<Set | null>(null);
  const [showSetEditor, setShowSetEditor] = useState(false);

  // Track completed exercises by target sets
  const { data: allSessionSets } = useLiveQuery(
    db.select({ exerciseId: sets.exerciseId })
      .from(sets)
      .where(and(eq(sets.sessionId, sessionId), isNull(sets.deletedAt)))
  );

  // Count completed exercises (based on target sets met)
  const completedExercisesCount = allExercises.reduce((count, exercise) => {
    const targetSets = parseTargetSets(exercise.target);
    const doneSets = allSessionSets?.filter(s => s.exerciseId === exercise.id).length || 0;

    if (targetSets !== null) {
      return doneSets >= targetSets ? count + 1 : count;
    }
    return doneSets > 0 ? count + 1 : count;
  }, 0);

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

      if (data.length === 0) {
        const lastSet = await db.select({ weight: sets.weightKg })
          .from(sets)
          .where(and(eq(sets.exerciseId, exerciseId), isNull(sets.deletedAt)))
          .orderBy(desc(sets.createdAt))
          .limit(1);

        if (lastSet.length > 0 && lastSet[0].weight) {
          setWeight(lastSet[0].weight.toString());
        }
      }

      if (routineId) {
        const routineList = await db.select({
          id: exercises.id,
          name: exercises.name,
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
    loadData();
    loadHistory();
  }, [loadData, loadHistory]);

  const handleSaveSet = useCallback(async (overrideDuration?: number) => {
    if (isSaving) return;

    const isDuration = exerciseType === 'duration';

    const finalDuration = overrideDuration !== undefined ? overrideDuration : (duration ? Number(duration) : 0);
    const finalReps = reps ? Number(reps) : 0;

    // Validate with Zod
    const setValidation = setInputSchema.safeParse({
      weightKg: Number(weight) || 0,
      reps: isDuration ? 0 : finalReps,
      durationSeconds: isDuration ? finalDuration : null,
      rir: isDuration ? null : Number(rir),
      isWarmup: isWarmupMode,
    });
    if (!setValidation.success) {
      const msg = setValidation.error.issues[0]?.message || t('common.invalidData');
      setToast({ visible: true, message: msg, type: 'error' });
      return;
    }
    // Extra business logic validation
    if (isDuration && finalDuration <= 0) {
      setToast({ visible: true, message: t('exercise.enterDuration'), type: 'error' });
      return;
    }
    if (!isDuration && finalReps <= 0) {
      setToast({ visible: true, message: t('exercise.enterReps'), type: 'error' });
      return;
    }
    if (!isDuration && !weight) {
      setToast({ visible: true, message: t('exercise.enterWeight'), type: 'error' });
      return;
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

      if (!isDuration) {
        const restTime = routineRest || 90;
        setTimerTarget(Date.now() + restTime * 1000);
        setTimerStatus('running');
      }

    } catch (e) {
      logger.error(t('common.operationError'), e);
      setToast({ visible: true, message: t('exercise.saveSetError'), type: 'error' });
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, exerciseType, duration, reps, weight, rir, sessionId, exerciseId, currentName, sessionSets, routineRest, undoTimeoutRef, loadData, isWarmupMode, t, trigger, setLastSavedSet, setTimerStatus, setTimerTarget]);

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
      await db.update(sets).set({ deletedAt: Date.now() }).where(eq(sets.id, setId));
      await loadData();
      setToast({ visible: true, message: t('exercise.setDeleted'), type: 'success' });
    } catch (e) {
      logger.error(t('common.operationError'), e);
      setToast({ visible: true, message: t('exercise.deleteSetError'), type: 'error' });
    }
  }, [loadData, t]);

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

  const handleSaveEditedSet = useCallback(async (weight: number, reps?: number, duration?: number, rir?: number) => {
    if (!editingSet) return;
    
    try {
      await db.update(sets)
        .set({
          weightKg: weight,
          reps: reps || editingSet.reps,
          durationSeconds: duration || editingSet.durationSeconds,
          rir: rir || editingSet.rir,
          isEdited: true,
        })
        .where(eq(sets.id, editingSet.id));
      
      await loadData();
      setShowSetEditor(false);
      setEditingSet(null);
      setToast({ visible: true, message: t('exercise.setEdited'), type: 'success' });
    } catch (e) {
      logger.error(t('common.operationError'), e);
      setToast({ visible: true, message: t('exercise.editSetError'), type: 'error' });
    }
  }, [editingSet, loadData, t]);

  return {
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
    activeSetTime,
    isActiveSetRunning,
    toggleActiveSet,
    lastSavedSet,
    handleUndo,
    isSaving,
    toast,
    setToast,
    editingSet,
    setEditingSet,
    showSetEditor,
    setShowSetEditor,
    completedExercisesCount,
    handleSaveSet,
    handleDeleteSet,
    handleEditSet,
    handleSaveEditedSet,
    loadData,
    loadHistory,
    t,
    language,
  };
}

import { useState, useEffect, useCallback, useRef } from 'react';
import { db } from '../src/db/client';
import { sets, exercises, sessions, routineExercises } from '../src/db/schema';
import { eq, and, desc, isNull, ne, sql } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { countCompletedRoutineExercises } from '../src/utils/exercise';
import { logger } from '../services/logger';
import { Set, SaveSetInput, SaveSetResult } from '../src/types';
import { parseLocalizedDecimal } from '../src/utils/localized-decimal';
import { setInputSchema } from '../src/validators/forms';
import { useI18n } from '../src/i18n/index';
import { useHaptics } from './use-haptics';
import { checkPersonalRecords, reconcilePersonalRecordsSync } from './use-personal-records';
import { useSessionTimer } from './use-session-timer';
import { useSessionUndo } from './use-session-undo';
import { SessionDraft } from '../src/utils/session-draft';
import { scheduleRestNotification, cancelRestNotification } from '../services/NotificationService';

export interface RoutineExerciseListItem {
  id: number;
  routineExerciseId: number;
  name: string;
  type: string;
  target: string | null;
  notes: string | null;
  restSeconds: number | null;
}

export interface UseExerciseSetsProps {
  sessionId: number;
  exerciseId: number;
  routineExerciseId: number;
  routineId: number | null;
  exerciseName: string;
  routineRest: number | null;
}

/**
 * Calculates next set number deterministically per occurrence.
 * Includes tombstones (deletedAt is not null) so undo/restore never causes collision.
 * Handles legacy NULL routineExerciseId safely in multi-occurrence routines (A/B/A).
 */
export async function getNextSetNumber(
  arg1: any,
  arg2?: any,
): Promise<number> {
  const isArg1Db = arg1 && (typeof arg1.select === 'function');
  const dbInstance = isArg1Db ? arg1 : (arg2 || db);
  const params: {
    sessionId: number;
    exerciseId: number;
    routineExerciseId?: number | null;
    routineId?: number | null;
  } = isArg1Db ? arg2 : arg1;

  const { sessionId, exerciseId, routineExerciseId, routineId } = params;

  let existingSets: { setNumber: number }[] = [];

  if (routineExerciseId) {
    existingSets = await dbInstance.select({ setNumber: sets.setNumber })
      .from(sets)
      .where(and(
        eq(sets.sessionId, sessionId),
        eq(sets.routineExerciseId, routineExerciseId),
      ));

    if (existingSets.length === 0) {
      const routineOccurrences = routineId
        ? await dbInstance.select({ id: routineExercises.id })
          .from(routineExercises)
          .where(and(
            eq(routineExercises.routineId, routineId),
            eq(routineExercises.exerciseId, exerciseId),
          ))
        : [{ id: routineExerciseId }];

      if (routineOccurrences.length === 1) {
        existingSets = await dbInstance.select({ setNumber: sets.setNumber })
          .from(sets)
          .where(and(
            eq(sets.sessionId, sessionId),
            eq(sets.exerciseId, exerciseId),
            isNull(sets.routineExerciseId),
          ));
      }
    }
  } else {
    existingSets = await dbInstance.select({ setNumber: sets.setNumber })
      .from(sets)
      .where(and(
        eq(sets.sessionId, sessionId),
        eq(sets.exerciseId, exerciseId),
        isNull(sets.routineExerciseId),
      ));
  }

  if (existingSets.length === 0) {
    return 1;
  }

  const maxSet = Math.max(...existingSets.map(s => s.setNumber));
  return maxSet + 1;
}

/**
 * Finds an existing set by operationId.
 */
export async function findSetByOperationId(
  operationId: string,
  dbInstance = db,
): Promise<Set | null> {
  if (!operationId || !operationId.trim()) return null;
  const result = await dbInstance.select()
    .from(sets)
    .where(eq(sets.operationId, operationId.trim()))
    .limit(1);
  return result[0] ?? null;
}

/**
 * Idempotent set mutation (Contract C3).
 * - Stable operation ID persisted on set.
 * - Retry with the same operation ID returns existing set (isDuplicate: true).
 * - Different operation ID with same values is allowed (never dedupe by load/reps).
 * - Scoped set numbering with tombstone safety.
 */
export async function saveSetMutation(
  arg1: any,
  arg2?: any,
): Promise<SaveSetResult> {
  const isArg1Db = arg1 && (typeof arg1.select === 'function');
  const dbInstance = isArg1Db ? arg1 : (arg2 || db);
  const input: SaveSetInput = isArg1Db ? arg2 : arg1;

  const normalizedOpId = input.operationId && input.operationId.trim().length > 0
    ? input.operationId.trim()
    : null;

  // 1. Idempotent check
  if (normalizedOpId) {
    const existing = await findSetByOperationId(normalizedOpId, dbInstance);
    if (existing) {
      return {
        set: existing,
        isDuplicate: true,
      };
    }
  }

  // 2. Compute deterministic next setNumber
  const nextSetNumber = await getNextSetNumber({
    sessionId: input.sessionId,
    exerciseId: input.exerciseId,
    routineExerciseId: input.routineExerciseId,
    routineId: input.routineId,
  }, dbInstance);

  // 3. Insert new set
  try {
    const inserted = await dbInstance.insert(sets).values({
      sessionId: input.sessionId,
      exerciseId: input.exerciseId,
      routineExerciseId: input.routineExerciseId ?? null,
      exerciseName: input.exerciseName ?? null,
      setNumber: nextSetNumber,
      weightKg: input.weightKg,
      reps: input.reps,
      durationSeconds: input.durationSeconds ?? null,
      rir: input.rir ?? null,
      isWarmup: input.isWarmup ?? false,
      createdAt: input.createdAt ?? Date.now(),
      operationId: normalizedOpId,
    }).returning();

    return {
      set: inserted[0],
      isDuplicate: false,
    };
  } catch (error: any) {
    // Graceful fallback for unique constraint collisions on operation_id
    if (normalizedOpId) {
      const existingAfterCollision = await findSetByOperationId(normalizedOpId, dbInstance);
      if (existingAfterCollision) {
        return {
          set: existingAfterCollision,
          isDuplicate: true,
        };
      }
    }
    throw error;
  }
}

export function useExerciseSets({
  sessionId,
  exerciseId,
  routineExerciseId,
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
    db.select({ exerciseId: sets.exerciseId, routineExerciseId: sets.routineExerciseId, isWarmup: sets.isWarmup })
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

      let data = await db.select()
        .from(sets)
        .where(and(eq(sets.sessionId, sessionId), eq(sets.routineExerciseId, routineExerciseId), isNull(sets.deletedAt)))
        .orderBy(sets.setNumber);

      if (data.length === 0) {
        const routineOccurrences = routineId
          ? await db.select({ id: routineExercises.id })
            .from(routineExercises)
            .where(and(
              eq(routineExercises.routineId, routineId),
              eq(routineExercises.exerciseId, exerciseId),
            ))
          : [{ id: routineExerciseId }];

        if (routineOccurrences.length === 1) {
          data = await db.select()
            .from(sets)
            .where(and(
              eq(sets.sessionId, sessionId),
              eq(sets.exerciseId, exerciseId),
              isNull(sets.routineExerciseId),
              isNull(sets.deletedAt),
            ))
            .orderBy(sets.setNumber);
        }
      }
      setSessionSets(data);
      setHasLoadedSessionSets(true);

      if (data.length === 0 && !restoredDraftRef.current) {
        const lastSet = await db.select({ weight: sets.weightKg })
          .from(sets)
          .innerJoin(sessions, eq(sets.sessionId, sessions.id))
          .where(and(
            eq(sets.exerciseId, exerciseId),
            ne(sets.sessionId, sessionId),
            isNull(sets.deletedAt),
            isNull(sessions.deletedAt),
          ))
          .orderBy(
            desc(sessions.startTime),
            desc(sql`coalesce(${sets.createdAt}, ${sessions.startTime})`),
            desc(sets.setNumber),
            desc(sets.id),
          )
          .limit(1);

        if (lastSet.length > 0 && lastSet[0].weight != null && !restoredDraftRef.current) {
          // Pre-fill from history: does NOT mark dirty
          setWeight(lastSet[0].weight.toString());
        }
      }

      if (routineId) {
        const routineList = await db.select({
          id: exercises.id,
          routineExerciseId: routineExercises.id,
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

        const currentIndex = routineList.findIndex(e => e.routineExerciseId === routineExerciseId);
        if (currentIndex !== -1 && currentIndex < routineList.length - 1) {
          const next = routineList[currentIndex + 1];
          setNextExercise(next);
        }
      }
    } catch (e) {
      logger.error(t('common.operationError'), e);
    }
  }, [sessionId, exerciseId, routineExerciseId, routineId, t]);

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
        .orderBy(
          desc(sessions.startTime),
          desc(sql`coalesce(${sets.createdAt}, ${sessions.startTime})`),
          desc(sets.setNumber),
          desc(sets.id),
        )
        .limit(20);

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

  useEffect(() => {
    if (timerStatus === 'idle') {
      cancelRestNotification();
    }
  }, [timerStatus]);

  useEffect(() => {
    return () => {
      cancelRestNotification();
    };
  }, []);

  const handleSaveSet = useCallback(async (
    overrideDuration?: number,
    operationIdOrOptions?: string | { operationId?: string | null } | null,
  ): Promise<boolean> => {
    if (isSaving) return false;

    const operationId = typeof operationIdOrOptions === 'string'
      ? operationIdOrOptions
      : operationIdOrOptions?.operationId ?? null;

    const isDuration = exerciseType === 'duration';

    // Parse localized decimal (Contract C2)
    const weightResult = parseLocalizedDecimal(weight, { allowNegative: false });
    if (weightResult.status === 'invalid') {
      setToast({ visible: true, message: t('common.invalidData'), type: 'error' });
      return false;
    }
    if (!isDuration && weightResult.status === 'empty') {
      setToast({ visible: true, message: t('exercise.enterWeight'), type: 'error' });
      return false;
    }

    let finalDuration = 0;
    if (overrideDuration !== undefined) {
      finalDuration = overrideDuration;
    } else if (duration) {
      const durResult = parseLocalizedDecimal(duration, { allowNegative: false });
      if (durResult.status === 'invalid') {
        setToast({ visible: true, message: t('common.invalidData'), type: 'error' });
        return false;
      }
      finalDuration = durResult.value ?? 0;
    }

    let finalReps = 0;
    if (!isDuration) {
      if (!reps || !reps.trim()) {
        setToast({ visible: true, message: t('exercise.enterReps'), type: 'error' });
        return false;
      }
      const trimmedReps = reps.trim();
      if (!/^\d+$/.test(trimmedReps) || parseInt(trimmedReps, 10) <= 0) {
        setToast({ visible: true, message: t('exercise.enterReps'), type: 'error' });
        return false;
      }
      finalReps = parseInt(trimmedReps, 10);
    }

    // Validate with Zod
    const setValidation = setInputSchema.safeParse({
      weightKg: weight,
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

    setIsSaving(true);

    try {
      const mutationResult = await saveSetMutation({
        sessionId,
        exerciseId,
        routineExerciseId,
        exerciseName: currentName,
        routineId,
        weightKg: setValidation.data.weightKg,
        reps: isDuration ? 0 : finalReps,
        durationSeconds: isDuration ? finalDuration : null,
        rir: isDuration ? null : Number(rir),
        isWarmup: isWarmupMode,
        operationId,
      });

      const saved = mutationResult.set;

      // Store for undo
      setLastSavedSet(saved);

      // Clear undo after 10 seconds
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
      undoTimeoutRef.current = setTimeout(() => {
        setLastSavedSet(null);
      }, 10000);

      await loadData();

      // Check for Personal Records (only for new, non-duplicate, non-warmup sets)
      if (!mutationResult.isDuplicate && !isWarmupMode && saved) {
        const prResult = await checkPersonalRecords({
          exerciseId,
          sessionId,
          savedSet: saved,
          isWarmup: isWarmupMode,
        });

        if (prResult.isWeightPR || prResult.isRepsPR || prResult.isDurationPR) {
          trigger('success');
          setToast({ visible: true, message: t('finish.prText'), type: 'success' });
        }
      }

      setReps('');
      setDuration('');
      // Clear dirty after successful save
      setIsDirty(false);
      resetActiveSet();

      if (!isDuration && !mutationResult.isDuplicate) {
        const restTime = routineRest || 90;
        setTimerTarget(Date.now() + restTime * 1000);
        setTimerStatus('running');
        scheduleRestNotification({ seconds: restTime, exerciseName: currentName });
      }

      return true;
    } catch (e) {
      logger.error(t('common.operationError'), e);
      setToast({ visible: true, message: t('exercise.saveSetError'), type: 'error' });
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [
    isSaving,
    exerciseType,
    duration,
    reps,
    weight,
    rir,
    sessionId,
    exerciseId,
    routineExerciseId,
    routineId,
    currentName,
    routineRest,
    undoTimeoutRef,
    loadData,
    isWarmupMode,
    t,
    trigger,
    setLastSavedSet,
    setTimerStatus,
    setTimerTarget,
    resetActiveSet,
    setIsDirty,
  ]);

  const handleUndo = useCallback(async () => {
    await hookHandleUndo({
      exerciseId,
      routineExerciseId,
      routineId,
      sessionId,
      exerciseType,
      setSessionSets,
      setCurrentName,
      setToast,
    });
  }, [hookHandleUndo, exerciseId, routineExerciseId, routineId, sessionId, exerciseType, setSessionSets, setCurrentName, setToast]);

  const handleDeleteSet = useCallback(async (setId: number) => {
    try {
      const deletedSet = sessionSets.find(set => set.id === setId);
      db.transaction((tx) => {
        tx.update(sets).set({ deletedAt: Date.now() }).where(eq(sets.id, setId)).run();
        reconcilePersonalRecordsSync({ exerciseId, sessionId, tx });
      });
      if (deletedSet) registerDeletedSet(deletedSet);
      await loadData();
      setToast({ visible: true, message: t('exercise.setDeleted'), type: 'success' });
    } catch (e) {
      logger.error(t('common.operationError'), e);
      setToast({ visible: true, message: t('exercise.deleteSetError'), type: 'error' });
    }
  }, [exerciseId, sessionId, loadData, registerDeletedSet, sessionSets, t]);

  const handleRestoreDeletedSet = useCallback(async () => {
    await handleRestoreDeleted({ exerciseId, routineExerciseId, routineId, sessionId, setSessionSets, setToast });
  }, [exerciseId, routineExerciseId, routineId, handleRestoreDeleted, sessionId]);

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
      db.transaction((tx) => {
        tx.update(sets)
          .set({
            weightKg: weight,
            // Use ?? (not ||) so valid zero values (e.g. RIR=0) are not replaced by the old value
            reps: reps ?? editingSet.reps,
            durationSeconds: duration ?? editingSet.durationSeconds,
            rir: rir ?? editingSet.rir,
            isEdited: true,
          })
          .where(eq(sets.id, editingSet.id))
          .run();

        reconcilePersonalRecordsSync({ exerciseId, sessionId, tx });
      });

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
  }, [editingSet, exerciseId, sessionId, loadData, t]);

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

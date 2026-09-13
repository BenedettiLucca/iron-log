import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '../../components/Button';
import { Toast } from '../../components/Toast';
import { SetEditor } from '../../components/SetEditor';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatTimer } from '../../src/utils/timer';
import { Colors } from '@/constants/colors';
import { safeParseParams, exerciseParamsSchema } from '@/src/validators/routes';
import { useExerciseSets, useProgression } from '../../hooks';
import { useHaptics } from '../../hooks/use-haptics';
import { useSessionKeepAwake } from '../../hooks/use-keep-awake-setting';
import { getRirColor } from '@/src/utils/exercise';
import { buildWorkoutA11y } from '../../src/utils/workout-a11y';
import { useSessionPersistence } from '../../hooks/use-session-persistence';
import { ExerciseHeader } from '../../components/session/ExerciseHeader';
import { SetList } from '../../components/session/SetList';
import { RestTimer } from '../../components/RestTimer';
import { WarmupToggle } from '../../components/session/WarmupToggle';
import { ExerciseHistoryModal } from '../../components/session/ExerciseHistoryModal';
import { RirExplainerModal } from '../../components/session/RirExplainerModal';
import {
  canNavigateAfterPendingSave,
  classifyRecoveredDraft,
  resolveNavigationAction,
  shouldSavePendingSet,
} from '@/src/utils/session-trust';
import {
  createOperationId,
  hasPendingSessionDraft,
  resolveSessionDraft,
} from '@/src/utils/session-draft';
import { logger } from '../../services/logger';

type SessionOperation =
  | 'idle'
  | 'set-finalization'
  | 'session-mutation'
  | 'removal-navigation'
  | 'advance-navigation'
  | 'navigating';

// Fallback for headless test environments where react-native mock does not include Modal
const SafeModal = (Modal || (({ children, visible, ...props }: any) => (
  visible ? <View {...props}>{children}</View> : null
))) as React.ComponentType<any>;

export default function ExerciseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { trigger } = useHaptics();
  useSessionKeepAwake();

  // Validate route params with Zod to prevent NaN
  const validated = safeParseParams(exerciseParamsSchema, params, 'ExerciseScreen');
  const routineId = validated?.routineId ?? null;
  const sessionId = validated?.sessionId ?? 0;
  const exerciseId = validated?.exerciseId ?? 0;
  const routineExerciseId = validated?.routineExerciseId ?? 0;
  const exerciseName = validated?.exerciseName ?? '';
  const target = validated?.target ?? '';
  const notes = validated?.notes ?? '';
  const routineRest = validated?.restSeconds ?? null;
  const startTime = validated?.startTime ?? Date.now();

  const {
    isDirty,
    setIsDirty,
    exerciseType,
    currentName,
    weight,
    setWeight,
    reps,
    setReps,
    duration,
    setDuration,
    rir,
    setRir,
    sessionSets,
    hasLoadedSessionSets,
    nextExercise,
    allExercises,
    isWarmupMode,
    setIsWarmupMode,
    historyVisible,
    setHistoryVisible,
    historyData,
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
    completedExercisesCount,
    handleSaveSet,
    handleDeleteSet,
    handleEditSet,
    handleSaveEditedSet,
    restoreDraft,
    t,
    language,
  } = useExerciseSets({
    sessionId,
    exerciseId,
    routineExerciseId,
    routineId,
    exerciseName,
    routineRest,
  });

  const a11y = buildWorkoutA11y({
    endSession: t('a11y.endSession'),
    undoLastSetLabel: t('exercise.undoLastSet'),
    undoLastSetHint: t('a11y.undoLastSetHint'),
    durationStart: t('a11y.durationStart'),
    durationStop: t('a11y.durationStop'),
    running: t('a11y.running'),
    history: t('a11y.openHistory'),
  });

  const { activeProgram, progressionStatus } = useProgression(exerciseId, exerciseName);
  const draftMutationGenerationRef = useRef(0);
  const operationRef = useRef<SessionOperation>('idle');
  const hasPersistenceFailureRef = useRef(false);
  const operationIdRef = useRef<string | null>(null);
  const [recoveredDecision, setRecoveredDecision] = useState<{
    visible: boolean;
    reason: 'real_pending' | 'ambiguous_legacy';
  }>({ visible: false, reason: 'real_pending' });
  const recoveredPendingRef = useRef<{
    isRecovered: boolean;
    reason: 'real_pending' | 'ambiguous_legacy';
  }>({ isRecovered: false, reason: 'real_pending' });

  const ensureOperationId = useCallback(() => {
    if (!operationIdRef.current) {
      operationIdRef.current = createOperationId();
    }
    return operationIdRef.current;
  }, []);

  const markDraftMutation = useCallback(() => {
    draftMutationGenerationRef.current += 1;
  }, []);
  const beginDraftMutation = useCallback(() => {
    if (operationRef.current !== 'idle') return false;
    markDraftMutation();
    return true;
  }, [markDraftMutation]);

  const runSessionMutation = useCallback(async <T,>(
    mutation: () => Promise<T>,
    blockedResult: T,
  ): Promise<T> => {
    if (operationRef.current !== 'idle') return blockedResult;
    operationRef.current = 'session-mutation';
    markDraftMutation();
    try {
      return await mutation();
    } finally {
      if (operationRef.current === 'session-mutation') {
        operationRef.current = 'idle';
      }
    }
  }, [markDraftMutation]);

  const guardedHandleUndo = useCallback(async () => {
    await runSessionMutation(handleUndo, undefined);
  }, [handleUndo, runSessionMutation]);
  const guardedHandleRestoreDeletedSet = useCallback(async () => {
    await runSessionMutation(handleRestoreDeletedSet, undefined);
  }, [handleRestoreDeletedSet, runSessionMutation]);
  const guardedHandleDeleteSet = useCallback(async (setId: number) => {
    await runSessionMutation(() => handleDeleteSet(setId), undefined);
  }, [handleDeleteSet, runSessionMutation]);
  const guardedHandleEditSet = useCallback(async (setId: number) => {
    await runSessionMutation(() => handleEditSet(setId), undefined);
  }, [handleEditSet, runSessionMutation]);
  const guardedHandleSaveEditedSet = useCallback((
    editedWeight: number,
    editedReps?: number,
    editedDuration?: number,
    editedRir?: number,
  ): Promise<boolean> => runSessionMutation(
    () => handleSaveEditedSet(editedWeight, editedReps, editedDuration, editedRir),
    false,
  ), [handleSaveEditedSet, runSessionMutation]);

  // Persistence Hook
  const { saveSessionContext, loadSessionContext, clearSessionContext } = useSessionPersistence({
    sessionId,
    exerciseId,
    routineExerciseId,
    routineId,
    exerciseName,
    currentName,
    exerciseType,
    weight,
    reps,
    duration,
    rir,
    isWarmupMode,
    isDirty,
    activeSetTime,
    isActiveSetRunning,
    activeSetStartedAt: activeSetStart,
    startTime,
    target,
    notes,
    restSeconds: routineRest,
    operationId: operationIdRef.current,
  });

  const sessionSetsRef = useRef(sessionSets);
  sessionSetsRef.current = sessionSets;

  useEffect(() => {
    if (!sessionId || !exerciseId) return;
    let isMounted = true;
    const hydrationGeneration = draftMutationGenerationRef.current;
    (async () => {
      const context = await loadSessionContext();
      if (!isMounted || !context) return;
      const draft = resolveSessionDraft(context, { sessionId, exerciseId, routineExerciseId });
      if (
        !draft ||
        operationRef.current !== 'idle' ||
        hydrationGeneration !== draftMutationGenerationRef.current
      ) {
        return;
      }

      // Reconcile with SQLite (Contract C3)
      let isOperationCommitted = false;
      if (draft.operationId) {
        try {
          const matchInLoaded = sessionSetsRef.current?.some(s => s.operationId === draft.operationId);
          if (matchInLoaded) {
            isOperationCommitted = true;
          } else {
            const { findSetByOperationId } = await import('../../hooks/use-exercise-sets');
            if (typeof findSetByOperationId === 'function') {
              const existingSet = await findSetByOperationId(draft.operationId);
              if (existingSet && existingSet.sessionId === sessionId) {
                isOperationCommitted = true;
              }
            }
          }
        } catch (error) {
          logger.error('Failed to check operationId in DB during recovery', error);
        }
      }

      if (!isMounted || hydrationGeneration !== draftMutationGenerationRef.current) return;

      const verdict = classifyRecoveredDraft(draft, isOperationCommitted);

      if (verdict.kind === 'committed') {
        // Crash after insert before clear reconciled: set is already in DB
        operationIdRef.current = null;
        recoveredPendingRef.current = { isRecovered: false, reason: 'real_pending' };
        try {
          await saveSessionContext(
            {
              reps: '',
              duration: '',
              isDirty: false,
              activeSetTime: 0,
              isActiveSetRunning: false,
              activeSetStartedAt: null,
              operationId: null,
            },
            { clearOnFailure: true },
          );
        } catch (clearErr) {
          logger.error('Failed to clear committed draft context', clearErr);
        }
        return;
      }

      if (verdict.kind === 'real_pending' || verdict.kind === 'ambiguous_legacy') {
        operationIdRef.current = draft.operationId ?? null;
        recoveredPendingRef.current = {
          isRecovered: true,
          reason: verdict.kind,
        };
        restoreDraft(draft);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [sessionId, exerciseId, routineExerciseId, loadSessionContext, restoreDraft, saveSessionContext]);

  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (operationRef.current === 'navigating') {
        return;
      }

      if (operationRef.current !== 'idle') {
        e.preventDefault();
        return;
      }

      const isPending = hasPendingSessionDraft({
        isDirty,
        activeSetTime,
        isActiveSetRunning,
      }) || hasPersistenceFailureRef.current;

      if (!isPending) {
        return;
      }

      e.preventDefault();
      operationRef.current = 'removal-navigation';

      (async () => {
        try {
          await saveSessionContext();
          hasPersistenceFailureRef.current = false;
          operationRef.current = 'navigating';
          navigation.dispatch(e.data.action);
        } catch {
          hasPersistenceFailureRef.current = true;
          operationRef.current = 'idle';
          setToast({
            visible: true,
            message: t('common.operationError'),
            type: 'error',
          });
        }
      })();
    });

    return unsubscribe;
  }, [navigation, isDirty, activeSetTime, isActiveSetRunning, saveSessionContext, setToast, t]);

  const executeAdvanceNavigation = useCallback(async () => {
    operationRef.current = 'advance-navigation';
    let navigationStarted = false;

    try {
      if (nextExercise) {
        await saveSessionContext({
          exerciseId: nextExercise.id,
          routineExerciseId: nextExercise.routineExerciseId,
          exerciseName: nextExercise.name,
          target: nextExercise.target ?? undefined,
          notes: nextExercise.notes ?? undefined,
          restSeconds: nextExercise.restSeconds,
          exerciseType: nextExercise.type,
          weight: '',
          reps: '',
          duration: '',
          rir: 2,
          isWarmupMode: false,
          isDirty: false,
          activeSetTime: 0,
          isActiveSetRunning: false,
          activeSetStartedAt: null,
          operationId: null,
        });
      } else {
        // Clear incomplete session when navigating to finish
        await clearSessionContext();
      }

      hasPersistenceFailureRef.current = false;
      operationRef.current = 'navigating';
      if (nextExercise) {
        router.replace({
          pathname: '/session/exercise',
          params: {
            sessionId,
            routineId,
            exerciseId: nextExercise.id,
            routineExerciseId: nextExercise.routineExerciseId,
            exerciseName: nextExercise.name,
            target: nextExercise.target,
            notes: nextExercise.notes,
            restSeconds: nextExercise.restSeconds?.toString(),
            startTime: startTime.toString()
          }
        });
      } else {
        router.replace({
          pathname: '/session/finish',
          params: { sessionId, startTime: startTime.toString() }
        });
      }
      navigationStarted = true;
    } catch (error) {
      hasPersistenceFailureRef.current = true;
      logger.error('Failed to persist session navigation', error);
      setToast({
        visible: true,
        message: t('common.operationError'),
        type: 'error',
      });
    } finally {
      if (!navigationStarted) {
        operationRef.current = 'idle';
      }
    }
  }, [clearSessionContext, nextExercise, routineId, router, saveSessionContext, sessionId, setToast, startTime, t]);

  const saveSetAndClearDraft = useCallback(async (
    overrideDuration?: number,
    owner: 'user' | 'advance' = 'user',
  ): Promise<boolean> => {
    const expectedOperation = owner === 'advance' ? 'advance-navigation' : 'idle';
    if (operationRef.current !== expectedOperation) return false;
    if (owner === 'user') operationRef.current = 'set-finalization';
    markDraftMutation();

    try {
      const opId = operationIdRef.current || createOperationId();
      operationIdRef.current = opId;

      // Persist operation ID before calling save (Contract C3)
      try {
        const raw = await AsyncStorage.getItem('incomplete_session');
        if (raw) {
          const parsed = JSON.parse(raw);
          parsed.operationId = opId;
          await AsyncStorage.setItem('incomplete_session', JSON.stringify(parsed));
        }
      } catch (persistErr) {
        logger.error('Failed to persist operation ID before save', persistErr);
      }

      const saved = await handleSaveSet(overrideDuration, opId);
      if (!saved) return false;

      recoveredPendingRef.current = { isRecovered: false, reason: 'real_pending' };
      Keyboard.dismiss();

      try {
        await saveSessionContext(
          {
            reps: '',
            duration: '',
            isDirty: false,
            activeSetTime: 0,
            isActiveSetRunning: false,
            activeSetStartedAt: null,
            operationId: null,
          },
          { clearOnFailure: true },
        );
        operationIdRef.current = null;
        hasPersistenceFailureRef.current = false;
        return true;
      } catch (error) {
        hasPersistenceFailureRef.current = true;
        logger.error('Failed to finalize persisted session draft', error);
        setToast({
          visible: true,
          message: t('common.operationError'),
          type: 'error',
        });
        return false;
      }
    } finally {
      if (owner === 'user' && operationRef.current === 'set-finalization') {
        operationRef.current = 'idle';
      }
    }
  }, [handleSaveSet, markDraftMutation, saveSessionContext, setToast, t]);

  const handleContinueEditing = useCallback(() => {
    setRecoveredDecision(prev => ({ ...prev, visible: false }));
  }, []);

  const handleDiscardRecoveredDraftAndAdvance = useCallback(async () => {
    setRecoveredDecision(prev => ({ ...prev, visible: false }));
    recoveredPendingRef.current = { isRecovered: false, reason: 'real_pending' };
    setIsDirty(false);
    setReps('');
    setDuration('');
    operationIdRef.current = null;
    markDraftMutation();

    try {
      await saveSessionContext(
        {
          reps: '',
          duration: '',
          isDirty: false,
          activeSetTime: 0,
          isActiveSetRunning: false,
          activeSetStartedAt: null,
          operationId: null,
        },
        { clearOnFailure: true },
      );
    } catch (err) {
      logger.error('Failed to clear discarded draft in persistence', err);
    }

    await executeAdvanceNavigation();
  }, [executeAdvanceNavigation, markDraftMutation, saveSessionContext, setDuration, setIsDirty, setReps]);

  const handleSaveRecoveredDraftAndAdvance = useCallback(async () => {
    setRecoveredDecision(prev => ({ ...prev, visible: false }));
    operationRef.current = 'advance-navigation';
    try {
      const saveSucceeded = await saveSetAndClearDraft(
        exerciseType === 'duration' ? activeSetTime : undefined,
        'advance',
      );
      if (!saveSucceeded) return;
      await executeAdvanceNavigation();
    } finally {
      if (operationRef.current === 'advance-navigation') {
        operationRef.current = 'idle';
      }
    }
  }, [activeSetTime, executeAdvanceNavigation, exerciseType, saveSetAndClearDraft]);

  const goToNextOrFinish = useCallback(async () => {
    if (
      operationRef.current !== 'idle' ||
      isSaving ||
      isActiveSetRunning
    ) return;

    const needsSave = shouldSavePendingSet({
      isDirty,
      exerciseType,
      activeSetTime,
      isActiveSetRunning,
    });

    const navAction = resolveNavigationAction({
      hasPendingSet: needsSave,
      isRecoveredPending: recoveredPendingRef.current.isRecovered,
      recoveredKind: recoveredPendingRef.current.reason,
    });

    if (navAction.type === 'prompt_recovery_decision') {
      setRecoveredDecision({
        visible: true,
        reason: navAction.reason,
      });
      return;
    }

    operationRef.current = 'advance-navigation';
    let navigationStarted = false;

    try {
      if (!needsSave) markDraftMutation();
      const saveSucceeded = needsSave
        ? await saveSetAndClearDraft(
          exerciseType === 'duration' ? activeSetTime : undefined,
          'advance',
        )
        : true;

      if (!canNavigateAfterPendingSave(needsSave, saveSucceeded)) return;

      await executeAdvanceNavigation();
      navigationStarted = true;
    } catch (error) {
      hasPersistenceFailureRef.current = true;
      logger.error('Failed to persist session navigation', error);
      setToast({
        visible: true,
        message: t('common.operationError'),
        type: 'error',
      });
    } finally {
      if (!navigationStarted && operationRef.current === 'advance-navigation') {
        operationRef.current = 'idle';
      }
    }
  }, [
    activeSetTime,
    executeAdvanceNavigation,
    exerciseType,
    isActiveSetRunning,
    isDirty,
    isSaving,
    markDraftMutation,
    saveSetAndClearDraft,
    setToast,
    t,
  ]);

  const calculateTarget = useCallback(() => {
    if (!target) return null;
    const match = target.match(/(\d+)x(\d+)/);
    if (match) {
      return { sets: Number(match[1]), reps: match[2] };
    }
    return null;
  }, [target]);

  const targetInfo = calculateTarget();
  const currentSetNumber = (sessionSets?.length || 0) + 1;
  const totalExercises = allExercises.length;

  const [showRirExplainer, setShowRirExplainer] = useState(false);
  // Track keyboard height on Android so the input panel scrolls above the IME.
  // KeyboardAvoidingView alone is unreliable inside OneUI translucent modals.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const keyboardListenerRef = useRef<ReturnType<typeof Keyboard.addListener> | null>(null);
  const dismissListenerRef = useRef<ReturnType<typeof Keyboard.addListener> | null>(null);
  useEffect(() => {
    if (typeof Keyboard.addListener !== 'function') return;
    keyboardListenerRef.current = Keyboard.addListener(
      Platform.OS === 'android' ? 'keyboardDidShow' : 'keyboardWillShow',
      (e) => setKeyboardHeight(e.endCoordinates?.height ?? 0),
    );
    dismissListenerRef.current = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      keyboardListenerRef.current?.remove();
      dismissListenerRef.current?.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <View className="flex-1 bg-background">
        <ExerciseHeader
          insetsTop={insets.top}
          totalExercises={totalExercises}
          completedExercisesCount={completedExercisesCount}
          t={t}
          startTime={startTime}
          onOpenHistory={() => setHistoryVisible(true)}
          a11yHistory={a11y.history}
          exerciseId={exerciseId}
          currentName={currentName}
          currentSetNumber={currentSetNumber}
          targetInfo={targetInfo}
          routineRest={routineRest}
          target={target}
          notes={notes}
        />

        {/* Undo Button (visible for 10s after save) */}
        {lastSavedSet && (
          <View className="mx-4 mt-2">
            <TouchableOpacity
              onPress={guardedHandleUndo}
              className="bg-warning/90 p-3 rounded-xl shadow-lg flex-row items-center justify-center gap-2"
              {...a11y.undo}
            >
              <Text className="text-onWarning font-bold text-sm">{t('exercise.undoLastSet')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {lastDeletedSet && (
          <View className="mx-4 mt-2">
            <TouchableOpacity
              onPress={guardedHandleRestoreDeletedSet}
              className="bg-danger/90 p-3 rounded-xl shadow-lg flex-row items-center justify-center gap-2"
              accessibilityRole="button"
              accessibilityLabel={t('exercise.undoDeletedSet')}
            >
              <Text className="text-onDanger font-bold text-sm">{t('exercise.undoDeletedSet')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Double Progression Banner */}
        {activeProgram && progressionStatus && (
          <View className="mx-4 mt-2">
            <View className="bg-primarySurface p-3 rounded-xl border border-primaryText/20">
              <View className="flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="text-subtext text-2xs font-bold uppercase tracking-wider">
                    {t('programs.repsRange', { sets: progressionStatus.targetSets, min: progressionStatus.targetRepsMin, max: progressionStatus.targetRepsMax })}
                  </Text>
                  {progressionStatus.lastPerformance && (
                    <Text className="text-text text-xs mt-0.5 font-medium">
                      {t('programs.lastPerformance', { weight: progressionStatus.lastPerformance.weight, reps: progressionStatus.lastPerformance.reps })}
                    </Text>
                  )}
                  {progressionStatus.isAtTop && (
                    <Text className="text-primaryText text-2xs font-bold mt-1">{t('programs.atTopRange')}</Text>
                  )}
                </View>
                <Text className="text-sm">
                  {progressionStatus.trend === 'up' ? t('programs.trendUp') : progressionStatus.trend === 'down' ? t('programs.trendDown') : t('programs.trendFlat')}
                </Text>
              </View>
            </View>
          </View>
        )}

        <SetList
          sessionSets={sessionSets}
          hasLoadedSessionSets={hasLoadedSessionSets}
          t={t}
          handleEditSet={guardedHandleEditSet}
          handleDeleteSet={guardedHandleDeleteSet}
        />

        {/* Recovered pending draft banner */}
        {recoveredPendingRef.current.isRecovered && isDirty && (
          <View
            className="mx-4 mt-2 bg-primarySurface p-3 rounded-xl border border-primaryText/20 flex-row items-center justify-between"
            testID="recovered-draft-banner"
          >
            <View className="flex-1 mr-2">
              <Text className="text-primaryText text-xs font-bold">
                {t('exercise.recoveredDraftNotice') !== 'exercise.recoveredDraftNotice'
                  ? t('exercise.recoveredDraftNotice')
                  : 'Série recuperada pendente'}
              </Text>
              <Text className="text-subtext text-2xs mt-0.5">
                {t('exercise.recoveredDraftNoticeHint') !== 'exercise.recoveredDraftNoticeHint'
                  ? t('exercise.recoveredDraftNoticeHint')
                  : 'Salve a série ou descarte antes de avançar.'}
              </Text>
            </View>
          </View>
        )}

        {/* Input Area */}
        <View
          className="bg-card p-3 rounded-t-3xl border-t border-border shadow-lg"
          style={{ paddingBottom: 12 + insets.bottom + (Platform.OS === 'android' ? keyboardHeight : 0) }}
        >
          <WarmupToggle
            value={isWarmupMode}
            label={t('exerciseSession.warmup')}
            accessibilityLabel={t('a11y.warmupSwitch')}
            onValueChange={(nextValue) => {
              if (!beginDraftMutation()) return;
              ensureOperationId();
              setIsWarmupMode(nextValue);
              setIsDirty(true);
            }}
          />
          {exerciseType === 'duration' ? (
            <View className="items-center mb-4">
              <Text
                className="text-text font-mono text-6xl font-bold mb-4"
                accessible={true}
                accessibilityRole="timer"
                accessibilityLabel={`${t('exerciseSession.elapsedTime')}: ${formatTimer(activeSetTime)}`}
              >
                {formatTimer(activeSetTime)}
              </Text>

              {!isActiveSetRunning && activeSetTime === 0 && (
                <View className="w-full flex-row items-center justify-center gap-2 mb-4">
                  <Text className="text-subtext text-xs uppercase font-bold">{t('exercise.extraWeight')}</Text>
                  <TextInput
                    className="bg-background text-text p-2 rounded border border-border w-20 text-center"
                    keyboardType="numeric"
                    value={weight}
                    onChangeText={(value) => {
                      if (!beginDraftMutation()) return;
                      ensureOperationId();
                      setWeight(value);
                      setIsDirty(true);
                    }}
                    placeholder="0"
                    placeholderTextColor={Colors.darkSubtext}
                    accessibilityLabel={t('exercise.weight')}
                  />
                </View>
              )}

              <TouchableOpacity
                onPress={() => {
                  if (!beginDraftMutation()) return;
                  ensureOperationId();
                  setIsDirty(true);
                  toggleActiveSet();
                }}
                className={`w-full rounded-2xl items-center justify-center min-h-[50px] shadow-sm active:opacity-90 ${
                  isActiveSetRunning ? 'bg-danger' : 'bg-success'
                }`}
                {...a11y.durationControl(isActiveSetRunning)}
              >
                <Text
                  className={`${
                    isActiveSetRunning ? 'text-onDanger' : 'text-onSuccess'
                  } font-bold text-sm`}
                >
                  {isActiveSetRunning ? t('exercise.stop') : t('exercise.startSet')}
                </Text>
              </TouchableOpacity>

              {/* Explicit save button for duration exercises */}
              {!isActiveSetRunning && activeSetTime > 0 && (
                <View className="w-full mt-3">
                  <Button
                    title={t("exercise.saveSet")}
                    onPress={async () => {
                      await saveSetAndClearDraft(activeSetTime);
                    }}
                    variant="primary"
                    size="md"
                    fullWidth
                  />
                </View>
              )}
            </View>
          ) : (
            <>
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-subtext mb-1 text-center font-bold uppercase text-xs">{t('exercise.weight')}</Text>
                  <TextInput
                    className="bg-background text-text text-center text-2xl font-bold p-2 rounded-xl border border-border"
                    keyboardType="numeric"
                    value={weight}
                    onChangeText={(value) => {
                      if (!beginDraftMutation()) return;
                      ensureOperationId();
                      setWeight(value);
                      setIsDirty(true);
                    }}
                    placeholder="0"
                    placeholderTextColor={Colors.darkSubtext}
                    accessibilityLabel={t('exercise.weight')}
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-subtext mb-1 text-center font-bold uppercase text-xs">{t("exercise.reps")}</Text>
                  <TextInput
                    className="bg-background text-text text-center text-2xl font-bold p-2 rounded-xl border border-border"
                    keyboardType="numeric"
                    value={reps}
                    onChangeText={(value) => {
                      if (!beginDraftMutation()) return;
                      ensureOperationId();
                      setReps(value);
                      setIsDirty(true);
                    }}
                    placeholder="0"
                    placeholderTextColor={Colors.darkSubtext}
                    accessibilityLabel={t('exercise.reps')}
                  />
                </View>
              </View>

              <View className="mb-3">
                <View className="flex-row justify-between items-center mb-1 px-1">
                  <TouchableOpacity
                    onPress={() => setShowRirExplainer(true)}
                    className="flex-row items-center gap-1 min-h-[44px]"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={t('exercise.rirQuestion')}
                    accessibilityHint={t('exercise.rirExplainer')}
                  >
                    <Text className="text-subtext font-bold uppercase text-xs">{t('exercise.rir')}</Text>
                    <View className="bg-background rounded-full w-4 h-4 justify-center items-center border border-border">
                      <Text className="text-subtext text-2xs font-bold">?</Text>
                    </View>
                  </TouchableOpacity>
                  <View
                    className="px-3 py-1 rounded-full border"
                    style={{ backgroundColor: `${getRirColor(rir)}20`, borderColor: getRirColor(rir) }}
                  >
                    <Text style={{ color: getRirColor(rir) }} className="font-bold text-lg">
                      {rir === 0 ? t('exercise.failure') : rir}
                    </Text>
                  </View>
                </View>

                <Slider
                  style={{ width: '100%', height: 40 }}
                  minimumValue={0}
                  maximumValue={5}
                  step={1}
                  value={rir}
                  onValueChange={(value) => {
                    if (!beginDraftMutation()) return;
                    ensureOperationId();
                    setRir(value);
                    setIsDirty(true);
                    trigger('light');
                  }}
                  accessibilityLabel={t('exercise.rirSliderLabel')}
                  accessibilityHint={t('exercise.rirSliderHint')}
                  accessibilityValue={{
                    min: 0,
                    max: 5,
                    now: rir,
                    text: t('exercise.rirSliderValue', {
                      value: rir,
                      meaning: rir <= 1
                        ? t('exercise.rirStrong')
                        : rir <= 3
                          ? t('exercise.rirModerate')
                          : t('exercise.rirLight'),
                    }),
                  }}
                  minimumTrackTintColor={Colors.primary}
                  maximumTrackTintColor={Colors.gray300}
                  thumbTintColor={Colors.primary}
                />
                <View className="flex-row justify-between px-1">
                  <Text className="text-subtext text-2xs">{t("finish.maximum")}</Text>
                  <Text className="text-subtext text-2xs">{t("finish.regenerative")}</Text>
                </View>
              </View>

              <Button
                title={isSaving ? t('exercise.saving') : t('exercise.saveBtn')}
                onPress={async () => {
                  await saveSetAndClearDraft();
                }}
                variant="primary"
                size="md"
                fullWidth
                disabled={isSaving}
              />
            </>
          )}

          <View className="mt-4">
            <Button
              title={nextExercise ? t('exercise.nextExerciseLabel', { name: nextExercise.name }) : t('exercise.finishWorkoutLabel')}
              onPress={goToNextOrFinish}
              variant="primary"
              size="md"
              fullWidth
              disabled={isSaving || isActiveSetRunning}
            />
          </View>
        </View>

        <ExerciseHistoryModal
          visible={historyVisible}
          onClose={() => setHistoryVisible(false)}
          historyData={historyData}
          t={t}
          language={language}
        />

        <RestTimer
          visible={timerStatus !== 'idle'}
          seconds={timerSeconds || 0}
          status={timerStatus}
          onClose={() => { setTimerStatus('idle'); setTimerSeconds(null); }}
          onSkip={() => { setTimerStatus('idle'); setTimerSeconds(null); }}
          onAddTime={addTime}
          nextExerciseName={nextExercise?.name}
        />

        <Toast
          visible={toast.visible}
          message={toast.message}
          type={toast.type}
          onHide={() => setToast({ ...toast, visible: false })}
        />

        <SetEditor
          visible={showSetEditor}
          setNumber={editingSet?.setNumber || 0}
          initialWeight={editingSet?.weightKg || 0}
          initialReps={editingSet?.reps}
          initialDuration={editingSet?.durationSeconds ?? undefined}
          initialRir={editingSet?.rir}
          isDuration={exerciseType === 'duration'}
          onSave={guardedHandleSaveEditedSet}
          onCancel={() => {
            setShowSetEditor(false);
            setEditingSet(null);
          }}
        />

        <RirExplainerModal
          visible={showRirExplainer}
          onClose={() => setShowRirExplainer(false)}
          t={t}
        />

        {/* Recovery Decision Modal (Contract C3) */}
        <SafeModal
          visible={recoveredDecision.visible}
          animationType="fade"
          transparent
          onRequestClose={handleContinueEditing}
          accessibilityViewIsModal
          testID="recovery-decision-dialog"
        >
          <TouchableOpacity
            activeOpacity={1}
            className="flex-1 justify-center items-center bg-black/60 p-6"
            onPress={handleContinueEditing}
            accessible={false}
            accessibilityRole="none"
          >
            <TouchableOpacity
              activeOpacity={1}
              className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-xl border border-border"
              onPress={(e) => e.stopPropagation()}
              accessible={false}
              accessibilityRole="none"
            >
              <Text
                className="text-text text-xl font-bold mb-3"
                accessibilityRole="header"
              >
                {recoveredDecision.reason === 'ambiguous_legacy'
                  ? (t('exercise.recoveredAmbiguousTitle') !== 'exercise.recoveredAmbiguousTitle'
                      ? t('exercise.recoveredAmbiguousTitle')
                      : 'Série recuperada não confirmada')
                  : (t('exercise.recoveredDraftTitle') !== 'exercise.recoveredDraftTitle'
                      ? t('exercise.recoveredDraftTitle')
                      : 'Série não salva recuperada')}
              </Text>

              <Text className="text-subtext text-sm mb-6 leading-5">
                {recoveredDecision.reason === 'ambiguous_legacy'
                  ? (t('exercise.recoveredAmbiguousMessage') !== 'exercise.recoveredAmbiguousMessage'
                      ? t('exercise.recoveredAmbiguousMessage')
                      : 'Encontramos dados de uma série anterior sem confirmação. Deseja salvar esta série antes de avançar, continuar editando ou descartá-la?')
                  : (t('exercise.recoveredDraftMessage') !== 'exercise.recoveredDraftMessage'
                      ? t('exercise.recoveredDraftMessage')
                      : 'Existe uma série pendente recuperada deste exercício. Deseja salvar antes de avançar, continuar editando ou descartar?')}
              </Text>

              <View className="gap-3">
                <View testID="recovery-btn-save">
                  <Button
                    title={t('exercise.saveAndAdvance') !== 'exercise.saveAndAdvance'
                      ? t('exercise.saveAndAdvance')
                      : 'Salvar e avançar'}
                    variant="primary"
                    size="md"
                    fullWidth
                    onPress={handleSaveRecoveredDraftAndAdvance}
                    accessibilityLabel={t('exercise.saveAndAdvance') !== 'exercise.saveAndAdvance'
                      ? t('exercise.saveAndAdvance')
                      : 'Salvar e avançar'}
                  />
                </View>

                <View testID="recovery-btn-continue">
                  <Button
                    title={t('exercise.continueEditing') !== 'exercise.continueEditing'
                      ? t('exercise.continueEditing')
                      : 'Continuar'}
                    variant="secondary"
                    size="md"
                    fullWidth
                    onPress={handleContinueEditing}
                    accessibilityLabel={t('exercise.continueEditing') !== 'exercise.continueEditing'
                      ? t('exercise.continueEditing')
                      : 'Continuar'}
                  />
                </View>

                <View testID="recovery-btn-discard">
                  <Button
                    title={t('exercise.discardDraft') !== 'exercise.discardDraft'
                      ? t('exercise.discardDraft')
                      : (t('finish.discardButton') !== 'finish.discardButton' ? t('finish.discardButton') : 'Descartar')}
                    variant="danger"
                    size="md"
                    fullWidth
                    onPress={handleDiscardRecoveredDraftAndAdvance}
                    accessibilityLabel={t('exercise.discardDraft') !== 'exercise.discardDraft'
                      ? t('exercise.discardDraft')
                      : 'Descartar'}
                  />
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </SafeModal>
      </View>
    </KeyboardAvoidingView>
  );
}

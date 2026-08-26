import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
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
  shouldSavePendingSet,
} from '@/src/utils/session-trust';
import {
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

export default function ExerciseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { trigger } = useHaptics();

  // Validate route params with Zod to prevent NaN
  const validated = safeParseParams(exerciseParamsSchema, params, 'ExerciseScreen');
  const routineId = validated?.routineId ?? null;
  const sessionId = validated?.sessionId ?? 0;
  const exerciseId = validated?.exerciseId ?? 0;
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
  });

  useEffect(() => {
    if (!sessionId || !exerciseId) return;
    let isMounted = true;
    const hydrationGeneration = draftMutationGenerationRef.current;
    (async () => {
      const context = await loadSessionContext();
      if (!isMounted || !context) return;
      const draft = resolveSessionDraft(context, { sessionId, exerciseId });
      if (
        draft &&
        operationRef.current === 'idle' &&
        hydrationGeneration === draftMutationGenerationRef.current
      ) {
        restoreDraft(draft);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [sessionId, exerciseId, loadSessionContext, restoreDraft]);

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

  const saveSetAndClearDraft = useCallback(async (
    overrideDuration?: number,
    owner: 'user' | 'advance' = 'user',
  ): Promise<boolean> => {
    const expectedOperation = owner === 'advance' ? 'advance-navigation' : 'idle';
    if (operationRef.current !== expectedOperation) return false;
    if (owner === 'user') operationRef.current = 'set-finalization';
    markDraftMutation();

    try {
      const saved = await handleSaveSet(overrideDuration);
      if (!saved) return false;

      try {
        await saveSessionContext(
          {
            reps: '',
            duration: '',
            isDirty: false,
            activeSetTime: 0,
            isActiveSetRunning: false,
            activeSetStartedAt: null,
          },
          { clearOnFailure: true },
        );
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

  const goToNextOrFinish = useCallback(async () => {
    if (
      operationRef.current !== 'idle' ||
      isSaving ||
      isActiveSetRunning
    ) return;

    operationRef.current = 'advance-navigation';
    let navigationStarted = false;

    try {
      const needsSave = shouldSavePendingSet({
        isDirty,
        exerciseType,
        activeSetTime,
        isActiveSetRunning,
      });
      if (!needsSave) markDraftMutation();
      const saveSucceeded = needsSave
        ? await saveSetAndClearDraft(
          exerciseType === 'duration' ? activeSetTime : undefined,
          'advance',
        )
        : true;

      if (!canNavigateAfterPendingSave(needsSave, saveSucceeded)) return;

      if (nextExercise) {
        await saveSessionContext({
          exerciseId: nextExercise.id,
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
  }, [
    activeSetTime,
    clearSessionContext,
    exerciseType,
    isActiveSetRunning,
    isDirty,
    isSaving,
    markDraftMutation,
    nextExercise,
    routineId,
    router,
    saveSessionContext,
    saveSetAndClearDraft,
    sessionId,
    setToast,
    startTime,
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

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
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

        {/* Input Area */}
        <View
          className="bg-card p-3 rounded-t-3xl border-t border-border shadow-lg"
          style={{ paddingBottom: 12 + insets.bottom }}
        >
          <WarmupToggle
            value={isWarmupMode}
            label={t('exerciseSession.warmup')}
            accessibilityLabel={t('a11y.warmupSwitch')}
            onValueChange={(nextValue) => {
              if (!beginDraftMutation()) return;
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
                  setIsDirty(true);
                  toggleActiveSet();
                }}
                className="rounded-2xl items-center py-5 px-16 shadow-lg"
                style={{
                  backgroundColor: isActiveSetRunning ? Colors.red400 : Colors.success,
                  shadowColor: Colors.black,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }}
                {...a11y.durationControl(isActiveSetRunning)}
              >
                <Text className={`${isActiveSetRunning ? 'text-onDanger' : 'text-onSuccess'} font-bold text-xl uppercase tracking-widest`}>
                  {isActiveSetRunning ? t('exercise.stop') : t('exercise.startSet')}
                </Text>
              </TouchableOpacity>

              {/* Explicit save button for duration exercises */}
              {!isActiveSetRunning && activeSetTime > 0 && (
                <View className="mt-4">
                  <Button
                    title={t("exercise.saveSet")}
                    onPress={async () => {
                      await saveSetAndClearDraft(activeSetTime);
                    }}
                    variant="primary"
                    size="lg"
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
      </View>
    </KeyboardAvoidingView>
  );
}

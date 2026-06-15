import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import { buildWorkoutA11y } from '../../src/utils/workout-a11y';
import { useSessionPersistence } from '../../hooks/use-session-persistence';
import { ExerciseHeader } from '../../components/session/ExerciseHeader';
import { SetList } from '../../components/session/SetList';
import { RestTimerBar } from '../../components/session/RestTimerBar';
import { ExerciseHistoryModal } from '../../components/session/ExerciseHistoryModal';
import { RirExplainerModal } from '../../components/session/RirExplainerModal';

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
    warmupSwitch: t('a11y.warmupSwitch'),
    undoLastSetLabel: t('exercise.undoLastSet'),
    undoLastSetHint: t('a11y.undoLastSetHint'),
    durationStart: t('a11y.durationStart'),
    durationStop: t('a11y.durationStop'),
    running: t('a11y.running'),
    history: t('a11y.openHistory'),
  });

  const { activeProgram, progressionStatus } = useProgression(exerciseId, exerciseName);

  // Persistence Hook
  useSessionPersistence({
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
    startTime,
    target,
    notes,
    restSeconds: routineRest,
  });

  const goToNextOrFinish = useCallback(async () => {
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
      // Clear incomplete session when navigating to finish
      await AsyncStorage.removeItem('incomplete_session');
      router.replace({
        pathname: '/session/finish',
        params: { sessionId, startTime: startTime.toString() }
      });
    }
  }, [nextExercise, sessionId, routineId, startTime, router]);

  const getRirColor = useCallback((val: number) => {
    if (val <= 1) return Colors.red400;
    if (val <= 3) return Colors.success;
    return Colors.secondary;
  }, []);

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
              onPress={handleUndo}
              className="bg-warning/90 p-3 rounded-xl shadow-lg flex-row items-center justify-center gap-2"
              {...a11y.undo}
            >
              <Text className="text-white font-bold text-sm">{t('exercise.undoLastSet')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Double Progression Banner */}
        {activeProgram && progressionStatus && (
          <View className="mx-4 mt-2">
            <View className="bg-primary/5 p-3 rounded-xl border border-primary/20">
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
                    <Text className="text-primary text-2xs font-bold mt-1">{t('programs.atTopRange')}</Text>
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
          t={t}
          handleEditSet={handleEditSet}
          handleDeleteSet={handleDeleteSet}
        />

        {/* Input Area */}
        <View
          className="bg-card p-3 rounded-t-3xl border-t border-border shadow-lg"
          style={{ paddingBottom: 12 + insets.bottom }}
        >
          {/* Warm-Up Mode Toggle */}
          <View className="flex-row items-center justify-between mb-3 py-1.5 bg-background rounded-lg px-3">
            <View className="flex-row items-center gap-2">
              <Text className="text-lg">🔥</Text>
              <Text className="text-text font-bold text-xs">{t('exerciseSession.warmup')}</Text>
            </View>
            <TouchableOpacity
              onPress={() => setIsWarmupMode(!isWarmupMode)}
              className={`w-12 h-7 rounded-full p-0.5 transition-colors ${isWarmupMode ? 'bg-warning' : 'bg-border'}`}
              {...a11y.warmupSwitch(isWarmupMode)}
            >
              <View
                className={`w-5 h-5 rounded-full bg-white shadow-sm transition-all ${isWarmupMode ? 'translate-x-5' : 'translate-x-0'}`}
              />
            </TouchableOpacity>
          </View>
          {exerciseType === 'duration' ? (
            <View className="items-center mb-4">
              <Text className="text-text font-mono text-6xl font-bold mb-4">
                {formatTimer(activeSetTime)}
              </Text>

              {!isActiveSetRunning && activeSetTime === 0 && (
                <View className="w-full flex-row items-center justify-center gap-2 mb-4">
                  <Text className="text-subtext text-xs uppercase font-bold">{t('exercise.extraWeight')}</Text>
                  <TextInput
                    className="bg-background text-text p-2 rounded border border-border w-20 text-center"
                    keyboardType="numeric"
                    value={weight}
                    onChangeText={setWeight}
                    placeholder="0"
                    placeholderTextColor={Colors.darkSubtext}
                  />
                </View>
              )}

              <TouchableOpacity
                onPress={toggleActiveSet}
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
                <Text className="text-white font-bold text-xl uppercase tracking-widest">
                  {isActiveSetRunning ? t('exercise.stop') : t('exercise.startSet')}
                </Text>
              </TouchableOpacity>

              {/* Explicit save button for duration exercises */}
              {!isActiveSetRunning && activeSetTime > 0 && (
                <View className="mt-4">
                  <Button
                    title={t("exercise.saveSet")}
                    onPress={() => handleSaveSet(activeSetTime)}
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
                    onChangeText={setWeight}
                    placeholder="0"
                    placeholderTextColor={Colors.darkSubtext}
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-subtext mb-1 text-center font-bold uppercase text-xs">{t("exercise.reps")}</Text>
                  <TextInput
                    className="bg-background text-text text-center text-2xl font-bold p-2 rounded-xl border border-border"
                    keyboardType="numeric"
                    value={reps}
                    onChangeText={setReps}
                    placeholder="0"
                    placeholderTextColor={Colors.darkSubtext}
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
                    setRir(value);
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
                  <Text className="text-gray-400 text-2xs">{t("finish.maximum")}</Text>
                  <Text className="text-gray-400 text-2xs">{t("finish.regenerative")}</Text>
                </View>
              </View>

              <Button
                title={isSaving ? t('exercise.saving') : t('exercise.saveBtn')}
                onPress={() => handleSaveSet()}
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
              variant={nextExercise ? 'secondary' : 'danger'}
              size="md"
              fullWidth
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

        <RestTimerBar
          timerStatus={timerStatus}
          timerSeconds={timerSeconds}
          setTimerStatus={setTimerStatus}
          setTimerSeconds={setTimerSeconds}
          addTime={addTime}
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
          onSave={handleSaveEditedSet}
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

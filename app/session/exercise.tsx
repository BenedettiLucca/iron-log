import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  KeyboardAvoidingView,
  Platform,
  AppState,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { db } from '../../src/db/client';
import { sets, exercises, sessions, routineExercises } from '../../src/db/schema';
import { eq, and, desc} from 'drizzle-orm';
import { Stopwatch } from '../../components/Stopwatch';
import { ProgressBar } from '../../components/ProgressBar';
import SetCard from '../../components/SetCard';
import { SetEditor } from '../../components/SetEditor';
import { RestTimer } from '../../components/RestTimer';
import { Button } from '../../components/Button';
import { Toast } from '../../components/Toast';
import Slider from '@react-native-community/slider';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { parseTargetSets } from '../../src/utils/exercise';
import { formatTimer } from '../../src/utils/timer';
import { useHaptics } from '../../hooks/use-haptics';
import { logger } from '@/services/logger';
import { Set, Exercise } from '@/src/types';
import { Colors } from '@/constants/colors';
import { safeParseParams, exerciseParamsSchema } from '@/src/validators/routes';
import { setInputSchema } from '@/src/validators/forms';

export default function ExerciseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const { trigger } = useHaptics();

  // Validate route params with Zod to prevent NaN
  // (Validation runs after hooks — early return is handled by useEffect)
  const validated = safeParseParams(exerciseParamsSchema, params, 'ExerciseScreen');
  const routineId = validated?.routineId ?? null;
  const sessionId = validated?.sessionId ?? 0;
  const exerciseId = validated?.exerciseId ?? 0;
  const exerciseName = validated?.exerciseName ?? '';
  const target = validated?.target ?? '';
  const notes = validated?.notes ?? '';
  const routineRest = validated?.restSeconds ?? null;
  const startTime = validated?.startTime ?? Date.now();

  const [exerciseType, setExerciseType] = useState('strength');
  const [currentName, setCurrentName] = useState(exerciseName);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [duration, setDuration] = useState('');
  const [rir, setRir] = useState(2);
  const [sessionSets, setSessionSets] = useState<Set[]>([]);
  const [nextExercise, setNextExercise] = useState<Exercise | null>(null);
  const [allExercises, setAllExercises] = useState<Set[]>([]);
  const [isWarmupMode, setIsWarmupMode] = useState(false);

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

  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyData, setHistoryData] = useState<Set[]>([]);

  // Rest Timer
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerTarget, setTimerTarget] = useState<number | null>(null);
  const [timerStatus, setTimerStatus] = useState<'idle' | 'running' | 'finished'>('idle');

  // Active Set Timer
  const [activeSetStart, setActiveSetStart] = useState<number | null>(null);
  const [activeSetTime, setActiveSetTime] = useState(0);
  const isActiveSetRunning = activeSetStart !== null;

  // Undo state
  const [lastSavedSet, setLastSavedSet] = useState<Exercise | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  // Loading state
  const [isSaving, setIsSaving] = useState(false);

  // Toast state
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  // Set Editor state
  const [editingSet, setEditingSet] = useState<Exercise | null>(null);
  const [showSetEditor, setShowSetEditor] = useState(false);

  // RIR Explainer modal state
  const [showRirExplainer, setShowRirExplainer] = useState(false);

  // Total exercises for progress bar
  const totalExercises = allExercises.length;

  // Efeito Active Timer (delta-based for accuracy)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (activeSetStart !== null) {
      const tick = () => {
        const elapsed = Math.floor((Date.now() - activeSetStart) / 1000);
        setActiveSetTime(elapsed);
      };
      tick();
      interval = setInterval(tick, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [activeSetStart]);

  // Efeito Rest Timer
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (timerStatus === 'running' && timerTarget) {
      const tick = () => {
        const now = Date.now();
        const left = Math.ceil((timerTarget - now) / 1000);
        if (left <= 0) {
          setTimerSeconds(0);
          setTimerStatus('finished');
        } else {
          setTimerSeconds(left);
        }
      };
      tick();
      interval = setInterval(tick, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [timerStatus, timerTarget]);

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
      logger.error('Operation failed', e);
    }
  }, [sessionId, exerciseId, routineId]);

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
        .where(and(eq(sets.exerciseId, exerciseId), isNull(sets.deletedAt), isNull(sessions.deletedAt)))
        .limit(20);

      history.sort((a, b) => b.date - a.date);
      setHistoryData(history);
    } catch (e) {
      logger.error('Operation failed', "Erro SQL Histórico:", e);
    }
  }, [exerciseId]);

  useEffect(() => {
    loadData();
    loadHistory();
  }, [loadData, loadHistory]);

  // Cleanup undo timeout
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  // Save session state when app goes to background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        // Save current session context for recovery
        const sessionContext = {
          sessionId,
          exerciseId,
          exerciseName: currentName,
          routineId,
          target,
          notes,
          restSeconds: routineRest,
          startTime,
        };
        AsyncStorage.setItem('incomplete_session', JSON.stringify(sessionContext));
      }
    });

    return () => {
      subscription.remove();
    };
  }, [sessionId, exerciseId, currentName, routineId, target, notes, routineRest, startTime]);

  const toggleActiveSet = useCallback(() => {
    if (activeSetStart !== null) {
      // Stop — keep current time frozen
      setActiveSetStart(null);
    } else {
      // Start fresh
      setActiveSetTime(0);
      setActiveSetStart(Date.now());
    }
  }, [activeSetStart]);

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
      const msg = setValidation.error.errors[0]?.message || 'Dados inválidos';
      setToast({ visible: true, message: msg, type: 'error' });
      return;
    }
    // Extra business logic validation
    if (isDuration && finalDuration <= 0) {
      setToast({ visible: true, message: 'Digite o tempo da série (em segundos)', type: 'error' });
      return;
    }
    if (!isDuration && finalReps <= 0) {
      setToast({ visible: true, message: 'Digite o número de repetições', type: 'error' });
      return;
    }
    if (!isDuration && !weight) {
      setToast({ visible: true, message: 'Digite a carga utilizada', type: 'error' });
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
      }, 10000) as unknown as NodeJS.Timeout;

      await loadData();
      setReps('');
      setDuration('');

      if (!isDuration) {
        const restTime = routineRest || 90;
        setTimerTarget(Date.now() + restTime * 1000);
        setTimerStatus('running');
      }

    } catch (e) {
      logger.error('Operation failed', e);
      setToast({ visible: true, message: 'Falha ao salvar série', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, exerciseType, duration, reps, weight, rir, sessionId, exerciseId, currentName, sessionSets, routineRest, undoTimeoutRef, loadData, isWarmupMode]);

  const handleUndo = useCallback(async () => {
    if (!lastSavedSet) return;

    try {
      await db.update(sets).set({ deletedAt: Date.now() }).where(eq(sets.id, lastSavedSet.id));
      setLastSavedSet(null);
      await loadData();
      setToast({ visible: true, message: 'A última série foi removida', type: 'success' });
    } catch (e) {
      logger.error('Operation failed', e);
      setToast({ visible: true, message: 'Falha ao desfazer', type: 'error' });
    }
  }, [lastSavedSet, loadData]);

  const handleDeleteSet = useCallback(async (setId: number) => {
    try {
      await db.update(sets).set({ deletedAt: Date.now() }).where(eq(sets.id, setId));
      await loadData();
      setToast({ visible: true, message: 'Série excluída', type: 'success' });
    } catch (e) {
      logger.error('Operation failed', e);
      setToast({ visible: true, message: 'Falha ao excluir série', type: 'error' });
    }
  }, [loadData]);

  const handleEditSet = useCallback(async (setId: number) => {
    try {
      const setData = await db.select().from(sets).where(and(eq(sets.id, setId), isNull(sets.deletedAt)));
      if (setData.length > 0) {
        setEditingSet(setData[0]);
        setShowSetEditor(true);
      }
    } catch (e) {
      logger.error('Operation failed', e);
      setToast({ visible: true, message: 'Falha ao carregar série', type: 'error' });
    }
  }, []);

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
      setToast({ visible: true, message: 'Série editada com sucesso', type: 'success' });
    } catch (e) {
      logger.error('Operation failed', e);
      setToast({ visible: true, message: 'Falha ao editar série', type: 'error' });
    }
  }, [editingSet, loadData]);

  const goToNextOrFinish = useCallback(() => {
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
      AsyncStorage.removeItem('incomplete_session');
      router.replace({
        pathname: '/session/finish',
        params: { sessionId, startTime: startTime.toString() }
      });
    }
  }, [nextExercise, sessionId, routineId, startTime, router]);


  const addTime = useCallback((sec: number) => {
    if (timerStatus === 'running' && timerTarget) {
      setTimerTarget(timerTarget + sec * 1000);
    } else {
      setTimerSeconds((prev) => (prev || 0) + sec);
    }
  }, [timerStatus, timerTarget]);

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

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      style={{ flex: 1 }}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="bg-card border-b border-border" style={{ paddingTop: insets.top }}>
            <View className="p-4">
              {/* Progress Bar */}
              {totalExercises > 0 && (
                <View className="mb-4">
                  <ProgressBar
                    current={completedExercisesCount}
                    total={totalExercises}
                    variant="compact"
                    showLabel={true}
                  />
                </View>
              )}

              <View className="flex-row justify-between items-center mb-4">
                <View className="flex-1">
                  <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-1">Tempo de Treino</Text>
                  <Stopwatch startTime={startTime} />
                </View>
                <TouchableOpacity
                  onPress={() => setHistoryVisible(true)}
                  className="bg-background px-3 py-2 rounded-lg border border-border"
                >
                  <Text className="text-subtext text-xs font-bold uppercase">Histórico</Text>
                </TouchableOpacity>
              </View>

              <Animated.View 
                key={`header-${exerciseId}`} 
                entering={FadeInRight.duration(300)} 
                exiting={FadeOutLeft.duration(300)}
              >
                <View className="flex-row justify-between items-start">
                  <View className="flex-1">
                    <Text className="text-text text-2xl font-bold">{currentName}</Text>
                    <View className="flex-row items-center gap-2 mt-2">
                      <Text className="text-primary text-sm font-semibold bg-primary/10 px-2 py-1 rounded-md">
                        Série {currentSetNumber}
                        {targetInfo && ` de ${targetInfo.sets}`}
                      </Text>
                      {routineRest && (
                        <Text className="text-subtext text-xs bg-background px-2 py-1 rounded-md border border-border">
                          ⏱ {routineRest}s
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {(target || notes) && (
                  <View className="mt-3 bg-background p-3 rounded-lg border border-border">
                    {target && <Text className="text-primary font-semibold text-sm">🎯 Meta: {target}</Text>}
                    {notes && <Text className="text-subtext text-xs italic mt-1">📝 {notes}</Text>}
                  </View>
                )}
              </Animated.View>
            </View>
          </View>

          {/* Undo Button (visible for 10s after save) */}
          {lastSavedSet && (
            <View className="mx-4 mt-4">
              <TouchableOpacity
                onPress={handleUndo}
                className="bg-warning/90 p-3 rounded-xl shadow-lg flex-row items-center justify-center gap-2"
              >
                <Text className="text-white font-bold text-sm">↩ Desfazer última série (10s)</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Saved Sets List */}
          <View className="flex-1 px-4">
            <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-3 mt-4">
              Séries Registradas ({sessionSets?.length || 0})
            </Text>
              <FlatList
               data={sessionSets}
               keyExtractor={(item) => item.id.toString()}
               renderItem={({ item, index }) => (
                 <SetCard
                   key={item.id}
                   index={index}
                   setNumber={item.setNumber}
                   weight={item.weightKg}
                   reps={item.reps || undefined}
                   duration={item.durationSeconds || undefined}
                   rir={item.rir}
                   isWarmup={item.isWarmup || false}
                   isEdited={item.isEdited || false}
                   onEdit={() => handleEditSet(item.id)}
                   onDelete={() => handleDeleteSet(item.id)}
                 />
               )}
              ListEmptyComponent={
                <View className="py-8">
                  <Text className="text-subtext text-center">Nenhuma série registrada ainda.</Text>
                </View>
              }
            />
          </View>

          {/* Input Area */}
          <View className="bg-card p-4 rounded-t-3xl border-t border-border shadow-lg">
            {/* Warm-Up Mode Toggle */}
            <View className="flex-row items-center justify-between mb-4 py-2 bg-background rounded-lg px-4">
              <View className="flex-row items-center gap-2">
                <Text className="text-2xl">🔥</Text>
                <View>
                  <Text className="text-text font-bold text-sm">Modo Aquecimento</Text>
                  <Text className="text-subtext text-xs">Registre seus aquecimentos separadamente</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsWarmupMode(!isWarmupMode)}
                className={`w-14 h-8 rounded-full p-1 transition-colors ${isWarmupMode ? 'bg-warning' : 'bg-border'}`}
              >
                <View
                  className={`w-6 h-6 rounded-full bg-white shadow-md transition-all ${isWarmupMode ? 'translate-x-6' : 'translate-x-0'}`}
                />
              </TouchableOpacity>
            </View>
          {exerciseType === 'duration' ? (
            <View className="items-center mb-6">
              <Text className="text-text font-mono text-6xl font-bold mb-4">
                {formatTimer(activeSetTime)}
              </Text>

              {!isActiveSetRunning && activeSetTime === 0 && (
                <View className="w-full flex-row items-center justify-center gap-2 mb-4">
                  <Text className="text-subtext text-xs uppercase font-bold">Carga Extra (kg):</Text>
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
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 8,
                  elevation: 8,
                }}
              >
                <Text className="text-white font-bold text-xl uppercase tracking-widest">
                  {isActiveSetRunning ? 'PARAR' : 'INICIAR SÉRIE'}
                </Text>
              </TouchableOpacity>

              {/* Explicit save button for duration exercises */}
              {!isActiveSetRunning && activeSetTime > 0 && (
                <View className="mt-4">
                  <Button
                    title="SALVAR SÉRIE"
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
                  <Text className="text-subtext mb-1 text-center font-bold uppercase text-xs">Carga (kg)</Text>
                  <TextInput
                    className="bg-background text-text text-center text-2xl font-bold p-3 rounded-xl border border-border"
                    keyboardType="numeric"
                    value={weight}
                    onChangeText={setWeight}
                    placeholder="0"
                    placeholderTextColor={Colors.darkSubtext}
                  />
                </View>

                <View className="flex-1">
                  <Text className="text-subtext mb-1 text-center font-bold uppercase text-xs">REPS</Text>
                  <TextInput
                    className="bg-background text-text text-center text-2xl font-bold p-3 rounded-xl border border-border"
                    keyboardType="numeric"
                    value={reps}
                    onChangeText={setReps}
                    placeholder="0"
                    placeholderTextColor={Colors.darkSubtext}
                  />
                </View>
              </View>

              <View className="mb-4">
                <View className="flex-row justify-between items-center mb-2 px-1">
                  <TouchableOpacity
                    onPress={() => setShowRirExplainer(true)}
                    className="flex-row items-center gap-1"
                  >
                    <Text className="text-subtext font-bold uppercase text-xs">Reserva (RIR)</Text>
                    <View className="bg-background rounded-full w-4 h-4 justify-center items-center border border-border">
                      <Text className="text-subtext text-2xs font-bold">?</Text>
                    </View>
                  </TouchableOpacity>
                  <View
                    className="px-3 py-1 rounded-full border"
                    style={{ backgroundColor: `${getRirColor(rir)}20`, borderColor: getRirColor(rir) }}
                  >
                    <Text style={{ color: getRirColor(rir) }} className="font-bold text-lg">
                      {rir === 0 ? 'FALHA' : rir}
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
                  minimumTrackTintColor={Colors.primary}
                  maximumTrackTintColor={Colors.gray300}
                  thumbTintColor={Colors.primary}
                />
                <View className="flex-row justify-between px-1">
                  <Text className="text-gray-400 text-2xs">MÁXIMO</Text>
                  <Text className="text-gray-400 text-2xs">LEVE</Text>
                </View>
              </View>

              <Button
                title={isSaving ? 'SALVANDO...' : 'SALVAR SÉRIE'}
                onPress={() => handleSaveSet()}
                variant="primary"
                size="lg"
                fullWidth
                disabled={isSaving}
              />
            </>
          )}

          <View className="mt-4">
            <Button
              title={nextExercise ? `PRÓXIMO: ${nextExercise.name}` : 'FINALIZAR TREINO'}
              onPress={goToNextOrFinish}
              variant={nextExercise ? 'secondary' : 'danger'}
              size="md"
              fullWidth
            />
          </View>
        </View>

        {/* History Modal */}
        <Modal visible={historyVisible} animationType="slide" presentationStyle="pageSheet">
          <View className="flex-1 bg-background p-4">
            <View className="flex-row justify-between items-center mb-4 mt-2">
              <Text className="text-text text-xl font-bold uppercase">Histórico</Text>
              <TouchableOpacity onPress={() => setHistoryVisible(false)}>
                <Text className="text-primary font-bold uppercase">Fechar</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={historyData}
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => {
                const date = new Date(item.date);
                return (
                  <View className="bg-card p-3 mb-2 rounded border border-border flex-row justify-between items-center">
                    <Text className="text-subtext font-mono text-xs">
                      {date.toLocaleDateString()}
                    </Text>
                    <Text className="text-text font-bold">
                      {item.weight}kg × {item.duration ? `${item.duration}s` : item.reps}
                    </Text>
                    {item.rir !== null && (
                      <Text className="text-subtext text-xs">RIR {item.rir}</Text>
                    )}
                  </View>
                );
              }}
            />
          </View>
        </Modal>

        {/* Rest Timer Bottom Sheet */}
        <RestTimer
          visible={timerStatus !== 'idle'}
          seconds={timerSeconds || 0}
          status={timerStatus}
          onClose={() => {
            setTimerStatus('idle');
            setTimerSeconds(null);
          }}
          onSkip={() => {
            setTimerStatus('idle');
            setTimerSeconds(null);
          }}
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
          initialDuration={editingSet?.durationSeconds}
          initialRir={editingSet?.rir}
          isDuration={exerciseType === 'duration'}
          onSave={handleSaveEditedSet}
          onCancel={() => {
            setShowSetEditor(false);
            setEditingSet(null);
          }}
        />

        {/* RIR Explainer Modal */}
        <Modal visible={showRirExplainer} animationType="fade" transparent onRequestClose={() => setShowRirExplainer(false)}>
          <TouchableOpacity
            activeOpacity={1}
            className="flex-1 justify-center items-center bg-black/40 p-6"
            onPress={() => setShowRirExplainer(false)}
          >
            <TouchableOpacity
              activeOpacity={1}
              className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-xl border border-border"
              onPress={(e) => e.stopPropagation()}
            >
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-text text-xl font-bold">O que é RIR?</Text>
                <TouchableOpacity onPress={() => setShowRirExplainer(false)}>
                  <Text className="text-subtext text-2xl font-bold">✕</Text>
                </TouchableOpacity>
              </View>

              <View className="space-y-4">
                <View className="flex-row items-start gap-3">
                  <View className="bg-danger/10 p-2 rounded-lg">
                    <Text className="text-2xl">0-1</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-text font-bold text-base mb-1">Forte / Pesado</Text>
                    <Text className="text-subtext text-sm">Próximo da falha muscular</Text>
                  </View>
                </View>

                <View className="flex-row items-start gap-3">
                  <View className="bg-success/10 p-2 rounded-lg">
                    <Text className="text-2xl">2-3</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-text font-bold text-base mb-1">Moderado</Text>
                    <Text className="text-subtext text-sm">Esforço controlado, bom para hipertrofia</Text>
                  </View>
                </View>

                <View className="flex-row items-start gap-3">
                  <View className="bg-secondary/10 p-2 rounded-lg">
                    <Text className="text-2xl">4-5</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="text-text font-bold text-base mb-1">Leve</Text>
                    <Text className="text-subtext text-sm">Aquecimento ou técnica</Text>
                  </View>
                </View>

                <View className="bg-background p-3 rounded-lg border border-border mt-4">
                  <Text className="text-subtext text-xs leading-5">
                    <Text className="font-bold text-text">RIR</Text> = Repetições na Reserva. Quanto maior o número, mais fácil foi a série. <Text className="font-bold text-text">RIR 0</Text> significa que você não conseguiria fazer mais uma repetição.
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={() => setShowRirExplainer(false)}
                className="mt-6 bg-primary p-3 rounded-xl items-center"
              >
                <Text className="text-white font-bold text-base uppercase">Entendi!</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}


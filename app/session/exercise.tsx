import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  StyleSheet,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { db } from '../../src/db/client';
import { sets, exercises, sessions, routineExercises } from '../../src/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { Stopwatch } from '../../components/Stopwatch';
import { ProgressBar } from '../../components/ProgressBar';
import { SetCard } from '../../components/SetCard';
import { RestTimer } from '../../components/RestTimer';
import { Button } from '../../components/Button';
import { Toast } from '../../components/Toast';
import Slider from '@react-native-community/slider';

export default function ExerciseScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const routineId = params.routineId ? Number(params.routineId) : null;
  const sessionId = Number(params.sessionId);
  const exerciseId = Number(params.exerciseId);
  const exerciseName = params.exerciseName as string;
  const target = params.target as string;
  const notes = params.notes as string;
  const routineRest = params.restSeconds ? Number(params.restSeconds) : null;
  const startTime = params.startTime ? Number(params.startTime) : Date.now();

  const [exerciseType, setExerciseType] = useState('strength');
  const [currentName, setCurrentName] = useState(exerciseName);
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('');
  const [duration, setDuration] = useState('');
  const [rir, setRir] = useState(2);
  const [sessionSets, setSessionSets] = useState<any[]>([]);
  const [nextExercise, setNextExercise] = useState<any>(null);
  const [allExercises, setAllExercises] = useState<any[]>([]);

  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);

  // Rest Timer
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerTarget, setTimerTarget] = useState<number | null>(null);
  const [timerStatus, setTimerStatus] = useState<'idle' | 'running' | 'finished'>('idle');

  // Active Set Timer
  const [activeSetTime, setActiveSetTime] = useState(0);
  const [isActiveSetRunning, setIsActiveSetRunning] = useState(false);

  // Undo state
  const [lastSavedSet, setLastSavedSet] = useState<any>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout>();

  // Loading state
  const [isSaving, setIsSaving] = useState(false);

  // Toast state
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

  // Get current exercise index
  const currentExerciseIndex = allExercises.findIndex(e => e.id === exerciseId);
  const totalExercises = allExercises.length;

  // Efeito Active Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActiveSetRunning) {
      interval = setInterval(() => {
        setActiveSetTime(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActiveSetRunning]);

  // Efeito Rest Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
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
    return () => clearInterval(interval);
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
        .where(and(eq(sets.sessionId, sessionId), eq(sets.exerciseId, exerciseId)))
        .orderBy(sets.setNumber);
      setSessionSets(data);

      if (data.length === 0) {
        const lastSet = await db.select({ weight: sets.weightKg })
          .from(sets)
          .where(eq(sets.exerciseId, exerciseId))
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
      console.error(e);
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
        .where(eq(sets.exerciseId, exerciseId))
        .limit(20);

      history.sort((a, b) => b.date - a.date);
      setHistoryData(history);
    } catch (e) {
      console.error("Erro SQL Histórico:", e);
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

  const toggleActiveSet = () => {
    if (isActiveSetRunning) {
      setIsActiveSetRunning(false);
      // Don't auto-save - wait for explicit save button
      setActiveSetTime(prev => prev);
    } else {
      setActiveSetTime(0);
      setIsActiveSetRunning(true);
    }
  };

  const handleSaveSet = async (overrideDuration?: number) => {
    if (isSaving) return;

    const isDuration = exerciseType === 'duration';

    const finalDuration = overrideDuration !== undefined ? overrideDuration : (duration ? Number(duration) : 0);
    const finalReps = reps ? Number(reps) : 0;

    // Validation
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
        weightKg: Number(weight) || 0,
        reps: isDuration ? 0 : finalReps,
        durationSeconds: isDuration ? finalDuration : null,
        rir: isDuration ? null : Number(rir),
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
      setReps('');
      setDuration('');

      if (!isDuration) {
        const restTime = routineRest || 90;
        setTimerTarget(Date.now() + restTime * 1000);
        setTimerStatus('running');
      }

    } catch (e) {
      console.error(e);
      setToast({ visible: true, message: 'Falha ao salvar série', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUndo = async () => {
    if (!lastSavedSet) return;

    try {
      await db.delete(sets).where(eq(sets.id, lastSavedSet.id));
      setLastSavedSet(null);
      await loadData();
      setToast({ visible: true, message: 'A última série foi removida', type: 'success' });
    } catch (e) {
      console.error(e);
      setToast({ visible: true, message: 'Falha ao desfazer', type: 'error' });
    }
  };

  const handleDeleteSet = async (setId: number) => {
    try {
      await db.delete(sets).where(eq(sets.id, setId));
      await loadData();
      setToast({ visible: true, message: 'Série excluída', type: 'success' });
    } catch (e) {
      console.error(e);
      setToast({ visible: true, message: 'Falha ao excluir série', type: 'error' });
    }
  };

  const goToNextOrFinish = () => {
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
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const addTime = (sec: number) => {
    if (timerStatus === 'running' && timerTarget) {
      setTimerTarget(timerTarget + sec * 1000);
    } else {
      setTimerSeconds((prev) => (prev || 0) + sec);
    }
  };

  const getRirColor = (val: number) => {
    if (val <= 1) return '#EF6464';
    if (val <= 3) return '#81B29A';
    return '#3D5A80';
  };

  const calculateTarget = () => {
    if (!target) return null;
    const match = target.match(/(\d+)x(\d+)/);
    if (match) {
      return { sets: Number(match[1]), reps: match[2] };
    }
    return null;
  };

  const targetInfo = calculateTarget();
  const currentSetNumber = (sessionSets?.length || 0) + 1;

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-card border-b border-border">
          <View className="p-4">
            {/* Progress Bar */}
            {totalExercises > 0 && (
              <View className="mb-4">
                <ProgressBar
                  current={currentExerciseIndex + 1}
                  total={totalExercises}
                  variant="compact"
                  showLabel={true}
                />
              </View>
            )}

            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-1">
                <Text className="text-subtext text-[10px] font-bold uppercase tracking-widest mb-1">Tempo de Treino</Text>
                <Stopwatch startTime={startTime} />
              </View>
              <TouchableOpacity
                onPress={() => setHistoryVisible(true)}
                className="bg-background px-3 py-2 rounded-lg border border-border"
              >
                <Text className="text-subtext text-xs font-bold uppercase">Histórico</Text>
              </TouchableOpacity>
            </View>

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
          <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-3">
            Séries Registradas ({sessionSets?.length || 0})
          </Text>
          {sessionSets?.length === 0 ? (
            <View className="py-8">
              <Text className="text-subtext text-center">Nenhuma série registrada ainda.</Text>
            </View>
          ) : (
            sessionSets.map((item, index) => (
              <SetCard
                key={item.id}
                index={index}
                setNumber={item.setNumber}
                weight={item.weightKg}
                reps={item.reps || undefined}
                duration={item.durationSeconds || undefined}
                rir={item.rir}
                onDelete={() => handleDeleteSet(item.id)}
              />
            ))
          )}
        </View>

        {/* Input Area */}
        <View className="bg-card p-4 rounded-t-3xl border-t border-border shadow-lg">
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
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            )}

            <TouchableOpacity
              onPress={toggleActiveSet}
              style={[
                styles.timerButton,
                isActiveSetRunning ? styles.timerButtonStop : styles.timerButtonStart
              ]}
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
                <Text className="text-subtext mb-1 text-center font-bold uppercase text-[10px]">Carga (kg)</Text>
                <TextInput
                  className="bg-background text-text text-center text-3xl font-bold p-4 rounded-xl border border-border"
                  keyboardType="numeric"
                  value={weight}
                  onChangeText={setWeight}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                />
              </View>

              <View className="flex-1">
                <Text className="text-subtext mb-1 text-center font-bold uppercase text-[10px]">REPS</Text>
                <TextInput
                  className="bg-background text-text text-center text-3xl font-bold p-4 rounded-xl border border-border"
                  keyboardType="numeric"
                  value={reps}
                  onChangeText={setReps}
                  placeholder="0"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>

            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-2 px-1">
                <TouchableOpacity
                  onPress={() => setToast({ visible: true, message: 'Repetições na Reserva (0 = Falha)', type: 'info' })}
                  className="flex-row items-center gap-1"
                >
                  <Text className="text-subtext font-bold uppercase text-[10px]">Reserva (RIR)</Text>
                  <View className="bg-background rounded-full w-4 h-4 justify-center items-center border border-border">
                    <Text className="text-subtext text-[8px] font-bold">?</Text>
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
                onValueChange={setRir}
                minimumTrackTintColor="#E07A5F"
                maximumTrackTintColor="#D1D5DB"
                thumbTintColor="#E07A5F"
              />
              <View className="flex-row justify-between px-1">
                <Text className="text-gray-400 text-[8px]">MÁXIMO</Text>
                <Text className="text-gray-400 text-[8px]">LEVE</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  timerButton: {
    paddingVertical: 20,
    paddingHorizontal: 48,
    borderRadius: 16,
    borderWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  timerButtonStart: {
    backgroundColor: '#81B29A',
    borderColor: '#81B29A80',
  },
  timerButtonStop: {
    backgroundColor: '#EF6464',
    borderColor: '#EF646480',
  },
});

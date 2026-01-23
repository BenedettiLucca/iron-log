import { View, Text, TextInput, TouchableOpacity, FlatList, Alert, KeyboardAvoidingView, Platform, Modal, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { db } from '../../src/db/client';
import { sets, exercises, sessions, routineExercises } from '../../src/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { Stopwatch } from '../../components/Stopwatch';
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

  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyData, setHistoryData] = useState<any[]>([]);

  // Rest Timer
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);
  const [timerTarget, setTimerTarget] = useState<number | null>(null);
  const [timerStatus, setTimerStatus] = useState<'idle' | 'running' | 'finished'>('idle');
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Active Set Timer
  const [activeSetTime, setActiveSetTime] = useState(0);
  const [isActiveSetRunning, setIsActiveSetRunning] = useState(false);

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

  const loadData = async () => {
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

          const currentIndex = routineList.findIndex(e => e.id === exerciseId);
          if (currentIndex !== -1 && currentIndex < routineList.length - 1) {
              const next = routineList[currentIndex + 1];
              setNextExercise(next);
          }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadHistory = async () => {
    try {
        const history = await db.select({
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
  };

  useEffect(() => {
    loadData();
    loadHistory();
  }, [sessionId, exerciseId]);

  const toggleActiveSet = () => {
      if (isActiveSetRunning) {
          setIsActiveSetRunning(false);
          handleSaveSet(activeSetTime);
          setActiveSetTime(0);
      } else {
          setActiveSetTime(0);
          setIsActiveSetRunning(true);
      }
  };

  const handleSaveSet = async (overrideDuration?: number) => {
    const isDuration = exerciseType === 'duration';
    
    const finalDuration = overrideDuration !== undefined ? overrideDuration : (duration ? Number(duration) : 0);
    const finalReps = reps ? Number(reps) : 0;

    if (isDuration && finalDuration <= 0) return;
    if (!isDuration && finalReps <= 0) return;

    const nextSetNumber = (sessionSets?.length || 0) + 1;

    try {
      await db.insert(sets).values({
        sessionId,
        exerciseId,
        exerciseName: currentName, 
        setNumber: nextSetNumber,
        weightKg: Number(weight) || 0,
        reps: isDuration ? 0 : finalReps,
        durationSeconds: isDuration ? finalDuration : null,
        rir: isDuration ? null : Number(rir),
      });

      await loadData();
      setReps('');
      setDuration('');

      if (!isDuration) {
          const restTime = routineRest || 90;
          setTimerTarget(Date.now() + restTime * 1000);
          setTimerStatus('running');
          setIsModalVisible(true);
      }

    } catch (e) {
      Alert.alert('Erro', 'Falha ao salvar série');
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

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-background"
    >
      <View className="p-4 border-b border-border bg-card">
        <View className="flex-row justify-between items-center mb-4 border-b border-border/50 pb-2">
            <View>
                <Text className="text-subtext text-[10px] font-bold uppercase tracking-widest">Tempo de Treino</Text>
                <Stopwatch startTime={startTime} />
            </View>
            <TouchableOpacity onPress={() => setHistoryVisible(true)} className="bg-background px-3 py-1 rounded border border-border">
                <Text className="text-subtext text-xs font-bold uppercase">Histórico</Text>
            </TouchableOpacity>
        </View>

        <View className="flex-row justify-between items-start">
            <View className="flex-1">
                <Text className="text-text text-2xl font-bold">{currentName}</Text>
                {(target || notes) && (
                    <View className="mt-2 bg-background p-2 rounded-lg self-start border border-border">
                        {target && <Text className="text-primary font-bold text-sm">Meta: {target}</Text>}
                        {notes && <Text className="text-subtext text-xs italic mt-1">{notes}</Text>}
                    </View>
                )}
            </View>
        </View>

        <View className="flex-row justify-between mt-4">
            <Text className="text-subtext">Série Atual: #{(sessionSets?.length || 0) + 1}</Text>
            <View className="flex-row gap-2">
                {routineRest && (
                    <Text className="text-subtext font-bold text-xs bg-background px-2 py-0.5 rounded border border-border">
                        Descanso: {routineRest}s
                    </Text>
                )}
                <Text className="text-primary font-bold uppercase text-xs tracking-wider border border-primary px-2 py-0.5 rounded">
                    {exerciseType === 'duration' ? 'Tempo' : 'Força'}
                </Text>
            </View>
        </View>
      </View>

      <ScrollView className="flex-1 p-4">
        <FlatList
          data={sessionSets}
          scrollEnabled={false}
          keyExtractor={(item) => item.id.toString()}
          ListEmptyComponent={<Text className="text-subtext text-center mt-4">Nenhuma série registrada hoje.</Text>}
          renderItem={({ item }) => (
            <View className="flex-row justify-between items-center bg-card p-3 mb-2 rounded border-l-4 border-success shadow-sm">
              <Text className="text-subtext font-bold">Set {item.setNumber}</Text>
              <Text className="text-text text-lg">
                {item.weightKg > 0 ? `${item.weightKg}kg x ` : ''}
                {item.durationSeconds ? `${item.durationSeconds}s` : `${item.reps} reps`}
              </Text>
              <Text className="text-subtext text-sm">RIR {item.rir}</Text>
            </View>
          )}
        />
      </ScrollView>

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
                    className={`px-12 py-6 rounded-full border-4 shadow-lg ${isActiveSetRunning ? 'bg-danger border-danger/50' : 'bg-success border-success/50'}`}
                >
                    <Text className="text-white font-bold text-xl uppercase tracking-widest">
                        {isActiveSetRunning ? 'PARAR E SALVAR' : 'INICIAR SÉRIE'}
                    </Text>
                </TouchableOpacity>
            </View>
        ) : (
            <>
                <View className="flex-row space-x-4 mb-4">
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
                            onPress={() => Alert.alert('RIR','Repetições na Reserva (0 = Falha)')}
                            className="flex-row items-center gap-1"
                        >
                            <Text className="text-subtext font-bold uppercase text-[10px]">Reserva (RIR)</Text>
                            <View className="bg-background rounded-full w-3 h-3 justify-center items-center border border-border">
                                <Text className="text-subtext text-[8px] font-bold">?</Text>
                            </View>
                        </TouchableOpacity>
                        <View className="bg-primary/10 px-3 py-0.5 rounded-full border border-primary/30">
                            <Text className="text-primary font-bold text-lg">{rir === 0 ? 'FALHA' : rir}</Text>
                        </View>
                    </View>
                    
                    <Slider
                        style={{width: '100%', height: 40}}
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

                <View className="flex-row gap-2">
                    <TouchableOpacity 
                    className="flex-1 bg-primary p-4 rounded-xl items-center active:bg-secondary"
                    onPress={() => handleSaveSet()}
                    >
                    <Text className="text-white font-bold text-lg uppercase tracking-widest">SALVAR</Text>
                    </TouchableOpacity>
                </View>
            </>
        )}

        <View className="mt-4">
            <TouchableOpacity 
                onPress={goToNextOrFinish}
                className={`p-4 rounded-xl items-center border ${nextExercise ? 'bg-background border-primary' : 'bg-danger border-danger'}`}
            >
                <Text className={nextExercise ? 'text-primary font-bold text-lg uppercase' : 'text-white font-bold text-lg uppercase'}>
                    {nextExercise ? 'PRÓXIMO' : 'FINALIZAR'}
                </Text>
            </TouchableOpacity>
        </View>
      </View>

      <Modal visible={historyVisible} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-background p-4">
            <View className="flex-row justify-between items-center mb-4 mt-2">
                <Text className="text-text text-xl font-bold uppercase">Histórico</Text>
                <TouchableOpacity onPress={() => setHistoryVisible(false)}>
                    <Text className="text-secondary font-bold uppercase">Fechar</Text>
                </TouchableOpacity>
            </View>
            <FlatList 
                data={historyData}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => {
                    const date = new Date(item.date);
                    return (
                        <View className="bg-card p-3 mb-2 rounded border border-border flex-row justify-between">
                            <Text className="text-subtext font-mono text-xs">
                                {date.toLocaleDateString()}
                            </Text>
                            <Text className="text-text font-bold">
                                {item.weight}kg x {item.duration ? `${item.duration}s` : item.reps}
                            </Text>
                            {item.rir !== null && <Text className="text-subtext text-xs">RIR {item.rir}</Text>}
                        </View>
                    );
                }}
            />
        </View>
      </Modal>

      <Modal visible={isModalVisible} transparent animationType="fade">
          <View className="flex-1 bg-black/90 justify-center items-center p-8">
              <Text className="text-subtext font-bold text-lg uppercase tracking-widest mb-4">Descansando</Text>
              
              <Text className={`text-8xl font-mono font-bold mb-8 text-primary`}>
                  {timerSeconds ? formatTimer(timerSeconds) : '0:00'}
              </Text>

              <View className="flex-row gap-4 w-full justify-center mb-8">
                  <TouchableOpacity 
                    onPress={() => addTime(30)}
                    className="bg-card p-4 rounded-full w-20 h-20 justify-center items-center border border-border"
                  >
                      <Text className="text-text font-bold text-lg">+30</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={() => addTime(-10)}
                    className="bg-card p-4 rounded-full w-20 h-20 justify-center items-center border border-border"
                  >
                      <Text className="text-text font-bold text-lg">-10</Text>
                  </TouchableOpacity>
              </View>

              <View className="w-full gap-4">
                <TouchableOpacity 
                    onPress={() => setIsModalVisible(false)}
                    className="bg-primary px-12 py-4 rounded-xl items-center"
                >
                    <Text className="text-white font-bold text-xl uppercase tracking-widest">
                        {timerStatus === 'finished' ? 'PRÓXIMA SÉRIE' : 'PULAR'}
                    </Text>
                </TouchableOpacity>

                {nextExercise && (
                    <TouchableOpacity 
                        onPress={() => { setIsModalVisible(false); goToNextOrFinish(); }}
                        className="items-center py-2 mt-8"
                    >
                        <Text className="text-subtext underline uppercase text-xs font-bold">Ir para {nextExercise.name}</Text>
                    </TouchableOpacity>
                )}
              </View>
          </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

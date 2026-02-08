import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useNavigation } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { db } from '../../src/db/client';
import { sessions, routineExercises, exercises, sets } from '../../src/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { Stopwatch } from '../../components/Stopwatch';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { ProgressBar } from '../../components/ProgressBar';
import { Dialog } from '../../components/Dialog';
import Animated, { FadeInLeft } from 'react-native-reanimated';

export default function SessionScreen() {
  const { routineId, routineName } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [routineExs, setRoutineExs] = useState<any[]>([]);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<any>(null);

  // Proteção contra saída acidental
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (e.data.action.type !== 'GO_BACK' && e.data.action.type !== 'POP') {
        return;
      }
      e.preventDefault();
      setPendingNavigation(e.data.action);
      setShowExitDialog(true);
    });

    return unsubscribe;
  }, [navigation]);

  const rIdStr = Array.isArray(routineId) ? routineId[0] : routineId;

  const loadExercises = useCallback(async () => {
      try {
          const data = await db.select({
            id: exercises.id,
            name: exercises.name,
            order: routineExercises.orderIndex,
            target: routineExercises.target,
            notes: routineExercises.notes,
            restSeconds: routineExercises.restSeconds
          })
          .from(routineExercises)
          .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
          .where(eq(routineExercises.routineId, Number(rIdStr)))
          .orderBy(routineExercises.orderIndex);
          
          setRoutineExs(data);
      } catch (e) {
          console.error(e);
      }
  }, [rIdStr]);

  useEffect(() => {
    const initSession = async () => {
      try {
        const now = Date.now();
        setStartTime(now);
        const result = await db.insert(sessions).values({
          routineId: Number(rIdStr),
          routineName: routineName as string,
          startTime: now,
          bodyWeight: 0,
          sRpe: 0,
        }).returning();
        setSessionId(result[0].id);
      } catch (e) {
        console.error(e);
        router.back();
      }
    };
    
    if (rIdStr) {
        initSession();
        loadExercises();
    }
  }, [rIdStr, loadExercises, routineName, router]);

  const finishSession = () => {
    if (!sessionId) return;
    setShowFinishDialog(true);
  };

  const confirmFinish = () => {
    setShowFinishDialog(false);
    router.replace({
      pathname: '/session/finish',
      params: { sessionId, startTime }
    });
  };

  if (!sessionId) return <View className="flex-1 bg-background" />;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{
        headerTitle: () => <Stopwatch startTime={startTime} className="text-white" />,
        headerRight: () => (
          <TouchableOpacity onPress={finishSession} className="bg-danger px-3 py-1.5 rounded-lg shadow-sm">
            <Text className="text-white font-bold text-xs uppercase tracking-wide">FIM</Text>
          </TouchableOpacity>
        ),
      }} />

      <View className="p-4 bg-card border-b border-border shadow-sm mb-2 z-10">
        <Text className="text-subtext uppercase text-[10px] font-black tracking-widest mb-1">Treino Ativo</Text>
        <Text className="text-text text-3xl font-black mb-4 tracking-tight">{routineName}</Text>

        <SessionProgress sessionId={sessionId} routineExs={routineExs} />
      </View>

      <FlatList 
        data={routineExs}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item, index }) => (
          <ExerciseCard 
            exercise={item} 
            sessionId={sessionId} 
            index={index}
            onPress={() => router.push({
              pathname: '/session/exercise',
              params: { 
                  sessionId, 
                  routineId: rIdStr,
                  exerciseId: item.id, 
                  exerciseName: item.name,
                  target: item.target, 
                  notes: item.notes,
                  restSeconds: item.restSeconds?.toString(),
                  startTime: startTime.toString()
              }
            })}
          />
        )}
      />

      <Dialog
        visible={showExitDialog}
        title="Sair do Treino?"
        message="Se você sair agora, o treino ficará aberto em segundo plano. Deseja sair?"
        confirmText="Sair"
        cancelText="Ficar"
        type="destructive"
        onConfirm={() => {
          setShowExitDialog(false);
          if (pendingNavigation) {
            navigation.dispatch(pendingNavigation);
          }
        }}
        onCancel={() => {
          setShowExitDialog(false);
          setPendingNavigation(null);
        }}
      />

      <Dialog
        visible={showFinishDialog}
        title="Finalizar Treino?"
        message="Você ainda pode estar com exercícios pendentes. Deseja finalizar mesmo assim?"
        confirmText="Finalizar"
        cancelText="Continuar Treino"
        type="destructive"
        onConfirm={confirmFinish}
        onCancel={() => setShowFinishDialog(false)}
      />
    </View>
  );
}

function ExerciseCard({ exercise, sessionId, onPress, index }: any) {
  const { data: setsData } = useLiveQuery(
    db.select({ count: count() })
      .from(sets)
      .where(and(eq(sets.sessionId, sessionId), eq(sets.exerciseId, exercise.id)))
  );

  const doneSets = setsData?.[0]?.count || 0;
  const isActive = doneSets > 0;

  return (
    <Animated.View entering={FadeInLeft.delay(index * 100).springify()}>
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className={`p-5 rounded-2xl border flex-row justify-between items-center transition-all ${
          isActive 
            ? 'bg-card border-primary shadow-md' 
            : 'bg-card border-border shadow-sm'
        }`}
      >
        <View className="flex-1">
          <View className="flex-row items-center gap-2 mb-1">
            <Text className={`text-lg font-black tracking-tight ${isActive ? 'text-text' : 'text-subtext'}`}>
              {exercise.name}
            </Text>
            {isActive && (
              <View className="bg-success/10 px-2 py-0.5 rounded-full border border-success/20">
                <Text className="text-success text-[10px] font-bold uppercase tracking-wide">
                  {doneSets} {doneSets === 1 ? 'série' : 'séries'}
                </Text>
              </View>
            )}
          </View>

          {(exercise.target || exercise.notes) && (
              <View className="mt-2 flex-row flex-wrap gap-2">
                  {exercise.target && (
                      <Text className="text-primary text-[10px] bg-primary/5 px-2 py-1 rounded-md border border-primary/10 font-bold uppercase tracking-wide">
                          Meta: {exercise.target}
                      </Text>
                  )}
                  {exercise.notes && (
                      <Text className="text-subtext text-xs italic" numberOfLines={1}>
                        📝 {exercise.notes}
                      </Text>
                  )}
              </View>
          )}

          <Text className={`text-xs mt-3 uppercase font-bold tracking-wider ${isActive ? 'text-text' : 'text-subtext/60'}`}>
            {doneSets > 0 ? 'Em andamento...' : 'Toque para iniciar'}
          </Text>
        </View>

        {doneSets > 0 && (
          <View className="ml-4">
              <View className="w-6 h-6 bg-success rounded-full border-[3px] border-white shadow-sm items-center justify-center">
                <Text className="text-white text-[8px] font-bold">✓</Text>
              </View>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function SessionProgress({ sessionId, routineExs }: { sessionId: number, routineExs: any[] }) {
  const { data: completedData } = useLiveQuery(
    db.select({ exerciseId: sets.exerciseId })
      .from(sets)
      .where(eq(sets.sessionId, sessionId))
      .orderBy(sets.exerciseId)
  );

  const completedExerciseIds = new Set(completedData?.map(s => s.exerciseId) || []);
  const completedCount = completedExerciseIds.size;
  const totalCount = routineExs.length;

  if (totalCount === 0) return null;

  return (
    <View className="mt-4">
      <ProgressBar
        current={completedCount}
        total={totalCount}
        variant="header"
        showLabel={true}
      />
    </View>
  );
}

import { View, Text, FlatList, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useNavigation, useFocusEffect } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import { db } from '../../src/db/client';
import { sessions, routineExercises, exercises, sets } from '../../src/db/schema';
import { and, count, eq, isNull } from 'drizzle-orm';
import { Stopwatch } from '../../components/Stopwatch';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { ProgressBar } from '../../components/ProgressBar';
import { Dialog } from '../../components/Dialog';
import { Toast } from '../../components/Toast';
import Animated, { FadeInLeft } from 'react-native-reanimated';
import { parseTargetSets } from '../../src/utils/exercise';
import { logger } from '@/services/logger';
import { RoutineExercise } from '@/src/types';
import { safeParseParams, sessionParamsSchema } from '@/src/validators/routes';

export default function SessionScreen() {
  const rawParams = useLocalSearchParams();
  const validated = safeParseParams(sessionParamsSchema, rawParams, 'SessionScreen');
  const routineId = validated?.routineId ?? '';
  const routineName = validated?.routineName ?? '';
  const router = useRouter();
  const navigation = useNavigation();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [routineExs, setRoutineExs] = useState<RoutineExercise[]>([]);
  const [showExitDialog, setShowExitDialog] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{ type: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exitToast, setExitToast] = useState({ visible: false, message: '' });
  const lastBackPressTime = useRef<number>(0);

  // Force refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setRefreshKey(prev => prev + 1);
      return () => {};
    }, [])
  );

  // Smart exit protection with toast + double-press
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (e.data.action.type !== 'GO_BACK' && e.data.action.type !== 'POP') {
        return;
      }
      
      e.preventDefault();
      
      const now = Date.now();
      const timeSinceLastPress = now - lastBackPressTime.current;
      
      if (timeSinceLastPress < 2000) {
        // Second press within 2 seconds - show confirmation dialog
        setPendingNavigation(e.data.action);
        setShowExitDialog(true);
        setExitToast({ visible: false, message: '' });
      } else {
        // First press - show toast
        lastBackPressTime.current = now;
        setExitToast({ visible: true, message: 'Pressione novamente para sair' });
        
        // Hide toast after 2 seconds
        setTimeout(() => {
          setExitToast({ visible: false, message: '' });
        }, 2000);
      }
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
          logger.error('Operation failed', e);
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
        logger.error('Operation failed', e);
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
        <Text className="text-subtext uppercase text-xs font-black tracking-widest mb-1">Treino Ativo</Text>
        <Text className="text-text text-2xl font-black mb-3 tracking-tight" numberOfLines={2}>{routineName}</Text>

        <SessionProgress key={`progress-${sessionId}-${refreshKey}`} sessionId={sessionId} routineExs={routineExs} />
      </View>

      <FlatList
        key={`list-${refreshKey}`}
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
        onConfirm={async () => {
          setShowExitDialog(false);
          // If session has no sets, hard-delete it to avoid ghost sessions
          if (sessionId) {
            try {
              const setCount = await db.select({ count: count() })
                .from(sets)
                .where(eq(sets.sessionId, sessionId));
              if (setCount[0]?.count === 0) {
                await db.delete(sessions).where(eq(sessions.id, sessionId));
              }
            } catch (e) {
              logger.error('Failed to cleanup empty session', e);
            }
          }
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

      <Toast
        visible={exitToast.visible}
        message={exitToast.message}
        type="info"
        onHide={() => setExitToast({ visible: false, message: '' })}
      />
    </View>
  );
}

function ExerciseCard({ exercise, sessionId, onPress, index }: any) {
  const { data: setsData } = useLiveQuery(
    db.select({ count: count() })
      .from(sets)
      .where(and(eq(sets.sessionId, sessionId), eq(sets.exerciseId, exercise.id), isNull(sets.deletedAt)))
  );

  const doneSets = setsData?.[0]?.count || 0;
  const targetSets = parseTargetSets(exercise.target);

  // Exercise is "active" if any sets are done
  const isActive = doneSets > 0;

  // Exercise is "complete" only if target sets are met (or if no target, any sets count as complete)
  const isComplete = targetSets !== null ? doneSets >= targetSets : doneSets > 0;

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
            <Text className={`flex-1 text-base font-black tracking-tight ${isActive ? 'text-text' : 'text-subtext'}`} numberOfLines={2}>
              {exercise.name}
            </Text>
            {isActive && (
              <View className="bg-success/10 px-2 py-0.5 rounded-full border border-success/20 flex-shrink-0">
                <Text className="text-success text-xs font-bold uppercase tracking-wide" numberOfLines={1}>
                  {doneSets}/{targetSets || '?'} séries
                </Text>
              </View>
            )}
          </View>

          {(exercise.target || exercise.notes) && (
              <View className="mt-2 flex-row flex-wrap gap-2">
                  {exercise.target && (
                      <Text className="text-primary text-xs bg-primary/5 px-2 py-1 rounded-md border border-primary/10 font-bold uppercase tracking-wide">
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
            {isComplete ? 'Concluído ✓' : isActive ? 'Em andamento...' : 'Toque para iniciar'}
          </Text>
        </View>

        {isComplete && (
          <View className="ml-4">
              <View className="w-6 h-6 bg-success rounded-full border-[3px] border-white shadow-sm items-center justify-center">
                <Text className="text-white text-2xs font-bold">✓</Text>
              </View>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

function SessionProgress({ sessionId, routineExs }: { sessionId: number, routineExs: any[] }) {
  // Fetch all sets for the session - selecting all columns for better live query support
  const { data: allSets } = useLiveQuery(
    db.select()
      .from(sets)
      .where(and(eq(sets.sessionId, sessionId), isNull(sets.deletedAt)))
      .orderBy(sets.id)
  );

  // Count sets per exercise
  const setsPerExercise = new Map<number, number>();
  allSets?.forEach(set => {
    const currentCount = setsPerExercise.get(set.exerciseId) || 0;
    setsPerExercise.set(set.exerciseId, currentCount + 1);
  });

  // Count exercises that have met their target sets
  const completedCount = routineExs.reduce((count, exercise) => {
    const targetSets = parseTargetSets(exercise.target);
    const doneSets = setsPerExercise.get(exercise.id) || 0;

    // Exercise is complete if target is met, or if no target and at least one set done
    if (targetSets !== null) {
      return doneSets >= targetSets ? count + 1 : count;
    }
    return doneSets > 0 ? count + 1 : count;
  }, 0);

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

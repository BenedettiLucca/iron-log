import { View, Text, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { db } from '../../src/db/client';
import { sessions, routineExercises, exercises, sets } from '../../src/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { Stopwatch } from '../../components/Stopwatch';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

export default function SessionScreen() {
  const { routineId, routineName } = useLocalSearchParams();
  const router = useRouter();
  const navigation = useNavigation();
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const [routineExs, setRoutineExs] = useState<any[]>([]);

  // Proteção contra saída acidental
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      // Se for para a tela de finalização, permite sem perguntar
      // Mas como usamos router.replace para finalização, o evento é diferente?
      // Vamos verificar se a ação é POP (voltar)
      
      if (e.data.action.type !== 'GO_BACK' && e.data.action.type !== 'POP') {
        return;
      }

      // Previne a saída padrão
      e.preventDefault();

      Alert.alert(
        'Sair do Treino?',
        'Se você sair agora, o treino ficará aberto em segundo plano. Deseja sair?',
        [
          { text: 'Ficar', style: 'cancel', onPress: () => {} },
          {
            text: 'Sair',
            style: 'destructive',
            onPress: () => navigation.dispatch(e.data.action),
          },
        ]
      );
    });

    return unsubscribe;
  }, [navigation]);

  // Garante que routineId é string única
  const rIdStr = Array.isArray(routineId) ? routineId[0] : routineId;

  const loadExercises = async () => {
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
  };

  // 1. Inicializar Sessão e Carregar Exercícios
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
  }, [rIdStr]);

  const finishSession = () => {
    if (!sessionId) return;
    router.replace({
      pathname: '/session/finish',
      params: { sessionId, startTime }
    });
  };

  if (!sessionId) return <View className="flex-1 bg-background" />;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{
        headerTitle: () => <Stopwatch startTime={startTime} />,
        headerRight: () => (
          <TouchableOpacity onPress={finishSession} className="bg-danger px-3 py-1 rounded">
            <Text className="text-white font-bold text-xs">FIM</Text>
          </TouchableOpacity>
        ),
      }} />

      <View className="p-4 bg-card border-b border-border">
        <Text className="text-subtext uppercase text-xs font-bold tracking-widest mb-1">Treino Atual</Text>
        <Text className="text-text text-2xl font-bold">{routineName}</Text>
      </View>

      <FlatList 
        data={routineExs}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        renderItem={({ item }) => (
          <ExerciseCard 
            exercise={item} 
            sessionId={sessionId} 
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
    </View>
  );
}

// Subcomponente para mostrar status de cada exercício
function ExerciseCard({ exercise, sessionId, onPress }: any) {
  // Query reativa para saber quantos sets já foram feitos deste exercício
  const { data: setsData } = useLiveQuery(
    db.select({ count: count() })
      .from(sets)
      .where(and(eq(sets.sessionId, sessionId), eq(sets.exerciseId, exercise.id)))
  );

  const doneSets = setsData?.[0]?.count || 0;
  const isActive = doneSets > 0;

  return (
    <TouchableOpacity 
      onPress={onPress}
      className={`p-4 rounded-xl border ${isActive ? 'bg-card border-primary shadow-md' : 'bg-card border-border'} flex-row justify-between items-center`}
    >
      <View className="flex-1">
        <Text className={`text-lg font-bold ${isActive ? 'text-text' : 'text-subtext'}`}>
          {exercise.name}
        </Text>
        
        {/* Metadados (Target/Notes) */}
        {(exercise.target || exercise.notes) && (
            <View className="mt-1 flex-row flex-wrap gap-2">
                {exercise.target && (
                    <Text className="text-primary text-xs bg-background px-2 py-0.5 rounded border border-primary/20">
                        Meta: {exercise.target}
                    </Text>
                )}
                {exercise.notes && (
                    <Text className="text-subtext text-xs italic mt-0.5" numberOfLines={1}>
                        {exercise.notes}
                    </Text>
                )}
            </View>
        )}

        <Text className="text-subtext text-sm mt-1">
          {doneSets > 0 ? `${doneSets} séries feitas` : 'Toque para iniciar'}
        </Text>
      </View>
      
      {doneSets > 0 && (
        <View className="ml-2">
            <View className="w-3 h-3 bg-success rounded-full" />
        </View>
      )}
    </TouchableOpacity>
  );
}

import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { db } from '../../src/db/client';
import { exercises, routineExercises } from '../../src/db/schema';
import { useRouter, useFocusEffect } from 'expo-router';
import { Toast } from '../../components/Toast';
import { Card } from '../../components/Card';
import { EmptyState, InlineEmptyState } from '../../components/EmptyState';
import { logger } from '@/services/logger';
import { Colors } from '@/constants/colors';
import { useRoutines } from '@/hooks/use-routines';
import { useSessions } from '@/hooks/use-sessions';

export default function HomeScreen() {
  const router = useRouter();
  const { allRoutines: routinesList, fetchRoutines } = useRoutines();
  const { lastSession, incompleteSession, fetchHomeData } = useSessions();
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    await Promise.all([fetchRoutines(), fetchHomeData()]);
  }, [fetchRoutines, fetchHomeData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const seedDatabase = async () => {
    try {
      const exResult = await db.insert(exercises).values([
        { name: 'Supino Reto (Barra)', defaultRestSeconds: 120 },
        { name: 'Agachamento Livre', defaultRestSeconds: 180 },
        { name: 'Levantamento Terra', defaultRestSeconds: 180 },
        { name: 'Puxada Alta', defaultRestSeconds: 90 },
        { name: 'Desenvolvimento Militar', defaultRestSeconds: 90 },
      ]).returning();

      const { routines } = await import('../../src/db/schema');
      const routineA = await db.insert(routines).values({ 
        name: 'Treino A (Push/Legs)', 
        description: 'Foco em Empurrar e Pernas' 
      }).returning();
      
      const routineB = await db.insert(routines).values({ 
        name: 'Treino B (Pull)', 
        description: 'Foco em Puxar e Posterior' 
      }).returning();

      await db.insert(routineExercises).values([
        { routineId: routineA[0].id, exerciseId: exResult[0].id, orderIndex: 1 },
        { routineId: routineA[0].id, exerciseId: exResult[1].id, orderIndex: 2 },
        { routineId: routineA[0].id, exerciseId: exResult[4].id, orderIndex: 3 },
        { routineId: routineB[0].id, exerciseId: exResult[2].id, orderIndex: 1 },
        { routineId: routineB[0].id, exerciseId: exResult[3].id, orderIndex: 2 },
      ]);

      fetchData();
      setToast({ visible: true, message: 'Banco de dados populado!', type: 'success' });
    } catch (e) {
      logger.error('Operation failed', e);
      setToast({ visible: true, message: 'Falha ao popular banco.', type: 'error' });
    }
  };

  const handleResumeSession = () => {
    if (!incompleteSession) return;
    
    router.push({
      pathname: '/session/exercise',
      params: {
        sessionId: incompleteSession.sessionId,
        routineId: incompleteSession.routineId?.toString(),
        exerciseId: incompleteSession.exerciseId,
        exerciseName: incompleteSession.exerciseName,
        target: incompleteSession.target,
        notes: incompleteSession.notes,
      }
    });
  };

  return (
    <View className="flex-1 bg-background px-4 pb-4">
      {/* Incomplete Session Banner */}
      {incompleteSession && (
        <View className="mt-4">
          <TouchableOpacity 
            onPress={handleResumeSession}
            activeOpacity={0.8}
          >
            <Card className="bg-primary/5 border-2 border-primary/20">
              <View className="flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="text-primary font-bold text-sm uppercase tracking-wider mb-1">Treino em Andamento</Text>
                  <Text className="text-text text-lg font-bold">{incompleteSession.routineName}</Text>
                  <Text className="text-subtext text-xs mt-0.5">
                    {incompleteSession.exerciseName} • Toque para continuar
                  </Text>
                </View>
                <View className="bg-primary px-3 py-2 rounded-lg">
                  <Text className="text-white font-bold text-sm uppercase">Continuar</Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        </View>
      )}

      <View className={`mt-4 ${incompleteSession ? 'mb-4' : 'mb-8'}`}>
        <View className="flex-row justify-between items-center mb-2 px-1">
            <Text className="text-subtext text-xs font-bold uppercase tracking-widest">Última Sessão</Text>
            <TouchableOpacity onPress={() => router.push('/history')}>
                <Text className="text-secondary text-xs font-bold uppercase tracking-wider">Ver Calendário</Text>
            </TouchableOpacity>
        </View>
        
        {lastSession ? (
            <Card
                pressable
                onPress={() => router.push({ pathname: '/session/summary', params: { sessionId: lastSession.id } })}
            >
                <View className="flex-row justify-between items-center">
                    <View>
                        <Text className="text-text font-black text-xl mb-1">{lastSession.routineName}</Text>
                        <Text className="text-subtext text-xs font-medium">
                            {new Date(lastSession.startTime).toLocaleDateString()} • {lastSession.durationMinutes || 0} min • RPE {lastSession.sRpe}
                        </Text>
                    </View>
                    <View className="bg-primary/10 p-2 rounded-full">
                        <Text className="text-primary text-xl">→</Text>
                    </View>
                </View>
            </Card>
        ) : (
            <InlineEmptyState
                icon="💪"
                title="Nenhum treino registrado ainda"
            />
        )}
      </View>

      <View className="flex-row justify-between items-end mb-3 px-1">
        <Text className="text-subtext text-xs font-bold uppercase tracking-widest">Rotinas Disponíveis</Text>
        <TouchableOpacity onPress={() => router.push('/routines')}>
          <Text className="text-primary font-bold text-xs uppercase tracking-wider">Gerenciar</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ gap: 12 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {routinesList && routinesList.length > 0 ? (
          routinesList.map((routine) => (
            <Card
              key={routine.id}
              pressable
              onPress={() => router.push({
                pathname: '/routine/[routineId]',
                params: {
                    routineId: routine.id,
                    routineName: routine.name,
                }
              })}
            >
              <View className="flex-row justify-between items-center">
                <View className="flex-1 mr-4">
                  <Text className="text-text text-xl font-bold mb-1">{routine.name}</Text>
                  <Text className="text-subtext text-sm" numberOfLines={1}>{routine.description}</Text>
                </View>
                <View className="w-10 h-10 bg-primary rounded-full justify-center items-center shadow-sm">
                  <Text className="text-white font-bold text-xl">{'>'}</Text>
                </View>
              </View>
            </Card>
          ))
        ) : (
          <EmptyState
            icon="🏋️"
            title="Nenhuma rotina encontrada"
            description="Comece criando sua primeira rotina de treino ou gere exemplos para começar rapidamente."
            actionLabel="Gerar Rotinas de Exemplo"
            onAction={seedDatabase}
          />
        )}
      </ScrollView>

      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={() => setToast({ ...toast, visible: false })}
      />
    </View>
  );
}

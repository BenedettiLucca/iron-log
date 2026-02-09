import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, RefreshControl } from 'react-native';
import { db } from '../../src/db/client';
import { routines, exercises, routineExercises, sessions } from '../../src/db/schema';
import { useRouter, useFocusEffect } from 'expo-router';
import { desc } from 'drizzle-orm';
import { Toast } from '../../components/Toast';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';

export default function HomeScreen() {
  const router = useRouter();
  const [routinesList, setRoutinesList] = useState<any[]>([]);
  const [lastSession, setLastSession] = useState<any>(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });
  const [refreshing, setRefreshing] = useState(false);

  // Função para buscar dados
  const fetchData = async () => {
    try {
      // 1. Buscando Rotinas
      const rResult = await db.select().from(routines);
      setRoutinesList(rResult);

      // 2. Buscando Última Sessão
      const sResult = await db.select().from(sessions).orderBy(desc(sessions.startTime)).limit(1);
      if (sResult.length > 0) {
          setLastSession(sResult[0]);
      } else {
          setLastSession(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  // Recarrega sempre que a tela ganha foco
  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
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
      console.error(e);
      setToast({ visible: true, message: 'Falha ao popular banco.', type: 'error' });
    }
  };

  return (
    <View className="flex-1 bg-background px-4 pb-4">
      <View className="mb-8 mt-4">
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
            <Card>
                <Text className="text-subtext italic text-center py-2">Nenhum treino registrado.</Text>
            </Card>
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
            tintColor="#E07A5F"
            colors={['#E07A5F']}
          />
        }
      >
        {routinesList && routinesList.length > 0 ? (
          routinesList.map((routine) => (
            <Card
              key={routine.id}
              pressable
              onPress={() => router.push({
                pathname: '/session/[routineId]',
                params: { 
                    routineId: routine.id, 
                    routineName: routine.name,
                    _ts: Date.now() 
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
          <View className="items-center mt-10 px-4">
            <Text className="text-subtext mb-6 text-center">Nenhuma rotina encontrada.</Text>
            <Button 
              title="Gerar Rotinas de Exemplo"
              onPress={seedDatabase}
              variant="secondary"
            />
          </View>
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
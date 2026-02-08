import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { db } from '../../src/db/client';
import { routines, exercises, routineExercises, sessions } from '../../src/db/schema';
import { Link, useRouter, useFocusEffect } from 'expo-router';
import { desc } from 'drizzle-orm';
import { Toast } from '../../components/Toast';

export default function HomeScreen() {
  const router = useRouter();
  const [routinesList, setRoutinesList] = useState<any[]>([]);
  const [lastSession, setLastSession] = useState<any>(null);
  const [toast, setToast] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' | 'info' });

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
      }
    } catch (e) {
      console.error(e);
    }
  };

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
        <View className="flex-row justify-between items-center mb-1">
            <Text className="text-subtext text-sm uppercase tracking-wider font-bold">Última Sessão</Text>
            <TouchableOpacity onPress={() => router.push('/history')}>
                <Text className="text-secondary text-xs font-bold uppercase tracking-wider">Ver Calendário</Text>
            </TouchableOpacity>
        </View>
        
        {lastSession ? (
            <TouchableOpacity 
                onPress={() => router.push({ pathname: '/session/summary', params: { sessionId: lastSession.id } })}
                className="bg-card p-4 rounded-xl border border-border shadow-sm flex-row justify-between items-center"
            >
                <View>
                    <Text className="text-text font-bold text-lg">{lastSession.routineName}</Text>
                    <Text className="text-subtext text-xs mt-1">
                        {new Date(lastSession.startTime).toLocaleDateString()} • {lastSession.durationMinutes || 0} min • RPE {lastSession.sRpe}
                    </Text>
                </View>
                <View className="bg-background p-2 rounded-full border border-border">
                    <Text className="text-primary font-bold text-xs">VER</Text>
                </View>
            </TouchableOpacity>
        ) : (
            <View className="bg-card p-4 rounded-xl border border-border shadow-sm">
                <Text className="text-subtext italic">Nenhum treino registrado.</Text>
            </View>
        )}
      </View>

      <View className="flex-row justify-between items-end mb-3">
        <Text className="text-subtext text-sm uppercase tracking-wider font-bold">Rotinas Disponíveis</Text>
        <TouchableOpacity onPress={() => router.push('/routines')}>
          <Text className="text-primary font-bold text-sm">GERENCIAR</Text>
        </TouchableOpacity>
      </View>
      
      <ScrollView className="flex-1 space-y-4">
        {routinesList && routinesList.length > 0 ? (
          routinesList.map((routine) => (
            <TouchableOpacity 
              key={routine.id}
              className="bg-card p-5 rounded-xl border border-border shadow-sm active:bg-border/50"
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
                <View>
                  <Text className="text-text text-xl font-bold">{routine.name}</Text>
                  <Text className="text-subtext mt-1">{routine.description}</Text>
                </View>
                <View className="w-8 h-8 bg-primary rounded-full justify-center items-center">
                  <Text className="text-white font-bold text-lg">></Text>
                </View>
              </View>
            </TouchableOpacity>
          ))
        ) : (
          <View className="items-center mt-10">
            <Text className="text-subtext mb-4 text-center">Nenhuma rotina encontrada.</Text>
            <TouchableOpacity 
              onPress={seedDatabase}
              className="bg-primary px-6 py-3 rounded-lg"
            >
              <Text className="text-white font-bold">Gerar Rotinas de Exemplo</Text>
            </TouchableOpacity>
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
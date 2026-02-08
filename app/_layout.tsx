import { Stack } from 'expo-router';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from '../src/db/client';
import migrations from '../drizzle/migrations';
import { View, Text, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../global.css';
import { useColorScheme } from '../hooks/use-color-scheme';

export default function Layout() {
  const { success, error } = useMigrations(db, migrations);
  const colorScheme = useColorScheme();

  if (error) {
    return (
      <View className="flex-1 justify-center items-center bg-background p-4">
        <Text className="text-danger text-lg font-bold">Erro na Migração do Banco de Dados</Text>
        <Text className="text-danger mt-2">{error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color="#E07A5F" />
        <Text className="text-text mt-4">Preparando Iron Log...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? '#1D1917' : '#F4F1DE' }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colorScheme === 'dark' ? '#1D1917' : '#E07A5F' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: colorScheme === 'dark' ? '#1D1917' : '#F4F1DE' },
          animation: 'default',
        }}
      >
        {/* O Drawer é a tela principal */}
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />

        {/* Fluxo de Sessão (Stack Pura) */}
        <Stack.Screen name="session/[routineId]" options={{ title: 'Treino Ativo' }} />
        <Stack.Screen name="session/exercise" options={{ title: 'Exercício', headerShown: false }} />
        <Stack.Screen name="session/finish" options={{ title: 'Finalizar' }} />
        <Stack.Screen name="session/summary" options={{ title: 'Resumo' }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

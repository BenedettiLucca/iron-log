import { Stack, useRouter } from 'expo-router';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { db } from '../src/db/client';
import migrations from '../drizzle/migrations';
import { View, Text, ActivityIndicator, Modal, TouchableOpacity } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../global.css';
import { useColorScheme } from '../hooks/use-color-scheme';
import { useEffect, useState } from 'react';
import { notificationService } from '@/services/NotificationService';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { eq } from 'drizzle-orm';
import { sessions } from '../src/db/schema';

// Configure Reanimated to reduce strict warnings for animations during render
import { configureReanimatedLogger } from 'react-native-reanimated/logs';
configureReanimatedLogger({
  strict: false, // Disable strict mode to suppress warnings about reading shared values during render
});

export default function Layout() {
  const { success, error } = useMigrations(db, migrations);
  const colorScheme = useColorScheme();
  const router = useRouter();

  // Session recovery state
  const [recoverySession, setRecoverySession] = useState<any>(null);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);

  // Initialize notifications after migrations complete
  useEffect(() => {
    if (success) {
      notificationService.initialize().catch((err) => {
        console.error('Failed to initialize notifications:', err);
      });
    }
  }, [success]);

  // Check for incomplete session on app startup
  useEffect(() => {
    const checkIncompleteSession = async () => {
      try {
        const sessionJson = await AsyncStorage.getItem('incomplete_session');
        if (!sessionJson) return;

        const sessionContext = JSON.parse(sessionJson);

        // Verify session still exists and hasn't been finished
        const sessionData = await db.select().from(sessions).where(eq(sessions.id, sessionContext.sessionId));

        if (sessionData.length === 0 || sessionData[0].endTime !== null) {
          // Session no longer exists or already finished, clear the marker
          await AsyncStorage.removeItem('incomplete_session');
          return;
        }

        // Session is valid, show recovery dialog
        setRecoverySession(sessionContext);
        setShowRecoveryDialog(true);
      } catch (e) {
        console.error('Error checking incomplete session:', e);
      }
    };

    if (success) {
      checkIncompleteSession();
    }
  }, [success]);

  // Set up notification response listener for deep linking
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const url = response.notification.request.content.data?.url;
        if (url) {
          // Navigate to the URL when notification is tapped
          // The router will handle the navigation
          console.log('Notification tapped, navigating to:', url);
        }
      }
    );

    return () => subscription.remove();
  }, []);

  const handleResumeSession = () => {
    if (!recoverySession) return;
    setShowRecoveryDialog(false);

    router.replace({
      pathname: '/session/exercise',
      params: {
        sessionId: recoverySession.sessionId,
        routineId: recoverySession.routineId?.toString(),
        exerciseId: recoverySession.exerciseId,
        exerciseName: recoverySession.exerciseName,
        target: recoverySession.target,
        notes: recoverySession.notes,
        restSeconds: recoverySession.restSeconds?.toString(),
        startTime: recoverySession.startTime.toString()
      }
    });
  };

  const handleSaveWorkout = () => {
    if (!recoverySession) return;
    setShowRecoveryDialog(false);

    // Clear the marker since user is choosing to finish
    AsyncStorage.removeItem('incomplete_session');

    router.replace({
      pathname: '/session/finish',
      params: {
        sessionId: recoverySession.sessionId,
        startTime: recoverySession.startTime.toString()
      }
    });
  };

  const handleDismissDialog = async () => {
    setShowRecoveryDialog(false);
    // Clear the marker but keep session in DB
    await AsyncStorage.removeItem('incomplete_session');
  };

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

      {/* Session Recovery Dialog */}
      <Modal
        visible={showRecoveryDialog}
        transparent
        animationType="fade"
        onRequestClose={handleDismissDialog}
      >
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 justify-center items-center bg-black/40"
          onPress={handleDismissDialog}
        >
          <TouchableOpacity
            activeOpacity={1}
            className="bg-card rounded-2xl p-6 m-6 max-w-sm w-full shadow-xl"
            onPress={(e) => e.stopPropagation()}
          >
            <Text className="text-text text-xl font-bold mb-3">Retomar Treino?</Text>
            <Text className="text-subtext text-base mb-6 leading-6">
              Você tem um treino em andamento. Deseja continuar ou salvar?
            </Text>

            <View className="flex-col gap-3">
              <TouchableOpacity
                className="py-3 px-4 rounded-xl items-center bg-primary"
                onPress={handleResumeSession}
              >
                <Text className="text-white font-semibold text-base">Retomar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="py-3 px-4 rounded-xl items-center bg-success"
                onPress={handleSaveWorkout}
              >
                <Text className="text-white font-semibold text-base">Salvar Treino</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="py-3 px-4 rounded-xl items-center bg-background border border-border"
                onPress={handleDismissDialog}
              >
                <Text className="text-text font-semibold text-base">Cancelar</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </GestureHandlerRootView>
  );
}

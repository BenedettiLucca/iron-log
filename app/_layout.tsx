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
import { and, eq, isNull } from 'drizzle-orm';
import { sessions } from '../src/db/schema';

// Configure Reanimated to reduce strict warnings for animations during render
import { configureReanimatedLogger } from 'react-native-reanimated';
import { logger } from '@/services/logger';
import { SessionContext } from '@/src/types';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { I18nProvider, useI18n } from '../src/i18n/index';
import { Colors } from '@/constants/colors';

configureReanimatedLogger({
  strict: false, // Disable strict mode to suppress warnings about reading shared values during render
});


function AppStack({ colorScheme }: { colorScheme: string }) {
  const { t } = useI18n();
  return (
    <AppStack colorScheme={colorScheme} />
  );
}

function SessionRecoveryModal({ visible, onResume, onSave, onDismiss, dontShowAgain, setDontShowAgain }: {
  visible: boolean;
  onResume: () => void;
  onSave: () => void;
  onDismiss: () => void;
  dontShowAgain: boolean;
  setDontShowAgain: (v: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <TouchableOpacity activeOpacity={1} className="flex-1 justify-center items-center bg-black/40" onPress={onDismiss}>
        <TouchableOpacity activeOpacity={1} className="bg-card rounded-2xl p-6 m-6 max-w-sm w-full shadow-xl" onPress={(e) => e.stopPropagation()}>
          <Text className="text-text text-xl font-bold mb-3">{t('session.resumeWorkout')}</Text>
          <Text className="text-subtext text-base mb-4 leading-6">{t('session.resumeDescription')}</Text>
          <TouchableOpacity className="flex-row items-center mb-4 py-2" onPress={() => setDontShowAgain(!dontShowAgain)}>
            <View className={`w-5 h-5 rounded border-2 mr-3 justify-center items-center ${dontShowAgain ? 'bg-primary border-primary' : 'border-border bg-card'}`}>
              {dontShowAgain && <Text className="text-white text-xs font-bold">✓</Text>}
            </View>
            <Text className="text-subtext text-sm">{t('session.dontAskAgain')}</Text>
          </TouchableOpacity>
          <View className="flex-col gap-3">
            <TouchableOpacity className="py-3 px-4 rounded-xl items-center bg-primary" onPress={onResume}>
              <Text className="text-white font-semibold text-base">{t('session.resume')}</Text>
            </TouchableOpacity>
            <TouchableOpacity className="py-3 px-4 rounded-xl items-center bg-success" onPress={onSave}>
              <Text className="text-white font-semibold text-base">{t('session.saveWorkout')}</Text>
            </TouchableOpacity>
            <TouchableOpacity className="py-3 px-4 rounded-xl items-center bg-background border border-border" onPress={onDismiss}>
              <Text className="text-text font-semibold text-base">{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

export default function Layout() {
  const { success, error } = useMigrations(db, migrations);
  const colorScheme = useColorScheme();
  const router = useRouter();

  // Session recovery state
  const [recoverySession, setRecoverySession] = useState<SessionContext | null>(null);
  const [showRecoveryDialog, setShowRecoveryDialog] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  // Initialize notifications after migrations complete
  useEffect(() => {
    if (success) {
      notificationService.initialize().catch((err) => {
        logger.error('Failed to initialize notifications', err);
      });
    }
  }, [success]);

  // Check for incomplete session on app startup
  useEffect(() => {
    const checkIncompleteSession = async () => {
      try {
        // Check if user opted out of recovery dialogs
        const skipRecovery = await AsyncStorage.getItem('skip_session_recovery');
        if (skipRecovery === 'true') {
          // Still clear the incomplete session marker but don't show dialog
          const sessionJson = await AsyncStorage.getItem('incomplete_session');
          if (sessionJson) {
            await AsyncStorage.removeItem('incomplete_session');
          }
          return;
        }

        const sessionJson = await AsyncStorage.getItem('incomplete_session');
        if (!sessionJson) return;

        const sessionContext = JSON.parse(sessionJson);

        // Verify session still exists and hasn't been finished
        const sessionData = await db.select().from(sessions).where(and(eq(sessions.id, sessionContext.sessionId), isNull(sessions.deletedAt)));

        if (sessionData.length === 0 || sessionData[0].endTime !== null) {
          // Session no longer exists or already finished, clear the marker
          await AsyncStorage.removeItem('incomplete_session');
          return;
        }

        // Session is valid, show recovery dialog
        setRecoverySession(sessionContext);
        setShowRecoveryDialog(true);
      } catch (e) {
        logger.error('Error checking incomplete session', e);
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
          logger.debug('Notification tapped, navigating to:', url);
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

  const handleSaveWorkout = async () => {
    if (!recoverySession) return;
    setShowRecoveryDialog(false);

    // Clear the marker since user is choosing to finish
    await AsyncStorage.removeItem('incomplete_session');

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
    
    // Save "don't show again" preference if checked
    if (dontShowAgain) {
      await AsyncStorage.setItem('skip_session_recovery', 'true');
    }
    
    // Clear the marker but keep session in DB
    await AsyncStorage.removeItem('incomplete_session');
    
    // Reset checkbox state
    setDontShowAgain(false);
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
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text className="text-text mt-4">Preparando Iron Log...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
    <I18nProvider>
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? Colors.darkBackground : Colors.lightBackground }}>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colorScheme === 'dark' ? Colors.darkBackground : Colors.primary },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: colorScheme === 'dark' ? Colors.darkBackground : Colors.lightBackground },
          animation: 'default',
        }}
      >
        {/* O Drawer é a tela principal */}
        <Stack.Screen name="(drawer)" options={{ headerShown: false }} />

        {/* Pré-visualização de Rotina */}
        <Stack.Screen name="routine/[routineId]" options={{ title: 'Rotina' }} />

        {/* Fluxo de Sessão (Stack Pura) */}
        <Stack.Screen name="session/[routineId]" options={{ title: 'Treino Ativo' }} />
        <Stack.Screen name="session/exercise" options={{ title: 'Exercise', headerShown: false }} />
        <Stack.Screen name="session/finish" options={{ title: 'Finalizar' }} />
        <Stack.Screen name="session/summary" options={{ title: 'Resumo' }} />
      </Stack>

      <SessionRecoveryModal
        visible={showRecoveryDialog}
        onResume={handleResumeSession}
        onSave={handleSaveWorkout}
        onDismiss={handleDismissDialog}
        dontShowAgain={dontShowAgain}
        setDontShowAgain={setDontShowAgain}
      />
    </GestureHandlerRootView>
    </I18nProvider>
    </ErrorBoundary>
  );
}

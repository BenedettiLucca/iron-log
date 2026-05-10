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
import { I18nProvider, useI18n, getNestedValue } from '../src/i18n/index';
import { pt as ptTranslations } from '../src/i18n/translations/pt';
import { Colors } from '@/constants/colors';
import { buildSessionRecoveryA11y } from '@/src/utils/session-recovery-a11y';

configureReanimatedLogger({
  strict: false, // Disable strict mode to suppress warnings about reading shared values during render
});


function AppStack({ colorScheme }: { colorScheme: string }) {
  const { t } = useI18n();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colorScheme === 'dark' ? Colors.darkBackground : Colors.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: 'bold' },
        contentStyle: { backgroundColor: colorScheme === 'dark' ? Colors.darkBackground : Colors.lightBackground },
        animation: 'default',
      }}
    >
      <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      <Stack.Screen name="routine/[routineId]" options={{ title: t('routineDetail.title') }} />
      <Stack.Screen name="session/[routineId]" options={{ title: t('session.activeWorkout') }} />
      <Stack.Screen name="session/exercise" options={{ title: 'Exercise', headerShown: false }} />
      <Stack.Screen name="session/finish" options={{ title: t('finish.title') }} />
      <Stack.Screen name="session/summary" options={{ title: t('summary.title') }} />
    </Stack>
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
  const title = t('session.resumeWorkout');
  const description = t('session.resumeDescription');
  const dontAskAgainLabel = t('session.dontAskAgain');
  const resumeLabel = t('session.resume');
  const saveWorkoutLabel = t('session.saveWorkout');
  const cancelLabel = t('common.cancel');
  const a11y = buildSessionRecoveryA11y({
    title,
    description,
    dontAskAgain: dontAskAgainLabel,
    resume: resumeLabel,
    saveWorkout: saveWorkoutLabel,
    cancel: cancelLabel,
    dismiss: t('session.recoveryDismiss'),
    dismissHint: t('session.recoveryDismissHint'),
    checkboxHint: t('session.dontAskAgainHint'),
  }, dontShowAgain);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View
        className="flex-1 justify-center items-center"
        accessibilityViewIsModal={a11y.modal.accessibilityViewIsModal}
        accessibilityLabel={a11y.modal.accessibilityLabel}
      >
        <TouchableOpacity
          activeOpacity={1}
          className="absolute inset-0 bg-black/40"
          onPress={onDismiss}
          accessibilityRole={a11y.backdrop.accessibilityRole}
          accessibilityLabel={a11y.backdrop.accessibilityLabel}
          accessibilityHint={a11y.backdrop.accessibilityHint}
        />
        <View className="bg-card rounded-2xl p-6 m-6 max-w-sm w-full shadow-xl">
          <Text className="text-text text-xl font-bold mb-3" accessibilityRole="header">{title}</Text>
          <Text className="text-subtext text-base mb-4 leading-6">{description}</Text>
          <TouchableOpacity
            className="flex-row items-center mb-4 py-2"
            onPress={() => setDontShowAgain(!dontShowAgain)}
            accessibilityRole={a11y.dontAskAgainCheckbox.accessibilityRole}
            accessibilityLabel={a11y.dontAskAgainCheckbox.accessibilityLabel}
            accessibilityState={a11y.dontAskAgainCheckbox.accessibilityState}
            accessibilityHint={a11y.dontAskAgainCheckbox.accessibilityHint}
          >
            <View className={`w-5 h-5 rounded border-2 mr-3 justify-center items-center ${dontShowAgain ? 'bg-primary border-primary' : 'border-border bg-card'}`}>
              {dontShowAgain && <Text className="text-white text-xs font-bold">✓</Text>}
            </View>
            <Text className="text-subtext text-sm">{dontAskAgainLabel}</Text>
          </TouchableOpacity>
          <View className="flex-col gap-3">
            <TouchableOpacity
              className="py-3 px-4 rounded-xl items-center bg-primary"
              onPress={onResume}
              accessibilityRole={a11y.actions.resume.accessibilityRole}
              accessibilityLabel={a11y.actions.resume.accessibilityLabel}
            >
              <Text className="text-white font-semibold text-base">{resumeLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="py-3 px-4 rounded-xl items-center bg-success"
              onPress={onSave}
              accessibilityRole={a11y.actions.save.accessibilityRole}
              accessibilityLabel={a11y.actions.save.accessibilityLabel}
            >
              <Text className="text-white font-semibold text-base">{saveWorkoutLabel}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="py-3 px-4 rounded-xl items-center bg-background border border-border"
              onPress={onDismiss}
              accessibilityRole={a11y.actions.cancel.accessibilityRole}
              accessibilityLabel={a11y.actions.cancel.accessibilityLabel}
            >
              <Text className="text-text font-semibold text-base">{cancelLabel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function Layout() {
  const { success, error } = useMigrations(db, migrations);
  const colorScheme = useColorScheme() ?? 'light';
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
        startTime: (recoverySession.startTime ?? Date.now()).toString()
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
        startTime: (recoverySession.startTime ?? Date.now()).toString()
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
        <Text className="text-danger text-lg font-bold">{getNestedValue(ptTranslations, 'common.dbMigrationError') || 'Erro na Migração do Banco de Dados'}</Text>
        <Text className="text-danger mt-2">{error.message}</Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text className="text-text mt-4">{getNestedValue(ptTranslations, 'common.preparingApp') || 'Preparando Iron Log...'}</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
    <I18nProvider>
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colorScheme === 'dark' ? Colors.darkBackground : Colors.lightBackground }}>
      <AppStack colorScheme={colorScheme} />

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

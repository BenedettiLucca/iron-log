import { useState, useEffect, useCallback, useRef } from 'react';
import {
  notificationService,
  NotificationConfig,
  SupplementNotificationTarget,
  NotificationPermissionResult,
  NotificationPermissionStatus,
} from '@/services/NotificationService';
import { supportsNativeNotifications } from '@/src/utils/runtime-environment';
import { logger } from '@/services/logger';

export function useNotifications() {
  const [settings, setSettings] = useState<NotificationConfig>({
    checkinDay: 1,
    checkinHour: 9,
    enabled: true,
  });
  const [loading, setLoading] = useState(true);
  const isNative = supportsNativeNotifications();
  const [permission, setPermission] = useState<NotificationPermissionResult>({
    status: isNative ? 'undetermined' : 'unavailable',
    granted: false,
    canAskAgain: isNative,
    isNative,
  });
  const isMountedRef = useRef(true);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const config = await notificationService.getSettings();
      if (isMountedRef.current) {
        setSettings(config);
      }
    } catch (error) {
      logger.error('Error loading notification settings', error);
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const checkPermissions = useCallback(async (): Promise<NotificationPermissionResult> => {
    try {
      const result = await notificationService.getPermissionStatus();
      if (isMountedRef.current) {
        setPermission(result);
      }
      return result;
    } catch (error) {
      logger.error('Error checking notification permissions', error);
      const fallback: NotificationPermissionResult = {
        status: 'denied',
        granted: false,
        canAskAgain: true,
        isNative: true,
      };
      if (isMountedRef.current) {
        setPermission(fallback);
      }
      return fallback;
    }
  }, []);

  const requestPermissions = useCallback(async (): Promise<NotificationPermissionResult> => {
    try {
      const result = await notificationService.requestPermission();
      if (isMountedRef.current) {
        setPermission(result);
      }
      return result;
    } catch (error) {
      logger.error('Error requesting notification permissions', error);
      const fallback: NotificationPermissionResult = {
        status: 'denied',
        granted: false,
        canAskAgain: true,
        isNative: true,
      };
      if (isMountedRef.current) {
        setPermission(fallback);
      }
      return fallback;
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    loadSettings();
    checkPermissions();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadSettings, checkPermissions]);

  const updateSettings = useCallback(async (config: Partial<NotificationConfig>) => {
    try {
      await notificationService.updateSettings(config);
      setSettings((prev) => ({ ...prev, ...config }));
    } catch (error) {
      logger.error('Error updating notification settings', error);
      throw error;
    }
  }, []);

  const toggleEnabled = useCallback(async () => {
    await updateSettings({ enabled: !settings.enabled });
  }, [settings.enabled, updateSettings]);

  const sendTestNotification = useCallback(async () => {
    await notificationService.sendTestNotification();
  }, []);

  const scheduleSupplementReminder = useCallback(
    async (supplement: SupplementNotificationTarget) => {
      await notificationService.scheduleSupplementReminder(supplement);
    },
    []
  );

  const cancelSupplementReminder = useCallback(async (supplementId: number) => {
    await notificationService.cancelSupplementReminder(supplementId);
  }, []);

  const rescheduleSupplementReminders = useCallback(async () => {
    await notificationService.scheduleAllSupplementReminders();
  }, []);

  return {
    settings,
    loading,
    permission,
    permissionStatus: permission.status as NotificationPermissionStatus,
    checkPermissions,
    getPermissionStatus: checkPermissions,
    requestPermissions,
    requestPermission: requestPermissions,
    updateSettings,
    toggleEnabled,
    sendTestNotification,
    scheduleSupplementReminder,
    cancelSupplementReminder,
    rescheduleSupplementReminders,
    loadSettings,
  };
}

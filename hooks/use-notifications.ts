import { useState, useEffect, useCallback, useRef } from 'react';
import { notificationService, NotificationConfig } from '@/services/NotificationService';
import { logger } from '@/services/logger';

export function useNotifications() {
  const [settings, setSettings] = useState<NotificationConfig>({
    checkinDay: 1,
    checkinHour: 9,
    enabled: true,
  });
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    isMountedRef.current = true;
    loadSettings();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadSettings]);

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

  return {
    settings,
    loading,
    updateSettings,
    toggleEnabled,
    sendTestNotification,
    loadSettings,
  };
}

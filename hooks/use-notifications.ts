import { useState, useEffect } from 'react';
import { notificationService, NotificationConfig } from '@/services/NotificationService';

export function useNotifications() {
  const [settings, setSettings] = useState<NotificationConfig>({
    checkinDay: 1,
    checkinHour: 9,
    enabled: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const config = await notificationService.getSettings();
      setSettings(config);
    } catch (error) {
      console.error('Error loading notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (config: Partial<NotificationConfig>) => {
    try {
      await notificationService.updateSettings(config);
      setSettings((prev) => ({ ...prev, ...config }));
    } catch (error) {
      console.error('Error updating notification settings:', error);
      throw error;
    }
  };

  const toggleEnabled = async () => {
    await updateSettings({ enabled: !settings.enabled });
  };

  const sendTestNotification = async () => {
    await notificationService.sendTestNotification();
  };

  return {
    settings,
    loading,
    updateSettings,
    toggleEnabled,
    sendTestNotification,
    loadSettings,
  };
}

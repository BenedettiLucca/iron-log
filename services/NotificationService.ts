import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { db } from '../src/db/client';
import { notificationSettings } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/services/logger';

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface NotificationConfig {
  checkinDay: number;
  checkinHour: number;
  enabled: boolean;
}

class NotificationService {
  private initialized = false;

  /**
   * Initialize notification system and request permissions
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    if (!Device.isDevice) {
      logger.debug('Notifications: Not a physical device, skipping');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      logger.debug('Notifications: Permission not granted');
      return false;
    }

    // Set up notification response listener
    this.setupResponseListener();

    this.initialized = true;

    // Schedule monthly check-in notification
    await this.scheduleMonthlyCheckin();

    return true;
  }

  /**
   * Set up listener for notification taps
   */
  private setupResponseListener() {
    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      logger.debug('Notification tapped:', data);

      // Handle deep linking based on notification type
      if (data.type === 'monthly_checkin') {
        // The app will handle navigation based on the URL
        // Navigation logic will be handled by the app's router
      }
    });
  }

  /**
   * Get notification settings from database
   */
  async getSettings(): Promise<NotificationConfig> {
    try {
      const settings = await db.select().from(notificationSettings).limit(1);

      if (settings.length === 0) {
        // Create default settings
        const defaultSettings: NotificationConfig = {
          checkinDay: 1,
          checkinHour: 9,
          enabled: true,
        };

        await db.insert(notificationSettings).values(defaultSettings);
        return defaultSettings;
      }

      return {
        checkinDay: settings[0].checkinDay,
        checkinHour: settings[0].checkinHour,
        enabled: settings[0].enabled,
      };
    } catch (error) {
      logger.error('Operation failed', 'Error getting notification settings:', error);
      return {
        checkinDay: 1,
        checkinHour: 9,
        enabled: true,
      };
    }
  }

  /**
   * Update notification settings
   */
  async updateSettings(config: Partial<NotificationConfig>): Promise<void> {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...config };

      // Update database
      const existing = await db.select().from(notificationSettings).limit(1);
      if (existing.length > 0) {
        await db
          .update(notificationSettings)
          .set({
            checkinDay: updated.checkinDay,
            checkinHour: updated.checkinHour,
            enabled: updated.enabled,
          })
          .where(eq(notificationSettings.id, existing[0].id));
      } else {
        await db.insert(notificationSettings).values(updated);
      }

      // Reschedule with new settings
      await this.scheduleMonthlyCheckin();
    } catch (error) {
      logger.error('Operation failed', 'Error updating notification settings:', error);
    }
  }

  /**
   * Schedule monthly check-in notification
   */
  async scheduleMonthlyCheckin(): Promise<void> {
    try {
      // Cancel all existing notifications
      await Notifications.cancelAllScheduledNotificationsAsync();

      const settings = await this.getSettings();

      if (!settings.enabled) {
        return;
      }

      // Calculate next notification date
      const now = new Date();
      const targetDay = Math.min(settings.checkinDay, this.getDaysInMonth(now));
      const targetDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        targetDay,
        settings.checkinHour,
        0,
        0
      );

      // If the date has passed this month, schedule for next month
      if (targetDate <= now) {
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const nextMonthDays = this.getDaysInMonth(nextMonth);
        const adjustedDay = Math.min(settings.checkinDay, nextMonthDays);

        targetDate.setFullYear(nextMonth.getFullYear());
        targetDate.setMonth(nextMonth.getMonth());
        targetDate.setDate(adjustedDay);
      }

      // Schedule the notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '📊 Check-in Mensal',
          body: 'Hora de registrar suas métricas e progresso!',
          data: {
            type: 'monthly_checkin',
            url: '/bio',
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: targetDate,
        },
      });

      logger.debug('Monthly check-in scheduled for:', targetDate.toISOString());
    } catch (error) {
      logger.error('Operation failed', 'Error scheduling monthly check-in:', error);
    }
  }

  /**
   * Get number of days in a month
   */
  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAll(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      logger.error('Operation failed', 'Error canceling notifications:', error);
    }
  }

  /**
   * Send a test notification (for development)
   */
  async sendTestNotification(): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧪 Test Notification',
          body: 'This is a test notification from Iron Log',
          data: {
            type: 'test',
          },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(Date.now() + 1000),
        },
      });
    } catch (error) {
      logger.error('Operation failed', 'Error sending test notification:', error);
    }
  }

}

export const notificationService = new NotificationService();

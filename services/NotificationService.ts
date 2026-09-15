import type * as ExpoNotifications from 'expo-notifications';
import * as Device from 'expo-device';
import { db } from '../src/db/client';
import { notificationSettings, supplements } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '@/services/logger';
import { getTranslation } from '../src/i18n/index';
import { supportsNativeNotifications } from '../src/utils/runtime-environment';

export type NotificationPermissionStatus =
  | 'granted'
  | 'denied'
  | 'blocked'
  | 'undetermined'
  | 'unavailable';

export interface NotificationPermissionResult {
  status: NotificationPermissionStatus;
  granted: boolean;
  canAskAgain: boolean;
  isNative: boolean;
}

export const NOTIFICATION_CATEGORIES = {
  CHECKIN: 'monthly-checkin',
  REST: 'rest-timer',
  SUPPLEMENT_PREFIX: 'supplement-',
} as const;

export const NOTIFICATION_CHANNELS = {
  CHECKIN: 'monthly-checkin',
  SUPPLEMENTS: 'supplements',
  REST: 'rest-timer',
} as const;

let expoNotifications: typeof ExpoNotifications | null = null;

async function getNotificationsModule(): Promise<typeof ExpoNotifications> {
  if (!expoNotifications) {
    const mod = await import('expo-notifications');
    if (typeof mod.setNotificationHandler === 'function') {
      mod.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: true,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
    }
    expoNotifications = mod;
  }
  return expoNotifications;
}

export interface NotificationConfig {
  checkinDay: number;
  checkinHour: number;
  enabled: boolean;
}

export interface SupplementNotificationTarget {
  id: number;
  name: string;
  dosage?: string | null;
  reminderTime?: string | null;
  isActive?: boolean | null;
}

const CHECKIN_NOTIFICATION_ID = 'monthly-checkin';
const CHECKIN_CHANNEL_ID = 'monthly-checkin';
const SUPPLEMENT_CHANNEL_ID = 'supplements';
const REST_NOTIFICATION_ID = 'rest-timer';

export function parseReminderTime(timeStr: string | null | undefined): { hour: number; minute: number } | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  if (isNaN(hour) || isNaN(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }
  return { hour, minute };
}

export function isValidReminderTime(timeStr: string | null | undefined): boolean {
  if (timeStr === null || timeStr === undefined || timeStr.trim() === '') return true;
  return parseReminderTime(timeStr) !== null;
}

function parsePermissionResult(
  result: ExpoNotifications.NotificationPermissionsStatus | undefined | null,
  isNative: boolean
): NotificationPermissionResult {
  if (!result) {
    return {
      status: 'undetermined',
      granted: false,
      canAskAgain: true,
      isNative,
    };
  }

  const granted = Boolean(result.granted || result.status === 'granted');
  const canAskAgain = result.canAskAgain ?? !granted;

  if (granted) {
    return {
      status: 'granted',
      granted: true,
      canAskAgain,
      isNative,
    };
  }

  if (!canAskAgain) {
    return {
      status: 'blocked',
      granted: false,
      canAskAgain: false,
      isNative,
    };
  }

  if (result.status === 'undetermined') {
    return {
      status: 'undetermined',
      granted: false,
      canAskAgain: true,
      isNative,
    };
  }

  return {
    status: 'denied',
    granted: false,
    canAskAgain: true,
    isNative,
  };
}

class NotificationService {
  private initialized = false;

  /**
   * Get current notification permission status.
   * In Expo Go (storeClient), returns unavailable without calling incompatible APIs.
   */
  async getPermissionStatus(executionEnvironment?: string): Promise<NotificationPermissionResult> {
    const isNative = supportsNativeNotifications(executionEnvironment);
    if (!isNative) {
      return {
        status: 'unavailable',
        granted: false,
        canAskAgain: false,
        isNative: false,
      };
    }

    try {
      const Notifications = await getNotificationsModule();
      if (typeof Notifications.getPermissionsAsync !== 'function') {
        return {
          status: 'unavailable',
          granted: false,
          canAskAgain: false,
          isNative: true,
        };
      }
      const result = await Notifications.getPermissionsAsync();
      return parsePermissionResult(result, true);
    } catch (error) {
      logger.error('Error querying notification permissions', error);
      return {
        status: 'denied',
        granted: false,
        canAskAgain: true,
        isNative: true,
      };
    }
  }

  /**
   * Request notification permission contextually.
   * In Expo Go (storeClient), returns unavailable without calling incompatible APIs.
   */
  async requestPermission(executionEnvironment?: string): Promise<NotificationPermissionResult> {
    const isNative = supportsNativeNotifications(executionEnvironment);
    if (!isNative) {
      logger.debug('Notifications: Native permission request skipped in Expo Go');
      return {
        status: 'unavailable',
        granted: false,
        canAskAgain: false,
        isNative: false,
      };
    }

    try {
      const Notifications = await getNotificationsModule();
      if (typeof Notifications.requestPermissionsAsync !== 'function') {
        return {
          status: 'unavailable',
          granted: false,
          canAskAgain: false,
          isNative: true,
        };
      }
      const result = await Notifications.requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
      return parsePermissionResult(result, true);
    } catch (error) {
      logger.error('Error requesting notification permissions', error);
      return {
        status: 'denied',
        granted: false,
        canAskAgain: true,
        isNative: true,
      };
    }
  }

  async requestPermissions(executionEnvironment?: string): Promise<NotificationPermissionResult> {
    return this.requestPermission(executionEnvironment);
  }

  /**
   * Initialize notification channels and schedule configured reminders.
   * Deliberately avoids getPermissionsAsync / requestPermissionsAsync in Expo Go.
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    if (!Device.isDevice) {
      logger.debug('Notifications: Not a physical device, skipping');
      return false;
    }

    try {
      const Notifications = await getNotificationsModule();
      await Notifications.setNotificationChannelAsync(CHECKIN_CHANNEL_ID, {
        name: 'Check-in Mensal',
        importance: Notifications.AndroidImportance.HIGH,
      });
      await Notifications.setNotificationChannelAsync(SUPPLEMENT_CHANNEL_ID, {
        name: 'Suplementos',
        importance: Notifications.AndroidImportance.HIGH,
      });
    } catch (err) {
      logger.error('Error creating notification channels', err);
    }

    this.initialized = true;

    await this.scheduleMonthlyCheckin();
    await this.scheduleAllSupplementReminders();

    return true;
  }

  /**
   * Get notification settings from database
   */
  async getSettings(): Promise<NotificationConfig> {
    try {
      const settings = await db.select().from(notificationSettings).limit(1);

      if (settings.length === 0) {
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
      logger.error('Error getting notification settings', error);
      return {
        checkinDay: 1,
        checkinHour: 9,
        enabled: true,
      };
    }
  }

  /**
   * Update notification settings and reschedule / cancel active reminders
   */
  async updateSettings(config: Partial<NotificationConfig>): Promise<void> {
    try {
      const current = await this.getSettings();
      const updated = { ...current, ...config };

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

      if (updated.enabled) {
        await this.scheduleMonthlyCheckin();
        await this.scheduleAllSupplementReminders();
      } else {
        await this.cancelCheckinNotification();
        await this.cancelAllSupplementReminders();
      }
    } catch (error) {
      logger.error('Error updating notification settings', error);
      throw error;
    }
  }

  /**
   * Schedule monthly check-in notification
   */
  async scheduleMonthlyCheckin(): Promise<void> {
    try {
      const settings = await this.getSettings();

      if (!settings.enabled) {
        await this.cancelCheckinNotification();
        return;
      }

      const Notifications = await getNotificationsModule();

      try {
        await Notifications.setNotificationChannelAsync(CHECKIN_CHANNEL_ID, {
          name: 'Check-in Mensal',
          importance: Notifications.AndroidImportance.HIGH,
        });
      } catch {
        // Channel setup is best effort on Android
      }

      const now = new Date();
      const targetDay = Math.min(settings.checkinDay, this.getDaysInMonth(now));
      let targetDate = new Date(
        now.getFullYear(),
        now.getMonth(),
        targetDay,
        settings.checkinHour,
        0,
        0
      );

      if (targetDate <= now) {
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        const nextMonthDays = this.getDaysInMonth(nextMonth);
        const adjustedDay = Math.min(settings.checkinDay, nextMonthDays);

        targetDate = new Date(
          nextMonth.getFullYear(),
          nextMonth.getMonth(),
          adjustedDay,
          settings.checkinHour,
          0,
          0
        );
      }

      await this.cancelCheckinNotification();

      const title = await getTranslation('notifications.checkinTitle');
      const body = await getTranslation('notifications.checkinBody');

      await Notifications.scheduleNotificationAsync({
        identifier: CHECKIN_NOTIFICATION_ID,
        content: {
          title,
          body,
          data: {
            type: 'monthly_checkin',
            url: '/bio/checkin',
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
      logger.error('Error scheduling monthly check-in', error);
    }
  }

  /**
   * Cancel monthly check-in notification
   */
  async cancelCheckinNotification(): Promise<void> {
    try {
      const Notifications = await getNotificationsModule();
      await Notifications.cancelScheduledNotificationAsync(CHECKIN_NOTIFICATION_ID);
    } catch (error) {
      logger.error('Error cancelling check-in notification', error);
    }
  }

  /**
   * Schedule or reschedule a single supplement reminder
   */
  async scheduleSupplementReminder(supplement: SupplementNotificationTarget): Promise<boolean> {
    try {
      const identifier = `supplement-${supplement.id}`;
      const settings = await this.getSettings();

      if (!settings.enabled || supplement.isActive === false || !supplement.reminderTime) {
        await this.cancelSupplementReminder(supplement.id);
        return false;
      }

      const parsedTime = parseReminderTime(supplement.reminderTime);
      if (!parsedTime) {
        await this.cancelSupplementReminder(supplement.id);
        return false;
      }

      const Notifications = await getNotificationsModule();

      try {
        await Notifications.setNotificationChannelAsync(SUPPLEMENT_CHANNEL_ID, {
          name: 'Suplementos',
          importance: Notifications.AndroidImportance.HIGH,
        });
      } catch {
        // Best effort channel creation
      }

      await this.cancelSupplementReminder(supplement.id);

      const title = await getTranslation('notifications.supplementTitle');
      const body = supplement.dosage
        ? await getTranslation('notifications.supplementBody', {
            name: supplement.name,
            dosage: supplement.dosage,
          })
        : await getTranslation('notifications.supplementBodyNoDosage', {
            name: supplement.name,
          });

      const trigger: ExpoNotifications.NotificationTriggerInput = {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: parsedTime.hour,
        minute: parsedTime.minute,
      };

      await Notifications.scheduleNotificationAsync({
        identifier,
        content: {
          title,
          body,
          data: {
            type: 'supplement_reminder',
            supplementId: supplement.id,
            url: '/supplements',
          },
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger,
      });

      logger.debug(`Supplement reminder scheduled for supplement ${supplement.id} at ${supplement.reminderTime}`);
      return true;
    } catch (error) {
      logger.error(`Error scheduling supplement reminder ${supplement.id}`, error);
      return false;
    }
  }

  /**
   * Cancel reminder for a specific supplement
   */
  async cancelSupplementReminder(supplementId: number): Promise<void> {
    try {
      const Notifications = await getNotificationsModule();
      await Notifications.cancelScheduledNotificationAsync(`supplement-${supplementId}`);
    } catch (error) {
      logger.error(`Error cancelling supplement reminder ${supplementId}`, error);
    }
  }

  /**
   * Schedule all active supplements with reminderTime configured
   */
  async scheduleAllSupplementReminders(): Promise<void> {
    try {
      const settings = await this.getSettings();
      if (!settings.enabled) {
        await this.cancelAllSupplementReminders();
        return;
      }

      const activeSupplements = await db
        .select()
        .from(supplements)
        .where(eq(supplements.isActive, true));

      for (const supp of activeSupplements) {
        if (supp.reminderTime) {
          await this.scheduleSupplementReminder(supp);
        } else {
          await this.cancelSupplementReminder(supp.id);
        }
      }
    } catch (error) {
      logger.error('Error scheduling all supplement reminders', error);
    }
  }

  /**
   * Cancel reminders for all supplements in database
   */
  async cancelAllSupplementReminders(): Promise<void> {
    try {
      const Notifications = await getNotificationsModule();
      if (typeof Notifications.getAllScheduledNotificationsAsync === 'function') {
        try {
          const scheduled = await Notifications.getAllScheduledNotificationsAsync();
          for (const notif of scheduled) {
            if (notif.identifier && notif.identifier.startsWith(NOTIFICATION_CATEGORIES.SUPPLEMENT_PREFIX)) {
              await Notifications.cancelScheduledNotificationAsync(notif.identifier);
            }
          }
        } catch {
          // Best effort if querying scheduled notifications fails
        }
      }
      const allSupplements = await db.select().from(supplements);
      for (const supp of allSupplements) {
        try {
          await Notifications.cancelScheduledNotificationAsync(`supplement-${supp.id}`);
        } catch {}
      }
    } catch (error) {
      logger.error('Error cancelling all supplement reminders', error);
    }
  }

  /**
   * Get number of days in a month
   */
  private getDaysInMonth(date: Date): number {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  /**
   * Cancel scheduled notifications for check-in and supplements,
   * without affecting active rest timer notifications.
   */
  async cancelAll(): Promise<void> {
    try {
      await this.cancelCheckinNotification();
      await this.cancelAllSupplementReminders();
    } catch (error) {
      logger.error('Error canceling notifications', error);
    }
  }

  cleanup(): void {
    this.initialized = false;
    expoNotifications = null;
  }

  /**
   * Send a test notification (for settings / development)
   */
  async sendTestNotification(): Promise<void> {
    try {
      const Notifications = await getNotificationsModule();
      const title = await getTranslation('notifications.testTitle');
      const body = await getTranslation('notifications.testBody');

      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
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
      logger.error('Error sending test notification', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();

export async function scheduleRestNotification(opts: { seconds: number; exerciseName?: string }): Promise<void> {
  if (opts.seconds <= 0) return;

  try {
    const Notifications = await getNotificationsModule();
    await Notifications.setNotificationChannelAsync(REST_NOTIFICATION_ID, {
      name: 'Descanso',
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.cancelScheduledNotificationAsync(REST_NOTIFICATION_ID);

    const title = await getTranslation('notifications.restTitle');
    const body = opts.exerciseName
      ? await getTranslation('notifications.restBodyNext', { name: opts.exerciseName })
      : await getTranslation('notifications.restBodyDefault');

    await Notifications.scheduleNotificationAsync({
      identifier: REST_NOTIFICATION_ID,
      content: {
        title,
        body,
        data: {
          type: 'rest_complete',
          exerciseName: opts.exerciseName,
        },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: opts.seconds,
      },
    });
    if (__DEV__) {
      console.log('[QA#89] rest notification scheduled', { seconds: opts.seconds });
    }
  } catch (error) {
    logger.error('Error scheduling rest notification', error);
  }
}

export async function cancelRestNotification(): Promise<void> {
  try {
    const Notifications = await getNotificationsModule();
    await Notifications.cancelScheduledNotificationAsync(REST_NOTIFICATION_ID);
  } catch (error) {
    logger.error('Error canceling rest notification', error);
  }
}

export async function getNotificationPermissionStatus(
  executionEnvironment?: string
): Promise<NotificationPermissionResult> {
  return notificationService.getPermissionStatus(executionEnvironment);
}

export async function requestNotificationPermission(
  executionEnvironment?: string
): Promise<NotificationPermissionResult> {
  return notificationService.requestPermission(executionEnvironment);
}

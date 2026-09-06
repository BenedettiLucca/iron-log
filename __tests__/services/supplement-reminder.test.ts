import * as Notifications from 'expo-notifications';
import { notificationService, scheduleRestNotification, cancelRestNotification } from '@/services/NotificationService';
import { getTranslation, translate } from '@/src/i18n/index';

const mockSelectFrom = jest.fn();
const mockInsertValues = jest.fn();
const mockUpdateSet = jest.fn();
const mockWhere = jest.fn();

let mockNotificationSettingsRows: Array<{
  id: number;
  checkinDay: number;
  checkinHour: number;
  enabled: boolean;
  lastNotificationDate: number | null;
}> = [
  {
    id: 1,
    checkinDay: 1,
    checkinHour: 9,
    enabled: true,
    lastNotificationDate: null,
  },
];

let mockSupplementsRows: Array<{
  id: number;
  name: string;
  dosage: string;
  timing: string;
  frequency: string;
  reminderTime: string | null;
  isNighttime: boolean;
  emoji: string;
  orderIndex: number;
  isActive: boolean;
}> = [];

jest.mock('@/src/db/client', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        mockSelectFrom(table);
        return {
          limit: (n: number) => {
            return Promise.resolve(mockNotificationSettingsRows.slice(0, n));
          },
          where: (clause: unknown) => {
            mockWhere(clause);
            return Promise.resolve(
              mockSupplementsRows.filter((s) => s.isActive)
            );
          },
          then: (resolve: (val: unknown) => unknown) => {
            return Promise.resolve(mockSupplementsRows).then(resolve);
          },
        };
      },
    }),
    insert: (table: unknown) => ({
      values: (val: unknown) => {
        mockInsertValues(table, val);
        if (Array.isArray(val)) {
          mockNotificationSettingsRows.push(...(val as typeof mockNotificationSettingsRows));
        } else {
          mockNotificationSettingsRows.push(val as (typeof mockNotificationSettingsRows)[0]);
        }
        return Promise.resolve();
      },
    }),
    update: (table: unknown) => ({
      set: (val: Partial<(typeof mockNotificationSettingsRows)[0]>) => {
        mockUpdateSet(table, val);
        if (mockNotificationSettingsRows.length > 0) {
          Object.assign(mockNotificationSettingsRows[0], val);
        }
        return {
          where: (clause: unknown) => {
            mockWhere(clause);
            return Promise.resolve();
          },
        };
      },
    }),
  },
}));

describe('Supplement Reminder & i18n Notification Service (#107)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationSettingsRows = [
      {
        id: 1,
        checkinDay: 1,
        checkinHour: 9,
        enabled: true,
        lastNotificationDate: null,
      },
    ];
    mockSupplementsRows = [
      {
        id: 10,
        name: 'Creatina',
        dosage: '5g',
        timing: 'pós-treino',
        frequency: 'daily',
        reminderTime: '08:30',
        isNighttime: false,
        emoji: '💊',
        orderIndex: 0,
        isActive: true,
      },
      {
        id: 11,
        name: 'Magnésio',
        dosage: '400mg',
        timing: 'noite',
        frequency: 'daily',
        reminderTime: '21:00',
        isNighttime: true,
        emoji: '🌙',
        orderIndex: 1,
        isActive: true,
      },
    ];
  });

  describe('scheduleSupplementReminder', () => {
    it('schedules notification for enabled supplement with reminderTime', async () => {
      await notificationService.scheduleSupplementReminder({
        id: 10,
        name: 'Creatina',
        dosage: '5g',
        reminderTime: '08:30',
        isActive: true,
      });

      expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
        'supplements',
        expect.objectContaining({ name: 'Suplementos' })
      );
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-10');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'supplement-10',
          content: expect.objectContaining({
            title: expect.any(String),
            body: expect.stringContaining('Creatina'),
            data: expect.objectContaining({
              type: 'supplement_reminder',
              supplementId: 10,
            }),
          }),
          trigger: expect.objectContaining({
            hour: 8,
            minute: 30,
          }),
        })
      );
    });

    it('uses body without dosage placeholder if dosage is omitted', async () => {
      await notificationService.scheduleSupplementReminder({
        id: 12,
        name: 'Multivitamínico',
        reminderTime: '07:00',
        isActive: true,
      });

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'supplement-12',
          content: expect.objectContaining({
            body: expect.stringContaining('Multivitamínico'),
          }),
          trigger: expect.objectContaining({
            hour: 7,
            minute: 0,
          }),
        })
      );
    });

    it('cancels scheduled notification if reminderTime is missing or invalid', async () => {
      await notificationService.scheduleSupplementReminder({
        id: 13,
        name: 'Whey',
        reminderTime: null,
        isActive: true,
      });

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-13');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();

      jest.clearAllMocks();
      await notificationService.scheduleSupplementReminder({
        id: 13,
        name: 'Whey',
        reminderTime: 'invalid-time',
        isActive: true,
      });

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-13');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('cancels scheduled notification if supplement is inactive', async () => {
      await notificationService.scheduleSupplementReminder({
        id: 14,
        name: 'Cafeína',
        reminderTime: '06:30',
        isActive: false,
      });

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-14');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('cancels scheduled notification if global notifications are disabled', async () => {
      mockNotificationSettingsRows[0].enabled = false;

      await notificationService.scheduleSupplementReminder({
        id: 10,
        name: 'Creatina',
        dosage: '5g',
        reminderTime: '08:30',
        isActive: true,
      });

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-10');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('cancelSupplementReminder & cancelAllSupplementReminders', () => {
    it('cancels a single supplement reminder by id', async () => {
      await notificationService.cancelSupplementReminder(10);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-10');
    });

    it('cancels all supplement reminders', async () => {
      await notificationService.cancelAllSupplementReminders();
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-10');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-11');
    });
  });

  describe('scheduleAllSupplementReminders', () => {
    it('schedules all active supplements with reminderTime', async () => {
      await notificationService.scheduleAllSupplementReminders();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'supplement-10',
          trigger: expect.objectContaining({ hour: 8, minute: 30 }),
        })
      );
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'supplement-11',
          trigger: expect.objectContaining({ hour: 21, minute: 0 }),
        })
      );
    });

    it('cancels all reminders when notifications are disabled', async () => {
      mockNotificationSettingsRows[0].enabled = false;
      await notificationService.scheduleAllSupplementReminders();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-10');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-11');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('updateSettings', () => {
    it('reschedules check-in and supplement reminders when enabled', async () => {
      mockNotificationSettingsRows[0].enabled = false;
      await notificationService.updateSettings({ enabled: true });

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: 'monthly-checkin' })
      );
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: 'supplement-10' })
      );
    });

    it('cancels check-in and supplement reminders when disabled', async () => {
      mockNotificationSettingsRows[0].enabled = true;
      await notificationService.updateSettings({ enabled: false });

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('monthly-checkin');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-10');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-11');
    });
  });

  describe('i18n notification resolution', () => {
    it('translates strings across all 4 locales (pt, en, es, zh)', () => {
      for (const lang of ['pt', 'en', 'es', 'zh'] as const) {
        const checkinTitle = translate('notifications.checkinTitle', undefined, lang);
        const checkinBody = translate('notifications.checkinBody', undefined, lang);
        const suppTitle = translate('notifications.supplementTitle', undefined, lang);
        const suppBody = translate('notifications.supplementBody', { name: 'Creatina', dosage: '5g' }, lang);
        const restTitle = translate('notifications.restTitle', undefined, lang);
        const restBodyNext = translate('notifications.restBodyNext', { name: 'Supino' }, lang);

        expect(checkinTitle).not.toBe('notifications.checkinTitle');
        expect(checkinBody).not.toBe('notifications.checkinBody');
        expect(suppTitle).not.toBe('notifications.supplementTitle');
        expect(suppBody).toContain('Creatina');
        expect(suppBody).toContain('5g');
        expect(restTitle).not.toBe('notifications.restTitle');
        expect(restBodyNext).toContain('Supino');
      }
    });

    it('provides getTranslation helper returning active language translation', async () => {
      const checkinTitle = await getTranslation('notifications.checkinTitle');
      expect(checkinTitle).toBeDefined();
      expect(checkinTitle.length).toBeGreaterThan(3);
    });
  });

  describe('Rest & Test notifications with i18n copy', () => {
    it('schedules rest notification with i18n copy', async () => {
      await scheduleRestNotification({ seconds: 60, exerciseName: 'Supino Reto' });
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'rest-timer',
          content: expect.objectContaining({
            title: expect.any(String),
            body: expect.stringContaining('Supino Reto'),
          }),
        })
      );
    });

    it('cancels rest notification', async () => {
      await cancelRestNotification();
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('rest-timer');
    });

    it('sends test notification with i18n copy', async () => {
      await notificationService.sendTestNotification();
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            title: expect.any(String),
            body: expect.any(String),
          }),
        })
      );
    });
  });
});

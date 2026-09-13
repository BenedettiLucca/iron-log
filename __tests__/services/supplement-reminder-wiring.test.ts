import * as Notifications from 'expo-notifications';
import { renderHook, act } from '@testing-library/react-native';
import { useSupplements } from '@/hooks/use-supplements';
import {
  notificationService,
  scheduleRestNotification,
  isValidReminderTime,
  parseReminderTime,
} from '@/services/NotificationService';
import { translate } from '@/src/i18n/index';

// Mocks
const mockSelectFrom = jest.fn();
const mockInsertValues = jest.fn();
const mockUpdateSet = jest.fn();
const mockWhere = jest.fn();

let mockNotificationSettingsRows: {
  id: number;
  checkinDay: number;
  checkinHour: number;
  enabled: boolean;
  lastNotificationDate: number | null;
}[] = [
  {
    id: 1,
    checkinDay: 1,
    checkinHour: 9,
    enabled: true,
    lastNotificationDate: null,
  },
];

let mockSupplementsRows: {
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
}[] = [];

let shouldDbFail = false;

jest.mock('@/src/db/client', () => ({
  db: {
    select: (fields?: unknown) => ({
      from: (table: unknown) => {
        mockSelectFrom(table);
        return {
          limit: (n: number) => {
            if (shouldDbFail) return Promise.reject(new Error('DB failure'));
            return Promise.resolve(mockNotificationSettingsRows.slice(0, n));
          },
          where: (clause: unknown) => {
            mockWhere(clause);
            return {
              limit: (n: number) => {
                if (shouldDbFail) return Promise.reject(new Error('DB failure'));
                return Promise.resolve(mockSupplementsRows.slice(0, n));
              },
              orderBy: () => {
                if (shouldDbFail) return Promise.reject(new Error('DB failure'));
                return Promise.resolve(mockSupplementsRows.filter((s) => s.isActive));
              },
              then: (resolve: (val: unknown) => unknown) => {
                if (shouldDbFail) return Promise.reject(new Error('DB failure'));
                return Promise.resolve(mockSupplementsRows.filter((s) => s.isActive)).then(resolve);
              },
            };
          },
          orderBy: () => {
            if (shouldDbFail) return Promise.reject(new Error('DB failure'));
            return Promise.resolve(mockSupplementsRows.filter((s) => s.isActive));
          },
          then: (resolve: (val: unknown) => unknown) => {
            if (shouldDbFail) return Promise.reject(new Error('DB failure'));
            return Promise.resolve(mockSupplementsRows).then(resolve);
          },
        };
      },
    }),
    insert: (table: unknown) => ({
      values: (val: any) => {
        if (shouldDbFail) {
          return {
            returning: () => Promise.reject(new Error('DB insert failed')),
            then: (_resolve: any, reject: any) => Promise.reject(new Error('DB insert failed')).then(_resolve, reject),
          };
        }
        mockInsertValues(table, val);
        const newId = (mockSupplementsRows.length > 0
          ? Math.max(...mockSupplementsRows.map((s) => s.id))
          : 0) + 1;
        const insertedRow = {
          id: newId,
          name: val.name || '',
          dosage: val.dosage || '',
          timing: val.timing || '',
          frequency: val.frequency || 'daily',
          reminderTime: val.reminderTime ?? null,
          isNighttime: Boolean(val.isNighttime),
          emoji: val.emoji || '💊',
          orderIndex: val.orderIndex ?? mockSupplementsRows.length,
          isActive: val.isActive !== undefined ? Boolean(val.isActive) : true,
        };
        mockSupplementsRows.push(insertedRow);
        return {
          returning: () => Promise.resolve([insertedRow]),
          then: (resolve: (val: unknown) => unknown) => Promise.resolve([insertedRow]).then(resolve),
        };
      },
    }),
    update: (table: unknown) => ({
      set: (val: any) => {
        if (shouldDbFail) {
          return {
            where: () => Promise.reject(new Error('DB update failed')),
          };
        }
        mockUpdateSet(table, val);
        return {
          where: (clause: unknown) => {
            mockWhere(clause);
            // Apply updates to matching rows if id is known
            return {
              returning: () => {
                return Promise.resolve(mockSupplementsRows.slice(0, 1));
              },
              then: (resolve: (val: unknown) => unknown) => {
                return Promise.resolve().then(resolve);
              },
            };
          },
        };
      },
    }),
  },
}));

describe('T17B — Supplement Reminders Immediate Wiring and ID Isolation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    shouldDbFail = false;
    notificationService.cleanup();
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
        name: 'Creatina Monohidratada',
        dosage: '5g',
        timing: 'qualquer hora',
        frequency: 'daily',
        reminderTime: '08:00',
        isNighttime: false,
        emoji: '💊',
        orderIndex: 0,
        isActive: true,
      },
      {
        id: 20,
        name: 'Magnésio Bisglicinato',
        dosage: '400mg',
        timing: 'antes de dormir',
        frequency: 'daily',
        reminderTime: '21:30',
        isNighttime: true,
        emoji: '🧪',
        orderIndex: 1,
        isActive: true,
      },
    ];
  });

  describe('Immediate trigger resync on Create / Add', () => {
    it('schedules notification immediately with isolated identifier when reminderTime is present', async () => {
      const { result } = renderHook(() => useSupplements());

      let success = false;
      await act(async () => {
        success = await result.current.addSupplement({
          name: 'Vitamina D3',
          dosage: '2000 UI',
          timing: 'manhã',
          frequency: 'daily',
          reminderTime: '07:30',
          isNighttime: false,
          emoji: '☀️',
          orderIndex: 2,
          isActive: true,
        });
      });

      expect(success).toBe(true);
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'supplement-21',
          content: expect.objectContaining({
            data: expect.objectContaining({
              supplementId: 21,
              type: 'supplement_reminder',
            }),
          }),
          trigger: expect.objectContaining({
            hour: 7,
            minute: 30,
          }),
        })
      );
    });

    it('cancels target identifier and does not schedule when reminderTime is null/empty', async () => {
      const { result } = renderHook(() => useSupplements());

      let success = false;
      await act(async () => {
        success = await result.current.addSupplement({
          name: 'Whey Protein',
          dosage: '30g',
          timing: 'pós-treino',
          frequency: 'daily',
          reminderTime: null,
          isNighttime: false,
          emoji: '🥛',
          orderIndex: 2,
          isActive: true,
        });
      });

      expect(success).toBe(true);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-21');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('Immediate trigger resync on Update / Edit', () => {
    it('updates trigger immediately when reminderTime changes', async () => {
      const { result } = renderHook(() => useSupplements());

      // Update Creatina (id 10) from 08:00 to 09:15
      mockSupplementsRows[0].reminderTime = '09:15';

      let success = false;
      await act(async () => {
        success = await result.current.updateSupplement(10, {
          reminderTime: '09:15',
        });
      });

      expect(success).toBe(true);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-10');
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'supplement-10',
          trigger: expect.objectContaining({
            hour: 9,
            minute: 15,
          }),
        })
      );
    });

    it('cancels only target supplement reminder when reminderTime is cleared (null)', async () => {
      const { result } = renderHook(() => useSupplements());

      mockSupplementsRows[0].reminderTime = null;

      let success = false;
      await act(async () => {
        success = await result.current.updateSupplement(10, {
          reminderTime: null,
        });
      });

      expect(success).toBe(true);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-10');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('supplement-20');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('monthly-checkin');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('rest-timer');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('cancels only target supplement reminder when supplement is deactivated (isActive: false)', async () => {
      const { result } = renderHook(() => useSupplements());

      mockSupplementsRows[0].isActive = false;

      let success = false;
      await act(async () => {
        success = await result.current.updateSupplement(10, {
          isActive: false,
        });
      });

      expect(success).toBe(true);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-10');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('supplement-20');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('monthly-checkin');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('rest-timer');
    });
  });

  describe('Immediate cancellation on Delete', () => {
    it('cancels only target supplement reminder on deleteSupplement', async () => {
      const { result } = renderHook(() => useSupplements());

      mockSupplementsRows[0].isActive = false;

      let success = false;
      await act(async () => {
        success = await result.current.deleteSupplement(10);
      });

      expect(success).toBe(true);
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-10');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('supplement-20');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('monthly-checkin');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('rest-timer');
    });
  });

  describe('Isolation from Check-in and Rest Timer (C8)', () => {
    it('scheduling or updating supplement reminders never cancels active rest timer', async () => {
      // Simulate active rest timer
      await scheduleRestNotification({ seconds: 90, exerciseName: 'Supino' });
      jest.clearAllMocks();

      const { result } = renderHook(() => useSupplements());

      mockSupplementsRows[0].reminderTime = '10:00';
      await act(async () => {
        await result.current.updateSupplement(10, { reminderTime: '10:00' });
      });

      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('rest-timer');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('monthly-checkin');
    });

    it('cancelling all supplement reminders never cancels monthly checkin or rest timer', async () => {
      await notificationService.cancelAllSupplementReminders();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-10');
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-20');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('monthly-checkin');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('rest-timer');
    });

    it('scheduleMonthlyCheckin never cancels supplement reminders or rest timer', async () => {
      await notificationService.scheduleMonthlyCheckin();

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('monthly-checkin');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('supplement-10');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('supplement-20');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('rest-timer');
    });
  });

  describe('Persistence failure handling (truthful reporting)', () => {
    it('returns false and does NOT schedule reminder when addSupplement fails in DB', async () => {
      shouldDbFail = true;
      const { result } = renderHook(() => useSupplements());

      let success = true;
      await act(async () => {
        success = await result.current.addSupplement({
          name: 'Omega 3',
          dosage: '1g',
          timing: 'almoço',
          frequency: 'daily',
          reminderTime: '12:00',
          isNighttime: false,
          emoji: '🐟',
          orderIndex: 2,
          isActive: true,
        });
      });

      expect(success).toBe(false);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });

    it('returns false and does NOT alter notifications when updateSupplement fails in DB', async () => {
      shouldDbFail = true;
      const { result } = renderHook(() => useSupplements());

      let success = true;
      await act(async () => {
        success = await result.current.updateSupplement(10, {
          reminderTime: '14:00',
        });
      });

      expect(success).toBe(false);
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });

    it('returns false and does NOT alter notifications when deleteSupplement fails in DB', async () => {
      shouldDbFail = true;
      const { result } = renderHook(() => useSupplements());

      let success = true;
      await act(async () => {
        success = await result.current.deleteSupplement(10);
      });

      expect(success).toBe(false);
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('Validation of reminder time & 4-language feedback', () => {
    it('validates reminder time formats correctly', () => {
      expect(isValidReminderTime('08:00')).toBe(true);
      expect(isValidReminderTime('23:59')).toBe(true);
      expect(isValidReminderTime('0:00')).toBe(true);
      expect(isValidReminderTime(null)).toBe(true);
      expect(isValidReminderTime(undefined)).toBe(true);
      expect(isValidReminderTime('')).toBe(true);

      expect(isValidReminderTime('24:00')).toBe(false);
      expect(isValidReminderTime('12:60')).toBe(false);
      expect(isValidReminderTime('invalid')).toBe(false);
      expect(isValidReminderTime('-1:00')).toBe(false);
    });

    it('parses reminder time into hour and minute or returns null', () => {
      expect(parseReminderTime('08:30')).toEqual({ hour: 8, minute: 30 });
      expect(parseReminderTime('21:00')).toEqual({ hour: 21, minute: 0 });
      expect(parseReminderTime('invalid')).toBeNull();
      expect(parseReminderTime(null)).toBeNull();
    });

    it('cancels reminder and does not schedule when given invalid reminder time', async () => {
      await notificationService.scheduleSupplementReminder({
        id: 10,
        name: 'Creatina',
        dosage: '5g',
        reminderTime: 'invalid-time',
        isActive: true,
      });

      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('supplement-10');
      expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    });

    it('provides localized feedback for invalid data across all 4 locales (pt, en, es, zh)', () => {
      for (const lang of ['pt', 'en', 'es', 'zh'] as const) {
        const invalidFeedback = translate('common.invalidData', undefined, lang);
        expect(invalidFeedback).toBeDefined();
        expect(invalidFeedback).not.toBe('common.invalidData');
        expect(invalidFeedback.length).toBeGreaterThan(0);
      }
    });

    it('provides localized notification copy across all 4 locales (pt, en, es, zh)', () => {
      for (const lang of ['pt', 'en', 'es', 'zh'] as const) {
        const title = translate('notifications.supplementTitle', undefined, lang);
        const bodyWithDosage = translate(
          'notifications.supplementBody',
          { name: 'Creatina', dosage: '5g' },
          lang
        );
        const bodyNoDosage = translate(
          'notifications.supplementBodyNoDosage',
          { name: 'Creatina' },
          lang
        );

        expect(title).not.toBe('notifications.supplementTitle');
        expect(bodyWithDosage).toContain('Creatina');
        expect(bodyWithDosage).toContain('5g');
        expect(bodyNoDosage).toContain('Creatina');
      }
    });
  });

  describe('Startup idempotence', () => {
    it('initialize can be called repeatedly without duplicating work', async () => {
      const first = await notificationService.initialize();
      const second = await notificationService.initialize();

      expect(first).toBe(true);
      expect(second).toBe(true);
    });

    it('startup resync schedules check-in and active supplements without affecting rest timer', async () => {
      await notificationService.initialize();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: 'monthly-checkin' })
      );
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: 'supplement-10' })
      );
      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: 'supplement-20' })
      );
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('rest-timer');
    });
  });
});

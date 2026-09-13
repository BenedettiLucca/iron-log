import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import {
  notificationService,
  scheduleRestNotification,
  cancelRestNotification,
  getNotificationPermissionStatus,
  requestNotificationPermission,
  NOTIFICATION_CATEGORIES,
} from '@/services/NotificationService';
import {
  supportsNativeNotifications,
  getExecutionEnvironment,
  isExpoGo,
} from '@/src/utils/runtime-environment';
import { renderHook, act } from '@testing-library/react-native';
import { useNotifications } from '@/hooks/use-notifications';

jest.mock('expo-notifications', () => ({
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval', DATE: 'date' },
  AndroidNotificationPriority: { HIGH: 'high' },
  AndroidImportance: { HIGH: 'high' },
  scheduleNotificationAsync: jest.fn(),
  cancelScheduledNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
}));

const mockNotificationSettingsRows: {
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

jest.mock('@/src/db/client', () => ({
  db: {
    select: () => ({
      from: () => ({
        limit: (n: number) => Promise.resolve(mockNotificationSettingsRows.slice(0, n)),
        where: () => Promise.resolve([]),
        then: (resolve: (val: unknown) => unknown) => Promise.resolve([]).then(resolve),
      }),
    }),
    insert: () => ({
      values: () => Promise.resolve(),
    }),
    update: () => ({
      set: () => ({
        where: () => Promise.resolve(),
      }),
    }),
  },
}));

describe('T17A — Notification runtime and permission API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Constants as any).executionEnvironment = 'storeClient';
    notificationService.cleanup();
  });

  describe('Runtime environment gate (Go vs Native)', () => {
    it('correctly distinguishes Expo Go (storeClient) from native builds', () => {
      expect(supportsNativeNotifications('storeClient')).toBe(false);
      expect(supportsNativeNotifications('bare')).toBe(true);
      expect(supportsNativeNotifications('standalone')).toBe(true);
      expect(isExpoGo('storeClient')).toBe(true);
      expect(isExpoGo('standalone')).toBe(false);
    });

    it('getExecutionEnvironment returns a string', () => {
      const env = getExecutionEnvironment();
      expect(typeof env).toBe('string');
    });
  });

  describe('Boundary permission table (Go vs Native x granted/denied/blocked/undetermined)', () => {
    describe('Expo Go (storeClient)', () => {
      it('getPermissionStatus returns unavailable without calling getPermissionsAsync', async () => {
        const result = await notificationService.getPermissionStatus('storeClient');
        expect(result).toEqual({
          status: 'unavailable',
          granted: false,
          canAskAgain: false,
          isNative: false,
        });
        expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
      });

      it('requestPermission returns unavailable without calling requestPermissionsAsync', async () => {
        const result = await notificationService.requestPermission('storeClient');
        expect(result).toEqual({
          status: 'unavailable',
          granted: false,
          canAskAgain: false,
          isNative: false,
        });
        expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
      });
    });

    describe('Native environment (bare/standalone)', () => {
      it('maps granted permission correctly', async () => {
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
          status: 'granted',
          granted: true,
          canAskAgain: true,
        });

        const result = await notificationService.getPermissionStatus('standalone');
        expect(result).toEqual({
          status: 'granted',
          granted: true,
          canAskAgain: true,
          isNative: true,
        });
        expect(Notifications.getPermissionsAsync).toHaveBeenCalledTimes(1);
      });

      it('maps denied permission with canAskAgain: true', async () => {
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
          status: 'denied',
          granted: false,
          canAskAgain: true,
        });

        const result = await notificationService.getPermissionStatus('standalone');
        expect(result).toEqual({
          status: 'denied',
          granted: false,
          canAskAgain: true,
          isNative: true,
        });
      });

      it('maps blocked permission when canAskAgain is false', async () => {
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
          status: 'denied',
          granted: false,
          canAskAgain: false,
        });

        const result = await notificationService.getPermissionStatus('standalone');
        expect(result).toEqual({
          status: 'blocked',
          granted: false,
          canAskAgain: false,
          isNative: true,
        });
      });

      it('maps undetermined permission for fresh installs', async () => {
        (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
          status: 'undetermined',
          granted: false,
          canAskAgain: true,
        });

        const result = await notificationService.getPermissionStatus('bare');
        expect(result).toEqual({
          status: 'undetermined',
          granted: false,
          canAskAgain: true,
          isNative: true,
        });
      });

      it('requestPermission calls requestPermissionsAsync and parses granted result', async () => {
        (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
          status: 'granted',
          granted: true,
          canAskAgain: true,
        });

        const result = await notificationService.requestPermission('standalone');
        expect(Notifications.requestPermissionsAsync).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
          status: 'granted',
          granted: true,
          canAskAgain: true,
          isNative: true,
        });
      });

      it('requestPermission parses blocked result when user denies permanently', async () => {
        (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
          status: 'denied',
          granted: false,
          canAskAgain: false,
        });

        const result = await notificationService.requestPermission('standalone');
        expect(result).toEqual({
          status: 'blocked',
          granted: false,
          canAskAgain: false,
          isNative: true,
        });
      });
    });
  });

  describe('Startup contract (no automatic prompt on boot)', () => {
    it('initialize does NOT request permissions automatically', async () => {
      await notificationService.initialize();
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });

    it('initialize is idempotent', async () => {
      const first = await notificationService.initialize();
      const second = await notificationService.initialize();
      expect(first).toBe(true);
      expect(second).toBe(true);
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    });
  });

  describe('Denial does not break timer scheduling', () => {
    it('scheduleRestNotification succeeds even when permissions are denied', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockResolvedValueOnce('rest-timer');

      await expect(
        scheduleRestNotification({ seconds: 90, exerciseName: 'Supino' })
      ).resolves.not.toThrow();

      expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          identifier: 'rest-timer',
        })
      );
    });

    it('scheduleRestNotification catches boundary errors without throwing into timer flow', async () => {
      (Notifications.scheduleNotificationAsync as jest.Mock).mockRejectedValueOnce(
        new Error('Permissions denied')
      );

      await expect(
        scheduleRestNotification({ seconds: 60, exerciseName: 'Agachamento' })
      ).resolves.not.toThrow();
    });

    it('cancelRestNotification safely cancels rest timer', async () => {
      await expect(cancelRestNotification()).resolves.not.toThrow();
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('rest-timer');
    });
  });

  describe('Notification category isolation (C8)', () => {
    it('exports category IDs and channels', () => {
      expect(NOTIFICATION_CATEGORIES.REST).toBe('rest-timer');
      expect(NOTIFICATION_CATEGORIES.CHECKIN).toBe('monthly-checkin');
    });

    it('cancelAll cancels checkin and supplements without canceling rest timer', async () => {
      await notificationService.cancelAll();
      expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('monthly-checkin');
      expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalledWith('rest-timer');
    });
  });

  describe('useNotifications hook integration', () => {
    it('exposes permission state in Go and allows querying', async () => {
      const { result } = renderHook(() => useNotifications());

      expect(result.current.permission).toBeDefined();
      expect(result.current.permission.status).toBe('unavailable');
      expect(result.current.permissionStatus).toBe('unavailable');
      expect(typeof result.current.checkPermissions).toBe('function');
      expect(typeof result.current.requestPermissions).toBe('function');
      expect(typeof result.current.requestPermission).toBe('function');
    });

    it('allows requesting permissions through hook in native environment and updates state', async () => {
      (Constants as any).executionEnvironment = 'standalone';

      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'undetermined',
        granted: false,
        canAskAgain: true,
      });
      (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'granted',
        granted: true,
        canAskAgain: true,
      });

      const { result } = renderHook(() => useNotifications());

      let res;
      await act(async () => {
        res = await result.current.requestPermissions();
      });

      expect(res).toEqual(
        expect.objectContaining({
          status: 'granted',
          granted: true,
        })
      );
      expect(result.current.permissionStatus).toBe('granted');
    });
  });

  describe('Standalone functions export contract', () => {
    it('exports getNotificationPermissionStatus and requestNotificationPermission', async () => {
      expect(typeof getNotificationPermissionStatus).toBe('function');
      expect(typeof requestNotificationPermission).toBe('function');
    });
  });
});

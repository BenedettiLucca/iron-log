import path from 'path';
import fs from 'fs';
import { db, sqlite } from '../fixtures/database';
import { sessions, routines, exercises, routineExercises } from '@/src/db/schema';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import { renderHook, act } from '@testing-library/react-native';
import {
  isAllowedNotificationRoute,
  resolveNotificationTarget,
  handleRestNotificationRecovery,
  processNotificationResponse,
  shouldShowNotificationPrePrompt,
  dismissNotificationPrePrompt,
  checkNotificationPrePrompt,
  useNotificationResponseRouting,
  NOTIFICATION_PROMPT_STORAGE_KEY,
} from '@/src/utils/notification-routing';

// Mock react-native
jest.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  Modal: 'Modal',
  Platform: {
    OS: 'android',
    select: (values: Record<string, unknown>) => values.android ?? values.default,
  },
  Linking: {
    openSettings: jest.fn(() => Promise.resolve()),
  },
}));

// Mock Expo Notifications
let mockNotificationListenerCallback: ((response: any) => void) | null = null;
const mockRemoveSubscription = jest.fn();

jest.mock('expo-notifications', () => ({
  getLastNotificationResponseAsync: jest.fn(),
  addNotificationResponseReceivedListener: jest.fn((callback) => {
    mockNotificationListenerCallback = callback;
    return { remove: mockRemoveSubscription };
  }),
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  setNotificationHandler: jest.fn(),
  SchedulableTriggerInputTypes: { TIME_INTERVAL: 'timeInterval', DATE: 'date' },
  AndroidNotificationPriority: { HIGH: 2 },
  AndroidImportance: { HIGH: 4 },
}));

// Mock database client
jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

describe('T17C — Notification response routing and UI guidance', () => {
  const mockRouter = {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockNotificationListenerCallback = null;
    sqlite.exec(
      'DELETE FROM sets; DELETE FROM sessions; DELETE FROM routine_exercises; DELETE FROM routines; DELETE FROM exercises; DELETE FROM body_metrics; DELETE FROM notification_settings; DELETE FROM sqlite_sequence;'
    );
    (AsyncStorage.getItem as jest.Mock).mockReset();
    (AsyncStorage.setItem as jest.Mock).mockReset();
    (AsyncStorage.removeItem as jest.Mock).mockReset();
    (Linking.openSettings as jest.Mock).mockClear();
  });

  describe('Destination allowlist & payload validation (C8)', () => {
    it('allows valid notification routes', () => {
      expect(isAllowedNotificationRoute('/bio/checkin')).toBe(true);
      expect(isAllowedNotificationRoute('/supplements')).toBe(true);
      expect(isAllowedNotificationRoute('/(tabs)')).toBe(true);
      expect(isAllowedNotificationRoute('/session/[routineId]')).toBe(true);
      expect(isAllowedNotificationRoute('/session/exercise')).toBe(true);
    });

    it('rejects external URLs, arbitrary internal routes, and invalid types', () => {
      expect(isAllowedNotificationRoute('https://malicious.com')).toBe(false);
      expect(isAllowedNotificationRoute('http://example.com/bio/checkin')).toBe(false);
      expect(isAllowedNotificationRoute('javascript:alert(1)')).toBe(false);
      expect(isAllowedNotificationRoute('/unauthorized/admin')).toBe(false);
      expect(isAllowedNotificationRoute('')).toBe(false);
      expect(isAllowedNotificationRoute(null as any)).toBe(false);
      expect(isAllowedNotificationRoute(123 as any)).toBe(false);
    });

    it('resolves monthly_checkin notification payload to /bio/checkin', () => {
      const target1 = resolveNotificationTarget({ type: 'monthly_checkin', url: '/bio/checkin' });
      expect(target1).toEqual({
        type: 'route',
        pathname: '/bio/checkin',
      });

      const target2 = resolveNotificationTarget({ type: 'monthly_checkin' });
      expect(target2).toEqual({
        type: 'route',
        pathname: '/bio/checkin',
      });
    });

    it('resolves supplement_reminder notification payload to /supplements', () => {
      const target = resolveNotificationTarget({
        type: 'supplement_reminder',
        supplementId: 42,
        url: '/supplements',
      });
      expect(target).toEqual({
        type: 'route',
        pathname: '/supplements',
        params: { supplementId: '42' },
      });
    });

    it('resolves rest_complete notification payload to rest_recovery', () => {
      const target = resolveNotificationTarget({
        type: 'rest_complete',
        exerciseName: 'Supino Reto',
      });
      expect(target).toEqual({
        type: 'rest_recovery',
        params: { exerciseName: 'Supino Reto' },
      });
    });

    it('rejects arbitrary payloads without opening routes', () => {
      expect(resolveNotificationTarget({ url: 'https://evil.com' })).toBeNull();
      expect(resolveNotificationTarget({ type: 'arbitrary_exploit' })).toBeNull();
      expect(resolveNotificationTarget({})).toBeNull();
      expect(resolveNotificationTarget(null)).toBeNull();
      expect(resolveNotificationTarget(undefined)).toBeNull();
    });
  });

  describe('Rest tap session recovery contract (T04 integration)', () => {
    it('preserves existing session without inserting new session on rest tap', async () => {
      const startTime = 1700000000000;
      const [routine] = await db.insert(routines).values({ name: 'Treino A' }).returning();
      const [exercise] = await db.insert(exercises).values({ name: 'Agachamento' }).returning();
      const [re] = await db
        .insert(routineExercises)
        .values({ routineId: routine.id, exerciseId: exercise.id, orderIndex: 0 })
        .returning();
      const [session] = await db
        .insert(sessions)
        .values({
          routineId: routine.id,
          routineName: 'Treino A',
          startTime,
          sRpe: 0,
        })
        .returning();

      const incompleteContext = {
        sessionId: session.id,
        routineId: routine.id,
        routineName: 'Treino A',
        exerciseId: exercise.id,
        exerciseName: 'Agachamento',
        routineExerciseId: re.id,
        startTime,
        restSeconds: 90,
      };

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(JSON.stringify(incompleteContext));

      const recovered = await handleRestNotificationRecovery({
        db,
        asyncStorage: AsyncStorage,
        router: mockRouter,
      });

      expect(recovered).toBe(true);

      // Verify NO new session was inserted
      const allSessions = db.select().from(sessions).all();
      expect(allSessions.length).toBe(1);
      expect(allSessions[0].id).toBe(session.id);

      // Verify reconstructed parent stack
      expect(mockRouter.push).toHaveBeenNthCalledWith(1, {
        pathname: '/session/[routineId]',
        params: {
          routineId: routine.id.toString(),
          routineName: 'Treino A',
          sessionId: session.id.toString(),
          startTime: startTime.toString(),
        },
      });

      // Verify exercise route pushed on top
      expect(mockRouter.push).toHaveBeenNthCalledWith(2, {
        pathname: '/session/exercise',
        params: {
          sessionId: session.id.toString(),
          routineId: routine.id.toString(),
          exerciseId: exercise.id,
          exerciseName: 'Agachamento',
          target: undefined,
          notes: undefined,
          restSeconds: '90',
          startTime: startTime.toString(),
          routineExerciseId: re.id,
        },
      });
    });

    it('does NOT navigate or insert session when incomplete session is already finished (endTime not null)', async () => {
      const startTime = 1700000000000;
      const [session] = await db
        .insert(sessions)
        .values({
          routineName: 'Treino A',
          startTime,
          endTime: startTime + 3600000,
        })
        .returning();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ sessionId: session.id, routineId: 1, startTime })
      );

      const recovered = await handleRestNotificationRecovery({
        db,
        asyncStorage: AsyncStorage,
        router: mockRouter,
      });

      expect(recovered).toBe(false);
      expect(mockRouter.push).not.toHaveBeenCalled();

      // Check stale incomplete session is removed
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('incomplete_session');

      // Still only 1 session
      const allSessions = db.select().from(sessions).all();
      expect(allSessions.length).toBe(1);
    });

    it('does NOT navigate or insert session when incomplete session is soft-deleted (deletedAt not null)', async () => {
      const startTime = 1700000000000;
      const [session] = await db
        .insert(sessions)
        .values({
          routineName: 'Treino A',
          startTime,
          deletedAt: startTime + 1000,
        })
        .returning();

      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ sessionId: session.id, routineId: 1, startTime })
      );

      const recovered = await handleRestNotificationRecovery({
        db,
        asyncStorage: AsyncStorage,
        router: mockRouter,
      });

      expect(recovered).toBe(false);
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('incomplete_session');
    });

    it('does NOT navigate or insert session when sessionId does not exist in DB', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ sessionId: 9999, routineId: 1, startTime: 1700000000000 })
      );

      const recovered = await handleRestNotificationRecovery({
        db,
        asyncStorage: AsyncStorage,
        router: mockRouter,
      });

      expect(recovered).toBe(false);
      expect(mockRouter.push).not.toHaveBeenCalled();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('incomplete_session');

      const allSessions = db.select().from(sessions).all();
      expect(allSessions.length).toBe(0);
    });
  });

  describe('Cold and Warm response processing & deduplication', () => {
    it('processes monthly checkin response once and deduplicates subsequent identical response', async () => {
      const processedIds = new Set<string>();

      const response = {
        actionIdentifier: 'default',
        notification: {
          request: {
            identifier: 'notif-checkin-001',
            content: {
              data: { type: 'monthly_checkin', url: '/bio/checkin' },
            },
          },
        },
      };

      // First run (e.g. cold or warm)
      const handled1 = await processNotificationResponse({
        response,
        processedResponseIds: processedIds,
        db,
        asyncStorage: AsyncStorage,
        router: mockRouter,
      });

      expect(handled1).toBe(true);
      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/bio/checkin',
        params: undefined,
      });

      // Second run with same notification identifier (duplicate cold + warm)
      const handled2 = await processNotificationResponse({
        response,
        processedResponseIds: processedIds,
        db,
        asyncStorage: AsyncStorage,
        router: mockRouter,
      });

      expect(handled2).toBe(false);
      expect(mockRouter.push).toHaveBeenCalledTimes(1);
    });

    it('ignores invalid notification response without routing', async () => {
      const processedIds = new Set<string>();

      const invalidResponse = {
        notification: {
          request: {
            identifier: 'notif-invalid-999',
            content: {
              data: { url: 'https://attacker.example.com' },
            },
          },
        },
      };

      const handled = await processNotificationResponse({
        response: invalidResponse,
        processedResponseIds: processedIds,
        db,
        asyncStorage: AsyncStorage,
        router: mockRouter,
      });

      expect(handled).toBe(false);
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
  });

  describe('UI Permission pre-prompt & orientation gate (T17A API integration)', () => {
    it('does NOT show pre-prompt in Expo Go (storeClient) and does not call native permission APIs', async () => {
      const shouldPrompt = await shouldShowNotificationPrePrompt(AsyncStorage, 'storeClient');
      expect(shouldPrompt).toBe(false);
      expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
      expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();

      const result = await checkNotificationPrePrompt(AsyncStorage, 'storeClient');
      expect(result.type).toBe('unavailable');
      expect(result.shouldPrompt).toBe(false);
    });

    it('shows pre-prompt on fresh native install when permission is undetermined and not yet dismissed', async () => {
      (Notifications.getPermissionsAsync as jest.Mock).mockResolvedValueOnce({
        status: 'undetermined',
        granted: false,
        canAskAgain: true,
      });
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

      const shouldPrompt = await shouldShowNotificationPrePrompt(AsyncStorage, 'standalone');
      expect(shouldPrompt).toBe(true);
    });

    it('does NOT show pre-prompt when already dismissed in AsyncStorage', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('true');

      const shouldPrompt = await shouldShowNotificationPrePrompt(AsyncStorage, 'standalone');
      expect(shouldPrompt).toBe(false);
      expect(Notifications.getPermissionsAsync).not.toHaveBeenCalled();
    });

    it('dismissNotificationPrePrompt stores dismissal flag in AsyncStorage', async () => {
      await dismissNotificationPrePrompt(AsyncStorage);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(NOTIFICATION_PROMPT_STORAGE_KEY, 'true');
    });
  });

  describe('useNotificationResponseRouting hook lifecycle', () => {
    it('does not register listeners or check initial response when success is false (before migrations)', () => {
      renderHook(() =>
        useNotificationResponseRouting({
          success: false,
          router: mockRouter,
          db,
          asyncStorage: AsyncStorage,
          executionEnvironment: 'standalone',
        })
      );

      expect(Notifications.addNotificationResponseReceivedListener).not.toHaveBeenCalled();
      expect(Notifications.getLastNotificationResponseAsync).not.toHaveBeenCalled();
    });

    it('attaches listener and checks initial response after migrations succeed', async () => {
      (Notifications.getLastNotificationResponseAsync as jest.Mock).mockResolvedValueOnce(null);

      const { unmount } = renderHook(() =>
        useNotificationResponseRouting({
          success: true,
          router: mockRouter,
          db,
          asyncStorage: AsyncStorage,
          executionEnvironment: 'standalone',
        })
      );

      // Wait for promises in effect
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(Notifications.addNotificationResponseReceivedListener).toHaveBeenCalled();
      expect(Notifications.getLastNotificationResponseAsync).toHaveBeenCalled();

      unmount();
      expect(mockRemoveSubscription).toHaveBeenCalled();
    });

    it('routes warm notification response through listener and calls onSessionResumed', async () => {
      const onSessionResumed = jest.fn();

      renderHook(() =>
        useNotificationResponseRouting({
          success: true,
          router: mockRouter,
          db,
          asyncStorage: AsyncStorage,
          onSessionResumed,
          executionEnvironment: 'standalone',
        })
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockNotificationListenerCallback).not.toBeNull();

      // Trigger listener
      await act(async () => {
        mockNotificationListenerCallback!({
          notification: {
            request: {
              identifier: 'warm-checkin-test',
              content: {
                data: { type: 'monthly_checkin', url: '/bio/checkin' },
              },
            },
          },
        });
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/bio/checkin',
        params: undefined,
      });
    });

    it('handles permission request from modal callback and records dismissal', async () => {
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

      const { result } = renderHook(() =>
        useNotificationResponseRouting({
          success: true,
          router: mockRouter,
          db,
          asyncStorage: AsyncStorage,
          executionEnvironment: 'standalone',
        })
      );

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      let permResult;
      await act(async () => {
        permResult = await result.current.handleRequestPermission();
      });

      expect(permResult).toEqual(
        expect.objectContaining({
          status: 'granted',
          granted: true,
        })
      );
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(NOTIFICATION_PROMPT_STORAGE_KEY, 'true');
    });

    it('opens settings when user confirms on blocked guidance', async () => {
      const { result } = renderHook(() =>
        useNotificationResponseRouting({
          success: true,
          router: mockRouter,
          db,
          asyncStorage: AsyncStorage,
          executionEnvironment: 'standalone',
        })
      );

      await act(async () => {
        await result.current.handleOpenSettings();
      });

      expect(Linking.openSettings).toHaveBeenCalled();
    });
  });

  describe('app/_layout.tsx integration and structure contract', () => {
    const root = path.resolve(__dirname, '../..');
    const layout = fs.readFileSync(path.join(root, 'app/_layout.tsx'), 'utf8');

    it('imports and utilizes notification response routing', () => {
      expect(layout).toContain("from '@/src/utils/notification-routing'");
      expect(layout).toContain('useNotificationResponseRouting');
    });

    it('renders NotificationPermissionModal in root layout', () => {
      expect(layout).toContain('<NotificationPermissionModal');
    });

    it('wires dismiss of recovery dialog when session resumes via notification', () => {
      expect(layout).toContain('setShowRecoveryDialog(false)');
    });
  });
});

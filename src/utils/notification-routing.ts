import { useState, useEffect, useRef, useCallback } from 'react';
import { Linking } from 'react-native';
import type { Router } from 'expo-router';
import { eq, and, isNull, type SQL } from 'drizzle-orm';
import { sessions } from '../db/schema';
import { logger } from '@/services/logger';
import { supportsNativeNotifications } from './runtime-environment';
import {
  getNotificationPermissionStatus,
  requestNotificationPermission,
  NotificationPermissionResult,
  NotificationPermissionStatus,
} from '@/services/NotificationService';

export const NOTIFICATION_PROMPT_STORAGE_KEY = '@ironlog_notification_prompt_dismissed';

export const ALLOWED_NOTIFICATION_ROUTES = [
  '/(tabs)',
  '/bio/checkin',
  '/supplements',
  '/session/[routineId]',
  '/session/exercise',
] as const;

export type AllowedNotificationRoute = (typeof ALLOWED_NOTIFICATION_ROUTES)[number];

export function isAllowedNotificationRoute(route: unknown): route is AllowedNotificationRoute {
  if (typeof route !== 'string') return false;
  const cleanRoute = route.split('?')[0].trim();
  if (!cleanRoute) return false;
  // Reject URLs with protocols (http, https, javascript, etc.)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(cleanRoute)) return false;
  return (ALLOWED_NOTIFICATION_ROUTES as readonly string[]).includes(cleanRoute);
}

export interface ResolvedNotificationTarget {
  type: 'route' | 'rest_recovery';
  pathname?: AllowedNotificationRoute;
  params?: NotificationRouteParams;
}

export function resolveNotificationTarget(data: unknown): ResolvedNotificationTarget | null {
  if (!data || typeof data !== 'object') return null;
  const payload = data as Record<string, unknown>;

  if (payload.type === 'rest_complete') {
    return {
      type: 'rest_recovery',
      params: typeof payload.exerciseName === 'string' ? { exerciseName: payload.exerciseName } : undefined,
    };
  }

  if (payload.type === 'monthly_checkin' || payload.url === '/bio/checkin') {
    return {
      type: 'route',
      pathname: '/bio/checkin',
    };
  }

  if (payload.type === 'supplement_reminder' || payload.url === '/supplements') {
    return {
      type: 'route',
      pathname: '/supplements',
      params:
        payload.supplementId !== undefined && payload.supplementId !== null
          ? { supplementId: String(payload.supplementId) }
          : undefined,
    };
  }

  if (typeof payload.url === 'string' && isAllowedNotificationRoute(payload.url)) {
    return {
      type: 'route',
      pathname: payload.url,
    };
  }

  return null;
}

/**
 * Minimal structural type for the Drizzle runner this module needs.
 * Accepts both the production `ExpoSQLiteDatabase` and test fixtures
 * (e.g. the better-sqlite3 drizzle instance in __tests__/fixtures/database).
 */
export interface NotificationRecoveryDb {
  select(): {
    from(table: typeof sessions): {
      where(condition: SQL | undefined): Promise<(typeof sessions.$inferSelect)[]>;
    };
  };
}

export interface RestRecoveryOptions {
  db: NotificationRecoveryDb;
  asyncStorage: {
    getItem: (key: string) => Promise<string | null>;
    removeItem: (key: string) => Promise<void>;
  };
  router: Pick<Router, 'push'>;
  onSuccess?: () => void;
}

export async function handleRestNotificationRecovery({
  db,
  asyncStorage,
  router,
  onSuccess,
}: RestRecoveryOptions): Promise<boolean> {
  try {
    const sessionJson = await asyncStorage.getItem('incomplete_session');
    if (!sessionJson) return false;

    let sessionContext: {
      sessionId?: number | string;
      id?: number | string;
      routineId?: number | string | null;
      routineName?: string;
      startTime?: number | string;
      exerciseId?: number | string;
      exerciseName?: string;
      target?: number | string | null;
      notes?: string | null;
      restSeconds?: number | string;
      routineExerciseId?: number | string;
    } | null;
    try {
      sessionContext = JSON.parse(sessionJson);
    } catch {
      return false;
    }
    if (!sessionContext) return false;

    const sessionId = Number(sessionContext.sessionId ?? sessionContext.id);
    if (!sessionId) return false;

    // Check session in database: must exist, not deleted, not finished
    const sessionData = await db
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, sessionId), isNull(sessions.deletedAt)));

    if (!sessionData || sessionData.length === 0 || sessionData[0].endTime !== null) {
      // Session invalid, deleted, or finished!
      // Clear stale marker and do NOT navigate or insert anything
      await asyncStorage.removeItem('incomplete_session');
      return false;
    }

    const existingSession = sessionData[0];
    const routineId = sessionContext.routineId ?? existingSession.routineId ?? null;
    const routineName = sessionContext.routineName || existingSession.routineName || '';
    const startTime = sessionContext.startTime ?? existingSession.startTime ?? Date.now();

    onSuccess?.();

    // Reconstruct parent route without inserting new session
    if (routineId) {
      router.push({
        pathname: '/session/[routineId]',
        params: {
          routineId: routineId.toString(),
          routineName,
          sessionId: sessionId.toString(),
          startTime: startTime.toString(),
        },
      });
    }

    // Push exercise route on top if exerciseId is present, preserving routineExerciseId occurrence
    if (sessionContext.exerciseId) {
      router.push({
        pathname: '/session/exercise',
        params: {
          sessionId: sessionId.toString(),
          routineId: routineId ? routineId.toString() : undefined,
          exerciseId: sessionContext.exerciseId,
          exerciseName: sessionContext.exerciseName ?? undefined,
          target: sessionContext.target ?? undefined,
          notes: sessionContext.notes ?? undefined,
          restSeconds:
            sessionContext.restSeconds !== undefined && sessionContext.restSeconds !== null
              ? sessionContext.restSeconds.toString()
              : undefined,
          startTime: startTime.toString(),
          routineExerciseId: sessionContext.routineExerciseId,
        },
      });
    }

    return true;
  } catch (err) {
    logger.error('Error recovering rest notification session', err);
    return false;
  }
}

export interface ProcessNotificationResponseOptions extends RestRecoveryOptions {
  /**
   * Minimal structural shape of an expo-notifications response.
   * Kept loose (readonly view of unknown payloads) because expo's own
   * `NotificationResponse` type is only importable statically and this
   * module deliberately lazy-loads expo-notifications.
   */
  response:
    | {
        actionIdentifier?: string;
        notification?: {
          id?: string;
          request?: {
            identifier?: string;
            content?: { data?: unknown };
          };
        };
      }
    | null
    | undefined;
  processedResponseIds: Set<string>;
}

export async function processNotificationResponse({
  response,
  processedResponseIds,
  db,
  asyncStorage,
  router,
  onSuccess,
}: ProcessNotificationResponseOptions): Promise<boolean> {
  if (!response) return false;

  const notifId =
    response.notification?.request?.identifier ||
    response.notification?.id ||
    response.actionIdentifier ||
    (response.notification?.request?.content?.data
      ? JSON.stringify(response.notification.request.content.data)
      : null);

  if (!notifId || processedResponseIds.has(notifId)) {
    return false;
  }
  processedResponseIds.add(notifId);

  const data = response.notification?.request?.content?.data;
  const target = resolveNotificationTarget(data);
  if (!target) {
    return false;
  }

  if (target.type === 'rest_recovery') {
    return handleRestNotificationRecovery({ db, asyncStorage, router, onSuccess });
  }

  if (target.type === 'route') {
    pushResolvedTarget(router, target);
    return true;
  }

  return false;
}

type NotificationRouteParams = Record<string, string | number | boolean | undefined>;

/**
 * Single typed-routes bridge: `target` comes from `resolveNotificationTarget`,
 * whose pathname is validated against ALLOWED_NOTIFICATION_ROUTES and whose
 * params are primitives (expo serializes params to strings in URLs anyway).
 * The one cast widens the allowlist union to expo's per-route Href union; every
 * allowlist member is a real route in the generated route map.
 */
function pushResolvedTarget(router: Pick<Router, 'push'>, target: ResolvedNotificationTarget): void {
  if (target.type !== 'route' || !target.pathname) return;
  router.push({ pathname: target.pathname, params: target.params } as Parameters<
    Pick<Router, 'push'>['push']
  >[0]);
}

export type NotificationGuidanceType =
  | 'pre_prompt'
  | 'blocked'
  | 'denied'
  | 'unavailable'
  | 'granted';

export async function checkNotificationPrePrompt(
  asyncStorage: { getItem: (key: string) => Promise<string | null> },
  executionEnvironment?: string
): Promise<{ shouldPrompt: boolean; type: NotificationGuidanceType; permissionStatus: NotificationPermissionStatus }> {
  const isNative = supportsNativeNotifications(executionEnvironment);
  if (!isNative) {
    return { shouldPrompt: false, type: 'unavailable', permissionStatus: 'unavailable' };
  }

  const dismissed = await asyncStorage.getItem(NOTIFICATION_PROMPT_STORAGE_KEY);
  if (dismissed === 'true') {
    return { shouldPrompt: false, type: 'pre_prompt', permissionStatus: 'undetermined' };
  }

  const perm = await getNotificationPermissionStatus(executionEnvironment);

  if (perm.status === 'undetermined') {
    return { shouldPrompt: true, type: 'pre_prompt', permissionStatus: perm.status };
  }

  return {
    shouldPrompt: false,
    type: perm.status as NotificationGuidanceType,
    permissionStatus: perm.status,
  };
}

export async function shouldShowNotificationPrePrompt(
  asyncStorage: { getItem: (key: string) => Promise<string | null> },
  executionEnvironment?: string
): Promise<boolean> {
  const { shouldPrompt } = await checkNotificationPrePrompt(asyncStorage, executionEnvironment);
  return shouldPrompt;
}

export async function dismissNotificationPrePrompt(
  asyncStorage: { setItem: (key: string, value: string) => Promise<void> }
): Promise<void> {
  await asyncStorage.setItem(NOTIFICATION_PROMPT_STORAGE_KEY, 'true');
}

export interface UseNotificationResponseRoutingOptions {
  success: boolean;
  router: RestRecoveryOptions['router'];
  db: NotificationRecoveryDb;
  asyncStorage: {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
    removeItem: (key: string) => Promise<void>;
  };
  onSessionResumed?: () => void;
  executionEnvironment?: string;
}

export function useNotificationResponseRouting({
  success,
  router,
  db,
  asyncStorage,
  onSessionResumed,
  executionEnvironment,
}: UseNotificationResponseRoutingOptions) {
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [modalType, setModalType] = useState<NotificationGuidanceType>('pre_prompt');
  const processedResponseIdsRef = useRef<Set<string>>(new Set());

  // Check pre-prompt after migrations complete
  useEffect(() => {
    if (!success) return;

    let isMounted = true;
    checkNotificationPrePrompt(asyncStorage, executionEnvironment)
      .then(({ shouldPrompt, type }) => {
        if (isMounted && shouldPrompt) {
          setModalType(type);
          setShowPromptModal(true);
        }
      })
      .catch((err) => {
        logger.error('Failed checking notification pre-prompt', err);
      });

    return () => {
      isMounted = false;
    };
  }, [success, asyncStorage, executionEnvironment]);

  // Handle warm listener and cold initial response
  useEffect(() => {
    if (!success) return;

    let isMounted = true;
    let subscription: { remove: () => void } | null = null;

    import('expo-notifications')
      .then((Notifications) => {
        if (!isMounted) return;

        // Warm response listener
        if (typeof Notifications.addNotificationResponseReceivedListener === 'function') {
          subscription = Notifications.addNotificationResponseReceivedListener((response) => {
            processNotificationResponse({
              response,
              processedResponseIds: processedResponseIdsRef.current,
              db,
              asyncStorage,
              router,
              onSuccess: onSessionResumed,
            }).catch((err) => {
              logger.error('Error handling warm notification response', err);
            });
          });
        }

        // Cold initial response check
        if (typeof Notifications.getLastNotificationResponseAsync === 'function') {
          Notifications.getLastNotificationResponseAsync()
            .then((coldResponse) => {
              if (isMounted && coldResponse) {
                processNotificationResponse({
                  response: coldResponse,
                  processedResponseIds: processedResponseIdsRef.current,
                  db,
                  asyncStorage,
                  router,
                  onSuccess: onSessionResumed,
                }).catch((err) => {
                  logger.error('Error handling cold notification response', err);
                });
              }
            })
            .catch((err) => {
              logger.error('Failed getting last notification response', err);
            });
        }
      })
      .catch((err) => {
        logger.error('Failed to bind notification response handlers', err);
      });

    return () => {
      isMounted = false;
      if (subscription && typeof subscription.remove === 'function') {
        subscription.remove();
      }
    };
  }, [success, db, asyncStorage, router, onSessionResumed]);

  const handleRequestPermission = useCallback(async (): Promise<NotificationPermissionResult> => {
    setShowPromptModal(false);
    await dismissNotificationPrePrompt(asyncStorage);
    try {
      const result = await requestNotificationPermission(executionEnvironment);
      if (result.status === 'blocked') {
        setModalType('blocked');
        setShowPromptModal(true);
      }
      return result;
    } catch (err) {
      logger.error('Error requesting notification permission from modal', err);
      const fallback: NotificationPermissionResult = {
        status: 'denied',
        granted: false,
        canAskAgain: true,
        isNative: supportsNativeNotifications(executionEnvironment),
      };
      return fallback;
    }
  }, [asyncStorage, executionEnvironment]);

  const handleOpenSettings = useCallback(async () => {
    setShowPromptModal(false);
    try {
      await Linking.openSettings();
    } catch (err) {
      logger.error('Error opening device settings', err);
    }
  }, []);

  const handleDismissModal = useCallback(async () => {
    setShowPromptModal(false);
    await dismissNotificationPrePrompt(asyncStorage);
  }, [asyncStorage]);

  return {
    showPromptModal,
    modalType,
    setShowPromptModal,
    setModalType,
    handleRequestPermission,
    handleOpenSettings,
    handleDismissModal,
  };
}

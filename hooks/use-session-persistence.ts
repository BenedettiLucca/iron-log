import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../services/logger';

const SESSION_CONTEXT_KEY = 'incomplete_session';
let sessionOperationQueue: Promise<void> = Promise.resolve();

function enqueueSessionOperation<T>(operation: () => Promise<T>): Promise<T> {
  const result = sessionOperationQueue.then(operation);
  sessionOperationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

interface UseSessionPersistenceReturn {
  saveSessionContext: (
    overrides?: Partial<SessionContext>,
    options?: { clearOnFailure?: boolean },
  ) => Promise<void>;
  loadSessionContext: () => Promise<SessionContext | null>;
  clearSessionContext: () => Promise<void>;
}

interface SessionContext {
  sessionId: number;
  exerciseId: number;
  exerciseName: string;
  routineId: number | null;
  target?: string;
  notes?: string;
  restSeconds?: number | null;
  startTime: number;
  exerciseType: string;
  weight: string;
  reps: string;
  duration: string;
  rir: number;
  isWarmupMode: boolean;
  isDirty: boolean;
  activeSetTime: number;
}

interface SessionPersistenceOptions {
  sessionId: number;
  exerciseId: number;
  routineId: number | null;
  exerciseName: string;
  currentName: string;
  exerciseType: string;
  weight: string;
  reps: string;
  duration: string;
  rir: number;
  isWarmupMode: boolean;
  isDirty: boolean;
  activeSetTime: number;
  startTime: number;
  target?: string;
  notes?: string;
  restSeconds?: number | null;
}

function createSessionContext(opts: SessionPersistenceOptions): SessionContext {
  return {
    sessionId: opts.sessionId,
    exerciseId: opts.exerciseId,
    exerciseName: opts.currentName,
    routineId: opts.routineId,
    target: opts.target,
    notes: opts.notes,
    restSeconds: opts.restSeconds,
    startTime: opts.startTime,
    exerciseType: opts.exerciseType,
    weight: opts.weight,
    reps: opts.reps,
    duration: opts.duration,
    rir: opts.rir,
    isWarmupMode: opts.isWarmupMode,
    isDirty: opts.isDirty,
    activeSetTime: opts.activeSetTime,
  };
}

export function useSessionPersistence(
  opts: SessionPersistenceOptions,
): UseSessionPersistenceReturn {
  const contextRef = useRef<SessionContext>(createSessionContext(opts));
  contextRef.current = createSessionContext(opts);

  const saveSessionContext = useCallback(
    (
      overrides: Partial<SessionContext> = {},
      options: { clearOnFailure?: boolean } = {},
    ): Promise<void> => {
      const context = { ...contextRef.current, ...overrides };
      contextRef.current = context;
      return enqueueSessionOperation(async () => {
        try {
          await AsyncStorage.setItem(SESSION_CONTEXT_KEY, JSON.stringify(context));
        } catch (writeError) {
          if (!options.clearOnFailure) throw writeError;
          logger.error('Failed to persist clean session context', writeError);
          try {
            await AsyncStorage.removeItem(SESSION_CONTEXT_KEY);
          } catch (clearError) {
            logger.error('Failed to remove stale session context', clearError);
            throw clearError;
          }
        }
      });
    },
    [],
  );

  const loadSessionContext = useCallback((): Promise<SessionContext | null> => {
    return enqueueSessionOperation(async () => {
      try {
        const raw = await AsyncStorage.getItem(SESSION_CONTEXT_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as SessionContext;
      } catch {
        return null;
      }
    });
  }, []);

  const clearSessionContext = useCallback((): Promise<void> => {
    return enqueueSessionOperation(() => AsyncStorage.removeItem(SESSION_CONTEXT_KEY));
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        void saveSessionContext().catch((error: unknown) => {
          logger.error('Failed to persist session context in background', error);
        });
      }
    });
    return () => {
      subscription.remove();
    };
  }, [saveSessionContext]);

  return { saveSessionContext, loadSessionContext, clearSessionContext };
}

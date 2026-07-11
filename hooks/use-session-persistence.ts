import { useEffect, useCallback } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface UseSessionPersistenceReturn {
  /** Awaitable: resolves after AsyncStorage write completes (or rejects on error). */
  saveSessionContext: (overrides?: Partial<SessionContext>) => Promise<void>;
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
}

export function useSessionPersistence(opts: {
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
  startTime: number;
  target?: string;
  notes?: string;
  restSeconds?: number | null;
}): UseSessionPersistenceReturn {
  const saveSessionContext = useCallback(async (overrides: Partial<SessionContext> = {}): Promise<void> => {
    const sessionContext: SessionContext = {
      sessionId: opts.sessionId,
      exerciseId: opts.exerciseId,
      exerciseName: opts.currentName,
      routineId: opts.routineId,
      target: opts.target,
      notes: opts.notes,
      restSeconds: opts.restSeconds,
      startTime: opts.startTime,
      // Also save the current input state for better recovery
      exerciseType: opts.exerciseType,
      weight: opts.weight,
      reps: opts.reps,
      duration: opts.duration,
      rir: opts.rir,
      isWarmupMode: opts.isWarmupMode,
      ...overrides,
    };
    await AsyncStorage.setItem('incomplete_session', JSON.stringify(sessionContext));
  }, [opts]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background') {
        saveSessionContext();
      }
    });
    return () => {
      subscription.remove();
    };
  }, [saveSessionContext]);

  return { saveSessionContext };
}

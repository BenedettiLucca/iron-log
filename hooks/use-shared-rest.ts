import { useState, useCallback, useEffect } from 'react';
import {
  resolveSharedRestSemantics,
  getPreservedRest,
  clearPreservedRest,
  TimerState,
  QueueItem,
} from '@/services/SessionOccurrenceService';

export interface UseSharedRestOptions {
  sessionId: number;
  routineExerciseId: number;
  timerStatus?: 'idle' | 'running' | 'finished';
  timerTarget?: number | null;
  timerSeconds?: number | null;
  setTimerTarget?: (target: number | null) => void;
  setTimerStatus?: (status: 'idle' | 'running' | 'finished') => void;
  setTimerSeconds?: (seconds: number | null) => void;
  customDb?: unknown;
}

export interface UseSharedRestReturn {
  isSuperset: boolean;
  groupId: string | null;
  isLastInGroup: boolean;
  groupMembers: QueueItem[];
  shouldTriggerRest: (targetRoutineExerciseId?: number) => boolean;
  preservedRest: TimerState | null;
  consumePreservedRest: () => TimerState | null;
  refreshSemantics: () => Promise<void>;
}

export function useSharedRest(options: UseSharedRestOptions): UseSharedRestReturn {
  const {
    sessionId,
    routineExerciseId,
    setTimerTarget,
    setTimerStatus,
    setTimerSeconds,
    customDb,
  } = options;

  const [semantics, setSemantics] = useState<{
    isSuperset: boolean;
    groupId: string | null;
    isLastInGroup: boolean;
    groupMembers: QueueItem[];
  }>({
    isSuperset: false,
    groupId: null,
    isLastInGroup: false,
    groupMembers: [],
  });

  const [preservedRest, setPreservedRestState] = useState<TimerState | null>(() => {
    return getPreservedRest(sessionId);
  });

  const refreshSemantics = useCallback(async () => {
    const res = await resolveSharedRestSemantics(
      { sessionId, routineExerciseId },
      customDb
    );
    setSemantics({
      isSuperset: res.isSuperset,
      groupId: res.groupId,
      isLastInGroup: res.isLastInGroup,
      groupMembers: res.groupMembers,
    });
  }, [sessionId, routineExerciseId, customDb]);

  useEffect(() => {
    void refreshSemantics();
  }, [refreshSemantics]);

  const shouldTriggerRest = useCallback(
    (targetRoutineExerciseId?: number): boolean => {
      const targetId = targetRoutineExerciseId ?? routineExerciseId;
      if (!semantics.isSuperset) return true;
      if (semantics.groupMembers.length <= 1) return true;
      const last = semantics.groupMembers[semantics.groupMembers.length - 1];
      return last?.routineExerciseId === targetId;
    },
    [semantics, routineExerciseId]
  );

  const consumePreservedRest = useCallback((): TimerState | null => {
    const current = getPreservedRest(sessionId);
    if (!current) return null;

    if (setTimerTarget && current.timerTarget !== null) {
      setTimerTarget(current.timerTarget);
    }
    if (setTimerStatus && current.timerStatus) {
      setTimerStatus(current.timerStatus);
    }
    if (setTimerSeconds && current.timerSeconds !== null) {
      setTimerSeconds(current.timerSeconds);
    }

    clearPreservedRest(sessionId);
    setPreservedRestState(null);
    return current;
  }, [sessionId, setTimerTarget, setTimerStatus, setTimerSeconds]);

  return {
    isSuperset: semantics.isSuperset,
    groupId: semantics.groupId,
    isLastInGroup: semantics.isLastInGroup,
    groupMembers: semantics.groupMembers,
    shouldTriggerRest,
    preservedRest,
    consumePreservedRest,
    refreshSemantics,
  };
}

export default useSharedRest;

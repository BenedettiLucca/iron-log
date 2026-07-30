export interface SessionDraft {
  weight: string;
  reps: string;
  duration: string;
  rir: number;
  isWarmupMode: boolean;
  isDirty: boolean;
  activeSetTime: number;
  isActiveSetRunning: boolean;
  activeSetStartedAt: number | null;
}

type SessionDraftState = {
  isDirty?: boolean;
  activeSetTime?: number;
  isActiveSetRunning?: boolean;
  activeSetStartedAt?: number | null;
};

export function hasPendingSessionDraft(state: SessionDraftState): boolean {
  if (!state) return false;
  return Boolean(
    state.isDirty ||
    (typeof state.activeSetTime === 'number' && state.activeSetTime > 0) ||
    state.isActiveSetRunning ||
    (typeof state.activeSetStartedAt === 'number' && Number.isFinite(state.activeSetStartedAt))
  );
}

export function resolveSessionDraft(
  value: unknown,
  identity: { sessionId: number; exerciseId: number }
): SessionDraft | null {
  if (value === null || value === undefined || !identity) return null;

  let obj: Record<string, unknown> | null = null;
  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        obj = parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    obj = value as Record<string, unknown>;
  }

  if (!obj) return null;

  const { sessionId, exerciseId } = obj;
  if (
    typeof sessionId !== 'number' ||
    !Number.isFinite(sessionId) ||
    !Number.isInteger(sessionId) ||
    sessionId <= 0 ||
    sessionId !== identity.sessionId
  ) {
    return null;
  }

  if (
    typeof exerciseId !== 'number' ||
    !Number.isFinite(exerciseId) ||
    !Number.isInteger(exerciseId) ||
    exerciseId <= 0 ||
    exerciseId !== identity.exerciseId
  ) {
    return null;
  }

  if (typeof obj.weight !== 'string') return null;
  if (typeof obj.reps !== 'string') return null;
  if (typeof obj.duration !== 'string') return null;

  const rir = obj.rir;
  if (
    typeof rir !== 'number' ||
    !Number.isFinite(rir) ||
    rir < 0 ||
    rir > 5
  ) {
    return null;
  }

  const isWarmupMode = obj.isWarmupMode;
  if (typeof isWarmupMode !== 'boolean') return null;

  const isDirty = obj.isDirty;
  if (typeof isDirty !== 'boolean') return null;

  const activeSetTime = obj.activeSetTime;
  if (
    typeof activeSetTime !== 'number' ||
    !Number.isFinite(activeSetTime) ||
    activeSetTime < 0
  ) {
    return null;
  }

  const rawActiveSetStartedAt = obj.activeSetStartedAt;
  const rawIsActiveSetRunning = obj.isActiveSetRunning;
  const hasRunningField = rawIsActiveSetRunning !== undefined;
  const hasStartedAtField = rawActiveSetStartedAt !== undefined;
  if (hasRunningField !== hasStartedAtField) return null;

  if (
    rawActiveSetStartedAt !== undefined &&
    rawActiveSetStartedAt !== null &&
    (
      typeof rawActiveSetStartedAt !== 'number' ||
      !Number.isFinite(rawActiveSetStartedAt) ||
      rawActiveSetStartedAt < 0
    )
  ) {
    return null;
  }
  const activeSetStartedAt = typeof rawActiveSetStartedAt === 'number'
    ? rawActiveSetStartedAt
    : null;

  if (rawIsActiveSetRunning !== undefined && typeof rawIsActiveSetRunning !== 'boolean') {
    return null;
  }
  const isActiveSetRunning = rawIsActiveSetRunning ?? false;
  if (isActiveSetRunning !== (activeSetStartedAt !== null)) return null;

  if (!hasPendingSessionDraft(obj)) return null;

  return {
    weight: obj.weight,
    reps: obj.reps,
    duration: obj.duration,
    rir,
    isWarmupMode,
    isDirty,
    activeSetTime,
    isActiveSetRunning,
    activeSetStartedAt,
  };
}

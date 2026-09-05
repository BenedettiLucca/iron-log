export type FinishIntent =
  | {
      kind: 'empty';
      persist: false;
      primaryAction: 'log_set';
      secondaryAction: 'discard_session';
      finishEnabled: false;
    }
  | {
      kind: 'content';
      persist: true;
      primaryAction: 'finish_workout';
      secondaryAction: 'discard_session';
      finishEnabled: true;
    }
  | {
      kind: 'inert';
      persist: false;
      primaryAction: 'finish_workout';
      secondaryAction: 'discard_session';
      finishEnabled: false;
    };

export function evaluateFinishIntent(opts: {
  workingSetCount: number;
  isSaving: boolean;
}): FinishIntent {
  if (opts.isSaving) {
    return {
      kind: 'inert',
      persist: false,
      primaryAction: 'finish_workout',
      secondaryAction: 'discard_session',
      finishEnabled: false,
    };
  }
  if (!Number.isFinite(opts.workingSetCount) || opts.workingSetCount <= 0) {
    return {
      kind: 'empty',
      persist: false,
      primaryAction: 'log_set',
      secondaryAction: 'discard_session',
      finishEnabled: false,
    };
  }
  return {
    kind: 'content',
    persist: true,
    primaryAction: 'finish_workout',
    secondaryAction: 'discard_session',
    finishEnabled: true,
  };
}

export type MeasurementType = 'weight_reps' | 'bodyweight_reps' | 'duration';

export function validateLoggedSet(input: {
  measurementType: MeasurementType;
  weightKg: number;
  reps: number;
  durationSeconds?: number;
}): { ok: true } | { ok: false; field: 'weight' | 'reps' | 'duration' } {
  if (input.measurementType === 'duration') {
    if (
      input.durationSeconds == null ||
      !Number.isFinite(input.durationSeconds) ||
      !Number.isInteger(input.durationSeconds) ||
      input.durationSeconds <= 0
    ) {
      return { ok: false, field: 'duration' };
    }
    if (input.weightKg != null && (!Number.isFinite(input.weightKg) || input.weightKg < 0)) {
      return { ok: false, field: 'weight' };
    }
    return { ok: true };
  }
  if (
    input.reps == null ||
    !Number.isFinite(input.reps) ||
    !Number.isInteger(input.reps) ||
    input.reps <= 0
  ) {
    return { ok: false, field: 'reps' };
  }
  if (input.weightKg == null || !Number.isFinite(input.weightKg)) {
    return { ok: false, field: 'weight' };
  }
  if (input.measurementType === 'weight_reps' && !(input.weightKg > 0)) {
    return { ok: false, field: 'weight' };
  }
  if (input.measurementType === 'bodyweight_reps' && input.weightKg < 0) {
    return { ok: false, field: 'weight' };
  }
  return { ok: true };
}

export function formatLoggedSet(set: {
  weightKg: number;
  reps: number;
  durationSeconds?: number | null;
}): string {
  if (set.durationSeconds != null) {
    return set.weightKg > 0
      ? `${set.durationSeconds}s x ${set.weightKg}kg`
      : `${set.durationSeconds}s`;
  }
  return `${set.weightKg}kg x ${set.reps}`;
}

export function evaluateRirSelection(opts: {
  value: number;
  rirRange?: { min: number; max: number };
}): {
  valid: boolean;
  requiresConfirmation: boolean;
  rirTargetDeviation: boolean;
} {
  if (
    opts.value == null ||
    !Number.isFinite(opts.value) ||
    !Number.isInteger(opts.value) ||
    opts.value < 0 ||
    opts.value > 10
  ) {
    return { valid: false, requiresConfirmation: false, rirTargetDeviation: false };
  }
  if (!opts.rirRange) {
    return { valid: true, requiresConfirmation: false, rirTargetDeviation: false };
  }
  const deviation = opts.value < opts.rirRange.min || opts.value > opts.rirRange.max;
  return {
    valid: true,
    requiresConfirmation: deviation,
    rirTargetDeviation: deviation,
  };
}

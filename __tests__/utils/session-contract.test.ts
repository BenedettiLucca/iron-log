import { parseEditedSetInput } from '@/src/validators/forms';
import {
  evaluateFinishIntent,
  evaluateRirSelection,
  formatLoggedSet,
  validateLoggedSet,
} from '@/src/utils/session-contract';

describe('Contract A — empty session cannot finish', () => {
  it('routes 0 working sets to empty-state, never persist', () => {
    expect(evaluateFinishIntent({
      workingSetCount: 0,
      isSaving: false,
    })).toEqual({
      kind: 'empty',
      persist: false,
      primaryAction: 'log_set',
      secondaryAction: 'discard_session',
      finishEnabled: false,
    });
  });

  it('allows persist only when there is at least one working set', () => {
    expect(evaluateFinishIntent({
      workingSetCount: 3,
      isSaving: false,
    })).toEqual({
      kind: 'content',
      persist: true,
      primaryAction: 'finish_workout',
      secondaryAction: 'discard_session',
      finishEnabled: true,
    });
  });

  it('makes a second tap inert while saving', () => {
    expect(evaluateFinishIntent({
      workingSetCount: 3,
      isSaving: true,
    }).kind).toBe('inert');
  });

  it('rejects non-finite working-set count and never enables finish', () => {
    expect(evaluateFinishIntent({
      workingSetCount: NaN,
      isSaving: false,
    })).toEqual({
      kind: 'empty',
      persist: false,
      primaryAction: 'log_set',
      secondaryAction: 'discard_session',
      finishEnabled: false,
    });

    expect(evaluateFinishIntent({
      workingSetCount: Infinity,
      isSaving: false,
    })).toEqual({
      kind: 'empty',
      persist: false,
      primaryAction: 'log_set',
      secondaryAction: 'discard_session',
      finishEnabled: false,
    });

    expect(evaluateFinishIntent({
      workingSetCount: -Infinity,
      isSaving: false,
    })).toEqual({
      kind: 'empty',
      persist: false,
      primaryAction: 'log_set',
      secondaryAction: 'discard_session',
      finishEnabled: false,
    });
  });
});

describe('Contract A — measurementType validation', () => {
  it('rejects 100kg × 0 for weight_reps', () => {
    expect(validateLoggedSet({
      measurementType: 'weight_reps',
      weightKg: 100,
      reps: 0,
    })).toEqual({ ok: false, field: 'reps' });
  });

  it('accepts 0kg × 10 for bodyweight_reps', () => {
    expect(validateLoggedSet({
      measurementType: 'bodyweight_reps',
      weightKg: 0,
      reps: 10,
    })).toEqual({ ok: true });
  });

  it('rejects 0kg × 10 for weight_reps', () => {
    expect(validateLoggedSet({
      measurementType: 'weight_reps',
      weightKg: 0,
      reps: 10,
    })).toEqual({ ok: false, field: 'weight' });
  });

  it('accepts 44s with kg/reps zero for duration', () => {
    expect(validateLoggedSet({
      measurementType: 'duration',
      weightKg: 0,
      reps: 0,
      durationSeconds: 44,
    })).toEqual({ ok: true });
  });

  it('rejects non-finite and non-positive duration values', () => {
    expect(validateLoggedSet({
      measurementType: 'duration',
      weightKg: 0,
      reps: 0,
      durationSeconds: NaN,
    })).toEqual({ ok: false, field: 'duration' });

    expect(validateLoggedSet({
      measurementType: 'duration',
      weightKg: 0,
      reps: 0,
      durationSeconds: Infinity,
    })).toEqual({ ok: false, field: 'duration' });

    expect(validateLoggedSet({
      measurementType: 'duration',
      weightKg: 0,
      reps: 0,
      durationSeconds: 0,
    })).toEqual({ ok: false, field: 'duration' });

    expect(validateLoggedSet({
      measurementType: 'duration',
      weightKg: 0,
      reps: 0,
      durationSeconds: -10,
    })).toEqual({ ok: false, field: 'duration' });
  });

  it('rejects non-finite weight and reps in weight_reps and bodyweight_reps', () => {
    expect(validateLoggedSet({
      measurementType: 'weight_reps',
      weightKg: NaN,
      reps: 8,
    })).toEqual({ ok: false, field: 'weight' });

    expect(validateLoggedSet({
      measurementType: 'weight_reps',
      weightKg: Infinity,
      reps: 8,
    })).toEqual({ ok: false, field: 'weight' });

    expect(validateLoggedSet({
      measurementType: 'weight_reps',
      weightKg: 80,
      reps: NaN,
    })).toEqual({ ok: false, field: 'reps' });

    expect(validateLoggedSet({
      measurementType: 'bodyweight_reps',
      weightKg: NaN,
      reps: 10,
    })).toEqual({ ok: false, field: 'weight' });

    expect(validateLoggedSet({
      measurementType: 'bodyweight_reps',
      weightKg: -5,
      reps: 10,
    })).toEqual({ ok: false, field: 'weight' });
  });

  it('legacy parser still accepts 0kg × 10 without measurementType — the gap this contract closes', () => {
    expect(parseEditedSetInput({
      weight: '0',
      reps: '10',
      rir: '2',
      isDuration: false,
    })).toEqual({
      ok: true,
      weightKg: 0,
      reps: 10,
      rir: 2,
    });
  });
});

describe('Contract A — duration set rendering (Prancha 28/08)', () => {
  it('renders 44s, not 0kg × 0', () => {
    expect(formatLoggedSet({
      weightKg: 0,
      reps: 0,
      durationSeconds: 44,
    })).toBe('44s');
  });

  it('renders 32s for the second plank set', () => {
    expect(formatLoggedSet({
      weightKg: 0,
      reps: 0,
      durationSeconds: 32,
    })).toBe('32s');
  });

  it('renders timed set with weight when weightKg > 0', () => {
    expect(formatLoggedSet({
      weightKg: 10,
      reps: 0,
      durationSeconds: 45,
    })).toBe('45s x 10kg');
  });

  it('uses nullish presence so 0s duration does not fall through to 0kg x 0', () => {
    expect(formatLoggedSet({
      weightKg: 0,
      reps: 0,
      durationSeconds: 0,
    })).toBe('0s');
  });

  it('preserves weighted rep rendering', () => {
    expect(formatLoggedSet({
      weightKg: 100,
      reps: 8,
    })).toBe('100kg x 8');

    expect(formatLoggedSet({
      weightKg: 100,
      reps: 8,
      durationSeconds: null,
    })).toBe('100kg x 8');
  });
});

describe('Contract B — rirRange deviation is not invalidity', () => {
  it('keeps RIR 5 valid and flags deviation from meta 1-2', () => {
    expect(evaluateRirSelection({ value: 5, rirRange: { min: 1, max: 2 } })).toEqual({
      valid: true,
      requiresConfirmation: true,
      rirTargetDeviation: true,
    });
  });

  it('flags RIR 5 against a meta of 0 without treating 5 as universally invalid', () => {
    expect(evaluateRirSelection({ value: 5, rirRange: { min: 0, max: 0 } })).toEqual({
      valid: true,
      requiresConfirmation: true,
      rirTargetDeviation: true,
    });
  });

  it('does not flag a value inside the prescribed range', () => {
    expect(evaluateRirSelection({ value: 2, rirRange: { min: 1, max: 2 } })).toEqual({
      valid: true,
      requiresConfirmation: false,
      rirTargetDeviation: false,
    });
  });

  it('degrades without rirRange and never crashes', () => {
    expect(evaluateRirSelection({ value: 5 })).toEqual({
      valid: true,
      requiresConfirmation: false,
      rirTargetDeviation: false,
    });
  });

  it('rejects non-finite RIR values', () => {
    expect(evaluateRirSelection({ value: NaN })).toEqual({
      valid: false,
      requiresConfirmation: false,
      rirTargetDeviation: false,
    });

    expect(evaluateRirSelection({ value: Infinity })).toEqual({
      valid: false,
      requiresConfirmation: false,
      rirTargetDeviation: false,
    });
  });
});

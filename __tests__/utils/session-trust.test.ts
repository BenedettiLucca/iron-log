import { parseEditedSetInput } from '@/src/validators/forms';
import {
  canActOnFinishStats,
  canNavigateAfterPendingSave,
  shouldSavePendingSet,
} from '@/src/utils/session-trust';

describe('set editor validation', () => {
  it.each([
    [{ weight: 'abc', reps: '8', rir: '2', isDuration: false }, 'weight'],
    [{ weight: '80', reps: '3.5', rir: '2', isDuration: false }, 'reps'],
    [{ weight: '0', duration: '1.5', isDuration: true }, 'duration'],
    [{ weight: '80', reps: '8', rir: '11', isDuration: false }, 'rir'],
  ] as const)('rejects invalid %s input', (input, expectedField) => {
    const result = parseEditedSetInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[expectedField]).toBeDefined();
      expect(result.firstErrorField).toBe(expectedField);
    }
  });

  it('preserves valid RIR zero', () => {
    expect(parseEditedSetInput({
      weight: '80',
      reps: '8',
      rir: '0',
      isDuration: false,
    })).toEqual({
      ok: true,
      weightKg: 80,
      reps: 8,
      rir: 0,
    });
  });
});

describe('session trust guards', () => {
  it('requires a save for dirty strength input', () => {
    expect(shouldSavePendingSet({
      isDirty: true,
      exerciseType: 'strength',
      activeSetTime: 0,
      isActiveSetRunning: false,
    })).toBe(true);
  });

  it('requires a save for a completed duration set or edited extra weight', () => {
    expect(shouldSavePendingSet({
      isDirty: false,
      exerciseType: 'duration',
      activeSetTime: 45,
      isActiveSetRunning: false,
    })).toBe(true);
    expect(shouldSavePendingSet({
      isDirty: true,
      exerciseType: 'duration',
      activeSetTime: 0,
      isActiveSetRunning: false,
    })).toBe(true);
  });

  it('blocks navigation when the required save fails', () => {
    expect(canNavigateAfterPendingSave(true, false)).toBe(false);
    expect(canNavigateAfterPendingSave(true, true)).toBe(true);
    expect(canNavigateAfterPendingSave(false, false)).toBe(true);
  });

  it('blocks finish decisions until stats load without error', () => {
    expect(canActOnFinishStats(true, false)).toBe(false);
    expect(canActOnFinishStats(false, true)).toBe(false);
    expect(canActOnFinishStats(false, false)).toBe(true);
  });
});

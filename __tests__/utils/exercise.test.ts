import {
  countCompletedRoutineExercises,
  parseTargetSets,
} from '@/src/utils/exercise';

describe('parseTargetSets', () => {
  it('returns null for null input', () => {
    expect(parseTargetSets(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseTargetSets(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseTargetSets('')).toBeNull();
  });

  it('extracts sets from "3x8-12"', () => {
    expect(parseTargetSets('3x8-12')).toBe(3);
  });

  it('extracts sets from "4x10"', () => {
    expect(parseTargetSets('4x10')).toBe(4);
  });

  it('extracts sets from "3x8"', () => {
    expect(parseTargetSets('3x8')).toBe(3);
  });

  it('returns null for duration-based target "60s"', () => {
    expect(parseTargetSets('60s')).toBeNull();
  });

  it('returns null for "invalid"', () => {
    expect(parseTargetSets('invalid')).toBeNull();
  });

  it('extracts sets from "5x5"', () => {
    expect(parseTargetSets('5x5')).toBe(5);
  });

  it('extracts sets from "10x3" (high sets)', () => {
    expect(parseTargetSets('10x3')).toBe(10);
  });
});

describe('countCompletedRoutineExercises', () => {
  const exercises = [
    { id: 1, target: '3x8' },
    { id: 2, target: null },
  ];

  it('does not complete targeted or targetless exercises with warm-up sets alone', () => {
    const sessionSets = [
      { exerciseId: 1, isWarmup: true },
      { exerciseId: 1, isWarmup: true },
      { exerciseId: 1, isWarmup: true },
      { exerciseId: 2, isWarmup: true },
    ];

    expect(countCompletedRoutineExercises(exercises, sessionSets)).toBe(0);
  });

  it('completes exercises from working sets while ignoring additional warm-ups', () => {
    const sessionSets = [
      { exerciseId: 1, isWarmup: true },
      { exerciseId: 1, isWarmup: false },
      { exerciseId: 1, isWarmup: false },
      { exerciseId: 1, isWarmup: false },
      { exerciseId: 2, isWarmup: false },
    ];

    expect(countCompletedRoutineExercises(exercises, sessionSets)).toBe(2);
  });

  it('keeps progress isolated per exercise', () => {
    const sessionSets = [
      { exerciseId: 1, isWarmup: false },
      { exerciseId: 1, isWarmup: false },
      { exerciseId: 2, isWarmup: false },
    ];

    expect(countCompletedRoutineExercises(exercises, sessionSets)).toBe(1);
  });
});

import { generateExerciseVerdict } from '@/src/utils/session-verdicts';
import { SummarySet } from '@/src/utils/session-summary';

const t = (key: string, vars?: Record<string, string | number>) => {
  if (key === 'common.exercise') return 'Exercise';
  if (key === 'summary.verdicts.suggestIncreaseNumeric') return `Next time try ${vars?.weight}kg`;
  if (key === 'summary.verdicts.suggestIncreaseGeneric') return 'Increase load next session';
  if (key === 'summary.verdicts.suggestHold') return 'Maintain current load';
  if (key === 'summary.verdicts.suggestReviewFatigue') return 'Lower load or rest more';
  if (key === 'summary.verdicts.suggestCheckLogging') return 'Verify logged sets details';
  return key;
};

describe('generateExerciseVerdict', () => {
  const baseSet: Omit<SummarySet, 'setNumber' | 'reps' | 'weightKg' | 'rir' | 'isWarmup'> = {
    exerciseId: 1,
    exerciseName: 'Bench Press',
    durationSeconds: null,
    deletedAt: null,
  };

  it('verdict is increase when all sets are at top of range', () => {
    const sets: SummarySet[] = [
      { ...baseSet, setNumber: 1, reps: 8, weightKg: 80, rir: null, isWarmup: false },
      { ...baseSet, setNumber: 2, reps: 8, weightKg: 80, rir: null, isWarmup: false },
      { ...baseSet, setNumber: 3, reps: 8, weightKg: 80, rir: null, isWarmup: false },
    ];
    const result = generateExerciseVerdict(1, 'Bench Press', '3x5-8', sets, t);
    expect(result.result).toBe('top');
    expect(result.verdict).toBe('increase');
    expect(result.nextLoadSuggestion).toBe('Next time try 82.5kg');
    expect(result.confidence).toBe('high');
    expect(result.flags).toEqual([]);
  });

  it('verdict is hold when sets are inside range but not all at top', () => {
    const sets: SummarySet[] = [
      { ...baseSet, setNumber: 1, reps: 8, weightKg: 80, rir: null, isWarmup: false },
      { ...baseSet, setNumber: 2, reps: 7, weightKg: 80, rir: null, isWarmup: false },
      { ...baseSet, setNumber: 3, reps: 6, weightKg: 80, rir: null, isWarmup: false },
    ];
    const result = generateExerciseVerdict(1, 'Bench Press', '3x5-8', sets, t);
    expect(result.result).toBe('within');
    expect(result.verdict).toBe('hold');
    expect(result.nextLoadSuggestion).toBe('Maintain current load');
    expect(result.confidence).toBe('high');
    expect(result.flags).toEqual([]);
  });

  it('verdict is review_fatigue when multiple sets fall below min reps', () => {
    const sets: SummarySet[] = [
      { ...baseSet, setNumber: 1, reps: 8, weightKg: 80, rir: null, isWarmup: false },
      { ...baseSet, setNumber: 2, reps: 4, weightKg: 80, rir: null, isWarmup: false },
      { ...baseSet, setNumber: 3, reps: 3, weightKg: 80, rir: null, isWarmup: false },
    ];
    const result = generateExerciseVerdict(1, 'Bench Press', '3x5-8', sets, t);
    expect(result.result).toBe('below');
    expect(result.verdict).toBe('review_fatigue');
    expect(result.nextLoadSuggestion).toBe('Lower load or rest more');
    expect(result.flags).toContain('repeated_below_range');
  });

  it('verdict is review_fatigue when sharp rep drop occurs between same-weight sets', () => {
    const sets: SummarySet[] = [
      { ...baseSet, setNumber: 1, reps: 8, weightKg: 80, rir: null, isWarmup: false },
      { ...baseSet, setNumber: 2, reps: 5, weightKg: 80, rir: null, isWarmup: false },
      { ...baseSet, setNumber: 3, reps: 5, weightKg: 80, rir: null, isWarmup: false },
    ];
    const result = generateExerciseVerdict(1, 'Bench Press', '3x5-8', sets, t);
    // drop from 8 to 5 is 3 reps drop (abrupt rep drop)
    expect(result.verdict).toBe('review_fatigue');
    expect(result.flags).toContain('abrupt_rep_drop');
  });

  it('verdict is check_logging when suspicious RIR inversion / inconsistency occurs', () => {
    const sets: SummarySet[] = [
      { ...baseSet, setNumber: 1, reps: 8, weightKg: 80, rir: 1, isWarmup: false },
      { ...baseSet, setNumber: 2, reps: 8, weightKg: 80, rir: 2, isWarmup: false },
    ];
    const result = generateExerciseVerdict(1, 'Bench Press', '2x5-8', sets, t);
    expect(result.verdict).toBe('check_logging');
    expect(result.flags).toContain('rir_inversion');
    expect(result.nextLoadSuggestion).toBe('Verify logged sets details');
  });

  it('flag extra_sets is present when user performs more sets than target sets', () => {
    const sets: SummarySet[] = [
      { ...baseSet, setNumber: 1, reps: 8, weightKg: 80, rir: null, isWarmup: false },
      { ...baseSet, setNumber: 2, reps: 8, weightKg: 80, rir: null, isWarmup: false },
      { ...baseSet, setNumber: 3, reps: 8, weightKg: 80, rir: null, isWarmup: false },
      { ...baseSet, setNumber: 4, reps: 8, weightKg: 80, rir: null, isWarmup: false },
    ];
    const result = generateExerciseVerdict(1, 'Bench Press', '3x5-8', sets, t);
    expect(result.flags).toContain('extra_sets');
  });

  it('result is no_target when target string cannot be parsed', () => {
    const sets: SummarySet[] = [
      { ...baseSet, setNumber: 1, reps: 8, weightKg: 80, rir: null, isWarmup: false },
    ];
    const result = generateExerciseVerdict(1, 'Bench Press', 'some random text', sets, t);
    expect(result.result).toBe('no_target');
    expect(result.verdict).toBe('hold');
    expect(result.confidence).toBe('low');
  });

  it('ignores duration only target like 60s', () => {
    const sets: SummarySet[] = [
      { ...baseSet, setNumber: 1, reps: 1, weightKg: 80, rir: null, isWarmup: false, durationSeconds: 60 },
    ];
    const result = generateExerciseVerdict(1, 'Plank', '60s', sets, t);
    expect(result.result).toBe('no_target');
  });

  it('parses rep targets even when they include trailing annotations', () => {
    const sets: SummarySet[] = [
      { ...baseSet, setNumber: 1, reps: 10, weightKg: 80, rir: null, isWarmup: false },
      { ...baseSet, setNumber: 2, reps: 9, weightKg: 80, rir: null, isWarmup: false },
      { ...baseSet, setNumber: 3, reps: 8, weightKg: 80, rir: null, isWarmup: false },
    ];
    const result = generateExerciseVerdict(1, 'Bench Press', '3x8-12 pause', sets, t);
    expect(result.result).toBe('within');
    expect(result.verdict).toBe('hold');
    expect(result.confidence).toBe('high');
  });
});

import {
  calculateWarmupProgression,
  formatWarmupProgression,
  getWarmupReps,
} from '@/src/utils/warmup';

describe('calculateWarmupProgression', () => {
  it('returns empty array for zero working weight', () => {
    expect(calculateWarmupProgression(0)).toEqual([]);
  });

  it('returns empty array for negative working weight', () => {
    expect(calculateWarmupProgression(-10)).toEqual([]);
  });

  it('returns 3 warmup sets by default', () => {
    const result = calculateWarmupProgression(100);
    expect(result).toHaveLength(3);
  });

  it('returns correct number of sets for custom warmupCount', () => {
    const result = calculateWarmupProgression(100, 2);
    expect(result).toHaveLength(2);
  });

  it('progression weights increase toward working weight', () => {
    const result = calculateWarmupProgression(100);
    for (let i = 1; i < result.length; i++) {
      expect(result[i].weight).toBeGreaterThan(result[i - 1].weight);
    }
  });

  it('all weights are less than working weight', () => {
    const result = calculateWarmupProgression(100);
    result.forEach((step) => {
      expect(step.weight).toBeLessThan(100);
      expect(step.weight).toBeGreaterThan(0);
    });
  });

  it('weights are rounded to nearest 0.5kg', () => {
    const result = calculateWarmupProgression(73);
    result.forEach((step) => {
      expect(step.weight % 0.5).toBe(0);
    });
  });

  it('each step has correct structure', () => {
    const result = calculateWarmupProgression(100);
    result.forEach((step) => {
      expect(step).toHaveProperty('weight');
      expect(step).toHaveProperty('reps');
      expect(step).toHaveProperty('percentage');
      expect(typeof step.weight).toBe('number');
      expect(typeof step.reps).toBe('number');
      expect(typeof step.percentage).toBe('number');
    });
  });

  it('percentages are 40, 60, 80 by default', () => {
    const result = calculateWarmupProgression(100);
    expect(result[0].percentage).toBe(40);
    expect(result[1].percentage).toBe(60);
    expect(result[2].percentage).toBe(80);
  });

  it('uses correct reps parameter', () => {
    const result = calculateWarmupProgression(100, 3, 5);
    result.forEach((step) => {
      expect(step.reps).toBe(5);
    });
  });
});

describe('formatWarmupProgression', () => {
  it('returns empty string for empty array', () => {
    expect(formatWarmupProgression([])).toBe('');
  });

  it('formats single warmup set', () => {
    const warmups = [{ weight: 40, reps: 8, percentage: 40 }];
    expect(formatWarmupProgression(warmups)).toBe('40kg\u00d78');
  });

  it('formats multiple warmup sets with comma separator', () => {
    const warmups = [
      { weight: 40, reps: 8, percentage: 40 },
      { weight: 60, reps: 8, percentage: 60 },
      { weight: 80, reps: 8, percentage: 80 },
    ];
    const result = formatWarmupProgression(warmups);
    expect(result).toBe('40kg\u00d78, 60kg\u00d78, 80kg\u00d78');
  });

  it('handles fractional weights', () => {
    const warmups = [{ weight: 22.5, reps: 10, percentage: 50 }];
    expect(formatWarmupProgression(warmups)).toBe('22.5kg\u00d710');
  });
});

describe('getWarmupReps', () => {
  it('returns 10 for reps <= 5 (heavy strength)', () => {
    expect(getWarmupReps(1)).toBe(10);
    expect(getWarmupReps(3)).toBe(10);
    expect(getWarmupReps(5)).toBe(10);
  });

  it('returns 8 for reps 6-8', () => {
    expect(getWarmupReps(6)).toBe(8);
    expect(getWarmupReps(7)).toBe(8);
    expect(getWarmupReps(8)).toBe(8);
  });

  it('returns 6 for reps 9-12', () => {
    expect(getWarmupReps(9)).toBe(6);
    expect(getWarmupReps(10)).toBe(6);
    expect(getWarmupReps(12)).toBe(6);
  });

  it('returns 5 for reps > 12 (high rep)', () => {
    expect(getWarmupReps(13)).toBe(5);
    expect(getWarmupReps(15)).toBe(5);
    expect(getWarmupReps(20)).toBe(5);
  });
});

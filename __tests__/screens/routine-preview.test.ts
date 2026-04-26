// Tests for Routine Preview Screen — pure functions extracted from the component
// No DB dependency — all logic tested in isolation

// ---------------------------------------------------------------------------
// Re-implement pure functions from app/routine/[routineId].tsx
// ---------------------------------------------------------------------------

function formatDate(epoch: number | null): string {
  if (!epoch) return '\u2014';
  return new Date(epoch).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function formatRest(seconds: number | null): string {
  if (!seconds) return '';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m`;
}

function estimateE1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function calcEstimatedDuration(totalExercises: number): number {
  return Math.max(15, totalExercises * 3);
}

interface WeightPoint {
  date: string;
  weight: number;
}

function computeWeightHistory(
  rawHistory: { startTime: number; weightKg: number | null }[]
): WeightPoint[] {
  return rawHistory
    .filter(w => w.weightKg !== null)
    .map(w => ({
      date: new Date(w.startTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      weight: w.weightKg!,
    }))
    .reverse();
}

function computeBarHeights(
  history: WeightPoint[],
  minBarHeight: number = 20,
  maxBarHeight: number = 60
): number[] {
  if (history.length === 0) return [];
  const weights = history.map(w => w.weight);
  const maxW = Math.max(...weights);
  const minW = Math.min(...weights);
  const range = maxW - minW || 1;
  const availableHeight = maxBarHeight - minBarHeight;
  return history.map(point => {
    return ((point.weight - minW) / range) * availableHeight + minBarHeight;
  });
}

function countExercisesWithPRs(
  exercises: { prWeight: number | null }[]
): number {
  return exercises.filter(e => e.prWeight !== null).length;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Routine Preview Screen \u2014 pure functions', () => {

  // =========================================================================
  describe('formatDate', () => {
    it('returns "\u2014" for null', () => {
      expect(formatDate(null)).toBe('\u2014');
    });

    it('formats a known epoch to pt-BR date', () => {
      const epoch = new Date(2025, 3, 26).getTime();
      const result = formatDate(epoch);
      expect(result).toMatch(/26\/04\/25/);
    });

    it('treats epoch 0 as falsy and returns dash', () => {
      // epoch 0 is falsy in JS, so the guard clause catches it
      const result = formatDate(0);
      expect(result).toBe('\u2014');
    });

    it('pads single-digit day/month', () => {
      const epoch = new Date(2025, 0, 5).getTime();
      const result = formatDate(epoch);
      expect(result).toMatch(/05\/01\/25/);
    });
  });

  // =========================================================================
  describe('formatRest', () => {
    it('returns empty string for null', () => {
      expect(formatRest(null)).toBe('');
    });

    it('returns empty string for 0', () => {
      expect(formatRest(0)).toBe('');
    });

    it('formats seconds under 60 as "Xs"', () => {
      expect(formatRest(30)).toBe('30s');
      expect(formatRest(45)).toBe('45s');
      expect(formatRest(59)).toBe('59s');
    });

    it('formats exactly 60 seconds as "1m"', () => {
      expect(formatRest(60)).toBe('1m');
    });

    it('formats 90 seconds as "1m"', () => {
      expect(formatRest(90)).toBe('1m');
    });

    it('formats 120 seconds as "2m"', () => {
      expect(formatRest(120)).toBe('2m');
    });

    it('formats 180 seconds as "3m"', () => {
      expect(formatRest(180)).toBe('3m');
    });

    it('truncates remainder seconds', () => {
      expect(formatRest(150)).toBe('2m');
    });
  });

  // =========================================================================
  describe('estimateE1RM (Epley formula)', () => {
    it('returns weight as-is for 1 rep', () => {
      expect(estimateE1RM(100, 1)).toBe(100);
    });

    it('calculates for 5 reps correctly', () => {
      expect(estimateE1RM(100, 5)).toBe(116.7);
    });

    it('calculates for 10 reps', () => {
      expect(estimateE1RM(80, 10)).toBe(106.7);
    });

    it('returns 0 for zero weight', () => {
      expect(estimateE1RM(0, 10)).toBe(0);
    });

    it('returns 0 for zero reps', () => {
      expect(estimateE1RM(100, 0)).toBe(0);
    });

    it('returns 0 for negative values', () => {
      expect(estimateE1RM(-50, 5)).toBe(0);
      expect(estimateE1RM(100, -3)).toBe(0);
    });

    it('handles fractional weight', () => {
      expect(estimateE1RM(22.5, 8)).toBe(28.5);
    });
  });

  // =========================================================================
  describe('calcEstimatedDuration', () => {
    it('returns minimum 15 minutes for 0 exercises', () => {
      expect(calcEstimatedDuration(0)).toBe(15);
    });

    it('returns minimum 15 minutes for 1 exercise', () => {
      expect(calcEstimatedDuration(1)).toBe(15);
    });

    it('returns minimum 15 minutes for 4 exercises', () => {
      expect(calcEstimatedDuration(4)).toBe(15);
    });

    it('returns 15 for 5 exercises', () => {
      expect(calcEstimatedDuration(5)).toBe(15);
    });

    it('calculates 18 minutes for 6 exercises', () => {
      expect(calcEstimatedDuration(6)).toBe(18);
    });

    it('calculates 30 minutes for 10 exercises', () => {
      expect(calcEstimatedDuration(10)).toBe(30);
    });

    it('calculates 36 minutes for 12 exercises', () => {
      expect(calcEstimatedDuration(12)).toBe(36);
    });
  });

  // =========================================================================
  describe('computeWeightHistory', () => {
    it('returns empty array for empty input', () => {
      expect(computeWeightHistory([])).toEqual([]);
    });

    it('filters out null weightKg entries', () => {
      const input = [
        { startTime: 1714000000000, weightKg: 80 },
        { startTime: 1714086400000, weightKg: null },
        { startTime: 1714172800000, weightKg: 85 },
      ];
      const result = computeWeightHistory(input);
      expect(result).toHaveLength(2);
      expect(result[0].weight).toBe(85);
      expect(result[1].weight).toBe(80);
    });

    it('reverses the order (oldest first)', () => {
      const input = [
        { startTime: 1714172800000, weightKg: 90 },
        { startTime: 1714086400000, weightKg: 80 },
        { startTime: 1714000000000, weightKg: 70 },
      ];
      const result = computeWeightHistory(input);
      expect(result[0].weight).toBe(70);
      expect(result[2].weight).toBe(90);
    });

    it('formats dates as DD/MM pt-BR', () => {
      const input = [
        { startTime: new Date(2025, 3, 26).getTime(), weightKg: 100 },
      ];
      const result = computeWeightHistory(input);
      expect(result[0].date).toMatch(/26\/04/);
    });

    it('handles single entry', () => {
      const input = [
        { startTime: 1714000000000, weightKg: 75 },
      ];
      const result = computeWeightHistory(input);
      expect(result).toHaveLength(1);
      expect(result[0].weight).toBe(75);
    });

    it('returns empty when all weights are null', () => {
      const input = [
        { startTime: 1714000000000, weightKg: null },
        { startTime: 1714086400000, weightKg: null },
      ];
      expect(computeWeightHistory(input)).toEqual([]);
    });
  });

  // =========================================================================
  describe('computeBarHeights', () => {
    it('returns empty array for empty history', () => {
      expect(computeBarHeights([])).toEqual([]);
    });

    it('returns minBarHeight for single data point', () => {
      const history = [{ date: '26/04', weight: 100 }];
      const result = computeBarHeights(history);
      expect(result).toEqual([20]);
    });

    it('returns uniform heights for uniform weights', () => {
      const history = [
        { date: '26/04', weight: 80 },
        { date: '27/04', weight: 80 },
        { date: '28/04', weight: 80 },
      ];
      const result = computeBarHeights(history);
      expect(result).toEqual([20, 20, 20]);
    });

    it('computes proportional heights for varying weights', () => {
      const history = [
        { date: '26/04', weight: 60 },
        { date: '27/04', weight: 80 },
        { date: '28/04', weight: 100 },
      ];
      const result = computeBarHeights(history);
      expect(result[0]).toBeCloseTo(20, 1);
      expect(result[1]).toBeCloseTo(40, 1);
      expect(result[2]).toBeCloseTo(60, 1);
    });

    it('all heights are within bounds', () => {
      const history = Array.from({ length: 20 }, (_, i) => ({
        date: `day${i}`,
        weight: 50 + Math.random() * 50,
      }));
      const result = computeBarHeights(history);
      result.forEach(h => {
        expect(h).toBeGreaterThanOrEqual(20);
        expect(h).toBeLessThanOrEqual(60);
      });
    });

    it('uses custom min/max bar heights', () => {
      const history = [
        { date: '01/01', weight: 50 },
        { date: '02/01', weight: 100 },
      ];
      const result = computeBarHeights(history, 10, 50);
      expect(result[0]).toBeCloseTo(10, 1);
      expect(result[1]).toBeCloseTo(50, 1);
    });
  });

  // =========================================================================
  describe('countExercisesWithPRs', () => {
    it('returns 0 for empty list', () => {
      expect(countExercisesWithPRs([])).toBe(0);
    });

    it('returns 0 when no exercises have PRs', () => {
      const exercises = [
        { prWeight: null },
        { prWeight: null },
        { prWeight: null },
      ];
      expect(countExercisesWithPRs(exercises)).toBe(0);
    });

    it('counts only exercises with non-null prWeight', () => {
      const exercises = [
        { prWeight: 100 },
        { prWeight: null },
        { prWeight: 80.5 },
        { prWeight: null },
        { prWeight: 120 },
      ];
      expect(countExercisesWithPRs(exercises)).toBe(3);
    });

    it('counts all exercises if all have PRs', () => {
      const exercises = [
        { prWeight: 50 },
        { prWeight: 60 },
        { prWeight: 70 },
      ];
      expect(countExercisesWithPRs(exercises)).toBe(3);
    });

    it('counts exercise with prWeight=0 as having a PR', () => {
      const exercises = [
        { prWeight: 0 },
        { prWeight: null },
      ];
      expect(countExercisesWithPRs(exercises)).toBe(1);
    });
  });
});

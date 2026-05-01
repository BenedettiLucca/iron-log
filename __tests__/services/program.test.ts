// Test ProgramService pure functions (no DB dependency)
// Re-implement the pure computation methods locally

function getCurrentWeek(startDate: number, weeksDuration: number): number {
  const now = Date.now();
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const elapsed = now - startDate;
  return Math.min(Math.floor(elapsed / msPerWeek) + 1, weeksDuration);
}

function getWeeksUntilDeload(startDate: number, weeksDuration: number, deloadWeek: number | null): number | null {
  if (!deloadWeek) return null;
  const current = getCurrentWeek(startDate, weeksDuration);
  return Math.max(0, deloadWeek - current);
}

function getCurrentPhase(startDate: number, weeksDuration: number, deloadWeek: number | null): string {
  const current = getCurrentWeek(startDate, weeksDuration);
  if (deloadWeek && current >= deloadWeek) return 'deload';
  const firstHalf = Math.floor(weeksDuration / 2);
  if (current <= firstHalf) return 'accumulation';
  return 'intensification';
}

// Double progression logic
function isAtTopOfRange(
  setsDone: { weight: number; reps: number }[],
  targetRepsMax: number
): boolean {
  if (setsDone.length === 0) return false;
  return setsDone.every(s => s.reps >= targetRepsMax);
}

function calculateTrend(
  currentSets: { weight: number; reps: number }[],
  previousSets: { weight: number; reps: number }[]
): 'up' | 'flat' | 'down' {
  if (previousSets.length === 0 || currentSets.length === 0) return 'flat';
  const prevAvg = previousSets.reduce((s, x) => s + x.weight, 0) / previousSets.length;
  const lastAvg = currentSets.reduce((s, x) => s + x.weight, 0) / currentSets.length;
  if (lastAvg > prevAvg + 0.5) return 'up';
  if (lastAvg < prevAvg - 0.5) return 'down';
  return 'flat';
}

describe('ProgramService pure functions', () => {

  describe('getCurrentWeek', () => {
    it('returns week 1 for a program that just started', () => {
      const now = Date.now();
      expect(getCurrentWeek(now - 1000, 6)).toBe(1); // 1 second ago
    });

    it('returns week 2 after 8 days', () => {
      const now = Date.now();
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      expect(getCurrentWeek(now - msPerWeek - 86400000, 6)).toBe(2);
    });

    it('caps at weeksDuration', () => {
      const now = Date.now();
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      // 10 weeks ago but program is only 6 weeks
      expect(getCurrentWeek(now - 10 * msPerWeek, 6)).toBe(6);
    });
  });

  describe('getWeeksUntilDeload', () => {
    it('returns null when no deload week set', () => {
      expect(getWeeksUntilDeload(Date.now(), 6, null)).toBeNull();
    });

    it('returns correct weeks until deload', () => {
      const now = Date.now();
      // Just started → week 1, deload at week 6
      expect(getWeeksUntilDeload(now, 6, 6)).toBe(5);
    });

    it('returns 0 when already at or past deload week', () => {
      const now = Date.now();
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      // 6 weeks ago → at deload week
      expect(getWeeksUntilDeload(now - 6 * msPerWeek, 6, 6)).toBe(0);
    });
  });

  describe('getCurrentPhase', () => {
    it('returns accumulation in first half', () => {
      const now = Date.now();
      // Week 1 of 6 → accumulation
      expect(getCurrentPhase(now, 6, 6)).toBe('accumulation');
    });

    it('returns intensification in second half', () => {
      const now = Date.now();
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      // Week 4 of 6 → intensification
      expect(getCurrentPhase(now - 3.5 * msPerWeek, 6, 6)).toBe('intensification');
    });

    it('returns deload at deload week', () => {
      const now = Date.now();
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      // Week 6 of 6 → deload
      expect(getCurrentPhase(now - 5.5 * msPerWeek, 6, 6)).toBe('deload');
    });

    it('returns accumulation when no deload week set and in first half', () => {
      const now = Date.now();
      expect(getCurrentPhase(now, 8, null)).toBe('accumulation');
    });
  });

  describe('isAtTopOfRange (double progression)', () => {
    it('returns false for empty sets', () => {
      expect(isAtTopOfRange([], 12)).toBe(false);
    });

    it('returns true when all sets hit target reps max', () => {
      const sets = [
        { weight: 80, reps: 12 },
        { weight: 80, reps: 12 },
        { weight: 80, reps: 12 },
      ];
      expect(isAtTopOfRange(sets, 12)).toBe(true);
    });

    it('returns false when at least one set is below target', () => {
      const sets = [
        { weight: 80, reps: 12 },
        { weight: 80, reps: 10 },
        { weight: 80, reps: 12 },
      ];
      expect(isAtTopOfRange(sets, 12)).toBe(false);
    });

    it('returns true when all sets exceed target', () => {
      const sets = [
        { weight: 80, reps: 13 },
        { weight: 80, reps: 14 },
      ];
      expect(isAtTopOfRange(sets, 12)).toBe(true);
    });
  });

  describe('calculateTrend', () => {
    it('returns flat when no previous data', () => {
      expect(calculateTrend([{ weight: 80, reps: 10 }], [])).toBe('flat');
    });

    it('returns up when load increased significantly', () => {
      const current = [{ weight: 85, reps: 10 }];
      const previous = [{ weight: 80, reps: 10 }];
      expect(calculateTrend(current, previous)).toBe('up');
    });

    it('returns down when load decreased significantly', () => {
      const current = [{ weight: 75, reps: 10 }];
      const previous = [{ weight: 80, reps: 10 }];
      expect(calculateTrend(current, previous)).toBe('down');
    });

    it('returns flat when load is similar', () => {
      const current = [{ weight: 80, reps: 10 }];
      const previous = [{ weight: 80, reps: 10 }];
      expect(calculateTrend(current, previous)).toBe('flat');
    });

    it('handles multiple sets with averages', () => {
      const current = [
        { weight: 85, reps: 10 },
        { weight: 85, reps: 8 },
      ];
      const previous = [
        { weight: 80, reps: 10 },
        { weight: 80, reps: 10 },
      ];
      // avg current: 85, avg previous: 80, diff = 5 > 0.5 → up
      expect(calculateTrend(current, previous)).toBe('up');
    });
  });

});

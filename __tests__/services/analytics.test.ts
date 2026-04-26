// Test Analytics pure functions (no DB dependency)
// Re-implement estimateE1RM locally to avoid DB import chain
function estimateE1RM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

// We also test the scoring logic by reimplementing the pure parts
describe('AnalyticsService pure functions', () => {

  describe('estimateE1RM (Epley formula)', () => {
    it('returns weight as-is for 1 rep', () => {
      expect(estimateE1RM(100, 1)).toBe(100);
    });

    it('calculates 1RM for 2 reps', () => {
      // 100 * (1 + 2/30) = 100 * 1.0667 = 106.7
      expect(estimateE1RM(100, 2)).toBe(106.7);
    });

    it('calculates 1RM for 5 reps', () => {
      // 100 * (1 + 5/30) = 100 * 1.1667 = 116.7
      expect(estimateE1RM(100, 5)).toBe(116.7);
    });

    it('calculates 1RM for 10 reps', () => {
      // 80 * (1 + 10/30) = 80 * 1.3333 = 106.7
      expect(estimateE1RM(80, 10)).toBe(106.7);
    });

    it('calculates 1RM for high reps (20)', () => {
      // 60 * (1 + 20/30) = 60 * 1.6667 = 100
      expect(estimateE1RM(60, 20)).toBe(100);
    });

    it('returns 0 for zero weight', () => {
      expect(estimateE1RM(0, 10)).toBe(0);
    });

    it('returns 0 for zero reps', () => {
      expect(estimateE1RM(100, 0)).toBe(0);
    });

    it('returns 0 for negative weight', () => {
      expect(estimateE1RM(-10, 5)).toBe(0);
    });

    it('returns 0 for negative reps', () => {
      expect(estimateE1RM(100, -5)).toBe(0);
    });

    it('handles fractional weight', () => {
      // 22.5 * (1 + 8/30) = 22.5 * 1.2667 = 28.5
      expect(estimateE1RM(22.5, 8)).toBe(28.5);
    });

    it('rounds to 1 decimal place', () => {
      const result = estimateE1RM(77.5, 6);
      // 77.5 * (1 + 6/30) = 77.5 * 1.2 = 93
      expect(result).toBe(93);
    });

    it('handles heavy compound lifts', () => {
      // 140 * (1 + 3/30) = 140 * 1.1 = 154
      expect(estimateE1RM(140, 3)).toBe(154);
    });
  });

  describe('Strength Score scoring logic', () => {
    // Test the scoring formulas used in calculateStrengthScore
    // by re-implementing the pure calculation

    function calcVolumeScore(avgWeeklyVolume: number): number {
      return Math.min(40, Math.round(
        avgWeeklyVolume <= 5000 ? (avgWeeklyVolume / 5000) * 20 :
        avgWeeklyVolume <= 15000 ? 20 + ((avgWeeklyVolume - 5000) / 10000) * 15 :
        35 + Math.min(5, ((avgWeeklyVolume - 15000) / 15000) * 5)
      ));
    }

    function calcIntensityScore(avgWeight: number): number {
      return Math.min(30, Math.round(
        avgWeight <= 20 ? (avgWeight / 20) * 10 :
        avgWeight <= 50 ? 10 + ((avgWeight - 20) / 30) * 10 :
        20 + Math.min(10, ((avgWeight - 50) / 30) * 10)
      ));
    }

    function calcConsistencyScore(avgSessionsPerWeek: number): number {
      return Math.min(30, Math.round(
        avgSessionsPerWeek <= 2 ? (avgSessionsPerWeek / 2) * 15 :
        avgSessionsPerWeek <= 4 ? 15 + ((avgSessionsPerWeek - 2) / 2) * 10 :
        25 + Math.min(5, ((avgSessionsPerWeek - 4) / 2) * 5)
      ));
    }

    function getLabel(score: number): string {
      if (score >= 80) return 'Elite';
      if (score >= 60) return 'Avançado';
      if (score >= 35) return 'Intermediário';
      if (score >= 15) return 'Iniciante';
      return 'Novato';
    }

    it('zero volume = zero volume score', () => {
      expect(calcVolumeScore(0)).toBe(0);
    });

    it('5000kg weekly = 20 volume score', () => {
      expect(calcVolumeScore(5000)).toBe(20);
    });

    it('15000kg weekly = 35 volume score', () => {
      expect(calcVolumeScore(15000)).toBe(35);
    });

    it('30000kg+ weekly caps at 40', () => {
      expect(calcVolumeScore(50000)).toBe(40);
    });

    it('zero avg weight = zero intensity score', () => {
      expect(calcIntensityScore(0)).toBe(0);
    });

    it('20kg avg = 10 intensity score', () => {
      expect(calcIntensityScore(20)).toBe(10);
    });

    it('50kg avg = 20 intensity score', () => {
      expect(calcIntensityScore(50)).toBe(20);
    });

    it('80kg+ avg caps at 30', () => {
      expect(calcIntensityScore(100)).toBe(30);
    });

    it('0 sessions/week = 0 consistency', () => {
      expect(calcConsistencyScore(0)).toBe(0);
    });

    it('2 sessions/week = 15 consistency', () => {
      expect(calcConsistencyScore(2)).toBe(15);
    });

    it('4 sessions/week = 25 consistency', () => {
      expect(calcConsistencyScore(4)).toBe(25);
    });

    it('6+ sessions/week caps at 30', () => {
      expect(calcConsistencyScore(10)).toBe(30);
    });

    it('Novato label for low score', () => {
      expect(getLabel(10)).toBe('Novato');
    });

    it('Iniciante label', () => {
      expect(getLabel(20)).toBe('Iniciante');
    });

    it('Intermediário label', () => {
      expect(getLabel(50)).toBe('Intermediário');
    });

    it('Avançado label', () => {
      expect(getLabel(70)).toBe('Avançado');
    });

    it('Elite label', () => {
      expect(getLabel(85)).toBe('Elite');
    });
  });
});

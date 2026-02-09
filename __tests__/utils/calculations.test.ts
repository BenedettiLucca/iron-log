import {
  calculate1RM,
  calculateVolume,
  calculateIntensity,
  getEffortLevel,
  isPersonalRecord,
} from '../../utils/calculations';

describe('calculations', () => {
  describe('calculate1RM', () => {
    it('should calculate 1RM using Epley formula', () => {
      const result = calculate1RM(100, 5, 'epley');
      expect(result).toBeCloseTo(116.67, 1);
    });

    it('should calculate 1RM using Brzycki formula', () => {
      const result = calculate1RM(100, 5, 'brzycki');
      expect(result).toBeCloseTo(112.5, 1);
    });

    it('should calculate 1RM using average formula', () => {
      const result = calculate1RM(100, 5, 'average');
      expect(result).toBeCloseTo(114.59, 1);
    });

    it('should return weight for single rep', () => {
      const result = calculate1RM(100, 1, 'average');
      expect(result).toBe(100);
    });

    it('should return 0 for invalid reps', () => {
      const result = calculate1RM(100, 0, 'average');
      expect(result).toBe(0);
    });
  });

  describe('calculateVolume', () => {
    it('should calculate volume load', () => {
      const result = calculateVolume(100, 10);
      expect(result).toBe(1000);
    });

    it('should handle zero weight', () => {
      const result = calculateVolume(0, 10);
      expect(result).toBe(0);
    });
  });

  describe('calculateIntensity', () => {
    it('should calculate intensity percentage', () => {
      const result = calculateIntensity(80, 100);
      expect(result).toBe(80);
    });

    it('should return 0 when 1RM is 0', () => {
      const result = calculateIntensity(80, 0);
      expect(result).toBe(0);
    });
  });

  describe('getEffortLevel', () => {
    it('should return easy level for high RIR', () => {
      const result = getEffortLevel(4);
      expect(result.level).toBe('easy');
      expect(result.percentage).toBe(50);
    });

    it('should return moderate level for medium RIR', () => {
      const result = getEffortLevel(2);
      expect(result.level).toBe('moderate');
      expect(result.percentage).toBe(65);
    });

    it('should return hard level for low RIR', () => {
      const result = getEffortLevel(1);
      expect(result.level).toBe('hard');
      expect(result.percentage).toBe(80);
    });

    it('should return maximal level for 0 RIR', () => {
      const result = getEffortLevel(0);
      expect(result.level).toBe('maximal');
      expect(result.percentage).toBe(95);
    });

    it('should return moderate for null RIR', () => {
      const result = getEffortLevel(null);
      expect(result.level).toBe('moderate');
    });
  });

  describe('isPersonalRecord', () => {
    const historicalSets = [
      { weightKg: 100, reps: 10 },
      { weightKg: 90, reps: 12 },
      { weightKg: 80, reps: 8 },
    ];

    it('should detect weight PR', () => {
      const currentSet = { weightKg: 110, reps: 10 };
      const result = isPersonalRecord(currentSet, historicalSets, 'weight');
      expect(result).toBe(true);
    });

    it('should detect reps PR', () => {
      const currentSet = { weightKg: 100, reps: 15 };
      const result = isPersonalRecord(currentSet, historicalSets, 'reps');
      expect(result).toBe(true);
    });

    it('should return true for first set', () => {
      const currentSet = { weightKg: 100, reps: 10 };
      const result = isPersonalRecord(currentSet, [], 'weight');
      expect(result).toBe(true);
    });

    it('should not detect PR when not exceeded', () => {
      const currentSet = { weightKg: 95, reps: 10 };
      const result = isPersonalRecord(currentSet, historicalSets, 'weight');
      expect(result).toBe(false);
    });
  });
});

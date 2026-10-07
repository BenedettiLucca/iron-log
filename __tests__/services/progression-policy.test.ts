import { evaluateProgression, type ProgressionPolicyInput } from '@/services/progression-policy';

describe('progression-policy (pure evaluation)', () => {
  describe('progression on load increase', () => {
    it('returns increase verdict when all sets at top of range', () => {
      // History baseline: 3x8@80kg within range
      // Performed: 3x10@80kg (all sets at top of 6-10 rep range -> should increase load)
      const input: ProgressionPolicyInput = {
        history: [
          { weightKg: 80, reps: 8 },
          { weightKg: 80, reps: 8 },
          { weightKg: 80, reps: 8 },
        ],
        performed: [
          { weightKg: 80, reps: 10 },
          { weightKg: 80, reps: 10 },
          { weightKg: 80, reps: 10 },
        ],
        target: { sets: 3, minReps: 6, maxReps: 10 },
      };

      const output = evaluateProgression(input);
      expect(output.verdict).toBe('increase');
      expect(output.result).toBe('top');
      expect(output.nextLoadSuggestion).toContain('82.5kg'); // 80 + 2.5
    });
  });

  describe('same-load-more-reps', () => {
    it('returns hold verdict when improved reps but not at top of range', () => {
      // History baseline: 3x6@80kg
      // Performed: 3x8@80kg (improved reps from 6 to 8, but not at top of 6-10 range yet)
      const input: ProgressionPolicyInput = {
        history: [
          { weightKg: 80, reps: 6 },
          { weightKg: 80, reps: 6 },
          { weightKg: 80, reps: 6 },
        ],
        performed: [
          { weightKg: 80, reps: 8 },
          { weightKg: 80, reps: 8 },
          { weightKg: 80, reps: 8 },
        ],
        target: { sets: 3, minReps: 6, maxReps: 10 },
      };

      const output = evaluateProgression(input);
      expect(output.verdict).toBe('hold');
      expect(output.result).toBe('within');
      expect(output.nextLoadSuggestion).toBe('Maintain current load');
    });
  });

  describe('regression', () => {
    it('returns hold verdict when reps drop below target range', () => {
      // History baseline: 3x8@80kg
      // Performed: 3x5@80kg (regression - dropped below target minReps 6)
      const input: ProgressionPolicyInput = {
        history: [
          { weightKg: 80, reps: 8 },
          { weightKg: 80, reps: 8 },
          { weightKg: 80, reps: 8 },
        ],
        performed: [
          { weightKg: 80, reps: 5 },
          { weightKg: 80, reps: 5 },
          { weightKg: 80, reps: 5 },
        ],
        target: { sets: 3, minReps: 6, maxReps: 10 },
      };

      const output = evaluateProgression(input);
      expect(output.verdict).toBe('hold');
      expect(output.result).toBe('below');
      expect(output.nextLoadSuggestion).toBe('Maintain current load');
    });
  });

  describe('insufficient history', () => {
    it('returns hold verdict when history is insufficient (< min history)', () => {
      // History has fewer entries than required baseline (<min history: 0 entries)
      // Performed sets are within range, but without baseline history verdict holds
      const input: ProgressionPolicyInput = {
        history: [],
        performed: [
          { weightKg: 80, reps: 8 },
          { weightKg: 80, reps: 8 },
          { weightKg: 80, reps: 8 },
        ],
        target: { sets: 3, minReps: 6, maxReps: 10 },
      };

      const output = evaluateProgression(input);
      expect(output.verdict).toBe('hold');
      expect(output.result).toBe('within');
      expect(output.nextLoadSuggestion).toBe('Maintain current load');
    });

    it('returns hold verdict with below result when fewer sets performed than target', () => {
      // Incomplete workout: performed only 2 of 3 target sets
      const input: ProgressionPolicyInput = {
        history: [],
        performed: [
          { weightKg: 80, reps: 8 },
          { weightKg: 80, reps: 8 },
        ],
        target: { sets: 3, minReps: 6, maxReps: 10 },
      };

      const output = evaluateProgression(input);
      expect(output.verdict).toBe('hold');
      expect(output.result).toBe('below');
      expect(output.nextLoadSuggestion).toBe('Maintain current load');
    });
  });

  describe('heavier load performance', () => {
    it('evaluates stepped-up load against history baseline', () => {
      // History baseline: 3x10@80kg (achieved top of range in prior session)
      // Performed: 3x6@82.5kg (stepped up load, starting at min reps of 6-10 range)
      const input: ProgressionPolicyInput = {
        history: [
          { weightKg: 80, reps: 10 },
          { weightKg: 80, reps: 10 },
          { weightKg: 80, reps: 10 },
        ],
        performed: [
          { weightKg: 82.5, reps: 6 },
          { weightKg: 82.5, reps: 6 },
          { weightKg: 82.5, reps: 6 },
        ],
        target: { sets: 3, minReps: 6, maxReps: 10 },
      };

      const output = evaluateProgression(input);
      expect(output.verdict).toBe('hold');
      expect(output.result).toBe('within');
      expect(output.nextLoadSuggestion).toBe('Maintain current load');
    });
  });
});

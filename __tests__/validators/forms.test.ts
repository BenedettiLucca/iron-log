import {
  weightInputSchema,
  monthlyCheckinSchema,
  setInputSchema,
  goalInputSchema,
  routineNameSchema,
  rpeSchema,
  validateField,
} from '@/src/validators/forms';

describe('Form Input Schemas', () => {

  describe('weightInputSchema', () => {
    it('validates valid weight', () => {
      expect(weightInputSchema.safeParse({ weight: 85.5 }).success).toBe(true);
    });

    it('validates string input (coerced to number)', () => {
      expect(weightInputSchema.safeParse({ weight: '85.5' }).success).toBe(true);
    });

    it('rejects zero weight', () => {
      const result = weightInputSchema.safeParse({ weight: 0 });
      expect(result.success).toBe(false);
    });

    it('rejects negative weight', () => {
      const result = weightInputSchema.safeParse({ weight: -5 });
      expect(result.success).toBe(false);
    });

    it('rejects weight over 500', () => {
      const result = weightInputSchema.safeParse({ weight: 501 });
      expect(result.success).toBe(false);
    });

    it('rejects Infinity', () => {
      const result = weightInputSchema.safeParse({ weight: Infinity });
      expect(result.success).toBe(false);
    });

    it('rejects non-numeric string', () => {
      const result = weightInputSchema.safeParse({ weight: 'abc' });
      expect(result.success).toBe(false);
    });
  });

  describe('setInputSchema', () => {
    it('validates valid set data', () => {
      const result = setInputSchema.safeParse({
        weightKg: 80,
        reps: 10,
        rir: 2,
        isWarmup: false,
      });
      expect(result.success).toBe(true);
    });

    it('rejects negative weight', () => {
      const result = setInputSchema.safeParse({ weightKg: -1, reps: 10 });
      expect(result.success).toBe(false);
    });

    it('rejects weight over 999', () => {
      const result = setInputSchema.safeParse({ weightKg: 1000, reps: 10 });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer reps', () => {
      const result = setInputSchema.safeParse({ weightKg: 80, reps: 10.5 });
      expect(result.success).toBe(false);
    });

    it('rejects negative reps', () => {
      const result = setInputSchema.safeParse({ weightKg: 80, reps: -1 });
      expect(result.success).toBe(false);
    });

    it('accepts zero weight (bodyweight exercises)', () => {
      const result = setInputSchema.safeParse({ weightKg: 0, reps: 15 });
      expect(result.success).toBe(true);
    });

    it('defaults isWarmup to false', () => {
      const result = setInputSchema.safeParse({ weightKg: 80, reps: 10 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isWarmup).toBe(false);
      }
    });

    it('validates optional durationSeconds', () => {
      const result = setInputSchema.safeParse({ weightKg: 0, reps: 0, durationSeconds: 60 });
      expect(result.success).toBe(true);
    });

    it('validates rir range -1 to 10', () => {
      expect(setInputSchema.safeParse({ weightKg: 80, reps: 10, rir: -1 }).success).toBe(true);
      expect(setInputSchema.safeParse({ weightKg: 80, reps: 10, rir: 10 }).success).toBe(true);
      expect(setInputSchema.safeParse({ weightKg: 80, reps: 10, rir: 11 }).success).toBe(false);
    });
  });

  describe('monthlyCheckinSchema', () => {
    it('validates valid monthly data', () => {
      const result = monthlyCheckinSchema.safeParse({
        waist: '82.5',
        armRight: '35',
        thighRight: '58',
        chest: '105',
        calf: '38',
      });
      expect(result.success).toBe(true);
    });

    it('defaults missing fields to 0', () => {
      const result = monthlyCheckinSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.waist).toBe(0);
      }
    });
  });

  describe('goalInputSchema', () => {
    it('validates valid goal', () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 3);
      const result = goalInputSchema.safeParse({
        type: 'weight',
        targetValue: '80',
        targetDate: futureDate,
      });
      expect(result.success).toBe(true);
    });

    it('rejects past target date', () => {
      const pastDate = new Date('2020-01-01');
      const result = goalInputSchema.safeParse({
        type: 'weight',
        targetValue: '80',
        targetDate: pastDate,
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid type', () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);
      const result = goalInputSchema.safeParse({
        type: 'invalid',
        targetValue: '80',
        targetDate: futureDate,
      });
      expect(result.success).toBe(false);
    });

    it('rejects zero target value', () => {
      const futureDate = new Date();
      futureDate.setMonth(futureDate.getMonth() + 1);
      const result = goalInputSchema.safeParse({
        type: 'weight',
        targetValue: '0',
        targetDate: futureDate,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('routineNameSchema', () => {
    it('validates valid name', () => {
      const result = routineNameSchema.safeParse({ name: 'Treino A' });
      expect(result.success).toBe(true);
    });

    it('rejects empty name', () => {
      const result = routineNameSchema.safeParse({ name: '' });
      expect(result.success).toBe(false);
    });

    it('rejects name over 100 chars', () => {
      const result = routineNameSchema.safeParse({ name: 'x'.repeat(101) });
      expect(result.success).toBe(false);
    });

    it('accepts optional description', () => {
      const result = routineNameSchema.safeParse({ name: 'Treino', description: 'Desc' });
      expect(result.success).toBe(true);
    });
  });

  describe('rpeSchema', () => {
    it('validates valid RPE values', () => {
      for (let i = 1; i <= 10; i++) {
        expect(rpeSchema.safeParse(i).success).toBe(true);
      }
    });

    it('rejects 0', () => {
      expect(rpeSchema.safeParse(0).success).toBe(false);
    });

    it('rejects 11', () => {
      expect(rpeSchema.safeParse(11).success).toBe(false);
    });

    it('coerces string to number', () => {
      expect(rpeSchema.safeParse('7').success).toBe(true);
    });
  });

  describe('validateField', () => {
    it('returns null for valid value', () => {
      expect(validateField(weightInputSchema, { weight: 80 })).toBeNull();
    });

    it('returns error message for invalid value', () => {
      const error = validateField(weightInputSchema, { weight: -1 });
      expect(error).toBeTruthy();
      expect(typeof error).toBe('string');
    });
  });
});

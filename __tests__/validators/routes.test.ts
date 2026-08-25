import {
  exerciseParamsSchema,
  sessionParamsSchema,
  summaryParamsSchema,
  finishParamsSchema,
  weekDetailParamsSchema,
  safeParseParams,
} from '@/src/validators/routes';

describe('Route Param Schemas', () => {

  describe('exerciseParamsSchema', () => {
    it('validates valid exercise params', () => {
      const result = exerciseParamsSchema.safeParse({
        sessionId: '123',
        exerciseId: '456',
        exerciseName: 'Supino Reto',
        target: '3x8-12',
        notes: 'Foco na negativa',
        restSeconds: '90',
        startTime: '1714000000000',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sessionId).toBe(123);
        expect(result.data.exerciseId).toBe(456);
        expect(result.data.exerciseName).toBe('Supino Reto');
        expect(result.data.restSeconds).toBe(90);
      }
    });

    it('handles missing optional params', () => {
      const result = exerciseParamsSchema.safeParse({
        sessionId: '1',
        exerciseId: '2',
        exerciseName: 'Test',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.routineId).toBeNull();
        expect(result.data.restSeconds).toBeNull();
        expect(result.data.target).toBe('');
      }
    });

    it('rejects non-numeric sessionId', () => {
      const result = exerciseParamsSchema.safeParse({
        sessionId: 'abc',
        exerciseId: '1',
        exerciseName: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative sessionId', () => {
      const result = exerciseParamsSchema.safeParse({
        sessionId: '-1',
        exerciseId: '1',
        exerciseName: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('rejects zero sessionId', () => {
      const result = exerciseParamsSchema.safeParse({
        sessionId: '0',
        exerciseId: '1',
        exerciseName: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty exerciseName', () => {
      const result = exerciseParamsSchema.safeParse({
        sessionId: '1',
        exerciseId: '2',
        exerciseName: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('sessionParamsSchema', () => {
    it('validates valid session params', () => {
      const result = sessionParamsSchema.safeParse({
        routineId: '5',
        routineName: 'Treino A',
      });
      expect(result.success).toBe(true);
    });

    it('rejects empty routineId', () => {
      const result = sessionParamsSchema.safeParse({
        routineId: '',
      });
      expect(result.success).toBe(false);
    });

    it('accepts optional _ts param', () => {
      const result = sessionParamsSchema.safeParse({
        routineId: '5',
        _ts: '1714000000000',
      });
      expect(result.success).toBe(true);
    });
  });

  describe('summaryParamsSchema', () => {
    it('validates valid summary params', () => {
      const result = summaryParamsSchema.safeParse({ sessionId: '42' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sessionId).toBe(42);
      }
    });

    it('rejects NaN sessionId', () => {
      const result = summaryParamsSchema.safeParse({ sessionId: 'not-a-number' });
      expect(result.success).toBe(false);
    });
  });

  describe('finishParamsSchema', () => {
    it('validates valid finish params', () => {
      const result = finishParamsSchema.safeParse({
        sessionId: '10',
        startTime: '1714000000000',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sessionId).toBe(10);
        expect(result.data.startTime).toBe(1714000000000);
      }
    });

    it('defaults startTime to Date.now() when missing', () => {
      const before = Date.now();
      const result = finishParamsSchema.safeParse({ sessionId: '10' });
      const after = Date.now();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.startTime).toBeGreaterThanOrEqual(before);
        expect(result.data.startTime).toBeLessThanOrEqual(after);
      }
    });
  });

  describe('safeParseParams', () => {
    it('returns parsed data for valid params', () => {
      const result = safeParseParams(summaryParamsSchema, { sessionId: '1' }, 'Test');
      expect(result).not.toBeNull();
      expect(result?.sessionId).toBe(1);
    });

    it('returns null for invalid params', () => {
      const result = safeParseParams(summaryParamsSchema, { sessionId: 'abc' }, 'Test');
      expect(result).toBeNull();
    });
  });

  describe('weekDetailParamsSchema', () => {
    it('accepts valid positive integer params', () => {
      const result = weekDetailParamsSchema.safeParse({ programId: '3', weekNumber: '7' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.programId).toBe(3);
        expect(result.data.weekNumber).toBe(7);
      }
    });

    it('accepts string "1" for both params', () => {
      const result = weekDetailParamsSchema.safeParse({ programId: '1', weekNumber: '1' });
      expect(result.success).toBe(true);
    });

    it('rejects missing programId', () => {
      const result = weekDetailParamsSchema.safeParse({ weekNumber: '2' });
      expect(result.success).toBe(false);
    });

    it('rejects missing weekNumber', () => {
      const result = weekDetailParamsSchema.safeParse({ programId: '1' });
      expect(result.success).toBe(false);
    });

    it('rejects NaN programId', () => {
      const result = weekDetailParamsSchema.safeParse({ programId: 'abc', weekNumber: '1' });
      expect(result.success).toBe(false);
    });

    it('rejects NaN weekNumber', () => {
      const result = weekDetailParamsSchema.safeParse({ programId: '1', weekNumber: 'xyz' });
      expect(result.success).toBe(false);
    });

    it('rejects zero programId', () => {
      const result = weekDetailParamsSchema.safeParse({ programId: '0', weekNumber: '1' });
      expect(result.success).toBe(false);
    });

    it('rejects zero weekNumber', () => {
      const result = weekDetailParamsSchema.safeParse({ programId: '1', weekNumber: '0' });
      expect(result.success).toBe(false);
    });

    it('rejects negative programId', () => {
      const result = weekDetailParamsSchema.safeParse({ programId: '-1', weekNumber: '1' });
      expect(result.success).toBe(false);
    });

    it('rejects negative weekNumber', () => {
      const result = weekDetailParamsSchema.safeParse({ programId: '1', weekNumber: '-5' });
      expect(result.success).toBe(false);
    });

    it('rejects fractional programId', () => {
      const result = weekDetailParamsSchema.safeParse({ programId: '1.5', weekNumber: '1' });
      expect(result.success).toBe(false);
    });

    it('rejects fractional weekNumber', () => {
      const result = weekDetailParamsSchema.safeParse({ programId: '1', weekNumber: '2.7' });
      expect(result.success).toBe(false);
    });
  });
});

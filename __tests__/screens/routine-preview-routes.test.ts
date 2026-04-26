// Tests for routine preview route params validation
import {
  routinePreviewParamsSchema,
  routineEditorParamsSchema,
  safeParseParams,
} from '@/src/validators/routes';

describe('Routine Preview Route Params', () => {

  describe('routinePreviewParamsSchema', () => {
    it('validates valid preview params', () => {
      const result = routinePreviewParamsSchema.safeParse({
        routineId: '5',
        routineName: 'Treino A (Push/Legs)',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.routineId).toBe(5);
        expect(result.data.routineName).toBe('Treino A (Push/Legs)');
      }
    });

    it('validates with only routineId (routineName optional)', () => {
      const result = routinePreviewParamsSchema.safeParse({
        routineId: '10',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.routineId).toBe(10);
        expect(result.data.routineName).toBe('');
      }
    });

    it('coerces string routineId to number', () => {
      const result = routinePreviewParamsSchema.safeParse({
        routineId: '42',
        routineName: 'Leg Day',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.routineId).toBe(42);
        expect(typeof result.data.routineId).toBe('number');
      }
    });

    it('rejects empty routineId', () => {
      const result = routinePreviewParamsSchema.safeParse({
        routineId: '',
        routineName: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-numeric routineId', () => {
      const result = routinePreviewParamsSchema.safeParse({
        routineId: 'abc',
        routineName: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('rejects negative routineId', () => {
      const result = routinePreviewParamsSchema.safeParse({
        routineId: '-5',
        routineName: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('rejects zero routineId', () => {
      const result = routinePreviewParamsSchema.safeParse({
        routineId: '0',
        routineName: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('rejects decimal routineId', () => {
      const result = routinePreviewParamsSchema.safeParse({
        routineId: '3.14',
        routineName: 'Test',
      });
      expect(result.success).toBe(false);
    });

    it('handles routineName with special characters', () => {
      const result = routinePreviewParamsSchema.safeParse({
        routineId: '1',
        routineName: 'Treino A (Push/Legs) — Avançado',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.routineName).toBe('Treino A (Push/Legs) \u2014 Avançado');
      }
    });

    it('handles large routineId', () => {
      const result = routinePreviewParamsSchema.safeParse({
        routineId: '999999',
        routineName: 'Test',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.routineId).toBe(999999);
      }
    });
  });

  describe('routineEditorParamsSchema (Edit button target)', () => {
    it('validates with id param', () => {
      const result = routineEditorParamsSchema.safeParse({
        id: '5',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.id).toBe('5');
      }
    });

    it('validates without id param (optional)', () => {
      const result = routineEditorParamsSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('safeParseParams with routinePreviewParamsSchema', () => {
    it('returns parsed data for valid params', () => {
      const result = safeParseParams(
        routinePreviewParamsSchema,
        { routineId: '7', routineName: 'Upper A' },
        'RoutinePreview'
      );
      expect(result).not.toBeNull();
      expect(result!.routineId).toBe(7);
      expect(result!.routineName).toBe('Upper A');
    });

    it('returns null for invalid params', () => {
      const result = safeParseParams(
        routinePreviewParamsSchema,
        { routineId: 'not-a-number' },
        'RoutinePreview'
      );
      expect(result).toBeNull();
    });

    it('returns null for missing routineId', () => {
      const result = safeParseParams(
        routinePreviewParamsSchema,
        { routineName: 'Test' },
        'RoutinePreview'
      );
      expect(result).toBeNull();
    });
  });
});

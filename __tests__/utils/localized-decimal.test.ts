import {
  parseLocalizedDecimal,
  toOptionalDecimal,
} from '@/src/utils/localized-decimal';
import {
  weightInputSchema,
  monthlyCheckinSchema,
  setInputSchema,
  parseEditedSetInput,
  goalInputSchema,
} from '@/src/validators/forms';

describe('localized-decimal parser (Contract C2)', () => {
  describe('core decimal parsing', () => {
    it('accepts both single comma and single dot resulting in identical value', () => {
      const commaResult = parseLocalizedDecimal('72,5');
      const dotResult = parseLocalizedDecimal('72.5');

      expect(commaResult).toEqual({ status: 'valid', value: 72.5 });
      expect(dotResult).toEqual({ status: 'valid', value: 72.5 });
      if (commaResult.status === 'valid' && dotResult.status === 'valid') {
        expect(commaResult.value).toBe(dotResult.value);
      }
    });

    it('parses integers correctly', () => {
      expect(parseLocalizedDecimal('72')).toEqual({ status: 'valid', value: 72 });
      expect(parseLocalizedDecimal('0')).toEqual({ status: 'valid', value: 0 });
      expect(parseLocalizedDecimal('1000')).toEqual({ status: 'valid', value: 1000 });
    });

    it('parses numbers passed as numeric type', () => {
      expect(parseLocalizedDecimal(72.5)).toEqual({ status: 'valid', value: 72.5 });
      expect(parseLocalizedDecimal(72)).toEqual({ status: 'valid', value: 72 });
      expect(parseLocalizedDecimal(0)).toEqual({ status: 'valid', value: 0 });
    });

    it('parses decimals with leading or trailing zeros', () => {
      expect(parseLocalizedDecimal('0.5')).toEqual({ status: 'valid', value: 0.5 });
      expect(parseLocalizedDecimal('0,5')).toEqual({ status: 'valid', value: 0.5 });
      expect(parseLocalizedDecimal('0.0')).toEqual({ status: 'valid', value: 0 });
      expect(parseLocalizedDecimal('0,0')).toEqual({ status: 'valid', value: 0 });
      expect(parseLocalizedDecimal('10.50')).toEqual({ status: 'valid', value: 10.5 });
    });

    it('parses shorthand decimals starting with separator', () => {
      expect(parseLocalizedDecimal('.5')).toEqual({ status: 'valid', value: 0.5 });
      expect(parseLocalizedDecimal(',5')).toEqual({ status: 'valid', value: 0.5 });
    });

    it('parses numbers with explicit positive sign', () => {
      expect(parseLocalizedDecimal('+72.5')).toEqual({ status: 'valid', value: 72.5 });
      expect(parseLocalizedDecimal('+72,5')).toEqual({ status: 'valid', value: 72.5 });
    });
  });

  describe('whitespace handling', () => {
    it('trims leading and trailing whitespace', () => {
      expect(parseLocalizedDecimal('  72.5  ')).toEqual({ status: 'valid', value: 72.5 });
      expect(parseLocalizedDecimal('\t72,5\n')).toEqual({ status: 'valid', value: 72.5 });
    });

    it('rejects internal whitespace as invalid format', () => {
      expect(parseLocalizedDecimal('7 2.5')).toEqual({
        status: 'invalid',
        reason: 'invalid_format',
      });
      expect(parseLocalizedDecimal('72 . 5')).toEqual({
        status: 'invalid',
        reason: 'invalid_format',
      });
      expect(parseLocalizedDecimal('72, 5')).toEqual({
        status: 'invalid',
        reason: 'invalid_format',
      });
    });
  });

  describe('empty / null / undefined distinction', () => {
    it('identifies empty strings as status empty', () => {
      expect(parseLocalizedDecimal('')).toEqual({ status: 'empty', value: undefined });
      expect(parseLocalizedDecimal('   ')).toEqual({ status: 'empty', value: undefined });
      expect(parseLocalizedDecimal('\t\n')).toEqual({ status: 'empty', value: undefined });
    });

    it('identifies null and undefined as status empty', () => {
      expect(parseLocalizedDecimal(null)).toEqual({ status: 'empty', value: undefined });
      expect(parseLocalizedDecimal(undefined)).toEqual({ status: 'empty', value: undefined });
    });
  });

  describe('never infer thousands and reject mixed / multiple separators', () => {
    it('never infers thousands: 1.500 and 1,500 are decimal 1.5, never 1500', () => {
      expect(parseLocalizedDecimal('1.500')).toEqual({ status: 'valid', value: 1.5 });
      expect(parseLocalizedDecimal('1,500')).toEqual({ status: 'valid', value: 1.5 });
    });

    it('rejects mixed dot and comma separators', () => {
      expect(parseLocalizedDecimal('1,234.56')).toEqual({
        status: 'invalid',
        reason: 'mixed_separators',
      });
      expect(parseLocalizedDecimal('1.234,56')).toEqual({
        status: 'invalid',
        reason: 'mixed_separators',
      });
    });

    it('rejects multiple dots or multiple commas', () => {
      expect(parseLocalizedDecimal('1.2.3')).toEqual({
        status: 'invalid',
        reason: 'multiple_separators',
      });
      expect(parseLocalizedDecimal('72.5.5')).toEqual({
        status: 'invalid',
        reason: 'multiple_separators',
      });
      expect(parseLocalizedDecimal('1,2,3')).toEqual({
        status: 'invalid',
        reason: 'multiple_separators',
      });
      expect(parseLocalizedDecimal('72,5,5')).toEqual({
        status: 'invalid',
        reason: 'multiple_separators',
      });
      expect(parseLocalizedDecimal('1..2')).toEqual({
        status: 'invalid',
        reason: 'multiple_separators',
      });
      expect(parseLocalizedDecimal('1,,2')).toEqual({
        status: 'invalid',
        reason: 'multiple_separators',
      });
    });
  });

  describe('never truncate via parseFloat and reject junk / invalid formats', () => {
    it('rejects trailing characters (no parseFloat truncation)', () => {
      expect(parseLocalizedDecimal('72.5kg')).toEqual({
        status: 'invalid',
        reason: 'invalid_format',
      });
      expect(parseLocalizedDecimal('72,5kg')).toEqual({
        status: 'invalid',
        reason: 'invalid_format',
      });
      expect(parseLocalizedDecimal('kg72.5')).toEqual({
        status: 'invalid',
        reason: 'invalid_format',
      });
    });

    it('rejects non-numeric strings', () => {
      expect(parseLocalizedDecimal('abc')).toEqual({
        status: 'invalid',
        reason: 'invalid_format',
      });
      expect(parseLocalizedDecimal('.')).toEqual({
        status: 'invalid',
        reason: 'invalid_format',
      });
      expect(parseLocalizedDecimal(',')).toEqual({
        status: 'invalid',
        reason: 'invalid_format',
      });
      expect(parseLocalizedDecimal('-')).toEqual({
        status: 'invalid',
        reason: 'invalid_format',
      });
      expect(parseLocalizedDecimal('+')).toEqual({
        status: 'invalid',
        reason: 'invalid_format',
      });
      expect(parseLocalizedDecimal('--5')).toEqual({
        status: 'invalid',
        reason: 'invalid_format',
      });
      expect(parseLocalizedDecimal('++5')).toEqual({
        status: 'invalid',
        reason: 'invalid_format',
      });
    });

    it('rejects infinite values and NaN', () => {
      expect(parseLocalizedDecimal(Infinity)).toEqual({
        status: 'invalid',
        reason: 'not_finite',
      });
      expect(parseLocalizedDecimal(-Infinity)).toEqual({
        status: 'invalid',
        reason: 'not_finite',
      });
      expect(parseLocalizedDecimal(Number.NaN)).toEqual({
        status: 'invalid',
        reason: 'not_finite',
      });
      expect(parseLocalizedDecimal('Infinity')).toEqual({
        status: 'invalid',
        reason: 'not_finite',
      });
      expect(parseLocalizedDecimal('-Infinity')).toEqual({
        status: 'invalid',
        reason: 'not_finite',
      });
      expect(parseLocalizedDecimal('NaN')).toEqual({
        status: 'invalid',
        reason: 'not_finite',
      });
    });

    it('rejects non-primitive types', () => {
      expect(parseLocalizedDecimal(true)).toEqual({
        status: 'invalid',
        reason: 'invalid_format',
      });
      expect(parseLocalizedDecimal(false)).toEqual({
        status: 'invalid',
        reason: 'invalid_format',
      });
      expect(parseLocalizedDecimal({})).toEqual({
        status: 'invalid',
        reason: 'invalid_format',
      });
      expect(parseLocalizedDecimal([])).toEqual({
        status: 'invalid',
        reason: 'invalid_format',
      });
    });
  });

  describe('negatives and domain options', () => {
    it('allows negative decimals by default', () => {
      expect(parseLocalizedDecimal('-5.5')).toEqual({ status: 'valid', value: -5.5 });
      expect(parseLocalizedDecimal('-5,5')).toEqual({ status: 'valid', value: -5.5 });
      expect(parseLocalizedDecimal(-5.5)).toEqual({ status: 'valid', value: -5.5 });
    });

    it('rejects negative decimals when allowNegative is false', () => {
      expect(parseLocalizedDecimal('-5.5', { allowNegative: false })).toEqual({
        status: 'invalid',
        reason: 'negative_not_allowed',
      });
      expect(parseLocalizedDecimal('-5,5', { allowNegative: false })).toEqual({
        status: 'invalid',
        reason: 'negative_not_allowed',
      });
      expect(parseLocalizedDecimal('-5', { allowNegative: false })).toEqual({
        status: 'invalid',
        reason: 'negative_not_allowed',
      });
      expect(parseLocalizedDecimal(-5, { allowNegative: false })).toEqual({
        status: 'invalid',
        reason: 'negative_not_allowed',
      });
    });
  });

  describe('locale matrix (pt, en, es, zh)', () => {
    const locales = ['pt-BR', 'en-US', 'es-ES', 'zh-CN', 'pt', 'en', 'es', 'zh'];

    it.each(locales)('handles comma and dot uniformly for locale %s', (locale) => {
      const comma = parseLocalizedDecimal('72,5', { locale });
      const dot = parseLocalizedDecimal('72.5', { locale });

      expect(comma).toEqual({ status: 'valid', value: 72.5 });
      expect(dot).toEqual({ status: 'valid', value: 72.5 });
    });
  });

  describe('toOptionalDecimal helper', () => {
    it('returns number for valid inputs', () => {
      expect(toOptionalDecimal('72,5')).toBe(72.5);
      expect(toOptionalDecimal('72.5')).toBe(72.5);
      expect(toOptionalDecimal(80)).toBe(80);
    });

    it('returns undefined for empty inputs', () => {
      expect(toOptionalDecimal('')).toBeUndefined();
      expect(toOptionalDecimal('   ')).toBeUndefined();
      expect(toOptionalDecimal(null)).toBeUndefined();
      expect(toOptionalDecimal(undefined)).toBeUndefined();
    });

    it('returns NaN for invalid inputs', () => {
      expect(Number.isNaN(toOptionalDecimal('abc'))).toBe(true);
      expect(Number.isNaN(toOptionalDecimal('72.5kg'))).toBe(true);
      expect(Number.isNaN(toOptionalDecimal('1.2.3'))).toBe(true);
      expect(Number.isNaN(toOptionalDecimal('-5', { allowNegative: false }))).toBe(true);
    });
  });
});

describe('forms.ts validators consuming localized-decimal', () => {
  describe('weightInputSchema', () => {
    it('accepts comma decimal string (pt-BR)', () => {
      const res = weightInputSchema.safeParse({ weight: '72,5' });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.weight).toBe(72.5);
      }
    });

    it('accepts dot decimal string (en-US)', () => {
      const res = weightInputSchema.safeParse({ weight: '72.5' });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.weight).toBe(72.5);
      }
    });

    it('yields identical result for comma and dot', () => {
      const comma = weightInputSchema.safeParse({ weight: '85,5' });
      const dot = weightInputSchema.safeParse({ weight: '85.5' });
      expect(comma.success).toBe(true);
      expect(dot.success).toBe(true);
      if (comma.success && dot.success) {
        expect(comma.data.weight).toBe(dot.data.weight);
      }
    });

    it('rejects junk and mixed separators without truncation', () => {
      expect(weightInputSchema.safeParse({ weight: '72.5kg' }).success).toBe(false);
      expect(weightInputSchema.safeParse({ weight: '72,5kg' }).success).toBe(false);
      expect(weightInputSchema.safeParse({ weight: '1,234.56' }).success).toBe(false);
      expect(weightInputSchema.safeParse({ weight: '72.5.5' }).success).toBe(false);
      expect(weightInputSchema.safeParse({ weight: 'abc' }).success).toBe(false);
    });

    it('rejects empty string (field is required)', () => {
      expect(weightInputSchema.safeParse({ weight: '' }).success).toBe(false);
      expect(weightInputSchema.safeParse({ weight: '   ' }).success).toBe(false);
    });
  });

  describe('monthlyCheckinSchema', () => {
    it('accepts comma decimal measurements', () => {
      const res = monthlyCheckinSchema.safeParse({
        waist: '82,5',
        armRight: '35,2',
        thighRight: '58,0',
        chest: '105,7',
        calf: '38,1',
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.waist).toBe(82.5);
        expect(res.data.armRight).toBe(35.2);
        expect(res.data.thighRight).toBe(58);
        expect(res.data.chest).toBe(105.7);
        expect(res.data.calf).toBe(38.1);
      }
    });

    it('treats empty string and null as undefined (optional)', () => {
      const res = monthlyCheckinSchema.safeParse({
        waist: '',
        armRight: '   ',
        thighRight: null,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.waist).toBeUndefined();
        expect(res.data.armRight).toBeUndefined();
        expect(res.data.thighRight).toBeUndefined();
      }
    });

    it('rejects junk in measurements', () => {
      expect(monthlyCheckinSchema.safeParse({ waist: '82.5cm' }).success).toBe(false);
      expect(monthlyCheckinSchema.safeParse({ waist: '82,5,5' }).success).toBe(false);
    });
  });

  describe('setInputSchema', () => {
    it('accepts comma decimal weightKg', () => {
      const res = setInputSchema.safeParse({
        weightKg: '72,5',
        reps: 10,
        rir: 2,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.weightKg).toBe(72.5);
        expect(res.data.reps).toBe(10);
      }
    });

    it('keeps reps and rir as integers (reps/RIR continuam inteiros)', () => {
      const resReps = setInputSchema.safeParse({
        weightKg: '72,5',
        reps: '10.5',
      });
      expect(resReps.success).toBe(false);

      const resRir = setInputSchema.safeParse({
        weightKg: '72,5',
        reps: 10,
        rir: '2.5',
      });
      expect(resRir.success).toBe(false);
    });
  });

  describe('parseEditedSetInput', () => {
    it('parses comma decimal weight', () => {
      const res = parseEditedSetInput({
        weight: '72,5',
        reps: '10',
        rir: '2',
        isDuration: false,
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.weightKg).toBe(72.5);
        expect(res.reps).toBe(10);
        expect(res.rir).toBe(2);
      }
    });

    it('parses dot decimal weight identically to comma', () => {
      const comma = parseEditedSetInput({
        weight: '72,5',
        reps: '10',
        isDuration: false,
      });
      const dot = parseEditedSetInput({
        weight: '72.5',
        reps: '10',
        isDuration: false,
      });
      expect(comma.ok).toBe(true);
      expect(dot.ok).toBe(true);
      if (comma.ok && dot.ok) {
        expect(comma.weightKg).toBe(dot.weightKg);
      }
    });

    it('rejects junk and malformed weights in set editor', () => {
      const resJunk = parseEditedSetInput({
        weight: '72.5kg',
        reps: '10',
        isDuration: false,
      });
      expect(resJunk.ok).toBe(false);
      if (!resJunk.ok) {
        expect(resJunk.errors.weight).toBe('invalid');
        expect(resJunk.firstErrorField).toBe('weight');
      }

      const resMixed = parseEditedSetInput({
        weight: '1,234.56',
        reps: '10',
        isDuration: false,
      });
      expect(resMixed.ok).toBe(false);
      if (!resMixed.ok) {
        expect(resMixed.errors.weight).toBe('invalid');
      }

      const resEmpty = parseEditedSetInput({
        weight: '',
        reps: '10',
        isDuration: false,
      });
      expect(resEmpty.ok).toBe(false);
      if (!resEmpty.ok) {
        expect(resEmpty.errors.weight).toBe('invalid');
      }
    });

    it('keeps duration and reps integer validation', () => {
      const resNonIntReps = parseEditedSetInput({
        weight: '72,5',
        reps: '10.5',
        isDuration: false,
      });
      expect(resNonIntReps.ok).toBe(false);
      if (!resNonIntReps.ok) {
        expect(resNonIntReps.errors.reps).toBe('invalid');
      }
    });
  });

  describe('goalInputSchema', () => {
    it('accepts comma decimal targetValue', () => {
      const futureDate = new Date(Date.now() + 86400000);
      const res = goalInputSchema.safeParse({
        type: 'weight',
        targetValue: '72,5',
        targetDate: futureDate,
      });
      expect(res.success).toBe(true);
      if (res.success) {
        expect(res.data.targetValue).toBe(72.5);
      }
    });
  });
});

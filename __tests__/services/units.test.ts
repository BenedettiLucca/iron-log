import {
  POUND_IN_KG,
  KG_IN_LB,
  INCH_IN_CM,
  CM_IN_IN,
  DEFAULT_WEIGHT_DECIMALS,
  DEFAULT_LENGTH_DECIMALS,
  kgToLb,
  lbToKg,
  cmToIn,
  inToCm,
  getWeightUnit,
  getLengthUnit,
  toDisplayWeight,
  fromDisplayWeight,
  toDisplayLength,
  fromDisplayLength,
  format,
  parse,
  formatWeight,
  parseWeight,
  formatLength,
  parseLength,
  formatCanonicalWeight,
  formatCanonicalLength,
  parseWeightInputToCanonical,
  parseLengthInputToCanonical,
  type UnitSystem,
} from '@/services/units';

describe('Unit Conversion Service (services/units)', () => {
  describe('Constants & factor integrity', () => {
    it('uses standard international avoirdupois pound and inch definition', () => {
      expect(POUND_IN_KG).toBe(0.45359237);
      expect(KG_IN_LB).toBeCloseTo(1 / 0.45359237, 10);
      expect(INCH_IN_CM).toBe(2.54);
      expect(CM_IN_IN).toBeCloseTo(1 / 2.54, 10);
      expect(DEFAULT_WEIGHT_DECIMALS).toBe(2);
      expect(DEFAULT_LENGTH_DECIMALS).toBe(2);
    });
  });

  describe('Exact known values per documented conventions', () => {
    it('converts 100kg to 220.46lb exactly at display precision', () => {
      expect(kgToLb(100)).toBe(220.46);
      expect(lbToKg(220.46)).toBe(100);
    });

    it('converts known barbell/dumbbell weight reference points', () => {
      // 20kg Olympic barbell -> 44.09 lb
      expect(kgToLb(20)).toBe(44.09);
      expect(lbToKg(44.09)).toBe(20);

      // 45lb barbell -> 20.41 kg
      expect(lbToKg(45)).toBe(20.41);
      expect(kgToLb(20.41)).toBe(45);

      // 0 kg / 0 lb
      expect(kgToLb(0)).toBe(0);
      expect(lbToKg(0)).toBe(0);
    });

    it('converts known length reference points', () => {
      // 1 in = 2.54 cm
      expect(inToCm(1)).toBe(2.54);
      expect(cmToIn(2.54)).toBe(1);

      // 100 in = 254 cm
      expect(inToCm(100)).toBe(254);
      expect(cmToIn(254)).toBe(100);

      // Common height: 180 cm -> 70.87 in
      expect(cmToIn(180)).toBe(70.87);
      expect(inToCm(70.87)).toBe(180.01);
      expect(Math.abs(inToCm(70.87) - 180)).toBeLessThanOrEqual(0.01);

      // 0 cm / 0 in
      expect(cmToIn(0)).toBe(0);
      expect(inToCm(0)).toBe(0);
    });
  });

  describe('Rounding & negative zero normalization', () => {
    it('applies symmetric round half-up away from zero', () => {
      expect(toDisplayWeight(1.005, 'metric', 2)).toBe(1.01);
      expect(toDisplayWeight(-1.005, 'metric', 2)).toBe(-1.01);
      expect(toDisplayWeight(2.5, 'metric', 0)).toBe(3);
      expect(toDisplayWeight(-2.5, 'metric', 0)).toBe(-3);
      expect(toDisplayWeight(0, 'metric', 2)).toBe(0);
      expect(format(1.005, { decimals: 2 })).toBe('1.01');
      expect(format(-1.005, { decimals: 2 })).toBe('-1.01');
    });

    it('handles non-finite values safely', () => {
      expect(toDisplayWeight(NaN, 'metric')).toBeNaN();
      expect(toDisplayWeight(Infinity, 'metric')).toBe(Infinity);
      expect(toDisplayWeight(-Infinity, 'metric')).toBe(-Infinity);
    });

    it('normalizes negative zero (-0) to positive zero (0)', () => {
      // Conversions and display values normalize -0 to 0
      expect(Object.is(toDisplayWeight(-0.0001, 'metric', 2), 0)).toBe(true);
      expect(Object.is(toDisplayWeight(-0, 'metric', 2), 0)).toBe(true);
      expect(Object.is(toDisplayLength(-0.0001, 'metric', 2), 0)).toBe(true);
      expect(Object.is(toDisplayLength(-0, 'metric', 2), 0)).toBe(true);
      expect(Object.is(fromDisplayWeight(-0.0001, 'metric', 2), 0)).toBe(true);
      expect(Object.is(fromDisplayLength(-0.0001, 'metric', 2), 0)).toBe(true);

      expect(Object.is(kgToLb(-0.0001), 0)).toBe(true);
      expect(Object.is(lbToKg(-0.0001), 0)).toBe(true);
      expect(Object.is(cmToIn(-0.0001), 0)).toBe(true);
      expect(Object.is(inToCm(-0.0001), 0)).toBe(true);

      // Formatting normalizes -0
      expect(format(-0.0001)).toBe('0');
      expect(format(-0.0001, { fixedDecimals: true, decimals: 2 })).toBe('0.00');

      // Parsing normalizes -0 to 0
      expect(Object.is(parse('-0'), 0)).toBe(true);
      expect(Object.is(parse('-0.00'), 0)).toBe(true);
      expect(Object.is(parse('-0 kg'), 0)).toBe(true);
      expect(Object.is(parse(-0), 0)).toBe(true);
      expect(Object.is(parseWeight('-0 kg'), 0)).toBe(true);
      expect(Object.is(parseLength('-0 cm'), 0)).toBe(true);
    });
  });

  describe('Dense grid round-trip identity (within one display step)', () => {
    it('weight: round-trip identity within 0.5 step over dense grid 20..300kg step 0.5', () => {
      const step = 0.5;
      let count = 0;
      for (let kg = 20; kg <= 300; kg = Math.round((kg + step) * 10) / 10) {
        count++;
        const lb = kgToLb(kg);
        const backKg = lbToKg(lb);
        const diff = Math.abs(backKg - kg);

        // Required: within one display step (0.5)
        expect(diff).toBeLessThanOrEqual(step);
        // At 2 decimal display precision, lbToKg(kgToLb(kg)) is exact
        expect(backKg).toBe(kg);
      }
      expect(count).toBe(561);
    });

    it('weight: round-trip identity via display converter functions over 20..300kg', () => {
      const systems: UnitSystem[] = ['metric', 'imperial'];
      let count = 0;
      for (const system of systems) {
        for (let kg = 20; kg <= 300; kg = Math.round((kg + 0.5) * 10) / 10) {
          count++;
          const displayVal = toDisplayWeight(kg, system);
          const backKg = fromDisplayWeight(displayVal, system);
          const diff = Math.abs(backKg - kg);
          expect(diff).toBeLessThanOrEqual(0.5);
          expect(backKg).toBe(kg);
        }
      }
      expect(count).toBe(1122);
    });

    it('length: round-trip identity within one display step over dense grid 60..250cm step 0.5', () => {
      const step = 0.5;
      const displayStep = 10 ** -DEFAULT_LENGTH_DECIMALS; // Exactly 0.01 cm, no slack
      let maxDiff = 0;
      let count = 0;
      for (let cm = 60; cm <= 250; cm = Math.round((cm + step) * 10) / 10) {
        count++;
        const inches = cmToIn(cm);
        const backCm = inToCm(inches);
        const diff = Math.abs(backCm - cm);

        if (diff > maxDiff) maxDiff = diff;

        // Required: strictly within one 0.5 cm gym increment step
        expect(diff).toBeLessThanOrEqual(step);
        // Required: strictly within one display step (0.01 cm) without slack
        expect(Number(diff.toFixed(DEFAULT_LENGTH_DECIMALS))).toBeLessThanOrEqual(displayStep);
      }
      expect(count).toBe(381);
      expect(Number(maxDiff.toFixed(DEFAULT_LENGTH_DECIMALS))).toBeLessThanOrEqual(displayStep);
    });

    it('length: round-trip identity via display converter functions over 60..250cm', () => {
      const systems: UnitSystem[] = ['metric', 'imperial'];
      let count = 0;
      for (const system of systems) {
        for (let cm = 60; cm <= 250; cm = Math.round((cm + 0.5) * 10) / 10) {
          count++;
          const displayVal = toDisplayLength(cm, system);
          const backCm = fromDisplayLength(displayVal, system);
          const diff = Math.abs(backCm - cm);
          expect(diff).toBeLessThanOrEqual(0.5);
        }
      }
      expect(count).toBe(762);
    });
  });

  describe('format and parse display strings: parse(format(x)) === x', () => {
    it('satisfies parse(format(x)) === x over dense grid 20..300 step 0.5', () => {
      let count = 0;
      for (let x = 20; x <= 300; x = Math.round((x + 0.5) * 10) / 10) {
        count++;
        expect(parse(format(x))).toBe(x);
      }
      expect(count).toBe(561);
    });

    it('satisfies parse(format(x)) === x with units and fixedDecimals', () => {
      const testCases = [
        { val: 0, unit: 'kg' },
        { val: 20.5, unit: 'kg' },
        { val: 100, unit: 'kg' },
        { val: 220.46, unit: 'lb' },
        { val: 180, unit: 'cm' },
        { val: 70.87, unit: 'in' },
        { val: 12.34, unit: 'lb' },
      ];

      for (const { val, unit } of testCases) {
        // Plain format
        expect(parse(format(val))).toBe(val);

        // Format with unit
        const formattedWithUnit = format(val, { unit });
        expect(parse(formattedWithUnit)).toBe(val);

        // Format with fixed decimals
        const formattedFixed = format(val, { decimals: 2, fixedDecimals: true, unit });
        expect(parse(formattedFixed)).toBe(val);
      }
    });

    it('formatWeight and parseWeight maintain parse(format(x)) === x', () => {
      expect(parseWeight(formatWeight(100, 'kg'))).toBe(100);
      expect(parseWeight(formatWeight(75.5, 'kg'))).toBe(75.5);
      expect(parseWeight(formatWeight(220.46, 'lb'))).toBe(220.46);
      expect(formatWeight(100, 'kg')).toBe('100 kg');
      expect(formatWeight(220.46, 'lb')).toBe('220.46 lb');
    });

    it('formatLength and parseLength maintain parse(format(x)) === x', () => {
      expect(parseLength(formatLength(180, 'cm'))).toBe(180);
      expect(parseLength(formatLength(70.87, 'in'))).toBe(70.87);
      expect(formatLength(180, 'cm')).toBe('180 cm');
      expect(formatLength(70.87, 'in')).toBe('70.87 in');
    });

    it('parses comma decimals from pt/es locales gracefully', () => {
      expect(parse('75,5')).toBe(75.5);
      expect(parse('75,5 kg')).toBe(75.5);
      expect(parse('220,46 lb')).toBe(220.46);
      expect(parse('  180,5 cm  ')).toBe(180.5);
    });

    it('handles negative numbers and fractions with leading decimal point', () => {
      expect(parse('-5.5')).toBe(-5.5);
      expect(parse('-5,5 kg')).toBe(-5.5);
      expect(parse('.5')).toBe(0.5);
      expect(parse(',5 in')).toBe(0.5);
    });

    it('returns NaN for non-numeric and empty inputs', () => {
      expect(parse('')).toBeNaN();
      expect(parse('   ')).toBeNaN();
      expect(parse('abc')).toBeNaN();
      expect(parse('kg')).toBeNaN();
    });

    it('rejects ambiguous inputs with multiple decimal points, multiple numbers or invalid characters', () => {
      expect(parse('100.5.5')).toBeNaN();
      expect(parse('75,5,5')).toBeNaN();
      expect(parse('100..5')).toBeNaN();
      expect(parse('100 200')).toBeNaN();
      expect(parse('100 200 kg')).toBeNaN();
      expect(parse('100-200')).toBeNaN();
      expect(parse('100+200')).toBeNaN();
      expect(parse('75.5.2 kg')).toBeNaN();
      expect(parse('12,34,56 cm')).toBeNaN();
      expect(parseWeight('100.5.5 kg')).toBeNaN();
      expect(parseLength('180.5.5 cm')).toBeNaN();
      expect(parseWeightInputToCanonical('100.5.5', 'metric')).toBeNaN();
      expect(parseLengthInputToCanonical('180.5.5', 'metric')).toBeNaN();
    });
  });

  describe('Edge helpers: Canonical display formatting & user input parsing', () => {
    it('returns correct unit label for system', () => {
      expect(getWeightUnit('metric')).toBe('kg');
      expect(getWeightUnit('imperial')).toBe('lb');
      expect(getLengthUnit('metric')).toBe('cm');
      expect(getLengthUnit('imperial')).toBe('in');
    });

    it('formatCanonicalWeight formats kg according to active preference', () => {
      expect(formatCanonicalWeight(100, 'metric')).toBe('100 kg');
      expect(formatCanonicalWeight(100, 'imperial')).toBe('220.46 lb');
      expect(formatCanonicalWeight(20, 'imperial')).toBe('44.09 lb');
    });

    it('formatCanonicalLength formats cm according to active preference', () => {
      expect(formatCanonicalLength(180, 'metric')).toBe('180 cm');
      expect(formatCanonicalLength(180, 'imperial')).toBe('70.87 in');
    });

    it('parseWeightInputToCanonical converts user input back to canonical kg', () => {
      // In metric system, 100 -> 100 kg
      expect(parseWeightInputToCanonical('100', 'metric')).toBe(100);
      expect(parseWeightInputToCanonical('75,5 kg', 'metric')).toBe(75.5);

      // In imperial system, 220.46 -> 100 kg
      expect(parseWeightInputToCanonical('220.46', 'imperial')).toBe(100);
      expect(parseWeightInputToCanonical('220,46 lb', 'imperial')).toBe(100);
      expect(parseWeightInputToCanonical('44.09', 'imperial')).toBe(20);
    });

    it('parseLengthInputToCanonical converts user input back to canonical cm', () => {
      // In metric system, 180 -> 180 cm
      expect(parseLengthInputToCanonical('180', 'metric')).toBe(180);
      expect(parseLengthInputToCanonical('180,5 cm', 'metric')).toBe(180.5);

      // In imperial system, 70.87 -> 180.01 cm (within 0.01 cm of 180)
      expect(parseLengthInputToCanonical('70.87', 'imperial')).toBe(180.01);
      expect(Math.abs(parseLengthInputToCanonical('70.87', 'imperial') - 180)).toBeLessThanOrEqual(0.01);
      expect(parseLengthInputToCanonical('1 in', 'imperial')).toBe(2.54);
    });
  });
});

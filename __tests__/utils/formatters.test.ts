import { formatCompactKilograms } from '../../src/utils/formatters';

describe('formatCompactKilograms', () => {
  it('separates the compact suffix from the mass unit', () => {
    expect(formatCompactKilograms(10800)).toBe('10.8k kg');
    expect(formatCompactKilograms(3700)).toBe('3.7k kg');
  });

  it('formats values below one thousand without a compact suffix', () => {
    expect(formatCompactKilograms(585)).toBe('585 kg');
    expect(formatCompactKilograms(0)).toBe('0 kg');
  });
});

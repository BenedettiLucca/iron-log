import { calculateVolume } from '@/src/utils/calculations';

describe('calculateVolume', () => {
  it('calculates volume for weight x reps', () => {
    expect(calculateVolume(100, 10)).toBe(1000);
  });

  it('calculates volume with fractional weight', () => {
    expect(calculateVolume(22.5, 8)).toBe(180);
  });

  it('returns 0 when weight is 0', () => {
    expect(calculateVolume(0, 10)).toBe(0);
  });

  it('returns 0 when reps is 0', () => {
    expect(calculateVolume(100, 0)).toBe(0);
  });

  it('handles large numbers', () => {
    expect(calculateVolume(200, 15)).toBe(3000);
  });

  it('handles decimal results', () => {
    expect(calculateVolume(7.5, 12)).toBe(90);
  });
});

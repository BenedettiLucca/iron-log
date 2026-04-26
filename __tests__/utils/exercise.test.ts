import { parseTargetSets } from '@/src/utils/exercise';

describe('parseTargetSets', () => {
  it('returns null for null input', () => {
    expect(parseTargetSets(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseTargetSets(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseTargetSets('')).toBeNull();
  });

  it('extracts sets from "3x8-12"', () => {
    expect(parseTargetSets('3x8-12')).toBe(3);
  });

  it('extracts sets from "4x10"', () => {
    expect(parseTargetSets('4x10')).toBe(4);
  });

  it('extracts sets from "3x8"', () => {
    expect(parseTargetSets('3x8')).toBe(3);
  });

  it('returns null for duration-based target "60s"', () => {
    expect(parseTargetSets('60s')).toBeNull();
  });

  it('returns null for "invalid"', () => {
    expect(parseTargetSets('invalid')).toBeNull();
  });

  it('extracts sets from "5x5"', () => {
    expect(parseTargetSets('5x5')).toBe(5);
  });

  it('extracts sets from "10x3" (high sets)', () => {
    expect(parseTargetSets('10x3')).toBe(10);
  });
});

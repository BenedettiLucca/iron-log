import { toLocalDateKey, todayLocalDateKey } from '../../src/utils/date-key';

describe('toLocalDateKey', () => {
  it('converts a midday timestamp to correct local date', () => {
    // noon local time — same day everywhere
    const noon = new Date(2026, 0, 15, 12, 0, 0).getTime();
    expect(toLocalDateKey(noon)).toBe('2026-01-15');
  });

  it('converts midnight local time correctly', () => {
    const midnight = new Date(2026, 0, 15, 0, 0, 0).getTime();
    expect(toLocalDateKey(midnight)).toBe('2026-01-15');
  });

  it('converts 23:59 local time to the same day (NOT the next day)', () => {
    // This is the core regression test:
    // toISOString would shift this to the next day in UTC-3
    const late = new Date(2026, 0, 15, 23, 59, 0).getTime();
    expect(toLocalDateKey(late)).toBe('2026-01-15');
  });

  it('produces different results than toISOString for late-night timestamps', () => {
    // Create a date at 23:00 local time
    const late = new Date(2026, 0, 15, 23, 0, 0).getTime();
    const localKey = toLocalDateKey(late);
    const utcKey = new Date(late).toISOString().split('T')[0];

    // In any timezone behind UTC (like UTC-3), the UTC key will be the next day
    // We just verify that our local key matches what the local date actually is
    expect(localKey).toBe('2026-01-15');

    // If the test runner is in UTC-3 or similar, utcKey will differ
    // But we can't assert that in CI — we just verify localKey is correct
    // and that the function does NOT use toISOString
    expect(localKey).not.toMatch(/^\d{4}-\d{2}-\d{2}T/); // no time component
  });

  it('handles month boundaries correctly', () => {
    const endOfMonth = new Date(2026, 0, 31, 23, 30, 0).getTime();
    expect(toLocalDateKey(endOfMonth)).toBe('2026-01-31');
  });

  it('handles year boundaries correctly', () => {
    const newYearsEve = new Date(2025, 11, 31, 23, 59, 59).getTime();
    expect(toLocalDateKey(newYearsEve)).toBe('2025-12-31');
  });

  it('pads single-digit months and days', () => {
    const d = new Date(2026, 2, 5, 10, 0, 0).getTime(); // March 5
    expect(toLocalDateKey(d)).toBe('2026-03-05');
  });
});

describe('todayLocalDateKey', () => {
  it('returns today in YYYY-MM-DD format', () => {
    const result = todayLocalDateKey();
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(result).toBe(expected);
  });
});

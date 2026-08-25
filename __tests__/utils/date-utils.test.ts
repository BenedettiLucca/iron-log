import {
  formatDateShort,
  formatEpochDate,
  getISOWeek,
  getWeekNumber,
  getWeekStart,
} from '../../src/utils/date-utils';

describe('date utilities', () => {
  describe('getISOWeek', () => {
    it.each([
      ['2026-01-01T12:00:00.000Z', '2026-W01'],
      ['2021-01-01T12:00:00.000Z', '2020-W53'],
      ['2024-12-30T12:00:00.000Z', '2025-W01'],
    ])('maps %s to %s', (isoDate, expected) => {
      expect(getISOWeek(Date.parse(isoDate))).toBe(expected);
    });
  });

  describe('getWeekStart', () => {
    it('returns local Monday midnight for a weekday', () => {
      const wednesday = new Date(2026, 5, 17, 15, 45).getTime();
      const mondayMidnight = new Date(2026, 5, 15, 0, 0, 0, 0).getTime();

      expect(getWeekStart(wednesday)).toBe(mondayMidnight);
    });

    it('maps Sunday back to the preceding Monday', () => {
      const sunday = new Date(2026, 5, 21, 10).getTime();
      const mondayMidnight = new Date(2026, 5, 15, 0, 0, 0, 0).getTime();

      expect(getWeekStart(sunday)).toBe(mondayMidnight);
    });
  });

  describe('formatEpochDate', () => {
    it('returns null only for a null epoch', () => {
      expect(formatEpochDate(null)).toBeNull();
    });

    it('formats Unix epoch zero as a valid date', () => {
      expect(formatEpochDate(0)).toBe('1970-01-01');
    });

    it('formats timestamps as UTC calendar dates', () => {
      expect(formatEpochDate(Date.parse('2026-07-20T23:59:59.000Z'))).toBe('2026-07-20');
    });
  });

  it('formats a Date as local DD/MM', () => {
    expect(formatDateShort(new Date(2026, 6, 5, 12))).toBe('05/07');
  });

  describe('getWeekNumber', () => {
    it.each([
      [new Date(2026, 0, 1, 12), 1],
      [new Date(2021, 0, 1, 12), 53],
      [new Date(2024, 11, 30, 12), 1],
    ])('returns ISO week %s', (date, expected) => {
      expect(getWeekNumber(date)).toBe(expected);
    });
  });
});

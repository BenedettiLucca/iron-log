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

    it('returns null for NaN or invalid epoch', () => {
      expect(formatEpochDate(NaN)).toBeNull();
    });

    it('formats timestamps as local calendar dates near midnight', () => {
      // 2026-07-20 23:45 in local time
      const lateNight = new Date(2026, 6, 20, 23, 45, 0).getTime();
      expect(formatEpochDate(lateNight)).toBe('2026-07-20');

      // 2026-07-20 00:15 in local time
      const earlyMorning = new Date(2026, 6, 20, 0, 15, 0).getTime();
      expect(formatEpochDate(earlyMorning)).toBe('2026-07-20');
    });

    it('pads single-digit months and days in local time', () => {
      const jan5 = new Date(2026, 0, 5, 12, 0, 0).getTime();
      expect(formatEpochDate(jan5)).toBe('2026-01-05');
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

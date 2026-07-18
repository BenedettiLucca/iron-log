import {
  getAdjacentMonths,
  getMetricTrend,
  getPercentageTrend,
  groupMetricsByMonth,
  isDisplayableBodyMetricValue,
} from '../../src/utils/body-metrics';
import { BodyMetric } from '../../src/types';

const makeMetric = (overrides: Partial<BodyMetric>): BodyMetric => ({
  id: 1,
  date: Date.now(),
  type: 'monthly',
  weight: null,
  waist: null,
  armRight: null,
  thighRight: null,
  chest: null,
  calf: null,
  photoFront: null,
  photoBack: null,
  photoSide: null,
  photoNotes: null,
  ...overrides,
});

describe('groupMetricsByMonth', () => {
  it('groups metrics by year-month', () => {
    const metrics: BodyMetric[] = [
      makeMetric({ id: 1, date: new Date(2026, 3, 5).getTime() }),
      makeMetric({ id: 2, date: new Date(2026, 3, 20).getTime() }),
      makeMetric({ id: 3, date: new Date(2026, 2, 10).getTime() }),
    ];
    const grouped = groupMetricsByMonth(metrics);
    expect(Object.keys(grouped).length).toBe(2);
    expect(grouped['2026-04'].length).toBe(2);
    expect(grouped['2026-03'].length).toBe(1);
  });

  it('returns empty object for empty array', () => {
    expect(groupMetricsByMonth([])).toEqual({});
  });

  it('handles single metric', () => {
    const metrics: BodyMetric[] = [makeMetric({ id: 1, date: new Date(2025, 11, 1).getTime() })];
    const grouped = groupMetricsByMonth(metrics);
    expect(grouped['2025-12'].length).toBe(1);
  });
});

describe('getAdjacentMonths', () => {
  it('returns current and previous month metrics', () => {
    const metrics: BodyMetric[] = [
      makeMetric({ id: 1, date: new Date(2026, 3, 5).getTime(), weight: 116 }),
      makeMetric({ id: 2, date: new Date(2026, 2, 10).getTime(), weight: 118 }),
      makeMetric({ id: 3, date: new Date(2026, 1, 15).getTime(), weight: 120 }),
    ];
    const { current, previous } = getAdjacentMonths(metrics);
    expect(current?.weight).toBe(116);
    expect(previous?.weight).toBe(118);
  });

  it('returns null previous when only one month', () => {
    const metrics: BodyMetric[] = [
      makeMetric({ id: 1, date: new Date(2026, 3, 5).getTime() }),
    ];
    const { current, previous } = getAdjacentMonths(metrics);
    expect(current).not.toBeNull();
    expect(previous).toBeNull();
  });

  it('returns nulls for empty array', () => {
    const { current, previous } = getAdjacentMonths([]);
    expect(current).toBeNull();
    expect(previous).toBeNull();
  });

  it('handles unsorted input', () => {
    const metrics: BodyMetric[] = [
      makeMetric({ id: 1, date: new Date(2026, 1, 5).getTime(), weight: 120 }),
      makeMetric({ id: 2, date: new Date(2026, 3, 10).getTime(), weight: 116 }),
    ];
    const { current, previous } = getAdjacentMonths(metrics);
    expect(current?.weight).toBe(116);
    expect(previous?.weight).toBe(120);
  });
});

describe('metric presentation helpers', () => {
  it('preserves direction and zero without assigning good/bad meaning', () => {
    expect(getMetricTrend(82, 80)).toEqual({ delta: 2, direction: 'up' });
    expect(getMetricTrend(78, 80)).toEqual({ delta: -2, direction: 'down' });
    expect(getMetricTrend(0, 0)).toEqual({ delta: 0, direction: 'stable' });
  });

  it('returns unavailable when either comparison value is missing or non-finite', () => {
    expect(getMetricTrend(null, 80)).toEqual({ delta: null, direction: 'unavailable' });
    expect(getMetricTrend(80, undefined)).toEqual({ delta: null, direction: 'unavailable' });
    expect(getMetricTrend(Number.NaN, 80)).toEqual({ delta: null, direction: 'unavailable' });
    expect(getMetricTrend(Number.POSITIVE_INFINITY, 80)).toEqual({ delta: null, direction: 'unavailable' });
  });

  it('uses an epsilon so displayed zero is stable rather than an up/down arrow', () => {
    expect(getMetricTrend(80.004, 80, 0.01)).toEqual({ delta: 0, direction: 'stable' });
  });

  it('does not invent a percentage when the previous period is zero or absent', () => {
    expect(getPercentageTrend(120, 100)).toEqual({ delta: 20, direction: 'up' });
    expect(getPercentageTrend(80, 100)).toEqual({ delta: -20, direction: 'down' });
    expect(getPercentageTrend(10, 0)).toEqual({ delta: null, direction: 'unavailable' });
    expect(getPercentageTrend(10, null)).toEqual({ delta: null, direction: 'unavailable' });
  });

  it('accepts intentional zero but rejects invalid persisted body metrics', () => {
    expect(isDisplayableBodyMetricValue(0)).toBe(true);
    expect(isDisplayableBodyMetricValue(999)).toBe(true);
    expect(isDisplayableBodyMetricValue(null)).toBe(false);
    expect(isDisplayableBodyMetricValue(-1)).toBe(false);
    expect(isDisplayableBodyMetricValue(1000)).toBe(false);
    expect(isDisplayableBodyMetricValue(Number.NaN)).toBe(false);
    expect(isDisplayableBodyMetricValue(Number.POSITIVE_INFINITY)).toBe(false);
  });
});

import { groupMetricsByMonth, getAdjacentMonths } from '../../src/utils/body-metrics';
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

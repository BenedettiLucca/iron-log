import { processCheckinData } from '../../src/utils/checkin-screen';
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

describe('processCheckinData', () => {
  it('returns current and previous from sorted monthly metrics', () => {
    const metrics: BodyMetric[] = [
      makeMetric({ id: 1, date: new Date(2026, 3, 5).getTime(), weight: 116 }),
      makeMetric({ id: 2, date: new Date(2026, 2, 10).getTime(), weight: 118 }),
      makeMetric({ id: 3, date: new Date(2026, 1, 15).getTime(), weight: 120, type: 'daily' }),
    ];
    const result = processCheckinData(metrics);
    expect(result.hasData).toBe(true);
    expect(result.current?.weight).toBe(116);
    expect(result.previous?.weight).toBe(118);
    expect(result.allMonthly.length).toBe(2);
  });

  it('returns hasData false when no monthly metrics', () => {
    const metrics: BodyMetric[] = [
      makeMetric({ id: 3, date: new Date(2026, 1, 15).getTime(), type: 'daily' }),
    ];
    const result = processCheckinData(metrics);
    expect(result.hasData).toBe(false);
    expect(result.current).toBeNull();
    expect(result.previous).toBeNull();
  });

  it('handles empty array', () => {
    const result = processCheckinData([]);
    expect(result.hasData).toBe(false);
    expect(result.allMonthly).toEqual([]);
  });

  it('sorts descending by date', () => {
    const metrics: BodyMetric[] = [
      makeMetric({ id: 1, date: new Date(2026, 1, 5).getTime(), weight: 120 }),
      makeMetric({ id: 2, date: new Date(2026, 3, 10).getTime(), weight: 116 }),
    ];
    const result = processCheckinData(metrics);
    expect(result.current?.weight).toBe(116);
    expect(result.previous?.weight).toBe(120);
  });
});

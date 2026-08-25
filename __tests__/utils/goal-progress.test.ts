import type { BodyMetric } from '../../src/types';
import { calculateGoalProgress, findGoalBaseline } from '../../src/utils/goal-progress';

const metric = (date: number, weight: number | null): BodyMetric => ({
  date,
  weight,
} as BodyMetric);

describe('findGoalBaseline', () => {
  test('never uses a measurement recorded after the goal start', () => {
    expect(findGoalBaseline([metric(300, 80)], 'weight', 200)).toBeNull();
  });

  test('uses the latest valid measurement at or before the goal start', () => {
    const metrics = [metric(100, 82), metric(180, 81), metric(180, null), metric(300, 79)];

    expect(findGoalBaseline(metrics, 'weight', 200)).toBe(81);
  });
});

describe('calculateGoalProgress', () => {
  // - decrease 121→100 at current121 with persisted achieved=true still yields 0/not completed;
  test('decrease 121 to 100 at current 121 with achieved=true still yields 0/not completed', () => {
    const result = calculateGoalProgress(121, 121, 100, true);
    expect(result.progress).toBe(0);
    expect(result.isCompleted).toBe(false);
  });

  // - decrease reaches target => 100/completed;
  test('decrease reaches target yields 100/completed', () => {
    const result = calculateGoalProgress(121, 100, 100, false);
    expect(result.progress).toBe(100);
    expect(result.isCompleted).toBe(true);

    const result2 = calculateGoalProgress(121, 95, 100, false);
    expect(result2.progress).toBe(100);
    expect(result2.isCompleted).toBe(true);
  });

  // - increase baseline/midpoint/target works;
  test('increase baseline/midpoint/target works', () => {
    // baseline
    const baseline = calculateGoalProgress(100, 100, 120, false);
    expect(baseline.progress).toBe(0);
    expect(baseline.isCompleted).toBe(false);

    // midpoint
    const midpoint = calculateGoalProgress(100, 110, 120, false);
    expect(midpoint.progress).toBe(50);
    expect(midpoint.isCompleted).toBe(false);

    // target
    const target = calculateGoalProgress(100, 120, 120, false);
    expect(target.progress).toBe(100);
    expect(target.isCompleted).toBe(true);
  });

  // - wrong-direction movement clamps 0;
  test('wrong-direction movement clamps 0', () => {
    // increase wrong direction
    const resIncreaseWrong = calculateGoalProgress(100, 90, 120, false);
    expect(resIncreaseWrong.progress).toBe(0);
    expect(resIncreaseWrong.isCompleted).toBe(false);

    // decrease wrong direction
    const resDecreaseWrong = calculateGoalProgress(120, 130, 100, false);
    expect(resDecreaseWrong.progress).toBe(0);
    expect(resDecreaseWrong.isCompleted).toBe(false);
  });

  test('initial === target keeps percentage unavailable and derives completion from current data', () => {
    const result = calculateGoalProgress(100, 100, 100, false);
    expect(result.progress).toBeNull();
    expect(result.isCompleted).toBe(true);

    const contradictoryPersistedState = calculateGoalProgress(100, 101, 100, true);
    expect(contradictoryPersistedState.progress).toBeNull();
    expect(contradictoryPersistedState.isCompleted).toBe(false);
  });

  // - missing baseline/current uses persisted achieved only as fallback;
  test('missing baseline/current uses persisted achieved only as fallback', () => {
    // null current, achieved=false
    const resNullCurrentFalse = calculateGoalProgress(100, null, 120, false);
    expect(resNullCurrentFalse.progress).toBeNull();
    expect(resNullCurrentFalse.isCompleted).toBe(false);

    // null current, achieved=true
    const resNullCurrentTrue = calculateGoalProgress(100, null, 120, true);
    expect(resNullCurrentTrue.progress).toBe(100);
    expect(resNullCurrentTrue.isCompleted).toBe(true);

    // null initial, achieved=false
    const resNullInitialFalse = calculateGoalProgress(null, 110, 120, false);
    expect(resNullInitialFalse.progress).toBeNull();
    expect(resNullInitialFalse.isCompleted).toBe(false);

    // null initial, achieved=true
    const resNullInitialTrue = calculateGoalProgress(null, 110, 120, true);
    expect(resNullInitialTrue.progress).toBe(100);
    expect(resNullInitialTrue.isCompleted).toBe(true);
  });

  // - NaN/infinite inputs unavailable.
  test('NaN/infinite inputs are unavailable', () => {
    const resNaN = calculateGoalProgress(NaN, 110, 120, false);
    expect(resNaN.progress).toBeNull();
    expect(resNaN.isCompleted).toBe(false);

    const resInfinite = calculateGoalProgress(100, Infinity, 120, false);
    expect(resInfinite.progress).toBeNull();
    expect(resInfinite.isCompleted).toBe(false);
  });
});

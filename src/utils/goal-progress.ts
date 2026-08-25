import type { BodyMetric, MeasurementGoalType } from '../types';

/**
 * Find latest valid (finite non-null) baseline metric value recorded at or before startDate.
 */
export function findGoalBaseline(
  metrics: BodyMetric[],
  goalType: MeasurementGoalType,
  startDate: number,
): number | null {
  let latestCandidate: BodyMetric | null = null;

  for (const m of metrics) {
    if (m.date <= startDate) {
      const val = m[goalType as keyof BodyMetric];
      if (val !== null && val !== undefined && typeof val === 'number' && Number.isFinite(val)) {
        if (!latestCandidate || m.date >= latestCandidate.date) {
          latestCandidate = m;
        }
      }
    }
  }

  if (!latestCandidate) return null;
  const result = latestCandidate[goalType as keyof BodyMetric];
  return typeof result === 'number' && Number.isFinite(result) ? result : null;
}

/**
 * Helper to calculate goal progress and completion status.
 */
export function calculateGoalProgress(
  initial: number | null,
  current: number | null,
  target: number | null,
  achieved: boolean
): { progress: number | null; isCompleted: boolean } {
  const isInitialFinite = initial !== null && Number.isFinite(initial);
  const isCurrentFinite = current !== null && Number.isFinite(current);
  const isTargetFinite = target !== null && Number.isFinite(target);

  if (isInitialFinite && isCurrentFinite && isTargetFinite) {
    if (target === initial) {
      return { progress: null, isCompleted: current === target };
    }

    const pct = ((current - initial) / (target - initial)) * 100;
    const progress = Math.min(Math.max(Math.round(pct), 0), 100);
    return { progress, isCompleted: progress === 100 };
  }

  // Progress is unavailable due to missing/non-finite values
  if (achieved) {
    return { progress: 100, isCompleted: true };
  }

  return { progress: null, isCompleted: false };
}

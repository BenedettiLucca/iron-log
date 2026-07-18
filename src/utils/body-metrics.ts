import { BodyMetric } from '@/src/types';

export function groupMetricsByMonth(metrics: BodyMetric[]): Record<string, BodyMetric[]> {
  return metrics.reduce((acc, metric) => {
    const d = new Date(metric.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(metric);
    return acc;
  }, {} as Record<string, BodyMetric[]>);
}

export function getAdjacentMonths(metrics: BodyMetric[]): { current: BodyMetric | null; previous: BodyMetric | null } {
  const sorted = [...metrics].sort((a, b) => b.date - a.date);
  if (sorted.length === 0) return { current: null, previous: null };
  return {
    current: sorted[0],
    previous: sorted[1] || null,
  };
}

export type MetricTrendDirection = 'up' | 'down' | 'stable' | 'unavailable';
export type MetricTrend = { delta: number | null; direction: MetricTrendDirection };

export function getMetricTrend(
  current: number | null | undefined,
  previous: number | null | undefined,
  epsilon?: number,
): MetricTrend {
  if (current === null || current === undefined || !Number.isFinite(current) ||
      previous === null || previous === undefined || !Number.isFinite(previous)) {
    return { delta: null, direction: 'unavailable' };
  }
  const delta = current - previous;
  if (epsilon !== undefined && Math.abs(delta) < epsilon) {
    return { delta: 0, direction: 'stable' };
  }
  if (delta > 0) return { delta, direction: 'up' };
  if (delta < 0) return { delta, direction: 'down' };
  return { delta: 0, direction: 'stable' };
}

export function getPercentageTrend(
  current: number | null | undefined,
  previous: number | null | undefined,
  epsilon?: number,
): MetricTrend {
  if (current === null || current === undefined || !Number.isFinite(current) ||
      previous === null || previous === undefined || !Number.isFinite(previous) ||
      previous === 0) {
    return { delta: null, direction: 'unavailable' };
  }
  const delta = ((current - previous) / previous) * 100;
  if (epsilon !== undefined && Math.abs(delta) < epsilon) {
    return { delta: 0, direction: 'stable' };
  }
  if (delta > 0) return { delta, direction: 'up' };
  if (delta < 0) return { delta, direction: 'down' };
  return { delta: 0, direction: 'stable' };
}

export function isDisplayableBodyMetricValue(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 999;
}

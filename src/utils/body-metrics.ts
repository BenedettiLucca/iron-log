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

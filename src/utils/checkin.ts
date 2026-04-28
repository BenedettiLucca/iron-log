import { BodyMetric } from '@/src/types';

export function formatMonthYear(epoch: number, locale = 'pt-BR'): string {
  return new Date(epoch).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

export function calculateChange(current: number | null, previous: number | null): string {
  if (current === null || previous === null) return '—';
  const diff = current - previous;
  const sign = diff > 0 ? '+' : '';
  return `${sign}${diff.toFixed(1)}`;
}

export function getPhotoOverlayData(metric: BodyMetric): { weight: string | null; waist: string | null } {
  return {
    weight: metric.weight ? `${metric.weight} kg` : null,
    waist: metric.waist ? `${metric.waist} cm` : null,
  };
}

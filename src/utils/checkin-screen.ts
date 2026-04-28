import { BodyMetric } from '@/src/types';

export interface CheckinScreenData {
  current: BodyMetric | null;
  previous: BodyMetric | null;
  allMonthly: BodyMetric[];
  hasData: boolean;
}

export function processCheckinData(metrics: BodyMetric[]): CheckinScreenData {
  const monthly = metrics.filter(m => m.type === 'monthly').sort((a, b) => b.date - a.date);
  return {
    current: monthly[0] ?? null,
    previous: monthly[1] ?? null,
    allMonthly: monthly,
    hasData: monthly.length > 0,
  };
}

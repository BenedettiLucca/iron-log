import { useState, useCallback } from 'react';
import { db } from '@/src/db/client';
import { bodyMetrics } from '@/src/db/schema';
import { desc, asc, eq } from 'drizzle-orm';
import { logger } from '@/services/logger';
import { BodyMetric } from '@/src/types';

export function useBodyMetrics() {
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await db.select().from(bodyMetrics).orderBy(desc(bodyMetrics.date)) as BodyMetric[];
      setMetrics(data || []);
    } catch (e) {
      logger.error('Failed to fetch body metrics', e);
      setMetrics([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveDailyWeight = useCallback(async (weight: number): Promise<boolean> => {
    try {
      await db.insert(bodyMetrics).values({
        date: Date.now(),
        type: 'daily',
        weight,
      });
      await fetchMetrics();
      return true;
    } catch (e) {
      logger.error('Failed to save daily weight', e);
      return false;
    }
  }, [fetchMetrics]);

  const getLastWeight = useCallback(async (): Promise<number | null> => {
    try {
      const result = await db.select({ weight: bodyMetrics.weight, date: bodyMetrics.date })
        .from(bodyMetrics)
        .where(eq(bodyMetrics.type, 'daily'))
        .orderBy(desc(bodyMetrics.date))
        .limit(1);
      return result.length > 0 && result[0].weight ? result[0].weight : null;
    } catch (e) {
      logger.error('Failed to get last weight', e);
      return null;
    }
  }, []);

  const getMonthlyMetrics = useCallback((): BodyMetric[] => {
    return metrics.filter(m => m.type === 'monthly');
  }, [metrics]);

  const getWeightHistory = useCallback((): BodyMetric[] => {
    return metrics.filter(m => m.weight !== null && m.weight > 0);
  }, [metrics]);

  return {
    metrics,
    isLoading,
    fetchMetrics,
    saveDailyWeight,
    getLastWeight,
    getMonthlyMetrics,
    getWeightHistory,
  };
}

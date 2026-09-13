import { useState, useCallback } from 'react';
import { db as defaultDb } from '@/src/db/client';
import { bodyMetrics } from '@/src/db/schema';
import { desc, eq, and, or, isNotNull, gt, lte, ne } from 'drizzle-orm';
import { logger } from '@/services/logger';
import { BodyMetric } from '@/src/types';
import { isDisplayableBodyMetricValue } from '@/src/utils/body-metrics';

export const DEFAULT_PREVIEW_LIMIT = 10;

/**
 * Fetches recent body metrics up to `limit` (default: 10) ordered by date descending.
 * Avoids loading the entire body_metrics table into memory for preview cards.
 */
export async function fetchRecentBodyMetrics(
  database: typeof defaultDb = defaultDb,
  limit: number = DEFAULT_PREVIEW_LIMIT,
): Promise<BodyMetric[]> {
  const result = await database
    .select()
    .from(bodyMetrics)
    .orderBy(desc(bodyMetrics.date))
    .limit(limit);
  return (result || []) as BodyMetric[];
}

/**
 * Dedicated LIMIT 1 query for the latest valid positive body weight.
 * Operates efficiently over thousands of rows without materializing full history.
 */
export async function fetchLatestValidWeight(
  database: typeof defaultDb = defaultDb,
): Promise<number | null> {
  const result = await database
    .select({ weight: bodyMetrics.weight })
    .from(bodyMetrics)
    .where(
      and(
        isNotNull(bodyMetrics.weight),
        gt(bodyMetrics.weight, 0),
        lte(bodyMetrics.weight, 999),
      ),
    )
    .orderBy(desc(bodyMetrics.date))
    .limit(1);

  if (result.length > 0 && isDisplayableBodyMetricValue(result[0].weight) && result[0].weight > 0) {
    return result[0].weight;
  }
  return null;
}

/**
 * Dedicated LIMIT 1 query for the latest monthly check-in that has at least one photo.
 * Correctly retrieves photos even when buried under hundreds of daily entries.
 */
export async function fetchLatestMonthlyWithPhotos(
  database: typeof defaultDb = defaultDb,
): Promise<BodyMetric | null> {
  const result = await database
    .select()
    .from(bodyMetrics)
    .where(
      and(
        eq(bodyMetrics.type, 'monthly'),
        or(
          and(isNotNull(bodyMetrics.photoFront), ne(bodyMetrics.photoFront, '')),
          and(isNotNull(bodyMetrics.photoBack), ne(bodyMetrics.photoBack, '')),
          and(isNotNull(bodyMetrics.photoSide), ne(bodyMetrics.photoSide, '')),
        ),
      ),
    )
    .orderBy(desc(bodyMetrics.date))
    .limit(1);

  const row = (result[0] as BodyMetric) ?? null;
  if (!row) return null;
  const hasPhoto = Boolean(
    (row.photoFront && row.photoFront.trim().length > 0) ||
    (row.photoBack && row.photoBack.trim().length > 0) ||
    (row.photoSide && row.photoSide.trim().length > 0),
  );
  return hasPhoto ? row : null;
}

/**
 * Explicit query for full body metrics history.
 * Must be called explicitly by evolution, analytics, or export services.
 * Guarantees that callers needing all entries never receive only a 10-item slice by mistake.
 */
export async function fetchFullBodyMetricsHistory(
  database: typeof defaultDb = defaultDb,
): Promise<BodyMetric[]> {
  const result = await database
    .select()
    .from(bodyMetrics)
    .orderBy(desc(bodyMetrics.date));
  return (result || []) as BodyMetric[];
}

export interface UseBodyMetricsOptions {
  /**
   * Maximum number of recent preview entries to load.
   * Default: 10.
   */
  limit?: number;

  /**
   * When true, loads the full table history into `metrics`.
   * Defaults to false so Bio tab does not materialize all rows.
   * Evolution and export callers can set this to true.
   */
  fullHistory?: boolean;
}

export interface UseBodyMetricsReturn {
  metrics: BodyMetric[];
  recentMetrics: BodyMetric[];
  latestValidWeight: number | null;
  latestMonthlyWithPhotos: BodyMetric | null;
  isLoading: boolean;
  hasError: boolean;
  errorMessage: string;
  fetchMetrics: (options?: { fullHistory?: boolean; limit?: number }) => Promise<void>;
  fetchFullHistory: () => Promise<BodyMetric[]>;
  fetchAllMetrics: () => Promise<BodyMetric[]>;
  fetchRecentMetrics: (limit?: number) => Promise<BodyMetric[]>;
  saveDailyWeight: (weight: number) => Promise<boolean>;
  getLastWeight: () => Promise<number | null>;
  getLatestMonthlyWithPhotos: () => Promise<BodyMetric | null>;
  getMonthlyMetrics: () => BodyMetric[];
  getWeightHistory: () => BodyMetric[];
}

export function useBodyMetrics(options?: UseBodyMetricsOptions): UseBodyMetricsReturn {
  const previewLimit = options?.limit ?? DEFAULT_PREVIEW_LIMIT;
  const wantFullHistory = options?.fullHistory ?? false;

  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [latestValidWeight, setLatestValidWeight] = useState<number | null>(null);
  const [latestMonthlyWithPhotos, setLatestMonthlyWithPhotos] = useState<BodyMetric | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchMetrics = useCallback(async (fetchOpts?: { fullHistory?: boolean; limit?: number }) => {
    const isFull = fetchOpts?.fullHistory ?? wantFullHistory;
    const limit = fetchOpts?.limit ?? previewLimit;

    try {
      setIsLoading(true);
      setHasError(false);
      setErrorMessage('');

      if (isFull) {
        const fullData = await fetchFullBodyMetricsHistory(defaultDb);
        setMetrics(fullData);

        const validWeight = fullData.find(
          m => isDisplayableBodyMetricValue(m.weight) && m.weight > 0,
        )?.weight ?? null;
        const monthlyWithPhotos = fullData.find(
          m => m.type === 'monthly' && Boolean(
            (m.photoFront && m.photoFront.trim().length > 0) ||
            (m.photoBack && m.photoBack.trim().length > 0) ||
            (m.photoSide && m.photoSide.trim().length > 0),
          ),
        ) ?? null;

        setLatestValidWeight(validWeight);
        setLatestMonthlyWithPhotos(monthlyWithPhotos);
      } else {
        const [recent, latestWeight, monthlyPhotos] = await Promise.all([
          fetchRecentBodyMetrics(defaultDb, limit),
          fetchLatestValidWeight(defaultDb),
          fetchLatestMonthlyWithPhotos(defaultDb),
        ]);

        setMetrics(recent);
        setLatestValidWeight(latestWeight);
        setLatestMonthlyWithPhotos(monthlyPhotos);
      }
    } catch (e) {
      logger.error('Failed to fetch body metrics', e);
      setHasError(true);
      setErrorMessage('');
      setMetrics([]);
      setLatestValidWeight(null);
      setLatestMonthlyWithPhotos(null);
    } finally {
      setIsLoading(false);
    }
  }, [previewLimit, wantFullHistory]);

  const saveDailyWeight = useCallback(async (weight: number): Promise<boolean> => {
    try {
      await defaultDb.insert(bodyMetrics).values({
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
      return await fetchLatestValidWeight(defaultDb);
    } catch (e) {
      logger.error('Failed to get last weight', e);
      return null;
    }
  }, []);

  const getLatestMonthlyWithPhotos = useCallback(async (): Promise<BodyMetric | null> => {
    try {
      return await fetchLatestMonthlyWithPhotos(defaultDb);
    } catch (e) {
      logger.error('Failed to get latest monthly with photos', e);
      return null;
    }
  }, []);

  const fetchFullHistory = useCallback(async (): Promise<BodyMetric[]> => {
    return await fetchFullBodyMetricsHistory(defaultDb);
  }, []);

  const fetchRecentMetrics = useCallback(async (limit?: number): Promise<BodyMetric[]> => {
    return await fetchRecentBodyMetrics(defaultDb, limit ?? previewLimit);
  }, [previewLimit]);

  const getMonthlyMetrics = useCallback((): BodyMetric[] => {
    return metrics.filter(m => m.type === 'monthly');
  }, [metrics]);

  const getWeightHistory = useCallback((): BodyMetric[] => {
    return metrics.filter(m => isDisplayableBodyMetricValue(m.weight) && m.weight > 0);
  }, [metrics]);

  return {
    metrics,
    recentMetrics: metrics,
    latestValidWeight,
    latestMonthlyWithPhotos,
    isLoading,
    hasError,
    errorMessage,
    fetchMetrics,
    fetchFullHistory,
    fetchAllMetrics: fetchFullHistory,
    fetchRecentMetrics,
    saveDailyWeight,
    getLastWeight,
    getLatestMonthlyWithPhotos,
    getMonthlyMetrics,
    getWeightHistory,
  };
}

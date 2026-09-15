/**
 * Formatting and calculation utilities for Routine Preview (modal & full screen).
 * Pure helpers extracted to ensure production and test suites share the exact same implementation.
 */

export interface WeightHistoryPoint {
  date: string;
  weight: number;
}

/**
 * Formats epoch timestamp to localized date string (DD/MM/YY).
 * Returns em-dash '—' for null, undefined, or 0.
 */
export function formatDate(epoch: number | null | undefined, locale: string = 'pt-BR'): string {
  if (!epoch) return '—';
  return new Date(epoch).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/**
 * Formats rest duration in seconds to human-readable string (e.g., '30s', '1m', '2m').
 * Returns empty string for null, undefined, or non-positive values.
 */
export function formatRest(seconds?: number | null): string {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m`;
}

/**
 * Calculates estimated routine duration in minutes based on total exercise count.
 * Returns 0 for 0 exercises; otherwise minimum 15 minutes or 3 minutes per exercise.
 */
export function calcEstimatedDuration(totalExercises: number): number {
  if (totalExercises <= 0) return 0;
  return Math.max(15, totalExercises * 3);
}

/**
 * Transforms raw session set history into ordered date-weight pairs (oldest first).
 */
export function computeWeightHistory(
  rawHistory: { startTime: number; weightKg: number | null }[],
  locale: string = 'pt-BR'
): WeightHistoryPoint[] {
  return rawHistory
    .filter((w): w is { startTime: number; weightKg: number } => w.weightKg !== null)
    .map(w => ({
      date: new Date(w.startTime).toLocaleDateString(locale, { day: '2-digit', month: '2-digit' }),
      weight: w.weightKg,
    }))
    .reverse();
}

/**
 * Computes proportional bar heights for the weight evolution chart.
 * Clamps heights between minBarHeight and maxBarHeight.
 */
export function computeBarHeights(
  history: { weight: number }[],
  minBarHeight: number = 20,
  maxBarHeight: number = 60
): number[] {
  if (history.length === 0) return [];
  const weights = history.map(w => w.weight);
  const maxW = Math.max(...weights);
  const minW = Math.min(...weights);
  const range = maxW - minW || 1;
  const availableHeight = maxBarHeight - minBarHeight;
  return history.map(point => {
    return ((point.weight - minW) / range) * availableHeight + minBarHeight;
  });
}

/**
 * Counts exercises that have a personal record.
 */
export function countExercisesWithPRs(
  exercises: { prWeight: number | null }[]
): number {
  return exercises.filter(e => e.prWeight !== null).length;
}

/**
 * Deduplicates exercises by exercise id for personal record badges.
 * Ensures that if an exercise appears multiple times in a routine (A/B/A),
 * only one PR badge is displayed.
 */
export function dedupeExercisesForPRs<T extends { id: number; prWeight: number | null }>(
  exercises: T[]
): T[] {
  return [...new Map(exercises.filter(e => e.prWeight !== null).map(ex => [ex.id, ex])).values()];
}

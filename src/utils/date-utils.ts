/**
 * Date utilities shared across services and components.
 */

/**
 * Returns ISO week string in YYYY-Www format (e.g. "2026-W24").
 * Extracted from AnalyticsService.getISOWeek.
 */
export function getISOWeek(epoch: number): string {
  const d = new Date(epoch);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
}

/**
 * Returns epoch milliseconds for the Monday of the week containing the given epoch.
 * Extracted from AnalyticsService.getWeekStart.
 */
export function getWeekStart(epoch: number): number {
  const d = new Date(epoch);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  return new Date(d.setDate(diff)).setHours(0, 0, 0, 0);
}

/**
 * Formats an epoch number to a localized date string (YYYY-MM-DD).
 * Extracted from AlexandriaExportService.formatEpochDate.
 */
export function formatEpochDate(epoch: number | null): string | null {
  if (!epoch) return null;
  const d = new Date(epoch);
  return d.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * Formats a Date object to DD/MM format.
 * Extracted from NotionExportService.formatDateShort.
 */
export function formatDateShort(d: Date): string {
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

/**
 * Returns the ISO week number of the year for a given Date.
 * Extracted from NotionExportService.getWeekNumber.
 */
export function getWeekNumber(d: Date): number {
  const target = new Date(d.valueOf());
  const dayNr = (d.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
}

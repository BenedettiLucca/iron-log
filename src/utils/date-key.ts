/**
 * Local date-key utilities for calendar and date grouping.
 *
 * The core problem: `new Date(ts).toISOString().split('T')[0]` uses UTC.
 * In timezones behind UTC (e.g. UTC-3 Brazil), a timestamp at 23:00 local
 * becomes 02:00 UTC the next day — workouts appear on the wrong calendar day.
 *
 * Solution: use local date components via Date getters.
 */

/**
 * Converts an epoch timestamp to a 'YYYY-MM-DD' string using LOCAL timezone.
 * This is the inverse of what `toISOString().split('T')[0]` does (UTC).
 */
export function toLocalDateKey(timestamp: number): string {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns today's date as a 'YYYY-MM-DD' string in local timezone.
 */
export function todayLocalDateKey(): string {
  return toLocalDateKey(Date.now());
}

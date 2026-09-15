import { db } from '@/src/db/client';
import { sessions } from '@/src/db/schema';
import { isNull, and, sql, gte, asc } from 'drizzle-orm';
import { logger } from '@/services/logger';
import { toLocalDateKey } from '@/src/utils/date-key';

export interface DailyActivityBucket {
  date: string; // 'YYYY-MM-DD'
  minutes: number;
  sessions: number;
}

export interface HeatmapDay {
  date: string;
  minutes: number;
  sessions: number;
  intensity: 0 | 1 | 2 | 3;
  isFuture: boolean;
}

export interface HeatmapWeek {
  weekIndex: number;
  days: HeatmapDay[];
  monthLabel?: string;
}

export interface HeatmapGrid {
  weeks: HeatmapWeek[];
  totalSessions: number;
  totalMinutes: number;
  activeDays: number;
}

/**
 * Returns intensity bucket 0-3 based on workout minutes:
 * 0: 0 minutes
 * 1: 1-30 minutes
 * 2: 31-60 minutes
 * 3: 60+ minutes
 */
export function getIntensityLevel(minutes: number): 0 | 1 | 2 | 3 {
  if (minutes <= 0) return 0;
  if (minutes <= 30) return 1;
  if (minutes <= 60) return 2;
  return 3;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const ActivityHeatmapService = {
  /**
   * Retrieves daily activity buckets for the period starting at `since` (defaults to ~365 days ago).
   * Follows TRUST II rules:
   * - Only finished sessions (endTime IS NOT NULL)
   * - No deleted sessions (isNull(sessions.deletedAt))
   * Minutes are taken from sessions.durationMinutes (fallback: (endTime - startTime) / 60000 when durationMinutes is null).
   */
  async getDailyActivity(since?: number): Promise<DailyActivityBucket[]> {
    try {
      const now = Date.now();
      const effectiveSince = since ?? (now - 365 * MS_PER_DAY);

      const conditions = [
        isNull(sessions.deletedAt),
        sql`${sessions.endTime} IS NOT NULL`,
      ];

      if (since !== undefined) {
        conditions.push(gte(sessions.startTime, effectiveSince));
      } else {
        conditions.push(gte(sessions.startTime, effectiveSince));
      }

      const rows = await db
        .select({
          id: sessions.id,
          startTime: sessions.startTime,
          endTime: sessions.endTime,
          durationMinutes: sessions.durationMinutes,
        })
        .from(sessions)
        .where(and(...conditions))
        .orderBy(asc(sessions.startTime));

      // Group sessions by local calendar date
      const dayMap = new Map<string, { minutes: number; sessions: number }>();

      for (const row of rows) {
        const dateKey = toLocalDateKey(row.startTime);
        let duration = 0;
        if (row.durationMinutes != null) {
          duration = Math.max(0, row.durationMinutes);
        } else if (row.endTime != null && row.startTime != null) {
          duration = Math.max(0, Math.round((row.endTime - row.startTime) / 60000));
        }

        const existing = dayMap.get(dateKey) ?? { minutes: 0, sessions: 0 };
        existing.minutes += duration;
        existing.sessions += 1;
        dayMap.set(dateKey, existing);
      }

      // Generate continuous daily buckets from effectiveSince to today
      const startDate = new Date(effectiveSince);
      startDate.setHours(0, 0, 0, 0);

      const endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);

      const buckets: DailyActivityBucket[] = [];
      const current = new Date(startDate);

      while (current <= endDate) {
        const key = toLocalDateKey(current.getTime());
        const data = dayMap.get(key) ?? { minutes: 0, sessions: 0 };
        buckets.push({
          date: key,
          minutes: data.minutes,
          sessions: data.sessions,
        });
        current.setDate(current.getDate() + 1);
      }

      // Ensure any days in dayMap outside generated range are also merged and sorted
      for (const [key, data] of dayMap.entries()) {
        if (!buckets.some((b) => b.date === key)) {
          buckets.push({
            date: key,
            minutes: data.minutes,
            sessions: data.sessions,
          });
        }
      }

      buckets.sort((a, b) => a.date.localeCompare(b.date));
      return buckets;
    } catch (e) {
      logger.error('Failed to get daily activity', e);
      return [];
    }
  },

  /**
   * Builds a structured grid of weeks × weekdays for GitHub-style heatmap rendering.
   */
  buildHeatmap(
    buckets: DailyActivityBucket[],
    weeksCount = 53,
    referenceDate: Date = new Date(),
    locale = 'en-US'
  ): HeatmapGrid {
    const bucketMap = new Map<string, DailyActivityBucket>();
    let totalSessions = 0;
    let totalMinutes = 0;
    let activeDays = 0;

    for (const bucket of buckets) {
      bucketMap.set(bucket.date, bucket);
      if (bucket.sessions > 0) {
        totalSessions += bucket.sessions;
        totalMinutes += bucket.minutes;
        activeDays += 1;
      }
    }

    const ref = new Date(referenceDate);
    const todayDayOfWeek = (ref.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    const currentWeekMonday = new Date(ref);
    currentWeekMonday.setDate(ref.getDate() - todayDayOfWeek);
    currentWeekMonday.setHours(0, 0, 0, 0);

    const gridStartMonday = new Date(currentWeekMonday);
    gridStartMonday.setDate(currentWeekMonday.getDate() - (weeksCount - 1) * 7);

    const weeks: HeatmapWeek[] = [];
    let lastMonth = -1;

    for (let w = 0; w < weeksCount; w++) {
      const days: HeatmapDay[] = [];
      let weekMonthLabel: string | undefined;

      for (let d = 0; d < 7; d++) {
        const dayDate = new Date(gridStartMonday);
        dayDate.setDate(gridStartMonday.getDate() + (w * 7 + d));
        const dateKey = toLocalDateKey(dayDate.getTime());
        const isFuture = dayDate > ref;

        const bucket = bucketMap.get(dateKey);
        const minutes = bucket?.minutes ?? 0;
        const sessionsCount = bucket?.sessions ?? 0;
        const intensity = isFuture ? 0 : getIntensityLevel(minutes);

        days.push({
          date: dateKey,
          minutes,
          sessions: sessionsCount,
          intensity,
          isFuture,
        });

        // Determine month label for the first day of the week
        if (d === 0) {
          const month = dayDate.getMonth();
          if (month !== lastMonth) {
            try {
              weekMonthLabel = dayDate.toLocaleDateString(locale, { month: 'short' });
            } catch {
              weekMonthLabel = undefined;
            }
            lastMonth = month;
          }
        }
      }

      weeks.push({
        weekIndex: w,
        days,
        monthLabel: weekMonthLabel,
      });
    }

    return {
      weeks,
      totalSessions,
      totalMinutes,
      activeDays,
    };
  },

  getIntensityLevel,
};

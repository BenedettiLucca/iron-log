import { db } from '@/src/db/client';
import { sessions, sets } from '@/src/db/schema';
import { desc, isNull, and, or, inArray, gte, lt, eq, sql } from 'drizzle-orm';
import { Session } from '@/src/types';
import { toLocalDateKey } from '@/src/utils/date-key';

export interface SessionWithExercises extends Session {
  exerciseNames: string[];
  totalSets: number;
}

export interface MonthMark {
  marked: boolean;
  dotColor: string;
}

export interface HistorySearchFilters {
  query?: string;
  startDate?: string; // 'YYYY-MM-DD'
  endDate?: string; // 'YYYY-MM-DD'
}

export interface HistoryPaginationCursor {
  startTime: number;
  id: number;
}

export interface HistorySearchOptions extends HistorySearchFilters {
  limit?: number;
  cursor?: HistoryPaginationCursor;
  dbInstance?: typeof db;
}

export interface HistorySearchResult {
  sessions: SessionWithExercises[];
  nextCursor?: HistoryPaginationCursor;
  hasMore: boolean;
}

/**
 * Validates whether a dateKey is a valid 'YYYY-MM-DD' string representing a real calendar date.
 */
export function isValidDateKey(date?: unknown): date is string {
  if (typeof date !== 'string') return false;
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return (
    d.getFullYear() === year &&
    d.getMonth() === month - 1 &&
    d.getDate() === day
  );
}

/**
 * Computes local timestamp bounds for a given year and month (1-indexed).
 * C7 compliant: start-inclusive, end-exclusive.
 */
export function getMonthRange(year: number, month: number): { startTimestamp: number; endTimestamp: number } {
  const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const end = new Date(year, month, 1, 0, 0, 0, 0);
  return {
    startTimestamp: start.getTime(),
    endTimestamp: end.getTime(),
  };
}

/**
 * Computes local timestamp bounds for a specific 'YYYY-MM-DD' dateKey.
 * C7 compliant: start-inclusive, end-exclusive.
 */
export function getDayRange(dateKey: string): { startTimestamp: number; endTimestamp: number } {
  if (!isValidDateKey(dateKey)) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  const [year, month, day] = dateKey.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0);
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
  return {
    startTimestamp: start.getTime(),
    endTimestamp: end.getTime(),
  };
}

/**
 * Computes timestamp bounds for user-provided date intervals.
 * Note: endDate is user-inclusive, mapping to the next day's midnight in SQL (end-exclusive).
 */
export function getDateIntervalRange(startDate?: string, endDate?: string): {
  startTimestamp?: number;
  endTimestamp?: number;
} {
  let startTimestamp: number | undefined;
  let endTimestamp: number | undefined;

  if (startDate && isValidDateKey(startDate)) {
    startTimestamp = getDayRange(startDate).startTimestamp;
  }
  if (endDate && isValidDateKey(endDate)) {
    endTimestamp = getDayRange(endDate).endTimestamp;
  }

  return { startTimestamp, endTimestamp };
}

/**
 * Enriches session rows with exercise names and non-deleted set counts in a single batch query.
 */
async function enrichSessionsWithExercises(
  sessionRows: Session[],
  dbInstance: typeof db
): Promise<SessionWithExercises[]> {
  if (sessionRows.length === 0) return [];

  const sessionIds = sessionRows.map((s) => s.id);
  const allSets = await dbInstance
    .select({
      sessionId: sets.sessionId,
      exerciseName: sets.exerciseName,
    })
    .from(sets)
    .where(and(
      inArray(sets.sessionId, sessionIds),
      isNull(sets.deletedAt)
    ));

  const setsBySession = new Map<number, { names: Set<string>; count: number }>();
  for (const row of allSets) {
    if (!setsBySession.has(row.sessionId)) {
      setsBySession.set(row.sessionId, { names: new Set(), count: 0 });
    }
    const entry = setsBySession.get(row.sessionId)!;
    entry.count++;
    if (row.exerciseName) {
      entry.names.add(row.exerciseName);
    }
  }

  return sessionRows.map((session) => {
    const data = setsBySession.get(session.id);
    return {
      ...session,
      exerciseNames: data ? Array.from(data.names) : [],
      totalSets: data?.count ?? 0,
    };
  });
}

export const HistoryQueryService = {
  isValidDateKey,
  getMonthRange,
  getDayRange,
  getDateIntervalRange,

  /**
   * Retrieves marked dates dictionary for calendar month view.
   * Loads only sessions within [startTimestamp, endTimestamp) and selects only startTime.
   * C1 compliant: excludes soft-deleted sessions; live/legacy sessions without endTime are counted.
   */
  async getMonthMarkedDates(options: {
    year: number;
    month: number;
    dotColor?: string;
    dbInstance?: typeof db;
  }): Promise<Record<string, MonthMark>> {
    const { year, month, dotColor = '#9E422E', dbInstance = db } = options;
    const { startTimestamp, endTimestamp } = getMonthRange(year, month);

    const rows = await dbInstance
      .select({ startTime: sessions.startTime })
      .from(sessions)
      .where(and(
        isNull(sessions.deletedAt),
        gte(sessions.startTime, startTimestamp),
        lt(sessions.startTime, endTimestamp)
      ));

    const marks: Record<string, MonthMark> = {};
    for (const row of rows) {
      const key = toLocalDateKey(row.startTime);
      marks[key] = { marked: true, dotColor };
    }
    return marks;
  },

  /**
   * Retrieves sessions for a specific day on demand.
   * C1 compliant: excludes soft-deleted sessions and soft-deleted sets.
   */
  async getDaySessions(options: {
    dateKey: string;
    dbInstance?: typeof db;
  }): Promise<SessionWithExercises[]> {
    const { dateKey, dbInstance = db } = options;
    if (!isValidDateKey(dateKey)) {
      return [];
    }

    const { startTimestamp, endTimestamp } = getDayRange(dateKey);

    const rows = await dbInstance
      .select()
      .from(sessions)
      .where(and(
        isNull(sessions.deletedAt),
        gte(sessions.startTime, startTimestamp),
        lt(sessions.startTime, endTimestamp)
      ))
      .orderBy(desc(sessions.startTime), desc(sessions.id));

    return enrichSessionsWithExercises(rows, dbInstance);
  },

  /**
   * Searches and filters sessions by routine or exercise name and date range with cursor pagination.
   * C1 compliant: excludes soft-deleted sessions and sets; live/legacy sessions without endTime are retained.
   * Pagination: stable ordering by startTime desc, id desc.
   * Exercises join: uses subquery to prevent session row duplication.
   */
  async searchSessions(
    options: HistorySearchOptions
  ): Promise<HistorySearchResult> {
    const {
      query,
      startDate,
      endDate,
      limit = 20,
      cursor,
      dbInstance = db,
    } = options;

    const conditions = [isNull(sessions.deletedAt)];

    // Date range filter
    const { startTimestamp, endTimestamp } = getDateIntervalRange(startDate, endDate);
    if (startTimestamp !== undefined) {
      conditions.push(gte(sessions.startTime, startTimestamp));
    }
    if (endTimestamp !== undefined) {
      conditions.push(lt(sessions.startTime, endTimestamp));
    }

    // Text query (routine or exercise)
    if (query && query.trim().length > 0) {
      const trimmed = query.trim().toLowerCase();
      const pattern = `%${trimmed.replace(/[%_\\]/g, '\\$&')}%`;
      conditions.push(
        or(
          sql`lower(${sessions.routineName}) LIKE ${pattern} ESCAPE '\\'`,
          sql`${sessions.id} IN (
            SELECT ${sets.sessionId}
            FROM ${sets}
            WHERE lower(${sets.exerciseName}) LIKE ${pattern} ESCAPE '\\'
              AND ${sets.deletedAt} IS NULL
          )`
        )!
      );
    }

    // Cursor pagination: startTime desc, id desc
    if (cursor) {
      conditions.push(
        or(
          lt(sessions.startTime, cursor.startTime),
          and(
            eq(sessions.startTime, cursor.startTime),
            lt(sessions.id, cursor.id)
          )
        )!
      );
    }

    // Fetch limit + 1 to detect if next page exists
    const rows = await dbInstance
      .select()
      .from(sessions)
      .where(and(...conditions))
      .orderBy(desc(sessions.startTime), desc(sessions.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const pageRows = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore && pageRows.length > 0
      ? {
          startTime: pageRows[pageRows.length - 1].startTime,
          id: pageRows[pageRows.length - 1].id,
        }
      : undefined;

    const enriched = await enrichSessionsWithExercises(pageRows, dbInstance);

    return {
      sessions: enriched,
      nextCursor,
      hasMore,
    };
  },
};

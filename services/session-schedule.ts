import { db as defaultDb } from '@/src/db/client';
import { sessions } from '@/src/db/schema';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';

/**
 * Session Scheduling Service (IL-95 core slice)
 *
 * Day-boundary semantics (device-local):
 * - `scheduled_for` stores epoch-at-midnight of the planned day in the
 *   device-local timezone at the time of scheduling.
 * - Overdue comparison uses the device-local midnight of "today" (the
 *   calendar day the user is currently in), NOT UTC.
 * - A session is overdue when scheduled_for < today's device-local midnight
 *   AND startTime IS NULL AND deletedAt IS NULL.
 * - A session planned for today is NOT overdue even if the morning has passed.
 * - If the user crosses timezones, the local day boundary moves with them
 *   (intentional — the schedule follows local time).
 *
 * Performed timestamps (startTime/endTime) are immutable: rescheduling only
 * moves scheduled_for, never the performed date.
 */

export interface ScheduledSessionRef {
  sessionId: number;
  scheduledFor: number; // epoch at midnight (device-local)
  occurrenceId: string;
  performed: boolean;
}

export interface RescheduleInput {
  sessionId: number;
  newScheduledFor: number; // epoch at midnight (device-local)
}

export interface OverdueQueryResult {
  scheduledFor: number;
  occurrenceId: string | null;
  sessionId: number;
}

/**
 * Returns the epoch timestamp for the start of the current device-local day
 * (midnight in the local timezone). Used as the overdue comparison boundary.
 */
export function deviceLocalMidnightToday(): number {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function scheduleSession(
  input: { routineId: number; scheduledFor: number; occurrenceId: string },
  db: any = defaultDb,
): ScheduledSessionRef {
  const inserted = db
    .insert(sessions)
    .values({
      routineId: input.routineId,
      scheduledFor: input.scheduledFor,
      occurrenceId: input.occurrenceId,
      startTime: 0,
    })
    .run();

  const rowId = Number(inserted.lastInsertRowid);
  const row = db
    .select()
    .from(sessions)
    .where(eq(sessions.id, rowId))
    .get();

  return {
    sessionId: row.id,
    scheduledFor: row.scheduledFor ?? input.scheduledFor,
    occurrenceId: row.occurrenceId ?? input.occurrenceId,
    performed: row.startTime != null && row.startTime !== 0,
  };
}

export function rescheduleSession(
  input: RescheduleInput,
  db: any = defaultDb,
): ScheduledSessionRef {
  const row = db
    .select()
    .from(sessions)
    .where(eq(sessions.id, input.sessionId))
    .get();

  if (row === undefined || row === null) {
    throw new Error(`Session ${input.sessionId} not found`);
  }

  db.update(sessions)
    .set({ scheduledFor: input.newScheduledFor })
    .where(eq(sessions.id, input.sessionId))
    .run();

  return {
    sessionId: input.sessionId,
    scheduledFor: input.newScheduledFor,
    occurrenceId: row.occurrenceId ?? '',
    performed: row.startTime != null && row.startTime !== 0,
  };
}

export function queryOverdueSessions(db: any = defaultDb): OverdueQueryResult[] {
  const todayMidnight = deviceLocalMidnightToday();
  const rows = db
    .select({
      id: sessions.id,
      scheduledFor: sessions.scheduledFor,
      occurrenceId: sessions.occurrenceId,
    })
    .from(sessions)
    .where(
      and(
        isNull(sessions.deletedAt),
        eq(sessions.startTime, 0),
        sql`${sessions.scheduledFor} IS NOT NULL`,
        lt(sessions.scheduledFor, todayMidnight),
      ),
    )
    .all();

  return rows.map((r: { id: number; scheduledFor: number; occurrenceId: string | null }) => ({
    sessionId: r.id,
    scheduledFor: r.scheduledFor,
    occurrenceId: r.occurrenceId ?? null,
  }));
}
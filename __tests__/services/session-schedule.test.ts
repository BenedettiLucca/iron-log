import { db, sqlite } from '../fixtures/database';
import { sessions, routines } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import {
  scheduleSession,
  rescheduleSession,
  queryOverdueSessions,
  type ScheduledSessionRef,
  type RescheduleInput,
  type OverdueQueryResult,
} from '@/services/session-schedule';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

describe('IL-95: Scheduled Session Dates + Reschedule Semantics', () => {
  beforeEach(() => {
    sqlite.exec(`
      DELETE FROM sessions;
      DELETE FROM routines;
      DELETE FROM sqlite_sequence;
    `);
    db.insert(routines).values({ id: 1, name: 'Test Routine' }).run();
  });

  // (a) schedule -> planned date stored; performed timestamps untouched
  it('scheduleSession stores plannedFor and keeps performed=false (planned, not performed)', () => {
    const input = {
      routineId: 1,
      scheduledFor: 1760000000, // epoch at device-local midnight (planned day)
      occurrenceId: 'program:12:week:3:day:2',
    };
    const result: ScheduledSessionRef = scheduleSession(input);
    expect(result.scheduledFor).toBe(1760000000);
    expect(result.performed).toBe(false);
    expect(result.occurrenceId).toBe('program:12:week:3:day:2');
    expect(result.sessionId).toBeGreaterThanOrEqual(1);
  });

  // (b) reschedule moves ONLY planned date; performed (startTime/endTime) immutable
  it('rescheduleSession moves only scheduledFor; performed timestamps preserved', () => {
    const seeded = scheduleSession({
      routineId: 1,
      scheduledFor: 1760000000,
      occurrenceId: 'program:12:week:3:day:2',
    });

    const input: RescheduleInput = {
      sessionId: seeded.sessionId,
      newScheduledFor: 1760200000,
    };
    const result: ScheduledSessionRef = rescheduleSession(input);
    expect(result.sessionId).toBe(seeded.sessionId);
    expect(result.scheduledFor).toBe(1760200000); // moved
    expect(result.performed).toBe(false);
    // Verify startTime/endTime unchanged in DB
    const row = db.select().from(sessions).where(eq(sessions.id, seeded.sessionId)).get();
    expect(row!.startTime).toBe(0);
    expect(row!.endTime).toBeNull();
  });

  // (c) overdue query returns scheduled-but-not-performed until completed/rescheduled
  it('queryOverdueSessions returns planned-but-not-performed sessions', () => {
    const now = new Date();
    const todayMidnightMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const pastMidnight = todayMidnightMs - 86400000;
    scheduleSession({
      routineId: 1,
      scheduledFor: pastMidnight,
      occurrenceId: 'program:12:week:3:day:2',
    });

    const result: OverdueQueryResult[] = queryOverdueSessions();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);
    result.forEach((session: OverdueQueryResult) => {
      expect(session.scheduledFor).toBeDefined();
      expect(session.sessionId).toBeDefined();
    });
  });

  // (d) device-local day boundary case — seeded, not vacuous:
  // a session scheduled "today" (local midnight) must NOT be overdue even though
  // its scheduledFor is below UTC-midnight on positive-offset days.
  it('overdue query uses device-local midnight comparison, not UTC (day-boundary case)', () => {
    const now = new Date();
    const todayLocalMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const yesterdayLocalMidnight = todayLocalMidnight - 86400000;
    const seeded = scheduleSession({
      routineId: 1,
      scheduledFor: todayLocalMidnight,
      occurrenceId: 'program:12:week:3:day:2',
    });
    expect(queryOverdueSessions().map((s) => s.sessionId)).not.toContain(seeded.sessionId);

    const seededYesterday = scheduleSession({
      routineId: 1,
      scheduledFor: yesterdayLocalMidnight,
      occurrenceId: 'program:12:week:3:day:1',
    });
    expect(queryOverdueSessions().map((s) => s.sessionId)).toContain(seededYesterday.sessionId);
  });

  it('soft-deleted sessions are omitted from overdue query', () => {
    const now = new Date();
    const todayMidnightMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oldMidnight = todayMidnightMs - 86400000;
    const seeded = scheduleSession({
      routineId: 1,
      scheduledFor: oldMidnight,
      occurrenceId: 'program:12:week:3:day:1',
    });
    expect(queryOverdueSessions().map((s) => s.sessionId)).toContain(seeded.sessionId);

    db.update(sessions)
      .set({ deletedAt: Date.now() })
      .where(eq(sessions.id, seeded.sessionId))
      .run();
    expect(queryOverdueSessions().map((s) => s.sessionId)).not.toContain(seeded.sessionId);
  });

  it('completed session (startTime set) is not returned by overdue query', () => {
    const now = new Date();
    const todayMidnightMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oldMidnight = todayMidnightMs - 86400000;
    const seeded = scheduleSession({
      routineId: 1,
      scheduledFor: oldMidnight,
      occurrenceId: 'program:12:week:3:day:1',
    });
    db.update(sessions)
      .set({ startTime: Date.now() - 3600000 })
      .where(eq(sessions.id, seeded.sessionId))
      .run();

    const result: OverdueQueryResult[] = queryOverdueSessions();
    expect(result.map((s) => s.sessionId)).not.toContain(seeded.sessionId);
  });

  it('rescheduling an overdue session to a future date removes it from overdue', () => {
    const now = new Date();
    const todayMidnightMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const pastMidnight = todayMidnightMs - 86400000;
    const seeded = scheduleSession({
      routineId: 1,
      scheduledFor: pastMidnight,
      occurrenceId: 'program:12:week:3:day:1',
    });

    expect(queryOverdueSessions().map((s) => s.sessionId)).toContain(seeded.sessionId);

    const futureMidnight = new Date().setHours(0, 0, 0, 0) + 86400000;
    rescheduleSession({ sessionId: seeded.sessionId, newScheduledFor: futureMidnight });

    expect(queryOverdueSessions().map((s) => s.sessionId)).not.toContain(seeded.sessionId);
  });
  it('performed session with old scheduled_for is not overdue', () => {
    const now = new Date();
    const todayMidnightMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oldMidnight = todayMidnightMs - 86400000;
    const seeded = scheduleSession({
      routineId: 1,
      scheduledFor: oldMidnight,
      occurrenceId: 'program:12:week:3:day:1',
    });
    db.update(sessions)
      .set({ startTime: Date.now() })
      .where(eq(sessions.id, seeded.sessionId))
      .run();

    const result = queryOverdueSessions();
    expect(result.map((s) => s.sessionId)).not.toContain(seeded.sessionId);
  });
});
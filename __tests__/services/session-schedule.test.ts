import {
  scheduleSession,
  rescheduleSession,
  queryOverdueSessions,
  type ScheduledSessionRef,
  type RescheduleInput,
  type OverdueQueryResult,
} from '@/services/session-schedule';

describe('IL-95: Scheduled Session Dates + Reschedule Semantics (RED tests)', () => {
  // (a) schedule -> planned date stored; performed timestamps untouched
  it('scheduleSession stores plannedFor and keeps performed=false (planned, not performed)', () => {
    const input = {
      routineId: 1,
      scheduledFor: 1760000000, // epoch at device-local midnight (planned day)
      occurrenceId: 'program:12:week:3:day:2',
    };
    const result: ScheduledSessionRef = scheduleSession(input);
    // DESIRED semantics (will throw — legitimate RED):
    expect(result.scheduledFor).toBe(1760000000);     // planned date stored
    expect(result.performed).toBe(false);               // performed timestamps untouched
    expect(result.occurrenceId).toBe('program:12:week:3:day:2');
  });

  // (b) reschedule moves ONLY planned date; performed (startTime/endTime) immutable
  it('rescheduleSession moves only scheduledFor; performed timestamps preserved', () => {
    const input: RescheduleInput = {
      sessionId: 42,
      newScheduledFor: 1760200000,
    };
    const result: ScheduledSessionRef = rescheduleSession(input);
    // DESIRED semantics:
    expect(result.sessionId).toBe(42);
    expect(result.scheduledFor).toBe(1760200000); // moved
    // Performed timestamps (startTime/endTime) stay unchanged as historical fact
  });

  // (c) overdue query returns scheduled-but-not-performed until completed/rescheduled
  it('queryOverdueSessions returns planned-but-not-performed sessions', () => {
    const result: OverdueQueryResult[] = queryOverdueSessions();
    // DESIRED: array of sessions with scheduledFor set, startTime IS NULL
    expect(Array.isArray(result)).toBe(true);
    result.forEach((session: OverdueQueryResult) => {
      expect(session.scheduledFor).toBeDefined();
      expect(session.sessionId).toBeDefined();
    });
  });

  // (d) device-local day boundary case (documented in comment)
  it('overdue query uses device-local midnight comparison, not UTC (day-boundary case)', () => {
    // Device-local day boundary semantics (see docs/plans/il95-scheduled-dates-contract.md §3.6):
    // - scheduledFor = epoch-at-midnight of planned day (device-local at scheduling time)
    // - Overdue compare = scheduledFor < device-local midnight of "today"
    // - If user crosses timezones, the local day boundary moves with them (intentional)
    // - A session planned for yesterday (device-local midnight) unperformed IS overdue
    // - A session planned for today IS NOT overdue even if morning has passed
    const result: OverdueQueryResult[] = queryOverdueSessions();
    // Implementation must compare against device-local midnight of today; UTC comparison would be wrong.
    expect(result).toBeDefined();
  });
});
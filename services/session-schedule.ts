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

export function scheduleSession(_input: {
  routineId: number;
  scheduledFor: number;
  occurrenceId: string;
}): ScheduledSessionRef {
  throw new Error('session scheduling not implemented yet (issue #95 core slice)');
}

export function rescheduleSession(_input: RescheduleInput): ScheduledSessionRef {
  throw new Error('session scheduling not implemented yet (issue #95 core slice)');
}

export function queryOverdueSessions(): OverdueQueryResult[] {
  throw new Error('session scheduling not implemented yet (issue #95 core slice)');
}
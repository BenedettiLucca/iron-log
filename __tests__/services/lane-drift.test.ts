import {
  classifyLane,
  computeDriftStatus,
  buildReentryGuidance,
  DEFAULT_DRIFT_THRESHOLD_DAYS,
  DEFAULT_LAPSED_THRESHOLD_DAYS,
  type LaneClassification,
  type DriftStatus,
  type ReentryGuidance,
  type ComputeDriftStatusInput,
} from '@/services/lane-drift';
import type { OverdueQueryResult } from '@/services/session-schedule';

describe('IL-67: Main-lane Drift Status + Re-entry Guidance (RED tests)', () => {
  // (1) main session performed recently -> on_track
  it('identifies status as on_track when main session was performed recently within threshold', () => {
    const now = 1760000000000;
    const twoDaysMs = 2 * 24 * 60 * 60 * 1000;
    const input: ComputeDriftStatusInput = {
      now,
      lastMainSessionAt: now - twoDaysMs, // 2 days ago
      performedSessions: [
        {
          sessionId: 101,
          startTime: now - twoDaysMs,
          lane: 'main',
        },
      ],
      overdueSessions: [],
      thresholds: {
        driftThresholdDays: DEFAULT_DRIFT_THRESHOLD_DAYS,
        lapsedThresholdDays: DEFAULT_LAPSED_THRESHOLD_DAYS,
      },
    };

    const status: DriftStatus = computeDriftStatus(input);

    // DESIRED semantics (will throw — legitimate RED):
    expect(status.status).toBe('on_track');
    expect(status.daysSinceLastMain).toBe(2);
    expect(status.thresholdDays).toBe(DEFAULT_DRIFT_THRESHOLD_DAYS);
  });

  // (2) planned-not-performed past threshold -> drifting
  it('identifies status as drifting when planned main session is overdue past threshold', () => {
    const now = 1760000000000;
    const sixDaysMs = 6 * 24 * 60 * 60 * 1000;
    const overdueMainSession: OverdueQueryResult = {
      sessionId: 102,
      scheduledFor: Math.floor((now - 2 * 24 * 60 * 60 * 1000) / 1000), // scheduled 2 days ago
      occurrenceId: 'program:1:week:2:day:1',
    };
    const input: ComputeDriftStatusInput = {
      now,
      lastMainSessionAt: now - sixDaysMs, // 6 days ago (exceeds default drift threshold of 4 days)
      performedSessions: [
        {
          sessionId: 100,
          startTime: now - sixDaysMs,
          lane: 'main',
        },
      ],
      overdueSessions: [overdueMainSession],
      thresholds: {
        driftThresholdDays: DEFAULT_DRIFT_THRESHOLD_DAYS, // 4
        lapsedThresholdDays: DEFAULT_LAPSED_THRESHOLD_DAYS, // 14
      },
    };

    const status: DriftStatus = computeDriftStatus(input);

    // DESIRED semantics:
    expect(status.status).toBe('drifting');
    expect(status.daysSinceLastMain).toBe(6);
    expect(status.thresholdDays).toBe(4);
    expect(status.overdueSessionsCount).toBe(1);
  });

  // (3) way past -> lapsed
  it('identifies status as lapsed when main-lane gap exceeds the lapsed threshold', () => {
    const now = 1760000000000;
    const twentyDaysMs = 20 * 24 * 60 * 60 * 1000;
    const overdueMainSession: OverdueQueryResult = {
      sessionId: 103,
      scheduledFor: Math.floor((now - 16 * 24 * 60 * 60 * 1000) / 1000),
      occurrenceId: 'program:1:week:3:day:1',
    };
    const input: ComputeDriftStatusInput = {
      now,
      lastMainSessionAt: now - twentyDaysMs, // 20 days ago (exceeds 14 days)
      performedSessions: [
        {
          sessionId: 90,
          startTime: now - twentyDaysMs,
          lane: 'main',
        },
      ],
      overdueSessions: [overdueMainSession],
      thresholds: {
        driftThresholdDays: DEFAULT_DRIFT_THRESHOLD_DAYS, // 4
        lapsedThresholdDays: DEFAULT_LAPSED_THRESHOLD_DAYS, // 14
      },
    };

    const status: DriftStatus = computeDriftStatus(input);

    // DESIRED semantics:
    expect(status.status).toBe('lapsed');
    expect(status.daysSinceLastMain).toBe(20);
    expect(status.thresholdDays).toBe(4);
    expect(status.lapsedThresholdDays).toBe(14);
  });

  // (4) re-entry guidance reduces volume after long gap
  it('re-entry guidance reduces volume after a long gap and remains purely advisory without clinical language', () => {
    const lapsedStatus: DriftStatus = {
      status: 'lapsed',
      daysSinceLastMain: 21,
      thresholdDays: 4,
      lapsedThresholdDays: 14,
      overdueSessionsCount: 3,
    };

    const guidance: ReentryGuidance = buildReentryGuidance({
      driftStatus: lapsedStatus,
    });

    // DESIRED semantics:
    expect(guidance.advisoryOnly).toBe(true);
    expect(guidance.volumeScaleFactor).toBeLessThan(1.0);
    expect(guidance.volumeScaleFactor).toBeGreaterThanOrEqual(0.5);
    expect(guidance.action).toBe('ramp_up');
    expect(guidance.daysSinceLastMain).toBe(21);

    // Strict informational trend language requirement: zero clinical or injury terminology
    const text = `${guidance.summary} ${(guidance.notes ?? []).join(' ')}`.toLowerCase();
    expect(text).not.toMatch(/injury|injured|clinical|pathol|atrophy|rehab|prescription|medical/);
  });

  // (5) accessory-only period does NOT count as main-lane activity (per owner default - flagged if owner chose different)
  it('accessory-only period does NOT count as main-lane activity and does not reset drift gap', () => {
    const now = 1760000000000;
    const oneDayMs = 1 * 24 * 60 * 60 * 1000;
    const eightDaysMs = 8 * 24 * 60 * 60 * 1000;

    // Verify lane classification distinguishes main vs accessory
    const accessoryClassification: LaneClassification = classifyLane({
      routineId: 5,
      routineName: 'Abs and Calves Accessory',
      tags: ['accessory'],
      isProgramSession: false,
    });
    expect(accessoryClassification.lane).toBe('accessory');

    const mainClassification: LaneClassification = classifyLane({
      routineId: 1,
      routineName: 'Upper Body A',
      tags: ['main'],
      isProgramSession: true,
    });
    expect(mainClassification.lane).toBe('main');

    // Athlete performed an accessory workout yesterday, but the last main session was 8 days ago.
    const input: ComputeDriftStatusInput = {
      now,
      lastMainSessionAt: now - eightDaysMs, // 8 days ago
      performedSessions: [
        {
          sessionId: 201,
          startTime: now - eightDaysMs,
          lane: 'main',
        },
        {
          sessionId: 202,
          startTime: now - oneDayMs, // Performed yesterday, but accessory only!
          lane: 'accessory',
        },
      ],
      thresholds: {
        driftThresholdDays: 4,
        lapsedThresholdDays: 14,
      },
    };

    const status: DriftStatus = computeDriftStatus(input);

    // DESIRED semantics:
    // Accessory session does NOT reset the drift timer; daysSinceLastMain must track the main session (8 days).
    expect(status.daysSinceLastMain).toBe(8);
    expect(status.status).toBe('drifting');
  });
});

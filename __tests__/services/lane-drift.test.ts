import {
  classifyLane,
  computeDriftStatus,
  buildReentryGuidance,
  setRoutineMainLane,
  DEFAULT_DRIFT_THRESHOLD_DAYS,
  DEFAULT_LAPSED_THRESHOLD_DAYS,
  DEFAULT_LAPSED_MULTIPLIER,
  type LaneClassification,
  type DriftStatus,
  type ReentryGuidance,
  type ComputeDriftStatusInput,
} from '@/services/lane-drift';
import type { OverdueQueryResult } from '@/services/session-schedule';
import { db } from '@/__tests__/fixtures/database';
import { routines } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

describe('IL-67: Main-lane Drift Status + Re-entry Guidance', () => {
  describe('classifyLane (owner decision: flag on routine, freestyle is accessory)', () => {
    it('classifies session as main when routine has isMainLane=true', () => {
      const result = classifyLane({
        routineId: 10,
        routineName: 'Upper Heavy A',
        isMainLane: true,
      });
      expect(result.lane).toBe('main');
      expect(result.confidence).toBe('explicit');
      expect(result.routineId).toBe(10);
      expect(result.reason).toContain('isMainLane=true');
    });

    it('classifies session as main when routine object has isMainLane=true', () => {
      const result = classifyLane({
        routineId: 11,
        routine: {
          id: 11,
          name: 'Lower Strength',
          isMainLane: true,
        },
      });
      expect(result.lane).toBe('main');
      expect(result.confidence).toBe('explicit');
      expect(result.routineId).toBe(11);
    });

    it('classifies session as accessory when routine has isMainLane=false', () => {
      const result = classifyLane({
        routineId: 12,
        routineName: 'Abs and Calves',
        isMainLane: false,
      });
      expect(result.lane).toBe('accessory');
      expect(result.confidence).toBe('explicit');
      expect(result.routineId).toBe(12);
    });

    it('classifies session as accessory when routine has default unset isMainLane', () => {
      const result = classifyLane({
        routineId: 13,
        routineName: 'Arm Isolation',
      });
      expect(result.lane).toBe('accessory');
      expect(result.confidence).toBe('explicit');
      expect(result.routineId).toBe(13);
    });

    it('classifies freestyle session (no routine) as accessory and documents explicitly', () => {
      // No routineId and no routine object = freestyle
      const resultNullId = classifyLane({
        sessionId: 99,
        routineId: null,
      });
      expect(resultNullId.lane).toBe('accessory');
      expect(resultNullId.routineId).toBeNull();
      expect(resultNullId.reason).toContain('Freestyle session (no routine)');

      const resultEmpty = classifyLane({});
      expect(resultEmpty.lane).toBe('accessory');
      expect(resultEmpty.routineId).toBeNull();
      expect(resultEmpty.reason).toContain('Freestyle session (no routine)');

      const resultNull = classifyLane(null);
      expect(resultNull.lane).toBe('accessory');
      expect(resultNull.routineId).toBeNull();
    });

    it('ignores tags and program heuristics in favor of routine isMainLane flag (owner rule: no heuristics)', () => {
      // Tags say 'main' and isProgramSession=true, but isMainLane is false -> accessory!
      const nonMainRoutine = classifyLane({
        routineId: 14,
        tags: ['main'],
        isProgramSession: true,
        isMainLane: false,
      });
      expect(nonMainRoutine.lane).toBe('accessory');

      // Tags say 'accessory', but routine has isMainLane=true -> main!
      const mainRoutineWithAccessoryTag = classifyLane({
        routineId: 15,
        tags: ['accessory'],
        isMainLane: true,
      });
      expect(mainRoutineWithAccessoryTag.lane).toBe('main');
    });
  });

  describe('computeDriftStatus', () => {
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

      expect(status.status).toBe('lapsed');
      expect(status.daysSinceLastMain).toBe(20);
      expect(status.thresholdDays).toBe(4);
      expect(status.lapsedThresholdDays).toBe(14);
    });

    // (5) accessory-only period does NOT count as main-lane activity
    it('accessory-only period does NOT count as main-lane activity and does not reset drift gap', () => {
      const now = 1760000000000;
      const oneDayMs = 1 * 24 * 60 * 60 * 1000;
      const eightDaysMs = 8 * 24 * 60 * 60 * 1000;

      // Verify lane classification distinguishes main vs accessory via routine flag
      const accessoryClassification: LaneClassification = classifyLane({
        routineId: 5,
        routineName: 'Abs and Calves Accessory',
        isMainLane: false,
      });
      expect(accessoryClassification.lane).toBe('accessory');

      const mainClassification: LaneClassification = classifyLane({
        routineId: 1,
        routineName: 'Upper Body A',
        isMainLane: true,
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

      // Accessory session does NOT reset the drift timer; daysSinceLastMain must track the main session (8 days).
      expect(status.daysSinceLastMain).toBe(8);
      expect(status.status).toBe('drifting');
    });

    it('returns insufficient-data when history contains no main-lane sessions', () => {
      const now = 1760000000000;
      const oneDayMs = 24 * 60 * 60 * 1000;

      // Empty history
      const emptyStatus = computeDriftStatus([], 4, { now });
      expect(emptyStatus.status).toBe('insufficient-data');
      expect(emptyStatus.daysSinceLastMain).toBeNull();
      expect(emptyStatus.thresholdDays).toBe(4);

      // Only accessory sessions
      const accessoryOnlyStatus = computeDriftStatus(
        [
          {
            sessionId: 301,
            startTime: now - oneDayMs,
            lane: 'accessory',
          },
          {
            sessionId: 302,
            startTime: now - 3 * oneDayMs,
            isMainLane: false,
          },
        ],
        4,
        { now }
      );
      expect(accessoryOnlyStatus.status).toBe('insufficient-data');
      expect(accessoryOnlyStatus.daysSinceLastMain).toBeNull();
    });

    it('supports positional signature computeDriftStatus(history, thresholdDays) with tunable 2x lapsed multiple', () => {
      const now = 1760000000000;
      const oneDayMs = 24 * 60 * 60 * 1000;

      const history = [
        {
          sessionId: 401,
          startTime: now - 3 * oneDayMs, // 3 days ago
          isMainLane: true,
        },
      ];

      // With thresholdDays = 5: drift = 5, lapsed = 2x = 10 (tunable default multiplier)
      const onTrack = computeDriftStatus(history, 5, { now });
      expect(onTrack.status).toBe('on_track');
      expect(onTrack.daysSinceLastMain).toBe(3);
      expect(onTrack.thresholdDays).toBe(5);
      expect(onTrack.lapsedThresholdDays).toBe(10);
      expect(DEFAULT_LAPSED_MULTIPLIER).toBe(2);

      // When gap is 7 days: past 5 days threshold, but before 10 days lapsed -> drifting
      const driftingHistory = [
        {
          sessionId: 402,
          startTime: now - 7 * oneDayMs,
          isMainLane: true,
        },
      ];
      const drifting = computeDriftStatus(driftingHistory, 5, { now });
      expect(drifting.status).toBe('drifting');
      expect(drifting.daysSinceLastMain).toBe(7);

      // When gap is 12 days: past 10 days (2x threshold) -> lapsed
      const lapsedHistory = [
        {
          sessionId: 403,
          startTime: now - 12 * oneDayMs,
          isMainLane: true,
        },
      ];
      const lapsed = computeDriftStatus(lapsedHistory, 5, { now });
      expect(lapsed.status).toBe('lapsed');
      expect(lapsed.daysSinceLastMain).toBe(12);
    });
  });

  describe('buildReentryGuidance (advisory volume scale & neutral wording)', () => {
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

      expect(guidance.advisoryOnly).toBe(true);
      expect(guidance.volumeScaleFactor).toBeLessThan(1.0);
      expect(guidance.volumeScaleFactor).toBeGreaterThanOrEqual(0.5);
      expect(guidance.action).toBe('ramp_up');
      expect(guidance.daysSinceLastMain).toBe(21);

      // Strict informational trend language requirement: zero clinical or injury terminology
      const text = `${guidance.summary} ${(guidance.notes ?? []).join(' ')}`.toLowerCase();
      expect(text).not.toMatch(/injury|injured|clinical|pathol|atrophy|rehab|prescription|medical/);
    });

    it('supports positional signature buildReentryGuidance(gapDays)', () => {
      // On track: gap <= 4
      const onTrack = buildReentryGuidance(2);
      expect(onTrack.action).toBe('resume_normal');
      expect(onTrack.volumeScaleFactor).toBe(1.0);
      expect(onTrack.intensityScaleFactor).toBe(1.0);
      expect(onTrack.advisoryOnly).toBe(true);

      // Moderate gap (5-7 days): 15% reduction
      const moderate = buildReentryGuidance(6);
      expect(moderate.action).toBe('reduce_volume');
      expect(moderate.volumeScaleFactor).toBe(0.85);
      expect(moderate.intensityScaleFactor).toBe(1.0);

      // Wider gap (8-13 days): 25% reduction
      const wide = buildReentryGuidance(10);
      expect(wide.action).toBe('reduce_volume');
      expect(wide.volumeScaleFactor).toBe(0.75);
      expect(wide.intensityScaleFactor).toBe(0.9);

      // Hiatus (14+ days): ramp-up
      const hiatus = buildReentryGuidance(14);
      expect(hiatus.action).toBe('ramp_up');
      expect(hiatus.volumeScaleFactor).toBe(0.65);
      expect(hiatus.intensityScaleFactor).toBe(0.85);
    });

    it('enforces volume scale floor >= 0.50 even after extremely long gaps', () => {
      const veryLongHiatus = buildReentryGuidance(60);
      expect(veryLongHiatus.volumeScaleFactor).toBeGreaterThanOrEqual(0.5);
      expect(veryLongHiatus.volumeScaleFactor).toBe(0.5);
      expect(veryLongHiatus.advisoryOnly).toBe(true);

      const hundredDayHiatus = buildReentryGuidance(100);
      expect(hundredDayHiatus.volumeScaleFactor).toBeGreaterThanOrEqual(0.5);
      expect(hundredDayHiatus.volumeScaleFactor).toBe(0.5);
    });

    it('handles null / insufficient data gap gracefully', () => {
      const guidance = buildReentryGuidance(null);
      expect(guidance.status).toBe('insufficient-data');
      expect(guidance.volumeScaleFactor).toBe(1.0);
      expect(guidance.advisoryOnly).toBe(true);
      expect(guidance.daysSinceLastMain).toBeNull();
    });

    it('maintains strict non-clinical language across all advice outputs', () => {
      const gaps = [null, 0, 3, 6, 10, 16, 30, 90];
      for (const gap of gaps) {
        const guidance = buildReentryGuidance(gap);
        const combinedText = `${guidance.summary} ${(guidance.notes ?? []).join(' ')}`.toLowerCase();
        expect(combinedText).not.toMatch(
          /injury|injured|clinical|pathol|atrophy|rehab|prescription|medical|damage/
        );
      }
    });
  });

  describe('setRoutineMainLane', () => {
    it('updates routine isMainLane flag in the database', async () => {
      // Insert a test routine into in-memory database
      const [inserted] = await db
        .insert(routines)
        .values({
          name: `Test Routine ${Date.now()}`,
          isTemplate: false,
          isMainLane: false,
        })
        .returning({ id: routines.id, isMainLane: routines.isMainLane });

      expect(inserted.isMainLane).toBe(false);

      // Set to true
      await setRoutineMainLane(inserted.id, true, db);

      const [afterTrue] = await db
        .select()
        .from(routines)
        .where(eq(routines.id, inserted.id));
      expect(afterTrue.isMainLane).toBe(true);

      // Set back to false
      await setRoutineMainLane(inserted.id, false, db);

      const [afterFalse] = await db
        .select()
        .from(routines)
        .where(eq(routines.id, inserted.id));
      expect(afterFalse.isMainLane).toBe(false);
    });
  });
});

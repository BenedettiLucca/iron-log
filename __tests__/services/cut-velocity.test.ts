import {
  detectCutVelocity,
  detectCutVelocityAdvisory,
  detectCutVelocityAdvisories,
  CUT_VELOCITY_DEFAULTS,
  type MeasuredWeightEntry,
  type SessionTopLoad,
} from '@/services/cut-velocity';

/**
 * #75 — Cut velocity load advisory (pure policy module).
 *
 * Connective-tissue risk ADVISORY (tendon-strength-gap framework):
 * Informational context only, NO clinical claims.
 *
 * Upstream anchors:
 * - epic/il-74-plateau: top-set derivation, PR tie-break rule, RIR regression rule, Trust II filtering.
 * - epic/il-147-contract: ONLY measured bodyMetrics-style weights count; borrowed/carried weights excluded.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function sessionLoad(
  sessionId: number,
  startTime: number,
  weightKg: number,
  reps: number,
  extra: Partial<SessionTopLoad> = {}
): SessionTopLoad {
  return {
    sessionId,
    startTime,
    weightKg,
    reps,
    ...extra,
  };
}

describe('cut-velocity load advisory (Issue #75)', () => {
  const baseTime = 1710000000000;

  describe('owner-tunable constants', () => {
    it('exports owner-tunable default constants', () => {
      expect(CUT_VELOCITY_DEFAULTS.MIN_CUT_WINDOW_DAYS).toBe(14);
      expect(CUT_VELOCITY_DEFAULTS.CUT_RATE_BW_PERCENT_PER_WEEK).toBe(0.5);
      expect(CUT_VELOCITY_DEFAULTS.MIN_WEIGHT_SAMPLES).toBe(2);
      expect(CUT_VELOCITY_DEFAULTS.LOAD_RISING_WINDOW_SESSIONS).toBe(3);
      expect(CUT_VELOCITY_DEFAULTS.LOAD_RISING_MIN_INCREASES).toBe(2);
      expect(CUT_VELOCITY_DEFAULTS.SAME_WEIGHT_REP_PROGRESS).toBe(true);
      expect(CUT_VELOCITY_DEFAULTS.RIR_REGRESSION).toBe(true);
    });
  });

  describe('core contract gates', () => {
    it('cut + rising -> advisory fires (load_rising_during_cut)', () => {
      // 80kg down to 78.6kg over 14 days:
      // Loss = 1.4kg in 2 weeks = 0.7 kg/week.
      // Rate = (0.7 / 80) * 100 = 0.875% bw/week >= 0.5% threshold -> cutPhase: true.
      const weights: MeasuredWeightEntry[] = [
        { date: baseTime, weightKg: 80.0 },
        { date: baseTime + 7 * DAY_MS, weightKg: 79.3 },
        { date: baseTime + 14 * DAY_MS, weightKg: 78.6 },
      ];

      // Top load increased in 2 of last 3 sessions (100 -> 102.5 -> 105)
      const loads: SessionTopLoad[] = [
        sessionLoad(1, baseTime + 2 * DAY_MS, 100, 8),
        sessionLoad(2, baseTime + 8 * DAY_MS, 102.5, 8),
        sessionLoad(3, baseTime + 14 * DAY_MS, 105, 8),
      ];

      const result = detectCutVelocity(weights, loads);

      expect(result.cutPhase).toBe(true);
      expect(result.velocityKgPerWeek).toBeCloseTo(-0.7, 1);
      expect(result.advisory).toBe('load_rising_during_cut');
      expect(result.state).toBe('evaluated');
    });

    it('cut + stable load -> advisory is none', () => {
      const weights: MeasuredWeightEntry[] = [
        { date: baseTime, weightKg: 80.0 },
        { date: baseTime + 14 * DAY_MS, weightKg: 78.6 },
      ];

      // Top load unchanged across 3 sessions
      const loads: SessionTopLoad[] = [
        sessionLoad(1, baseTime + 2 * DAY_MS, 100, 8),
        sessionLoad(2, baseTime + 8 * DAY_MS, 100, 8),
        sessionLoad(3, baseTime + 14 * DAY_MS, 100, 8),
      ];

      const result = detectCutVelocity(weights, loads);

      expect(result.cutPhase).toBe(true);
      expect(result.advisory).toBe('none');
      expect(result.state).toBe('evaluated');
    });

    it('cut + declining load -> advisory is none', () => {
      const weights: MeasuredWeightEntry[] = [
        { date: baseTime, weightKg: 80.0 },
        { date: baseTime + 14 * DAY_MS, weightKg: 78.6 },
      ];

      // Top load dropping (100 -> 97.5 -> 95)
      const loads: SessionTopLoad[] = [
        sessionLoad(1, baseTime + 2 * DAY_MS, 100, 8),
        sessionLoad(2, baseTime + 8 * DAY_MS, 97.5, 8),
        sessionLoad(3, baseTime + 14 * DAY_MS, 95, 8),
      ];

      const result = detectCutVelocity(weights, loads);

      expect(result.cutPhase).toBe(true);
      expect(result.advisory).toBe('none');
      expect(result.state).toBe('evaluated');
    });

    it('no cut (stable weight) -> advisory is none even if loads are rising', () => {
      const weights: MeasuredWeightEntry[] = [
        { date: baseTime, weightKg: 80.0 },
        { date: baseTime + 14 * DAY_MS, weightKg: 80.0 },
      ];

      const loads: SessionTopLoad[] = [
        sessionLoad(1, baseTime + 2 * DAY_MS, 100, 8),
        sessionLoad(2, baseTime + 8 * DAY_MS, 105, 8),
        sessionLoad(3, baseTime + 14 * DAY_MS, 110, 8),
      ];

      const result = detectCutVelocity(weights, loads);

      expect(result.cutPhase).toBe(false);
      expect(result.velocityKgPerWeek).toBeCloseTo(0, 1);
      expect(result.advisory).toBe('none');
      expect(result.state).toBe('evaluated');
    });

    it('no cut (weight gain) -> advisory is none even if loads are rising', () => {
      const weights: MeasuredWeightEntry[] = [
        { date: baseTime, weightKg: 80.0 },
        { date: baseTime + 14 * DAY_MS, weightKg: 81.4 },
      ];

      const loads: SessionTopLoad[] = [
        sessionLoad(1, baseTime + 2 * DAY_MS, 100, 8),
        sessionLoad(2, baseTime + 8 * DAY_MS, 105, 8),
        sessionLoad(3, baseTime + 14 * DAY_MS, 110, 8),
      ];

      const result = detectCutVelocity(weights, loads);

      expect(result.cutPhase).toBe(false);
      expect(result.velocityKgPerWeek).toBeCloseTo(0.7, 1);
      expect(result.advisory).toBe('none');
      expect(result.state).toBe('evaluated');
    });

    it('no cut (mild loss below 0.5% bw/week threshold) -> advisory is none', () => {
      // 80kg to 79.8kg over 14 days: 0.1 kg/week = 0.125% bw/week < 0.5% threshold
      const weights: MeasuredWeightEntry[] = [
        { date: baseTime, weightKg: 80.0 },
        { date: baseTime + 14 * DAY_MS, weightKg: 79.8 },
      ];

      const loads: SessionTopLoad[] = [
        sessionLoad(1, baseTime + 2 * DAY_MS, 100, 8),
        sessionLoad(2, baseTime + 8 * DAY_MS, 105, 8),
        sessionLoad(3, baseTime + 14 * DAY_MS, 110, 8),
      ];

      const result = detectCutVelocity(weights, loads);

      expect(result.cutPhase).toBe(false);
      expect(result.advisory).toBe('none');
    });
  });

  describe('insufficient data handling (never silently-green)', () => {
    const loads: SessionTopLoad[] = [
      sessionLoad(1, baseTime + 2 * DAY_MS, 100, 8),
      sessionLoad(2, baseTime + 8 * DAY_MS, 105, 8),
      sessionLoad(3, baseTime + 14 * DAY_MS, 110, 8),
    ];

    it('returns insufficient-data for empty weight history', () => {
      const result = detectCutVelocity([], loads);
      expect(result.advisory).toBe('insufficient-data');
      expect(result.state).toBe('insufficient-data');
      expect(result.cutPhase).toBe(false);
      expect(result.velocityKgPerWeek).toBeNull();
    });

    it('returns insufficient-data for single weight entry', () => {
      const weights: MeasuredWeightEntry[] = [{ date: baseTime, weightKg: 80.0 }];
      const result = detectCutVelocity(weights, loads);
      expect(result.advisory).toBe('insufficient-data');
      expect(result.state).toBe('insufficient-data');
      expect(result.velocityKgPerWeek).toBeNull();
    });

    it('returns insufficient-data when weight history spans less than minCutWindowDays (e.g. 5 days < 14 days)', () => {
      const weights: MeasuredWeightEntry[] = [
        { date: baseTime, weightKg: 80.0 },
        { date: baseTime + 5 * DAY_MS, weightKg: 78.5 },
      ];
      const result = detectCutVelocity(weights, loads);
      expect(result.advisory).toBe('insufficient-data');
      expect(result.state).toBe('insufficient-data');
      expect(result.velocityKgPerWeek).toBeNull();
    });

    it('returns insufficient-data during a cut when top-load history is empty', () => {
      const weights: MeasuredWeightEntry[] = [
        { date: baseTime, weightKg: 80.0 },
        { date: baseTime + 14 * DAY_MS, weightKg: 78.6 },
      ];
      const result = detectCutVelocity(weights, []);
      expect(result.cutPhase).toBe(true);
      expect(result.advisory).toBe('insufficient-data');
      expect(result.state).toBe('insufficient-data');
    });

    it('returns insufficient-data during a cut when top-load history has fewer than 2 valid sessions', () => {
      const weights: MeasuredWeightEntry[] = [
        { date: baseTime, weightKg: 80.0 },
        { date: baseTime + 14 * DAY_MS, weightKg: 78.6 },
      ];
      const result = detectCutVelocity(weights, [
        sessionLoad(1, baseTime + 2 * DAY_MS, 100, 8),
      ]);
      expect(result.cutPhase).toBe(true);
      expect(result.advisory).toBe('insufficient-data');
    });
  });

  describe('weight provenance (epic/il-147-contract semantics)', () => {
    const loads: SessionTopLoad[] = [
      sessionLoad(1, baseTime + 2 * DAY_MS, 100, 8),
      sessionLoad(2, baseTime + 8 * DAY_MS, 105, 8),
      sessionLoad(3, baseTime + 14 * DAY_MS, 110, 8),
    ];

    it('borrowed weights excluded: fixture with a bodyMetrics-less session must not count', () => {
      // 1 real measured bodyMetrics row at t0
      // 1 session at t14 with bodyWeight, but bodyMetrics-less (hasBodyMetric: false / isWeightMeasured: false)
      const weightsWithBodyMetricLessSession: MeasuredWeightEntry[] = [
        { date: baseTime, weight: 80.0, provenance: 'measured' },
        {
          date: baseTime + 14 * DAY_MS,
          bodyWeight: 78.0,
          hasBodyMetric: false,
          isWeightMeasured: false,
          weightProvenance: 'borrowed',
        },
      ];

      // After excluding the unmeasured session, only 1 valid weight remains -> insufficient-data
      const result = detectCutVelocity(weightsWithBodyMetricLessSession, loads);
      expect(result.advisory).toBe('insufficient-data');
      expect(result.state).toBe('insufficient-data');
      expect(result.velocityKgPerWeek).toBeNull();
    });

    it('excludes rows explicitly tagged with provenance: borrowed', () => {
      const weights: MeasuredWeightEntry[] = [
        { date: baseTime, weightKg: 80.0, provenance: 'measured' },
        { date: baseTime + 7 * DAY_MS, weightKg: 70.0, provenance: 'borrowed' }, // should be ignored
        { date: baseTime + 14 * DAY_MS, weightKg: 78.6, provenance: 'measured' },
      ];

      const result = detectCutVelocity(weights, loads);
      expect(result.cutPhase).toBe(true);
      expect(result.velocityKgPerWeek).toBeCloseTo(-0.7, 1);
      expect(result.advisory).toBe('load_rising_during_cut');
    });

    it('filters out non-positive or null weights', () => {
      const weights: MeasuredWeightEntry[] = [
        { date: baseTime, weightKg: 80.0 },
        { date: baseTime + 7 * DAY_MS, weightKg: 0 },
        { date: baseTime + 10 * DAY_MS, weightKg: -5 },
        { date: baseTime + 14 * DAY_MS, weightKg: 78.6 },
      ];

      const result = detectCutVelocity(weights, loads);
      expect(result.cutPhase).toBe(true);
      expect(result.velocityKgPerWeek).toBeCloseTo(-0.7, 1);
    });
  });

  describe('epic/il-74-plateau convention mirroring', () => {
    const weights: MeasuredWeightEntry[] = [
      { date: baseTime, weightKg: 80.0 },
      { date: baseTime + 14 * DAY_MS, weightKg: 78.6 },
    ];

    it('excludes soft-deleted sessions from top load history', () => {
      const loads: SessionTopLoad[] = [
        sessionLoad(1, baseTime + 2 * DAY_MS, 100, 8),
        sessionLoad(2, baseTime + 5 * DAY_MS, 110, 8, { deletedAt: baseTime + 99 }), // deleted, ignore
        sessionLoad(3, baseTime + 8 * DAY_MS, 100, 8),
        sessionLoad(4, baseTime + 14 * DAY_MS, 100, 8),
      ];

      // With deleted session excluded, sessions are [100, 100, 100] (flat)
      const result = detectCutVelocity(weights, loads);
      expect(result.cutPhase).toBe(true);
      expect(result.advisory).toBe('none');
    });

    it('treats same weight with more reps as load progress (PR tie-break rule)', () => {
      // 100kg x 6 -> 100kg x 8 -> 100kg x 10: increases in reps
      const loads: SessionTopLoad[] = [
        sessionLoad(1, baseTime + 2 * DAY_MS, 100, 6),
        sessionLoad(2, baseTime + 8 * DAY_MS, 100, 8),
        sessionLoad(3, baseTime + 14 * DAY_MS, 100, 10),
      ];

      const result = detectCutVelocity(weights, loads);
      expect(result.cutPhase).toBe(true);
      expect(result.advisory).toBe('load_rising_during_cut');
    });

    it('allows disabling sameWeightRepProgress via options', () => {
      const loads: SessionTopLoad[] = [
        sessionLoad(1, baseTime + 2 * DAY_MS, 100, 6),
        sessionLoad(2, baseTime + 8 * DAY_MS, 100, 8),
        sessionLoad(3, baseTime + 14 * DAY_MS, 100, 10),
      ];

      const result = detectCutVelocity(weights, loads, { sameWeightRepProgress: false });
      expect(result.cutPhase).toBe(true);
      // With rep progress disabled, all 3 are flat 100kg loads -> no increase -> advisory none
      expect(result.advisory).toBe('none');
    });

    it('treats same weight with increasing RIR as regression', () => {
      const loads: SessionTopLoad[] = [
        sessionLoad(1, baseTime + 2 * DAY_MS, 100, 8, { rir: 0 }),
        sessionLoad(2, baseTime + 8 * DAY_MS, 100, 8, { rir: 1 }),
        sessionLoad(3, baseTime + 14 * DAY_MS, 100, 8, { rir: 2 }),
      ];

      const result = detectCutVelocity(weights, loads);
      expect(result.cutPhase).toBe(true);
      expect(result.advisory).toBe('none');
    });
  });

  describe('owner-tunable options', () => {
    it('respects cutRateBwPercentPerWeek threshold override', () => {
      // 80kg to 79.0kg over 14 days = 0.5 kg/week = 0.625% bw/week
      const weights: MeasuredWeightEntry[] = [
        { date: baseTime, weightKg: 80.0 },
        { date: baseTime + 14 * DAY_MS, weightKg: 79.0 },
      ];

      const loads: SessionTopLoad[] = [
        sessionLoad(1, baseTime + 2 * DAY_MS, 100, 8),
        sessionLoad(2, baseTime + 8 * DAY_MS, 105, 8),
        sessionLoad(3, baseTime + 14 * DAY_MS, 110, 8),
      ];

      // Default threshold is 0.5% -> cutPhase is true, advisory fires
      expect(detectCutVelocity(weights, loads).cutPhase).toBe(true);
      expect(detectCutVelocity(weights, loads).advisory).toBe('load_rising_during_cut');

      // Stricter threshold of 1.0% -> 0.625% is below threshold -> cutPhase false, advisory none
      const strict = detectCutVelocity(weights, loads, { cutRateBwPercentPerWeek: 1.0 });
      expect(strict.cutPhase).toBe(false);
      expect(strict.advisory).toBe('none');
    });

    it('respects minCutWindowDays override', () => {
      const weights7Days: MeasuredWeightEntry[] = [
        { date: baseTime, weightKg: 80.0 },
        { date: baseTime + 7 * DAY_MS, weightKg: 79.0 },
      ];

      const loads: SessionTopLoad[] = [
        sessionLoad(1, baseTime + 2 * DAY_MS, 100, 8),
        sessionLoad(2, baseTime + 4 * DAY_MS, 105, 8),
        sessionLoad(3, baseTime + 7 * DAY_MS, 110, 8),
      ];

      // Default 14 days: 7 days is insufficient
      expect(detectCutVelocity(weights7Days, loads).advisory).toBe('insufficient-data');

      // Tuned to 7 days: 7 days is sufficient -> fires
      const tuned = detectCutVelocity(weights7Days, loads, { minCutWindowDays: 7 });
      expect(tuned.cutPhase).toBe(true);
      expect(tuned.advisory).toBe('load_rising_during_cut');
    });

    it('respects loadRisingMinIncreases and loadRisingWindowSessions overrides', () => {
      const weights: MeasuredWeightEntry[] = [
        { date: baseTime, weightKg: 80.0 },
        { date: baseTime + 14 * DAY_MS, weightKg: 78.6 },
      ];

      // 4 sessions: 100 -> 102.5 -> 102.5 -> 105 (increases at s2 and s4)
      const loads: SessionTopLoad[] = [
        sessionLoad(1, baseTime + 2 * DAY_MS, 100, 8),
        sessionLoad(2, baseTime + 6 * DAY_MS, 102.5, 8),
        sessionLoad(3, baseTime + 10 * DAY_MS, 102.5, 8),
        sessionLoad(4, baseTime + 14 * DAY_MS, 105, 8),
      ];

      // Default (2 increases in last 3 sessions):
      // Last 3 sessions are s2, s3, s4: s2 increased (+1), s3 flat (+0), s4 increased (+1) -> 2 increases -> fires
      expect(detectCutVelocity(weights, loads).advisory).toBe('load_rising_during_cut');

      // Requiring 3 increases in last 3 sessions -> only 2 increases -> advisory none
      const tuned = detectCutVelocity(weights, loads, { loadRisingMinIncreases: 3 });
      expect(tuned.advisory).toBe('none');
    });
  });

  describe('multi-exercise map support', () => {
    it('evaluates per-exercise map preserving keys and aggregates overall advisory', () => {
      const weights: MeasuredWeightEntry[] = [
        { date: baseTime, weightKg: 80.0 },
        { date: baseTime + 14 * DAY_MS, weightKg: 78.6 },
      ];

      const map = {
        bench: [
          sessionLoad(1, baseTime + 2 * DAY_MS, 100, 8),
          sessionLoad(2, baseTime + 8 * DAY_MS, 105, 8),
          sessionLoad(3, baseTime + 14 * DAY_MS, 110, 8),
        ],
        squat: [
          sessionLoad(1, baseTime + 2 * DAY_MS, 140, 5),
          sessionLoad(2, baseTime + 8 * DAY_MS, 140, 5),
          sessionLoad(3, baseTime + 14 * DAY_MS, 140, 5),
        ],
      };

      const result = detectCutVelocityAdvisories(weights, map);
      expect(result.overall.advisory).toBe('load_rising_during_cut');
      expect(result.byExercise.bench.advisory).toBe('load_rising_during_cut');
      expect(result.byExercise.squat.advisory).toBe('none');
    });
  });

  describe('alias exports and deterministic ordering', () => {
    it('detectCutVelocityAdvisory is an alias of detectCutVelocity', () => {
      expect(detectCutVelocityAdvisory).toBe(detectCutVelocity);
    });

    it('produces identical output for shuffled inputs', () => {
      const weightsOrdered: MeasuredWeightEntry[] = [
        { date: baseTime, weightKg: 80.0 },
        { date: baseTime + 7 * DAY_MS, weightKg: 79.3 },
        { date: baseTime + 14 * DAY_MS, weightKg: 78.6 },
      ];
      const loadsOrdered: SessionTopLoad[] = [
        sessionLoad(1, baseTime + 2 * DAY_MS, 100, 8),
        sessionLoad(2, baseTime + 8 * DAY_MS, 102.5, 8),
        sessionLoad(3, baseTime + 14 * DAY_MS, 105, 8),
      ];

      const weightsShuffled = [weightsOrdered[1], weightsOrdered[2], weightsOrdered[0]];
      const loadsShuffled = [loadsOrdered[2], loadsOrdered[0], loadsOrdered[1]];

      const res1 = detectCutVelocity(weightsOrdered, loadsOrdered);
      const res2 = detectCutVelocity(weightsShuffled, loadsShuffled);

      expect(res1).toEqual(res2);
    });
  });
});

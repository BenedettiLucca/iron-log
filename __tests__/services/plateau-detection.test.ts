import {
  detectPlateau,
  detectPlateaus,
  PLATEAU_SESSION_THRESHOLD,
  RIR_REGRESSION_FLAG,
  type PlateauSessionLoad,
} from '@/services/plateau-detection';

/**
 * #74 — Plateau detection (pure logic slice).
 *
 * Conventions reused from existing services (READ-ONLY):
 * - Top-load convention: max working-set weight per session (AnalyticsService.calculateTopExerciseProgressions),
 *   with the PR tie-break rule: same weight, higher reps = improvement (checkPersonalRecordsSync).
 * - Trust II filtering: finished sessions only, soft-deleted excluded, non-warmup, positive weight/reps
 *   (TrainingVarianceService). The pure input carries `deletedAt` so the filter is testable in pure land.
 *
 * State machine (most-recent-directional-change wins):
 * - progressing: last non-unchanged transition improved load (heavier, or same weight + more reps)
 * - declining:   last non-unchanged transition regressed (lighter, same weight + fewer reps,
 *                or same weight with RIR increasing = load too light, opt-out via `rirRegression`)
 * - stale(N):    N consecutive sessions without top-load improvement, N >= threshold
 * - insufficient-data: all-flat history shorter than threshold
 */

const DAY = 24 * 60 * 60 * 1000;

function session(i: number, weightKg: number, reps: number, extra: Partial<PlateauSessionLoad> = {}): PlateauSessionLoad {
  return {
    sessionId: i,
    startTime: i * DAY,
    weightKg,
    reps,
    ...extra,
  };
}

describe('detectPlateau (pure per-exercise session history)', () => {
  it('exports the default threshold as owner-tunable constant (3 consecutive sessions)', () => {
    expect(PLATEAU_SESSION_THRESHOLD).toBe(3);
    expect(RIR_REGRESSION_FLAG).toBe(true);
  });
  it('returns insufficient-data for an empty history', () => {
    expect(detectPlateau([])).toEqual({ state: 'insufficient-data' });
  });

  it('returns insufficient-data for a single session', () => {
    expect(detectPlateau([session(1, 100, 8)])).toEqual({ state: 'insufficient-data' });
  });

  it('returns insufficient-data for below-threshold all-flat history', () => {
    // 2 consecutive sessions at the same top load, threshold 3 → no plateau yet.
    const history = [session(1, 100, 8), session(2, 100, 8)];
    expect(detectPlateau(history)).toEqual({ state: 'insufficient-data' });
  });

  it('returns stale(3) at exactly the default threshold with `since` pointing at the plateau start', () => {
    const history = [session(1, 100, 8), session(2, 100, 8), session(3, 100, 8)];
    expect(detectPlateau(history)).toEqual({
      state: 'stale',
      staleSessions: 3,
      since: session(1, 0, 0).startTime,
      topLoad: session(3, 100, 8),
    });
  });

  it('flags the plateau run after a load improvement, counting sessions since the improvement', () => {
    // e1=90, e2..e5=100: improvement at e2, then 3 consecutive sessions without improvement.
    const history = [
      session(1, 90, 8),
      session(2, 100, 6),
      session(3, 100, 6),
      session(4, 100, 6),
      session(5, 100, 6),
    ];
    expect(detectPlateau(history)).toEqual({
      state: 'stale',
      staleSessions: 3,
      since: session(3, 0, 0).startTime,
      topLoad: session(5, 100, 6),
    });
  });

  it('respects the threshold override (owner-tunable) via options', () => {
    const history = [session(1, 100, 8), session(2, 100, 8)];
    expect(detectPlateau(history, { threshold: 2 })).toEqual({
      state: 'stale',
      staleSessions: 2,
      since: session(1, 0, 0).startTime,
      topLoad: session(2, 100, 8),
    });
    // Default threshold 3: the same history is below threshold → not stale.
    expect(detectPlateau(history)).toEqual({ state: 'insufficient-data' });
  });

  it('returns progressing when the latest session improved load', () => {
    const history = [session(1, 90, 10), session(2, 100, 8)];
    expect(detectPlateau(history)).toEqual({
      state: 'progressing',
      staleStreak: 0,
      topLoad: session(2, 100, 8),
    });
  });

  it('treats weight increase with fewer reps as progress (weight is the primary signal)', () => {
    const history = [session(1, 100, 5), session(2, 105, 3)];
    expect(detectPlateau(history)).toEqual({
      state: 'progressing',
      staleStreak: 0,
      topLoad: session(2, 105, 3),
    });
  });

  it('treats same weight with more reps as progress (default progress rule, documented tie-break)', () => {
    const history = [session(1, 100, 5), session(2, 100, 6)];
    expect(detectPlateau(history)).toEqual({
      state: 'progressing',
      staleStreak: 0,
      topLoad: session(2, 100, 6),
    });
    // A rep PR after a flat pair breaks any plateau streak.
    const withFlatPrefix = [session(1, 100, 5), session(2, 100, 5), session(3, 100, 6)];
    expect(detectPlateau(withFlatPrefix)).toEqual({
      state: 'progressing',
      staleStreak: 0,
      topLoad: session(3, 100, 6),
    });
  });

  it('can disable the same-weight-more-reps progress rule (configurable)', () => {
    const history = [session(1, 100, 5), session(2, 100, 6)];
    expect(detectPlateau(history, { sameWeightRepProgress: false })).toEqual({ state: 'insufficient-data' });
    // With the rule off, three flat-load sessions reach the threshold and flag stale.
    const threeFlat = [session(1, 100, 5), session(2, 100, 6), session(3, 100, 6)];
    expect(detectPlateau(threeFlat, { sameWeightRepProgress: false })).toEqual({
      state: 'stale',
      staleSessions: 3,
      since: session(1, 0, 0).startTime,
      topLoad: session(3, 100, 6),
    });
  });

  it('returns progressing with a staleStreak when a flat tail is still below the threshold', () => {
    const history = [session(1, 90, 8), session(2, 100, 6), session(3, 100, 6)];
    expect(detectPlateau(history)).toEqual({
      state: 'progressing',
      staleStreak: 1,
      topLoad: session(3, 100, 6),
    });
  });

  it('treats weight regression as declining (explicit state, not stale)', () => {
    // 100, 100, 90: a 2-session flat tail preceded a regression → declining, never stale.
    const history = [session(1, 100, 8), session(2, 100, 8), session(3, 90, 10)];
    expect(detectPlateau(history)).toEqual({
      state: 'declining',
      topLoad: session(3, 90, 10),
      previousTopLoad: session(2, 100, 8),
    });
  });

  it('treats same weight with fewer reps (rep plateau) as declining', () => {
    const history = [session(1, 100, 8), session(2, 100, 5)];
    expect(detectPlateau(history)).toEqual({
      state: 'declining',
      topLoad: session(2, 100, 5),
      previousTopLoad: session(1, 100, 8),
    });
  });

  it('treats same weight with increasing RIR as declining (load too light), configurable off', () => {
    const history: PlateauSessionLoad[] = [
      session(1, 100, 8, { rir: 0 }),
      session(2, 100, 8, { rir: 2 }),
    ];
    expect(detectPlateau(history)).toEqual({
      state: 'declining',
      topLoad: session(2, 100, 8, { rir: 2 }),
      previousTopLoad: session(1, 100, 8, { rir: 0 }),
    });
    // RIR drop or missing RIR is not a regression.
    const flatHistory: PlateauSessionLoad[] = [
      session(1, 100, 8, { rir: 2 }),
      session(2, 100, 8, { rir: 0 }),
    ];
    expect(detectPlateau(flatHistory)).toEqual({ state: 'insufficient-data' });
    // Opt-out: with RIR regression disabled the flat pair stays below-threshold.
    expect(detectPlateau(history, { rirRegression: false })).toEqual({ state: 'insufficient-data' });
  });

  it('keeps declining even when a regression is followed by a flat tail', () => {
    // 100, 90, 90: the regression at e2 dominates → declining, not stale at the new level.
    const history = [session(1, 100, 8), session(2, 90, 10), session(3, 90, 10)];
    expect(detectPlateau(history)).toEqual({
      state: 'declining',
      topLoad: session(3, 90, 10),
      previousTopLoad: session(1, 100, 8),
    });
  });

  it('excludes soft-deleted sessions from the history (Trust II)', () => {
    // The deleted 110kg session must not count as progress.
    const history = [
      session(1, 100, 8),
      session(2, 110, 5, { deletedAt: 99 }),
      session(3, 100, 8),
      session(4, 100, 8),
    ];
    expect(detectPlateau(history)).toEqual({
      state: 'stale',
      staleSessions: 3,
      since: session(1, 0, 0).startTime,
      topLoad: session(4, 100, 8),
    });
    // A deleted session that would have caused a regression must not trigger declining either.
    const regressionDeleted = [
      session(1, 100, 8),
      session(2, 80, 10, { deletedAt: 99 }),
      session(3, 100, 8),
    ];
    expect(detectPlateau(regressionDeleted)).toEqual({ state: 'insufficient-data' });
  });

  it('ignores sessions with no valid top load (non-positive weight/reps), pure exclusion like soft-deletes', () => {
    // The invalid 0kg session is excluded (Trust II: weightKg > 0), so the history is
    // three consecutive flat 100kg sessions — the same result as if it had never existed.
    const history = [
      session(1, 100, 8),
      session(2, 0, 8),
      session(3, 100, 8),
      session(4, 100, 8),
    ];
    expect(detectPlateau(history)).toEqual({
      state: 'stale',
      staleSessions: 3,
      since: session(1, 0, 0).startTime,
      topLoad: session(4, 100, 8),
    });
    // All-invalid history has no evidence at all.
    expect(detectPlateau([session(1, 0, 8), session(2, 0, 8)])).toEqual({ state: 'insufficient-data' });
  });

  it('is deterministic for unordered input (sorts by startTime)', () => {
    const ordered = [session(1, 90, 8), session(2, 100, 6), session(3, 100, 6)];
    const shuffled = [ordered[1], ordered[2], ordered[0]];
    expect(detectPlateau(shuffled)).toEqual(detectPlateau(ordered));
  });
});

describe('detectPlateaus (per-exercise map)', () => {
  it('returns a state per exercise without leaking results across exercises', () => {
    const result = detectPlateaus({
      1: [session(1, 100, 8), session(2, 100, 8), session(3, 100, 8)],
      2: [session(4, 90, 8), session(5, 100, 8)],
    });
    expect(Object.keys(result)).toEqual(['1', '2']);
    expect(result[1]).toEqual({
      state: 'stale',
      staleSessions: 3,
      since: session(1, 0, 0).startTime,
      topLoad: session(3, 100, 8),
    });
    expect(result[2]).toEqual({
      state: 'progressing',
      staleStreak: 0,
      topLoad: session(5, 100, 8),
    });
  });

  it('returns an empty object for an empty history map', () => {
    expect(detectPlateaus({})).toEqual({});
  });
});

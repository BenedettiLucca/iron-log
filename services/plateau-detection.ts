/**
 * Plateau detection — pure per-exercise logic (Issue #74).
 *
 * Pure slice: no DB access. The caller supplies each exercise's session
 * history — the top working-set load per finished session (AnalyticsService
 * top-load convention) — carrying `deletedAt` so soft-delete exclusion is
 * testable without a DB (Trust II mirrors TrainingVarianceService).
 *
 * State machine (most-recent directional change wins):
 * - progressing:     last non-flat transition improved load (heavier, or same
 *                    weight + more reps per the PR tie-break convention)
 * - declining:       last non-flat transition regressed (lighter, same weight
 *                    + fewer reps, or same weight with RIR increasing = load
 *                    too light; opt out via `rirRegression`)
 * - stale(N):        N consecutive sessions without a top-load improvement
 *                    since the last improvement, N >= threshold
 * - insufficient-data: nothing to conclude (fewer than 2 live sessions, or an
 *                    all-flat history shorter than the threshold)
 */

export const PLATEAU_SESSION_THRESHOLD = 3;
export const RIR_REGRESSION_FLAG = true;

export interface PlateauSessionLoad {
  sessionId: number;
  startTime: number;
  weightKg: number;
  reps: number;
  rir?: number | null;
  deletedAt?: number | null;
}

export interface PlateauOptions {
  /** Consecutive non-improving sessions before the run is stale. Defaults to PLATEAU_SESSION_THRESHOLD. */
  threshold?: number;
  /** Same weight + increasing RIR counts as a regression (load too light). Defaults to RIR_REGRESSION_FLAG. */
  rirRegression?: boolean;
  /** Same weight + more reps counts as an improvement (PR tie-break). Defaults to true. */
  sameWeightRepProgress?: boolean;
}

export type PlateauState =
  | { state: 'insufficient-data' }
  | { state: 'progressing'; staleStreak: number; topLoad: PlateauSessionLoad }
  | { state: 'stale'; staleSessions: number; since: number; topLoad: PlateauSessionLoad }
  | { state: 'declining'; topLoad: PlateauSessionLoad; previousTopLoad: PlateauSessionLoad };

function isImprovement(cur: PlateauSessionLoad, prev: PlateauSessionLoad, sameWeightRepProgress: boolean): boolean {
  return (
    cur.weightKg > prev.weightKg ||
    (sameWeightRepProgress && cur.weightKg === prev.weightKg && cur.reps > prev.reps)
  );
}

function isRegression(cur: PlateauSessionLoad, prev: PlateauSessionLoad, rirRegression: boolean): boolean {
  return (
    cur.weightKg < prev.weightKg ||
    (cur.weightKg === prev.weightKg && cur.reps < prev.reps) ||
    (rirRegression &&
      cur.weightKg === prev.weightKg &&
      cur.reps === prev.reps &&
      cur.rir != null &&
      prev.rir != null &&
      cur.rir > prev.rir)
  );
}

/**
 * Detect the plateau state for one exercise's session history.
 *
 * Input sessions with `deletedAt` set or a non-positive weight/reps are
 * excluded entirely (Trust II: only finished, live, positive-load sessions
 * count), so invalid/deleted entries never skew progress or regressions.
 */
export function detectPlateau(history: PlateauSessionLoad[], options: PlateauOptions = {}): PlateauState {
  const threshold = options.threshold ?? PLATEAU_SESSION_THRESHOLD;
  const rirRegression = options.rirRegression ?? RIR_REGRESSION_FLAG;
  const sameWeightRepProgress = options.sameWeightRepProgress ?? true;

  const live = history
    .filter((h) => h.deletedAt == null && h.weightKg > 0 && h.reps > 0)
    .slice()
    .sort((a, b) => a.startTime - b.startTime || a.sessionId - b.sessionId);

  if (live.length < 2) return { state: 'insufficient-data' };

  let lastChange: 'improvement' | 'regression' | null = null;
  let flatStreak = 0;
  let flatRunStart: PlateauSessionLoad | null = null;
  let regressionFrom: PlateauSessionLoad | null = null;

  for (let i = 1; i < live.length; i++) {
    const prev = live[i - 1];
    const cur = live[i];
    if (isImprovement(cur, prev, sameWeightRepProgress)) {
      lastChange = 'improvement';
      flatStreak = 0;
      flatRunStart = null;
    } else if (isRegression(cur, prev, rirRegression)) {
      lastChange = 'regression';
      regressionFrom = prev;
      flatStreak = 0;
      flatRunStart = null;
    } else {
      if (flatStreak === 0) flatRunStart = cur;
      flatStreak += 1;
    }
  }

  const latest = live[live.length - 1];

  if (lastChange === 'regression' && regressionFrom) {
    return { state: 'declining', topLoad: latest, previousTopLoad: regressionFrom };
  }
  if (lastChange === 'improvement') {
    if (flatStreak >= threshold) {
      return {
        state: 'stale',
        staleSessions: flatStreak,
        since: (flatRunStart ?? live[0]).startTime,
        topLoad: latest,
      };
    }
    return { state: 'progressing', staleStreak: flatStreak, topLoad: latest };
  }
  // All-flat history: never improved, never regressed.
  if (live.length >= threshold) {
    return {
      state: 'stale',
      staleSessions: live.length,
      since: live[0].startTime,
      topLoad: latest,
    };
  }
  return { state: 'insufficient-data' };
}

/** Per-exercise plateau states, one entry per key, preserving key insertion order. */
export function detectPlateaus(
  historyMap: Record<string, PlateauSessionLoad[]>,
  options: PlateauOptions = {}
): Record<string, PlateauState> {
  const result: Record<string, PlateauState> = {};
  for (const [key, history] of Object.entries(historyMap)) {
    result[key] = detectPlateau(history, options);
  }
  return result;
}
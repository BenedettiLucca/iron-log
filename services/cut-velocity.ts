/**
 * Cut-velocity load advisory policy module (Issue #75).
 *
 * Informational trend context only; not medical advice; consult a qualified professional for health decisions.
 *
 * During a cut phase (sustained measured-weight loss), top working load trends
 * are monitored. If top load trends are rising during a cut phase, this policy
 * surfaces a non-blocking informational advisory ('load_rising_during_cut').
 *
 * Approved upstream anchors:
 * 1. plateau-detection conventions (branch epic/il-74-plateau):
 *    Top-set derivation and regression/improvement definitions are mirrored.
 * 2. Weight provenance (branch epic/il-147-contract):
 *    ONLY explicitly measured body weight entries (bodyMetrics-style rows) are
 *    considered. Borrowed, carried, or unmeasured session weights are excluded.
 */

// convention mirror of epic/il-74-plateau; reconcile at integration
export interface SessionTopLoad {
  sessionId: number;
  startTime: number;
  weightKg: number;
  reps: number;
  rir?: number | null;
  deletedAt?: number | null;
  exerciseId?: number;
}

/**
 * Measured weight entry.
 * Follows epic/il-147-contract semantics: only verified measured weights count.
 * Rows with provenance: 'borrowed', 'carried', isWeightMeasured: false, or hasBodyMetric: false are excluded.
 */
export interface MeasuredWeightEntry {
  date?: number;
  timestamp?: number;
  startTime?: number;
  weightKg?: number | null;
  weight?: number | null;
  bodyWeight?: number | null;
  provenance?: 'measured' | 'borrowed' | 'carried' | string | null;
  weightProvenance?: 'measured' | 'borrowed' | 'carried' | string | null;
  isWeightMeasured?: boolean | null;
  hasBodyMetric?: boolean | null;
  source?: 'body_metrics' | 'session' | string;
}

/** Normalized internal representation of measured body weight */
export interface NormalizedMeasuredWeight {
  date: number;
  weightKg: number;
}

/** Owner-tunable default constants */
export const CUT_VELOCITY_DEFAULTS = {
  /** Minimum window in days to assess whether a cut is sustained. Default: 14 days (2 weeks). */
  MIN_CUT_WINDOW_DAYS: 14,
  /** Cut velocity threshold: >=0.5% bodyweight/week sustained. Default: 0.5%. */
  CUT_RATE_BW_PERCENT_PER_WEEK: 0.5,
  /** Cut velocity threshold (% bw lost per week). Default: 0.5%. */
  CUT_VELOCITY_THRESHOLD: 0.5,
  /** Minimum number of measured weight samples required. Default: 2. */
  MIN_WEIGHT_SAMPLES: 2,
  /** Number of recent sessions to inspect for top-load trend. Default: 3 sessions. */
  LOAD_RISING_WINDOW_SESSIONS: 3,
  /** Minimum number of session-to-session load increases to trigger 'rising'. Default: 2. */
  LOAD_RISING_MIN_INCREASES: 2,
  /** PR tie-break rule: same weight with higher reps = improvement. Default: true. */
  SAME_WEIGHT_REP_PROGRESS: true,
  /** Same weight + reps with higher RIR = regression (load too light). Default: true. */
  RIR_REGRESSION: true,
} as const;

/** Canonical cut velocity threshold constant alias */
export const CUT_VELOCITY_THRESHOLD = CUT_VELOCITY_DEFAULTS.CUT_VELOCITY_THRESHOLD;

export interface CutVelocityOptions {
  /** Minimum window in days to assess sustained cut. Defaults to CUT_VELOCITY_DEFAULTS.MIN_CUT_WINDOW_DAYS (14). */
  minCutWindowDays?: number;
  /** Cut velocity threshold (% bw lost per week). Defaults to CUT_VELOCITY_DEFAULTS.CUT_RATE_BW_PERCENT_PER_WEEK (0.5). */
  cutRateBwPercentPerWeek?: number;
  /** Minimum number of measured weight data points. Defaults to CUT_VELOCITY_DEFAULTS.MIN_WEIGHT_SAMPLES (2). */
  minWeightSamples?: number;
  /** Number of recent sessions to inspect for top-load changes. Defaults to CUT_VELOCITY_DEFAULTS.LOAD_RISING_WINDOW_SESSIONS (3). */
  loadRisingWindowSessions?: number;
  /** Number of increases required to classify load as rising. Defaults to CUT_VELOCITY_DEFAULTS.LOAD_RISING_MIN_INCREASES (2). */
  loadRisingMinIncreases?: number;
  /** PR tie-break convention from epic/il-74-plateau. Defaults to true. */
  sameWeightRepProgress?: boolean;
  /** RIR regression convention from epic/il-74-plateau. Defaults to true. */
  rirRegression?: boolean;
}

export type CutAdvisory = 'none' | 'load_rising_during_cut' | 'insufficient-data';
export type LoadTrend = 'rising' | 'stable' | 'declining' | 'insufficient-data';

export interface CutVelocityResult {
  /** True when bodyweight loss meets or exceeds the cut velocity threshold sustained over the window. */
  cutPhase: boolean;
  /**
   * Rate of bodyweight change in kg/week over the sustained window.
   * Negative indicates weight loss (e.g. -0.7 kg/week), positive indicates weight gain.
   * null when weight history is insufficient.
   */
  velocityKgPerWeek: number | null;
  /**
   * Non-blocking advisory state:
   * - 'load_rising_during_cut': advisory fires (top load rising during sustained cut)
   * - 'none': no advisory needed (not in cut, or load stable/declining)
   * - 'insufficient-data': explicit state for missing/insufficient data (never silently green)
   */
  advisory: CutAdvisory;
  /** Explicit state identifier mirroring plateau detection conventions. */
  state: 'evaluated' | 'insufficient-data';
  /** Diagnostic details */
  details?: {
    loadTrend: LoadTrend;
    measuredWeightSamples: number;
    weightDaysSpan: number;
    lossRatePercentPerWeek: number | null;
    baselineWeightKg: number | null;
    currentWeightKg: number | null;
    insufficientReason?: string;
  };
}

export interface MultiExerciseCutAdvisoryResult {
  overall: CutVelocityResult;
  byExercise: Record<string, CutVelocityResult>;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = 7 * MS_PER_DAY;

/**
 * Filter out unmeasured, borrowed, carried, or non-measured provenance weights
 * (branch epic/il-147-contract semantics: whitelists 'measured' provenance).
 */
export function isMeasuredWeight(entry: MeasuredWeightEntry): boolean {
  if (!entry || typeof entry !== 'object') return false;

  // Whitelist 'measured' provenance: reject if provenance or weightProvenance is set to non-'measured'
  // Explicitly accepts and excludes 'borrowed', 'carried', and any non-'measured' value
  if (entry.provenance != null && entry.provenance !== 'measured') return false;
  if (entry.weightProvenance != null && entry.weightProvenance !== 'measured') return false;

  // Reject explicit unmeasured flag
  if (entry.isWeightMeasured === false) return false;

  // Reject sessions without body metrics
  if (entry.hasBodyMetric === false) return false;

  // If entry originated from a session without explicit measurement provenance, reject
  if (entry.source === 'session' && entry.isWeightMeasured !== true && entry.provenance !== 'measured') {
    return false;
  }

  const weight = entry.weightKg ?? entry.weight ?? (entry.isWeightMeasured ? entry.bodyWeight : null);
  if (weight == null || typeof weight !== 'number' || Number.isNaN(weight) || weight <= 0) {
    return false;
  }

  const rawDate = entry.date ?? entry.timestamp ?? entry.startTime;
  if (rawDate == null || typeof rawDate !== 'number' || Number.isNaN(rawDate) || rawDate <= 0) {
    return false;
  }

  return true;
}

/**
 * Normalizes and sorts measured weight records in ascending chronological order.
 */
export function filterAndNormalizeWeights(entries: MeasuredWeightEntry[]): NormalizedMeasuredWeight[] {
  return entries
    .filter(isMeasuredWeight)
    .map((e) => {
      const rawDate = e.date ?? e.timestamp ?? e.startTime!;
      const date = rawDate < 1e11 ? rawDate * 1000 : rawDate;
      const weightKg = (e.weightKg ?? e.weight ?? e.bodyWeight)!;
      return { date, weightKg };
    })
    .sort((a, b) => a.date - b.date);
}

// convention mirror of epic/il-74-plateau; reconcile at integration
function isImprovement(
  cur: SessionTopLoad,
  prev: SessionTopLoad,
  sameWeightRepProgress: boolean
): boolean {
  return (
    cur.weightKg > prev.weightKg ||
    (sameWeightRepProgress && cur.weightKg === prev.weightKg && cur.reps > prev.reps)
  );
}

// convention mirror of epic/il-74-plateau; reconcile at integration
function isRegression(
  cur: SessionTopLoad,
  prev: SessionTopLoad,
  rirRegression: boolean
): boolean {
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
 * Evaluates top-load trend over the recent session window.
 * Requires at least 3 sessions of top-load history; fewer than 3 sessions returns 'insufficient-data'.
 */
export function evaluateLoadTrend(
  history: SessionTopLoad[],
  options: CutVelocityOptions = {}
): LoadTrend {
  const windowSessions = options.loadRisingWindowSessions ?? CUT_VELOCITY_DEFAULTS.LOAD_RISING_WINDOW_SESSIONS;
  const minIncreases = options.loadRisingMinIncreases ?? CUT_VELOCITY_DEFAULTS.LOAD_RISING_MIN_INCREASES;
  const sameWeightRepProgress = options.sameWeightRepProgress ?? CUT_VELOCITY_DEFAULTS.SAME_WEIGHT_REP_PROGRESS;
  const rirRegression = options.rirRegression ?? CUT_VELOCITY_DEFAULTS.RIR_REGRESSION;

  const live = history
    .filter((h) => h.deletedAt == null && h.weightKg > 0 && h.reps > 0)
    .slice()
    .sort((a, b) => a.startTime - b.startTime || a.sessionId - b.sessionId);

  // Fewer than 3 sessions of top-load history -> insufficient data to evaluate trend
  if (live.length < 3 || live.length < windowSessions) {
    return 'insufficient-data';
  }

  // Inspect the transitions corresponding to the recent window
  const transitions: { cur: SessionTopLoad; prev: SessionTopLoad }[] = [];

  if (live.length <= windowSessions) {
    for (let i = 1; i < live.length; i++) {
      transitions.push({ cur: live[i], prev: live[i - 1] });
    }
  } else {
    const startIndex = live.length - windowSessions;
    for (let i = startIndex; i < live.length; i++) {
      transitions.push({ cur: live[i], prev: live[i - 1] });
    }
  }

  let increases = 0;
  let regressions = 0;

  for (const { cur, prev } of transitions) {
    if (isImprovement(cur, prev, sameWeightRepProgress)) {
      increases += 1;
    } else if (isRegression(cur, prev, rirRegression)) {
      regressions += 1;
    }
  }

  if (increases >= minIncreases) {
    return 'rising';
  }
  if (regressions > 0 && increases === 0) {
    return 'declining';
  }
  return 'stable';
}

interface WeightEvaluation {
  isSufficient: boolean;
  cutPhase: boolean;
  velocityKgPerWeek: number | null;
  lossRatePercentPerWeek: number | null;
  baselineWeightKg: number | null;
  currentWeightKg: number | null;
  daysSpan: number;
  sampleCount: number;
  insufficientReason?: string;
}

function evaluateWeightVelocity(
  weights: NormalizedMeasuredWeight[],
  options: CutVelocityOptions = {}
): WeightEvaluation {
  const minCutWindowDays = options.minCutWindowDays ?? CUT_VELOCITY_DEFAULTS.MIN_CUT_WINDOW_DAYS;
  const cutRateBwPercentPerWeek = options.cutRateBwPercentPerWeek ?? CUT_VELOCITY_DEFAULTS.CUT_RATE_BW_PERCENT_PER_WEEK;
  const minSamples = options.minWeightSamples ?? CUT_VELOCITY_DEFAULTS.MIN_WEIGHT_SAMPLES;

  if (weights.length < minSamples) {
    return {
      isSufficient: false,
      cutPhase: false,
      velocityKgPerWeek: null,
      lossRatePercentPerWeek: null,
      baselineWeightKg: null,
      currentWeightKg: null,
      daysSpan: 0,
      sampleCount: weights.length,
      insufficientReason: 'fewer_samples_than_minimum',
    };
  }

  const latest = weights[weights.length - 1];
  const earliest = weights[0];
  const totalSpanMs = latest.date - earliest.date;
  const totalSpanDays = totalSpanMs / MS_PER_DAY;

  if (totalSpanDays < minCutWindowDays) {
    return {
      isSufficient: false,
      cutPhase: false,
      velocityKgPerWeek: null,
      lossRatePercentPerWeek: null,
      baselineWeightKg: earliest.weightKg,
      currentWeightKg: latest.weightKg,
      daysSpan: Math.round(totalSpanDays * 10) / 10,
      sampleCount: weights.length,
      insufficientReason: 'history_span_less_than_window',
    };
  }

  // Extract points spanning the recent cut window ending at latest.date
  const windowStartMs = latest.date - minCutWindowDays * MS_PER_DAY;
  const windowPoints = weights.filter((w) => w.date >= windowStartMs);

  // If the earliest point in the window starts after windowStartMs, anchor with the point just before it
  if (windowPoints.length === 0 || windowPoints[0].date > windowStartMs) {
    const priorPoint = weights.filter((w) => w.date < windowStartMs).pop();
    if (priorPoint) {
      windowPoints.unshift(priorPoint);
    }
  }

  const activePoints = windowPoints.length >= 2 ? windowPoints : weights;
  const baseline = activePoints[0];
  const endPoint = activePoints[activePoints.length - 1];
  const windowSpanWeeks = (endPoint.date - baseline.date) / MS_PER_WEEK;

  if (windowSpanWeeks <= 0) {
    return {
      isSufficient: false,
      cutPhase: false,
      velocityKgPerWeek: null,
      lossRatePercentPerWeek: null,
      baselineWeightKg: baseline.weightKg,
      currentWeightKg: endPoint.weightKg,
      daysSpan: 0,
      sampleCount: activePoints.length,
      insufficientReason: 'zero_time_span',
    };
  }

  let velocity: number;

  if (activePoints.length === 2) {
    velocity = (endPoint.weightKg - baseline.weightKg) / windowSpanWeeks;
  } else {
    // Ordinary least-squares linear regression slope in kg/week
    const n = activePoints.length;
    let sumX = 0;
    let sumY = 0;
    const xVals = activePoints.map((p) => {
      const x = (p.date - baseline.date) / MS_PER_WEEK;
      sumX += x;
      sumY += p.weightKg;
      return x;
    });

    const meanX = sumX / n;
    const meanY = sumY / n;

    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      const dx = xVals[i] - meanX;
      const dy = activePoints[i].weightKg - meanY;
      num += dx * dy;
      den += dx * dx;
    }

    velocity = den > 0 ? num / den : (endPoint.weightKg - baseline.weightKg) / windowSpanWeeks;
  }

  // Classification uses raw values; rounding is display-only.
  // Compare raw velocity/loss rate to the threshold without premature rounding.
  let lossRatePercentPerWeek = 0;
  let cutPhase = false;

  if (velocity < 0) {
    const rawLossRateKgPerWeek = -velocity;
    const rawLossRatePercentPerWeek = (rawLossRateKgPerWeek / baseline.weightKg) * 100;
    if (rawLossRatePercentPerWeek >= cutRateBwPercentPerWeek) {
      cutPhase = true;
    }
    lossRatePercentPerWeek = Math.round(rawLossRatePercentPerWeek * 100) / 100;
  }

  const velocityKgPerWeek = Math.round(velocity * 100) / 100;
  const baselineWeightKg = baseline.weightKg;
  const currentWeightKg = endPoint.weightKg;

  return {
    isSufficient: true,
    cutPhase,
    velocityKgPerWeek,
    lossRatePercentPerWeek,
    baselineWeightKg,
    currentWeightKg,
    daysSpan: Math.round(((endPoint.date - baseline.date) / MS_PER_DAY) * 10) / 10,
    sampleCount: activePoints.length,
  };
}

/**
 * Pure policy evaluation for cut-velocity load advisory.
 *
 * Evaluates whether:
 * 1. A cut phase is sustained (measured-weight loss >= cutRateBwPercentPerWeek over minCutWindowDays).
 * 2. Top working loads keep rising during the cut phase (increased in >= 2 of last 3 sessions).
 *
 * Missing or insufficient data returns explicit state 'insufficient-data', never silently green.
 */
export function detectCutVelocity(
  weightHistory: MeasuredWeightEntry[],
  topLoadHistory: SessionTopLoad[],
  options: CutVelocityOptions = {}
): CutVelocityResult {
  const normalizedWeights = filterAndNormalizeWeights(weightHistory);
  const weightEval = evaluateWeightVelocity(normalizedWeights, options);

  if (!weightEval.isSufficient) {
    return {
      cutPhase: false,
      velocityKgPerWeek: null,
      advisory: 'insufficient-data',
      state: 'insufficient-data',
      details: {
        loadTrend: 'insufficient-data',
        measuredWeightSamples: normalizedWeights.length,
        weightDaysSpan: weightEval.daysSpan,
        lossRatePercentPerWeek: null,
        baselineWeightKg: weightEval.baselineWeightKg,
        currentWeightKg: weightEval.currentWeightKg,
        insufficientReason: weightEval.insufficientReason ?? 'insufficient_weight_history',
      },
    };
  }

  // If user is not in a cut phase, the advisory does not fire
  if (!weightEval.cutPhase) {
    return {
      cutPhase: false,
      velocityKgPerWeek: weightEval.velocityKgPerWeek,
      advisory: 'none',
      state: 'evaluated',
      details: {
        loadTrend: evaluateLoadTrend(topLoadHistory, options),
        measuredWeightSamples: weightEval.sampleCount,
        weightDaysSpan: weightEval.daysSpan,
        lossRatePercentPerWeek: weightEval.lossRatePercentPerWeek,
        baselineWeightKg: weightEval.baselineWeightKg,
        currentWeightKg: weightEval.currentWeightKg,
      },
    };
  }

  // User is in a sustained cut phase: assess top-load progression
  const loadTrend = evaluateLoadTrend(topLoadHistory, options);

  let advisory: CutAdvisory;
  let state: 'evaluated' | 'insufficient-data';

  if (loadTrend === 'rising') {
    advisory = 'load_rising_during_cut';
    state = 'evaluated';
  } else if (loadTrend === 'insufficient-data') {
    advisory = 'insufficient-data';
    state = 'insufficient-data';
  } else {
    // stable or declining
    advisory = 'none';
    state = 'evaluated';
  }

  return {
    cutPhase: true,
    velocityKgPerWeek: weightEval.velocityKgPerWeek,
    advisory,
    state,
    details: {
      loadTrend,
      measuredWeightSamples: weightEval.sampleCount,
      weightDaysSpan: weightEval.daysSpan,
      lossRatePercentPerWeek: weightEval.lossRatePercentPerWeek,
      baselineWeightKg: weightEval.baselineWeightKg,
      currentWeightKg: weightEval.currentWeightKg,
      ...(loadTrend === 'insufficient-data' ? { insufficientReason: 'insufficient_load_history' } : {}),
    },
  };
}

/**
 * Multi-exercise evaluation: evaluates per-exercise top-load histories.
 * The overall advisory fires if ANY exercise experiences rising top loads during a sustained cut phase.
 * If the exercise map is empty, returns 'insufficient-data' (never silently green).
 */
export function detectCutVelocityAdvisories(
  weightHistory: MeasuredWeightEntry[],
  topLoadsByExercise: Record<string, SessionTopLoad[]>,
  options: CutVelocityOptions = {}
): MultiExerciseCutAdvisoryResult {
  const byExercise: Record<string, CutVelocityResult> = {};
  const entries = Object.entries(topLoadsByExercise);

  let anyRising = false;
  let allInsufficient = entries.length > 0;
  let primaryResult: CutVelocityResult | null = null;

  for (const [key, history] of entries) {
    const res = detectCutVelocity(weightHistory, history, options);
    byExercise[key] = res;

    if (!primaryResult) {
      primaryResult = res;
    }

    if (res.advisory === 'load_rising_during_cut') {
      anyRising = true;
    }
    if (res.details?.loadTrend !== 'insufficient-data') {
      allInsufficient = false;
    }
  }

  const normalizedWeights = filterAndNormalizeWeights(weightHistory);
  const weightEval = evaluateWeightVelocity(normalizedWeights, options);

  let overallAdvisory: CutAdvisory;
  let overallState: 'evaluated' | 'insufficient-data';

  if (!weightEval.isSufficient || entries.length === 0) {
    overallAdvisory = 'insufficient-data';
    overallState = 'insufficient-data';
  } else if (anyRising) {
    overallAdvisory = 'load_rising_during_cut';
    overallState = 'evaluated';
  } else if (!weightEval.cutPhase) {
    overallAdvisory = 'none';
    overallState = 'evaluated';
  } else if (allInsufficient) {
    overallAdvisory = 'insufficient-data';
    overallState = 'insufficient-data';
  } else {
    overallAdvisory = 'none';
    overallState = 'evaluated';
  }

  const overallLoadTrend: LoadTrend = entries.length === 0
    ? 'insufficient-data'
    : anyRising
      ? 'rising'
      : allInsufficient
        ? 'insufficient-data'
        : 'stable';

  const overall: CutVelocityResult = {
    cutPhase: weightEval.cutPhase,
    velocityKgPerWeek: weightEval.velocityKgPerWeek,
    advisory: overallAdvisory,
    state: overallState,
    details: {
      loadTrend: overallLoadTrend,
      measuredWeightSamples: weightEval.sampleCount,
      weightDaysSpan: weightEval.daysSpan,
      lossRatePercentPerWeek: weightEval.lossRatePercentPerWeek,
      baselineWeightKg: weightEval.baselineWeightKg,
      currentWeightKg: weightEval.currentWeightKg,
      ...(entries.length === 0 ? { insufficientReason: 'empty_exercise_history' } : {}),
      ...(!weightEval.isSufficient && weightEval.insufficientReason ? { insufficientReason: weightEval.insufficientReason } : {}),
    },
  };

  return {
    overall,
    byExercise,
  };
}

/** Function aliases for caller convenience */
export const detectCutVelocityAdvisory = detectCutVelocity;
export const evaluateCutVelocityAdvisory = detectCutVelocity;

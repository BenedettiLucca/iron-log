import { logger } from './logger';

export interface ExerciseHistoryEntry {
  weightKg: number;
  reps: number;
  rir?: number | null;
}

export interface PerformedSet {
  weightKg: number;
  reps: number;
  rir?: number | null;
}

export type ProgressionVerdict = 'hold' | 'increase' | 'review_fatigue' | 'check_logging';

export type SuggestedLoad = string | null;

export type ProgressionResult = 'below' | 'within' | 'top' | 'no_target';

export type ProgressionConfidence = 'low' | 'medium' | 'high';

export interface ExerciseTarget {
  sets: number;
  minReps: number;
  maxReps: number;
}

export interface ProgressionPolicyInput {
  /** Historical sets for this exercise (ordered chronologically, oldest first). */
  history: ExerciseHistoryEntry[];
  /** The performed sets in the just-finished session (ordered by setNumber). */
  performed: PerformedSet[];
  /** Target prescription for this exercise (if any). */
  target: ExerciseTarget | null;
}

export interface ProgressionPolicyOutput {
  /** Verdict: 'hold' | 'increase' | 'review_fatigue' | 'check_logging'. */
  verdict: ProgressionVerdict;
  /** Suggested next load as a human-readable string (null if no suggestion). */
  nextLoadSuggestion: SuggestedLoad;
  /** Classification result ('below' | 'within' | 'top' | 'no_target'). */
  result: ProgressionResult;
  /** Confidence level. */
  confidence: ProgressionConfidence;
  /** Anomaly flags. */
  flags: string[];
}

export interface ProgressionPolicyOptions {
  /** Load increment step in kg. Defaults to DEFAULT_LOAD_INCREMENT_KG (2.5kg). */
  loadIncrementKg?: number;
  /** Minimum number of historical sets required as baseline. Defaults to DEFAULT_MIN_HISTORY_THRESHOLD (1). */
  minHistoryThreshold?: number;
  /** Rep drop threshold at same weight indicating acute fatigue. Defaults to ABRUPT_REP_DROP_THRESHOLD (3). */
  abruptRepDropThreshold?: number;
}

export interface ProgressionDecisionLogContext {
  exerciseId?: number;
  exerciseName?: string;
  sessionId?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Tunables & Defaults (Issue #148)
// ---------------------------------------------------------------------------

export const DEFAULT_LOAD_INCREMENT_KG = 2.5;
export const DEFAULT_MIN_HISTORY_THRESHOLD = 1;
export const ABRUPT_REP_DROP_THRESHOLD = 3;

// ---------------------------------------------------------------------------
// Pure Evaluation Policy (No DB / No I/O)
// ---------------------------------------------------------------------------

/**
 * Pure evaluation function for double progression overload.
 * Takes history, performed sets, and target prescription.
 * Produces verdict, next load suggestion, result category, confidence, and anomaly flags.
 * Completely free of side-effects, async operations, or database dependencies.
 */
export function evaluateProgression(
  input: ProgressionPolicyInput,
  options?: ProgressionPolicyOptions
): ProgressionPolicyOutput {
  const { history, performed, target } = input;
  const loadIncrementKg = options?.loadIncrementKg ?? DEFAULT_LOAD_INCREMENT_KG;
  const minHistoryThreshold = options?.minHistoryThreshold ?? DEFAULT_MIN_HISTORY_THRESHOLD;
  const repDropThreshold = options?.abruptRepDropThreshold ?? ABRUPT_REP_DROP_THRESHOLD;

  const flags: string[] = [];

  // 1. Anomaly checks
  // A. RIR inversion: later set with same/higher load and reps has higher RIR
  let hasRirInversion = false;
  for (let i = 0; i < performed.length - 1; i++) {
    const s1 = performed[i];
    const s2 = performed[i + 1];
    if (s1.rir != null && s2.rir != null) {
      if (s2.weightKg >= s1.weightKg && s2.reps >= s1.reps && s2.rir > s1.rir) {
        hasRirInversion = true;
      }
    }
  }
  if (hasRirInversion) {
    flags.push('rir_inversion');
  }

  // B. Abrupt rep drop at same weight (drop >= threshold)
  let hasAbruptRepDrop = false;
  for (let i = 0; i < performed.length - 1; i++) {
    const s1 = performed[i];
    const s2 = performed[i + 1];
    if (s1.weightKg === s2.weightKg && s1.reps - s2.reps >= repDropThreshold) {
      hasAbruptRepDrop = true;
    }
  }
  if (hasAbruptRepDrop) {
    flags.push('abrupt_rep_drop');
  }

  // C. Extra working sets beyond target
  if (target && performed.length > target.sets) {
    flags.push('extra_sets');
  }

  // D. Insufficient history flag
  if (history.length < minHistoryThreshold) {
    flags.push('insufficient_history');
  }

  // 2. Result Classification
  let result: ProgressionResult = 'no_target';

  if (!target) {
    result = 'no_target';
  } else if (performed.length < target.sets) {
    // Incomplete workout: performed fewer sets than target sets
    result = 'below';
  } else {
    const plannedSets = performed.slice(0, target.sets);
    const allTop = plannedSets.every(s => s.reps >= target.maxReps);
    const allWithin = plannedSets.every(s => s.reps >= target.minReps);

    if (allTop) {
      result = 'top';
    } else if (allWithin) {
      result = 'within';
    } else {
      result = 'below';
    }
  }

  // 3. Verdict Determination
  let verdict: ProgressionVerdict = 'hold';

  if (hasRirInversion) {
    verdict = 'check_logging';
  } else if (hasAbruptRepDrop) {
    verdict = 'review_fatigue';
  } else if (result === 'top') {
    // Top of range reached: check baseline history to confirm progression
    const hasSufficientHistory = history.length >= minHistoryThreshold;
    const historyMaxWeight = history.length > 0
      ? Math.max(...history.map(s => s.weightKg))
      : 0;
    const performedMinWeight = performed.length > 0
      ? Math.min(...performed.map(s => s.weightKg))
      : 0;

    // Must have sufficient history and performed load must meet or exceed history baseline
    if (hasSufficientHistory && performedMinWeight >= historyMaxWeight) {
      verdict = 'increase';
    } else {
      verdict = 'hold';
    }
  } else {
    // 'within', 'below', or 'no_target' -> hold current load
    verdict = 'hold';
  }

  // 4. Confidence Determination
  let confidence: ProgressionConfidence = 'low';
  if (performed.length === 0 || !target) {
    confidence = 'low';
  } else if (history.length < minHistoryThreshold || performed.length < target.sets || flags.length > 0) {
    confidence = 'medium';
  } else {
    confidence = 'high';
  }

  // 5. Next Load Suggestion
  let nextLoadSuggestion: SuggestedLoad = null;

  if (!target) {
    nextLoadSuggestion = null;
  } else if (verdict === 'increase') {
    const weights = performed.map(s => s.weightKg);
    const uniqueWeights = Array.from(new Set(weights));
    const hasSingleWorkingWeight =
      uniqueWeights.length === 1 && Number.isFinite(uniqueWeights[0]) && uniqueWeights[0] > 0;

    if (hasSingleWorkingWeight) {
      const nextWeight = uniqueWeights[0] + loadIncrementKg;
      nextLoadSuggestion = `Next time try ${nextWeight}kg`;
    } else {
      nextLoadSuggestion = 'Increase load next session';
    }
  } else if (verdict === 'hold') {
    nextLoadSuggestion = 'Maintain current load';
  } else if (verdict === 'review_fatigue') {
    nextLoadSuggestion = 'Lower load or rest more';
  } else if (verdict === 'check_logging') {
    nextLoadSuggestion = 'Verify logged sets details';
  }

  return {
    verdict,
    nextLoadSuggestion,
    result,
    confidence,
    flags,
  };
}

// ---------------------------------------------------------------------------
// Logging Seam (Separated from Evaluation)
// ---------------------------------------------------------------------------

/**
 * Structured logger for progression evaluation decisions.
 * Keeps persistence / analytics telemetry cleanly split from pure evaluation.
 */
export function logProgressionDecision(
  output: ProgressionPolicyOutput,
  context?: ProgressionDecisionLogContext
): void;
export function logProgressionDecision(
  first: ProgressionPolicyOutput | ProgressionPolicyInput | number,
  second?: ProgressionPolicyOutput | Record<string, unknown>,
  third?: Record<string, unknown>
): void {
  if (typeof first === 'object' && first !== null && 'verdict' in first) {
    const output = first as ProgressionPolicyOutput;
    const ctx = (typeof second === 'object' && second !== null ? second : {}) as Record<string, unknown>;
    logger.info('[ProgressionPolicy] Decision evaluated', {
      verdict: output.verdict,
      result: output.result,
      nextLoadSuggestion: output.nextLoadSuggestion,
      confidence: output.confidence,
      flags: output.flags,
      ...ctx,
    });
  } else if (typeof first === 'number') {
    const output = second as ProgressionPolicyOutput | undefined;
    logger.info('[ProgressionPolicy] Decision evaluated', {
      exerciseId: first,
      verdict: output?.verdict,
      result: output?.result,
      nextLoadSuggestion: output?.nextLoadSuggestion,
      confidence: output?.confidence,
      flags: output?.flags,
      ...(third ?? {}),
    });
  } else if (typeof first === 'object' && first !== null && 'performed' in first) {
    const output = second as ProgressionPolicyOutput | undefined;
    logger.info('[ProgressionPolicy] Decision evaluated', {
      verdict: output?.verdict,
      result: output?.result,
      nextLoadSuggestion: output?.nextLoadSuggestion,
      confidence: output?.confidence,
      flags: output?.flags,
      ...(third ?? {}),
    });
  } else {
    logger.info('[ProgressionPolicy] Decision evaluated', { first, second, third });
  }
}

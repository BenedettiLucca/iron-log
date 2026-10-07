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

export function evaluateProgression(_input: ProgressionPolicyInput): ProgressionPolicyOutput {
  throw new Error('progression policy not implemented yet (issue #148 core slice)');
}

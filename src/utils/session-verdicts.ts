import type { SummarySet } from './session-summary';

type TFunction = (key: string, vars?: Record<string, string | number>) => string;

export interface ParsedTarget {
  sets: number;
  minReps: number;
  maxReps: number;
}

export interface ExerciseVerdict {
  exerciseId: number;
  exerciseName: string;
  targetRange: ParsedTarget | null;
  workingSets: {
    setNumber: number;
    weightKg: number;
    reps: number;
    rir: number | null;
  }[];
  result: 'below' | 'within' | 'top' | 'no_target';
  verdict: 'hold' | 'increase' | 'review_fatigue' | 'check_logging';
  nextLoadSuggestion: string | null;
  flags: string[];
  confidence: 'low' | 'medium' | 'high';
}

export function parseTargetString(target: string | null | undefined): ParsedTarget | null {
  if (!target) return null;

  const cleaned = target.replace(/\s+/g, '').toLowerCase();

  // Match set x rep-range at the start of the string, allowing trailing annotations.
  // Examples: 3x8-12, 3x8-12pause, 3x8-12tempo
  const rangeMatch = cleaned.match(/^(\d+)x(\d+)-(\d+)/);
  if (rangeMatch) {
    return {
      sets: parseInt(rangeMatch[1], 10),
      minReps: parseInt(rangeMatch[2], 10),
      maxReps: parseInt(rangeMatch[3], 10),
    };
  }

  // Match set x single reps at the start of the string, allowing trailing annotations.
  // Examples: 3x10, 3x10pause
  const singleMatch = cleaned.match(/^(\d+)x(\d+)/);
  if (singleMatch) {
    return {
      sets: parseInt(singleMatch[1], 10),
      minReps: parseInt(singleMatch[2], 10),
      maxReps: parseInt(singleMatch[2], 10),
    };
  }

  return null;
}

export function generateExerciseVerdict(
  exerciseId: number,
  exerciseName: string,
  targetStr: string | null | undefined,
  sets: SummarySet[],
  t: TFunction
): ExerciseVerdict {
  const workingSets = sets
    .filter(s => !s.isWarmup && s.deletedAt == null)
    .sort((a, b) => a.setNumber - b.setNumber);

  const target = parseTargetString(targetStr);

  const flags: string[] = [];
  let result: 'below' | 'within' | 'top' | 'no_target' = 'no_target';
  let verdict: 'hold' | 'increase' | 'review_fatigue' | 'check_logging' = 'hold';
  let confidence: 'low' | 'medium' | 'high' = 'low';
  let nextLoadSuggestion: string | null = null;

  // 1. Anomaly flag checks
  // A. Suspicious RIR inversion / inconsistency
  let hasRirInversion = false;
  for (let i = 0; i < workingSets.length - 1; i++) {
    const s1 = workingSets[i];
    const s2 = workingSets[i + 1];
    if (s1.rir !== null && s2.rir !== null) {
      if (s2.weightKg >= s1.weightKg && s2.reps >= s1.reps && s2.rir > s1.rir) {
        hasRirInversion = true;
      }
    }
  }
  if (hasRirInversion) {
    flags.push('rir_inversion');
  }

  // B. Abrupt rep drop between same-weight working sets (drop >= 3 reps)
  let hasAbruptRepDrop = false;
  for (let i = 0; i < workingSets.length - 1; i++) {
    const s1 = workingSets[i];
    const s2 = workingSets[i + 1];
    if (s1.weightKg === s2.weightKg && s1.reps - s2.reps >= 3) {
      hasAbruptRepDrop = true;
    }
  }
  if (hasAbruptRepDrop) {
    flags.push('abrupt_rep_drop');
  }

  // C. Extra working sets beyond planned target sets
  if (target && workingSets.length > target.sets) {
    flags.push('extra_sets');
  }

  // D. Repeated below-range working sets (>= 2 sets below minimum reps)
  let hasRepeatedBelowRange = false;
  if (target) {
    const belowRangeCount = workingSets.filter(s => s.reps < target.minReps).length;
    if (belowRangeCount >= 2) {
      hasRepeatedBelowRange = true;
      flags.push('repeated_below_range');
    }
  }

  // 2. Result Classification & Verdict rules
  if (!target) {
    result = 'no_target';
    verdict = 'hold';
    confidence = 'low';
    nextLoadSuggestion = null;
  } else {
    // Determine result
    if (workingSets.length < target.sets) {
      result = 'below';
    } else {
      const plannedSets = workingSets.slice(0, target.sets);
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

    // Determine verdict
    if (hasRirInversion) {
      verdict = 'check_logging';
    } else if (hasRepeatedBelowRange || hasAbruptRepDrop) {
      verdict = 'review_fatigue';
    } else if (result === 'top') {
      verdict = 'increase';
    } else {
      verdict = 'hold';
    }

    // Determine confidence
    if (workingSets.length === 0) {
      confidence = 'low';
    } else if (workingSets.length < target.sets || flags.length > 0) {
      confidence = 'medium';
    } else {
      confidence = 'high';
    }

    // Suggest next-load suggestion
    if (verdict === 'increase') {
      const weights = workingSets.map(s => s.weightKg);
      const uniqueWeights = Array.from(new Set(weights));
      const hasSingleWorkingWeight = uniqueWeights.length === 1 && uniqueWeights[0] > 0;
      
      if (hasSingleWorkingWeight) {
        const nextWeight = uniqueWeights[0] + 2.5;
        nextLoadSuggestion = t('summary.verdicts.suggestIncreaseNumeric', { weight: nextWeight });
      } else {
        nextLoadSuggestion = t('summary.verdicts.suggestIncreaseGeneric');
      }
    } else if (verdict === 'hold') {
      nextLoadSuggestion = t('summary.verdicts.suggestHold');
    } else if (verdict === 'review_fatigue') {
      nextLoadSuggestion = t('summary.verdicts.suggestReviewFatigue');
    } else if (verdict === 'check_logging') {
      nextLoadSuggestion = t('summary.verdicts.suggestCheckLogging');
    }
  }

  return {
    exerciseId,
    exerciseName,
    targetRange: target,
    workingSets: workingSets.map(s => ({
      setNumber: s.setNumber,
      weightKg: s.weightKg,
      reps: s.reps,
      rir: s.rir,
    })),
    result,
    verdict,
    nextLoadSuggestion,
    flags,
    confidence,
  };
}

export function generateSessionVerdicts(
  setsData: SummarySet[],
  targetsMap: Map<number, string>,
  t: TFunction
): ExerciseVerdict[] {
  // Group sets by exerciseId
  const exerciseSetsMap = new Map<number, SummarySet[]>();
  setsData.forEach(set => {
    if (!exerciseSetsMap.has(set.exerciseId)) {
      exerciseSetsMap.set(set.exerciseId, []);
    }
    exerciseSetsMap.get(set.exerciseId)!.push(set);
  });

  const verdicts: ExerciseVerdict[] = [];

  exerciseSetsMap.forEach((sets, exerciseId) => {
    const firstSet = sets[0];
    const exerciseName = firstSet?.exerciseName || `${t('common.exercise')} ${exerciseId}`;
    const targetStr = targetsMap.get(exerciseId) || null;
    const verdict = generateExerciseVerdict(exerciseId, exerciseName, targetStr, sets, t);

    if (verdict.workingSets.length > 0) {
      verdicts.push(verdict);
    }
  });

  return verdicts;
}

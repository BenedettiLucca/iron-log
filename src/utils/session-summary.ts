import { generateSessionVerdicts } from './session-verdicts';

type TFunction = (key: string, vars?: Record<string, string | number>) => string;

export interface SummarySet {
  exerciseId: number;
  exerciseName: string | null;
  setNumber: number;
  weightKg: number;
  reps: number;
  durationSeconds: number | null;
  rir: number | null;
  deletedAt?: number | null;
  isWarmup: boolean;
}

export interface SummarySession {
  routineId: number | null;
  routineName: string | null;
  startTime: number;
  bodyWeight: number | null;
  sRpe: number | null;
  notes: string | null;
  durationMinutes: number | null;
}

interface ExerciseSummary {
  name: string;
  sets: SummarySet[];
  exId: number;
  target?: string;
}

export interface SessionStats {
  totalSets: number;
  totalVolume: number;
  bestSet: { weight: number; reps: number; exercise: string } | null;
  averageIntensity: number;
}

export interface BuildSessionSummaryInput {
  session: SummarySession;
  setsData: SummarySet[];
  targetsMap: Map<number, string>;
  t: TFunction;
  locale: string;
}

export interface BuildSessionSummaryResult {
  report: string;
  stats: SessionStats;
}

export function buildSessionSummary({
  session,
  setsData,
  targetsMap,
  t,
  locale,
}: BuildSessionSummaryInput): BuildSessionSummaryResult {
  const activeSets = setsData.filter(set => set.deletedAt == null);
  const workingSets = activeSets.filter(set => !set.isWarmup);
  const exercisesMap = new Map<string, ExerciseSummary>();

  activeSets.forEach(set => {
    const exName = set.exerciseName || `${t('common.exercise')} ${set.exerciseId}`;
    if (!exercisesMap.has(exName)) {
      exercisesMap.set(exName, { sets: [], exId: set.exerciseId, name: exName });
    }
    exercisesMap.get(exName)!.sets.push(set);
  });

  exercisesMap.forEach((data) => {
    const target = targetsMap.get(data.exId);
    if (target) data.target = target;
  });

  let totalVolume = 0;
  let maxVolume = 0;
  let bestSet: SessionStats['bestSet'] = null;

  workingSets.forEach(set => {
    if (set.reps && set.weightKg) {
      const volume = set.reps * set.weightKg;
      totalVolume += volume;

      if (volume > maxVolume) {
        maxVolume = volume;
        bestSet = {
          weight: set.weightKg,
          reps: set.reps,
          exercise: set.exerciseName || t('reports.md.unknown'),
        };
      }
    }
  });

  const stats: SessionStats = {
    totalSets: workingSets.length,
    totalVolume,
    bestSet,
    averageIntensity: workingSets.length > 0 ? totalVolume / workingSets.length : 0,
  };

  const dateObj = new Date(session.startTime);
  const dateStr = dateObj.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  let report = `💪 ${t('summary.workoutReport', { name: session.routineName || 'Iron Log' })} - [${dateStr}]\n\n`;
  report += `⚖️ ${t('summary.reportWeight')}: ${session.bodyWeight || 'N/A'} kg | ⏱️ ${t('summary.reportDuration')}: ${session.durationMinutes} min | 🔥 ${t('summary.reportSrpe')}: ${session.sRpe}\n\n`;

  exercisesMap.forEach((data) => {
    const { sets: setsList, target } = data;
    setsList.sort((a, b) => a.setNumber - b.setNumber);

    const setsStr = setsList.map(s => {
      let coreStr = '';
      if (s.durationSeconds) {
        coreStr = `${s.durationSeconds}s`;
        if (s.weightKg > 0) coreStr += `x${s.weightKg}kg`;
      } else {
        coreStr = `${s.reps}x${s.weightKg}kg`;
      }
      return `S${s.setNumber}: ${coreStr}${s.rir !== null ? `xRIR${s.rir}` : ''}`;
    }).join(' | ');

    const header = target ? `[${data.name}] (${t('summary.reportTarget')}: ${target})` : `[${data.name}]`;
    report += `${header}: ${setsStr}\n`;
  });

  if (session.notes) {
    report += `\n📝 ${t('summary.reportObservations')}: ${session.notes}`;
  }

  const verdicts = generateSessionVerdicts(setsData, targetsMap, t);
  if (verdicts.length > 0) {
    report += `\n\n## ${t('summary.verdicts.title')}\n`;
    verdicts.forEach(v => {
      let verdictKey = '';
      if (v.verdict === 'increase') verdictKey = 'summary.verdicts.verdictIncrease';
      else if (v.verdict === 'hold') verdictKey = 'summary.verdicts.verdictHold';
      else if (v.verdict === 'review_fatigue') verdictKey = 'summary.verdicts.verdictReviewFatigue';
      else if (v.verdict === 'check_logging') verdictKey = 'summary.verdicts.verdictCheckLogging';

      let resultKey = '';
      if (v.result === 'top') resultKey = 'summary.verdicts.resultTop';
      else if (v.result === 'within') resultKey = 'summary.verdicts.resultWithin';
      else if (v.result === 'below') resultKey = 'summary.verdicts.resultBelow';
      else if (v.result === 'no_target') resultKey = 'summary.verdicts.resultNoTarget';

      const verdictStr = verdictKey ? t(verdictKey) : v.verdict;
      const resultStr = resultKey ? t(resultKey) : v.result;
      const showVerdict = v.result !== 'no_target';

      report += `- [${v.exerciseName}] ${t('summary.verdicts.result')}: ${resultStr}`;
      if (showVerdict) {
        report += ` | ${t('summary.verdicts.verdict')}: ${verdictStr}`;
      }
      if (showVerdict && v.nextLoadSuggestion) {
        report += ` | ${t('summary.verdicts.nextLoad')}: ${v.nextLoadSuggestion}`;
      }
      if (v.flags.length > 0) {
        const flagLabels = v.flags.map((flag) => {
          if (flag === 'rir_inversion') return t('summary.verdicts.flagRirInversion');
          if (flag === 'abrupt_rep_drop') return t('summary.verdicts.flagAbruptRepDrop');
          if (flag === 'extra_sets') return t('summary.verdicts.flagExtraSets');
          if (flag === 'repeated_below_range') return t('summary.verdicts.flagRepeatedBelowRange');
          return flag;
        }).join(', ');

        report += ` | ${t('summary.verdicts.flags')}: ${flagLabels}`;
      }
      report += '\n';
    });
    report = report.trimEnd();
  }

  return { report, stats };
}

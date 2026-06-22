import type { ExerciseVerdict } from './session-verdicts';

type TFunction = (key: string, vars?: Record<string, string | number>) => string;

export function buildSessionVerdictsMarkdown(verdicts: ExerciseVerdict[], t: TFunction): string {
  if (verdicts.length === 0) return '';

  let md = `## ${t('summary.verdicts.title')}\n\n`;

  for (const v of verdicts) {
    let resultKey = '';
    if (v.result === 'top') resultKey = 'summary.verdicts.resultTop';
    else if (v.result === 'within') resultKey = 'summary.verdicts.resultWithin';
    else if (v.result === 'below') resultKey = 'summary.verdicts.resultBelow';
    else if (v.result === 'no_target') resultKey = 'summary.verdicts.resultNoTarget';
    const resultStr = resultKey ? t(resultKey) : v.result;

    let line = `- **${v.exerciseName}** — ${t('summary.verdicts.result')}: ${resultStr}`;

    if (v.result !== 'no_target') {
      let verdictKey = '';
      if (v.verdict === 'increase') verdictKey = 'summary.verdicts.verdictIncrease';
      else if (v.verdict === 'hold') verdictKey = 'summary.verdicts.verdictHold';
      else if (v.verdict === 'review_fatigue') verdictKey = 'summary.verdicts.verdictReviewFatigue';
      else if (v.verdict === 'check_logging') verdictKey = 'summary.verdicts.verdictCheckLogging';
      const verdictStr = verdictKey ? t(verdictKey) : v.verdict;

      line += ` | ${t('summary.verdicts.verdict')}: ${verdictStr}`;

      if (v.nextLoadSuggestion) {
        line += ` | ${t('summary.verdicts.nextLoad')}: ${v.nextLoadSuggestion}`;
      }
    }

    if (v.flags.length > 0) {
      const flagLabels = v.flags.map((flag) => {
        if (flag === 'rir_inversion') return t('summary.verdicts.flagRirInversion');
        if (flag === 'abrupt_rep_drop') return t('summary.verdicts.flagAbruptRepDrop');
        if (flag === 'extra_sets') return t('summary.verdicts.flagExtraSets');
        if (flag === 'repeated_below_range') return t('summary.verdicts.flagRepeatedBelowRange');
        return flag;
      });
      line += ` | ${t('summary.verdicts.flags')}: ${flagLabels.join(', ')}`;
    }

    md += `${line}\n`;
  }

  return `${md}\n`;
}

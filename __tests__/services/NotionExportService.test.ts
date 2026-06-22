import { buildSessionVerdictsMarkdown } from '@/src/utils/session-verdict-markdown';
import type { ExerciseVerdict } from '@/src/utils/session-verdicts';

const translations: Record<string, string> = {
  'summary.verdicts.title': 'Coaching Verdicts',
  'summary.verdicts.result': 'Result',
  'summary.verdicts.verdict': 'Verdict',
  'summary.verdicts.nextLoad': 'Next Load',
  'summary.verdicts.flags': 'Flags',
  'summary.verdicts.resultTop': 'Top of range',
  'summary.verdicts.resultWithin': 'Within range',
  'summary.verdicts.resultBelow': 'Below range',
  'summary.verdicts.resultNoTarget': 'No target',
  'summary.verdicts.verdictIncrease': 'Increase load',
  'summary.verdicts.verdictHold': 'Hold load',
  'summary.verdicts.verdictReviewFatigue': 'Review fatigue',
  'summary.verdicts.verdictCheckLogging': 'Check logging',
  'summary.verdicts.flagRirInversion': 'Suspicious RIR inconsistency',
  'summary.verdicts.flagAbruptRepDrop': 'Abrupt rep drop between sets',
  'summary.verdicts.flagExtraSets': 'Extra sets beyond target',
  'summary.verdicts.flagRepeatedBelowRange': 'Repeated below-range sets',
};

const t = (key: string) => translations[key] ?? key;

describe('buildSessionVerdictsMarkdown', () => {
  it('includes verdict details and flags for rep-range exercises', () => {
    const verdicts: ExerciseVerdict[] = [
      {
        exerciseId: 1,
        exerciseName: 'Bench Press',
        targetRange: { sets: 3, minReps: 8, maxReps: 12 },
        workingSets: [],
        result: 'top',
        verdict: 'increase',
        nextLoadSuggestion: 'Next time try 102.5kg',
        flags: ['extra_sets'],
        confidence: 'high',
      },
    ];

    const md = buildSessionVerdictsMarkdown(verdicts, t);

    expect(md).toContain('## Coaching Verdicts');
    expect(md).toContain('- **Bench Press** — Result: Top of range | Verdict: Increase load | Next Load: Next time try 102.5kg | Flags: Extra sets beyond target');
  });

  it('shows no_target result without verdict guidance', () => {
    const verdicts: ExerciseVerdict[] = [
      {
        exerciseId: 2,
        exerciseName: 'Plank',
        targetRange: null,
        workingSets: [],
        result: 'no_target',
        verdict: 'hold',
        nextLoadSuggestion: null,
        flags: [],
        confidence: 'low',
      },
    ];

    const md = buildSessionVerdictsMarkdown(verdicts, t);

    expect(md).toContain('- **Plank** — Result: No target');
    expect(md).not.toContain('Verdict:');
    expect(md).not.toContain('Next Load:');
  });
});

import { buildSessionSummary } from '@/src/utils/session-summary';

const translations: Record<string, string> = {
  'common.exercise': 'Exercise',
  'summary.reportWeight': 'Weight',
  'summary.reportDuration': 'Duration',
  'summary.reportSrpe': 'sRPE',
  'summary.reportTarget': 'Target',
  'summary.reportObservations': 'Observations',
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
  'summary.verdicts.suggestIncreaseGeneric': 'Increase load next session',
  'summary.verdicts.suggestHold': 'Maintain current load',
  'summary.verdicts.suggestReviewFatigue': 'Lower load or rest more',
  'summary.verdicts.suggestCheckLogging': 'Verify logged sets details',
  'summary.verdicts.flagRirInversion': 'Suspicious RIR inconsistency',
  'summary.verdicts.flagAbruptRepDrop': 'Abrupt rep drop between sets',
  'summary.verdicts.flagExtraSets': 'Extra sets beyond target',
  'summary.verdicts.flagRepeatedBelowRange': 'Repeated below-range sets',
};

const t = (key: string, vars?: Record<string, string | number>) => {
  if (key === 'summary.workoutReport') return `WORKOUT ${vars?.name}`;
  if (key === 'summary.verdicts.suggestIncreaseNumeric') return `Next time try ${vars?.weight}kg`;
  return translations[key] ?? key;
};

const baseSession = {
  id: 1,
  routineId: 10,
  routineName: 'Upper A',
  startTime: new Date(2026, 4, 9, 15, 30).getTime(),
  endTime: new Date(2026, 4, 9, 16, 30).getTime(),
  bodyWeight: 92,
  sRpe: 8,
  notes: null,
  durationMinutes: 60,
  deletedAt: null,
};

describe('buildSessionSummary', () => {
  it('ignores soft-deleted sets in report and stats', () => {
    const { report, stats } = buildSessionSummary({
      session: baseSession,
      targetsMap: new Map([[101, '3x8']]),
      t,
      locale: 'en-US',
      setsData: [
        {
          exerciseId: 101,
          exerciseName: 'Bench Press',
          setNumber: 1,
          weightKg: 60,
          reps: 10,
          durationSeconds: null,
          rir: null,
          deletedAt: null,
          isWarmup: true,
        },
        {
          exerciseId: 101,
          exerciseName: 'Bench Press',
          setNumber: 2,
          weightKg: 100,
          reps: 5,
          durationSeconds: null,
          rir: 2,
          deletedAt: null,
          isWarmup: false,
        },
        {
          exerciseId: 101,
          exerciseName: 'Bench Press',
          setNumber: 3,
          weightKg: 200,
          reps: 10,
          durationSeconds: null,
          rir: 0,
          deletedAt: 999,
          isWarmup: false,
        },
      ],
    });

    expect(stats.totalSets).toBe(1); // Excludes warmup and deleted
    expect(stats.totalVolume).toBe(500); // Only working set 2: 5 * 100
    expect(stats.averageIntensity).toBe(500);
    expect(stats.bestSet).toEqual({ weight: 100, reps: 5, exercise: 'Bench Press' });

    expect(report).toContain('WORKOUT Upper A');
    expect(report).toContain('Weight: 92 kg');
    expect(report).toContain('S1: 10x60kg'); // Warmup IS in report
    expect(report).toContain('S2: 5x100kgxRIR2');
    expect(report).not.toContain('S3: 10x200kg');
    expect(report).not.toContain('xRIR0');
  });

  it('includes coaching verdict block in the generated summary report', () => {
    const { report } = buildSessionSummary({
      session: baseSession,
      targetsMap: new Map([[101, '3x8-12']]),
      t,
      locale: 'en-US',
      setsData: [
        {
          exerciseId: 101,
          exerciseName: 'Bench Press',
          setNumber: 1,
          weightKg: 100,
          reps: 12,
          durationSeconds: null,
          rir: null,
          deletedAt: null,
          isWarmup: false,
        },
        {
          exerciseId: 101,
          exerciseName: 'Bench Press',
          setNumber: 2,
          weightKg: 100,
          reps: 12,
          durationSeconds: null,
          rir: null,
          deletedAt: null,
          isWarmup: false,
        },
        {
          exerciseId: 101,
          exerciseName: 'Bench Press',
          setNumber: 3,
          weightKg: 100,
          reps: 12,
          durationSeconds: null,
          rir: null,
          deletedAt: null,
          isWarmup: false,
        },
      ],
    });

    expect(report).toContain('## Coaching Verdicts');
    expect(report).toContain('- [Bench Press] Result: Top of range | Verdict: Increase load | Next Load: Next time try 102.5kg');
  });

  it('includes anomaly flags and hides verdict guidance when no rep-range target exists', () => {
    const { report } = buildSessionSummary({
      session: baseSession,
      targetsMap: new Map([[101, '60s'], [202, '3x5-8']]),
      t,
      locale: 'en-US',
      setsData: [
        {
          exerciseId: 101,
          exerciseName: 'Plank',
          setNumber: 1,
          weightKg: 0,
          reps: 1,
          durationSeconds: 60,
          rir: null,
          deletedAt: null,
          isWarmup: false,
        },
        {
          exerciseId: 202,
          exerciseName: 'Bench Press',
          setNumber: 1,
          weightKg: 100,
          reps: 8,
          durationSeconds: null,
          rir: 1,
          deletedAt: null,
          isWarmup: false,
        },
        {
          exerciseId: 202,
          exerciseName: 'Bench Press',
          setNumber: 2,
          weightKg: 100,
          reps: 8,
          durationSeconds: null,
          rir: 3,
          deletedAt: null,
          isWarmup: false,
        },
      ],
    });

    expect(report).toContain('- [Plank] Result: No target');
    expect(report).not.toContain('- [Plank] Result: No target | Verdict:');
    expect(report).toContain('Flags: Suspicious RIR inconsistency');
  });
});

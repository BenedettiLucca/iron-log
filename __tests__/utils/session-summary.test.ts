import { buildSessionSummary } from '@/src/utils/session-summary';

const t = (key: string, vars?: Record<string, string | number>) => {
  if (key === 'common.exercise') return 'Exercise';
  if (key === 'summary.workoutReport') return `WORKOUT ${vars?.name}`;
  if (key === 'summary.reportWeight') return 'Weight';
  if (key === 'summary.reportDuration') return 'Duration';
  if (key === 'summary.reportSrpe') return 'sRPE';
  if (key === 'summary.reportTarget') return 'Target';
  return key;
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
          weightKg: 100,
          reps: 5,
          durationSeconds: null,
          rir: 2,
          deletedAt: null,
        },
        {
          exerciseId: 101,
          exerciseName: 'Bench Press',
          setNumber: 2,
          weightKg: 200,
          reps: 10,
          durationSeconds: null,
          rir: 0,
          deletedAt: 999,
        },
      ],
    });

    expect(stats.totalSets).toBe(1);
    expect(stats.totalVolume).toBe(500);
    expect(stats.averageIntensity).toBe(500);
    expect(stats.bestSet).toEqual({ weight: 100, reps: 5, exercise: 'Bench Press' });

    expect(report).toContain('WORKOUT Upper A');
    expect(report).toContain('Weight: 92 kg');
    expect(report).toContain('[Bench Press] (Target: 3x8): S1: 5x100kgxRIR2');
    expect(report).not.toContain('S2: 10x200kg');
    expect(report).not.toContain('xRIR0');
  });
});

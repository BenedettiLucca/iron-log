import { buildSessionSummary } from '@/src/utils/session-summary';

const t = (key: string) => key === 'common.exercise' ? 'Exercise' : key;

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
      setsData: [
        {
          id: 1,
          sessionId: 1,
          exerciseId: 101,
          exerciseName: 'Bench Press',
          setNumber: 1,
          weightKg: 100,
          reps: 5,
          durationSeconds: null,
          rir: 2,
          isWarmup: false,
          isEdited: false,
          createdAt: 1,
          deletedAt: null,
        },
        {
          id: 2,
          sessionId: 1,
          exerciseId: 101,
          exerciseName: 'Bench Press',
          setNumber: 2,
          weightKg: 200,
          reps: 10,
          durationSeconds: null,
          rir: 0,
          isWarmup: false,
          isEdited: false,
          createdAt: 2,
          deletedAt: 999,
        },
      ],
    });

    expect(stats.totalSets).toBe(1);
    expect(stats.totalVolume).toBe(500);
    expect(stats.averageIntensity).toBe(500);
    expect(stats.bestSet).toEqual({ weight: 100, reps: 5, exercise: 'Bench Press' });

    expect(report).toContain('[Bench Press] (Meta: 3x8): S1: 5x100kgxRIR2');
    expect(report).not.toContain('S2: 10x200kg');
    expect(report).not.toContain('xRIR0');
  });
});

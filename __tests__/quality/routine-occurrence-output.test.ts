import fs from 'fs';
import path from 'path';
import { buildSessionSummary } from '@/src/utils/session-summary';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const t = (key: string, vars?: Record<string, string | number>) => {
  if (key === 'summary.workoutReport') return `WORKOUT ${vars?.name}`;
  if (key === 'summary.reportTarget') return 'Target';
  if (key === 'common.exercise') return 'Exercise';
  return key;
};

describe('routine occurrence summary/export contract', () => {
  it('keeps A/B/A sets and targets separate in the generated session summary', () => {
    const { report } = buildSessionSummary({
      session: {
        routineId: 1,
        routineName: 'A/B/A',
        startTime: 1_700_000_000_000,
        bodyWeight: null,
        sRpe: null,
        notes: null,
        durationMinutes: 30,
      },
      targetsMap: new Map([
        ['routine:101', '1x5'],
        ['routine:103', '1x10'],
      ]),
      t,
      locale: 'en-US',
      setsData: [
        {
          exerciseId: 7,
          routineExerciseId: 101,
          exerciseName: 'Supino',
          setNumber: 1,
          weightKg: 100,
          reps: 5,
          durationSeconds: null,
          rir: 2,
          deletedAt: null,
          isWarmup: false,
        },
        {
          exerciseId: 7,
          routineExerciseId: 103,
          exerciseName: 'Supino',
          setNumber: 1,
          weightKg: 70,
          reps: 10,
          durationSeconds: null,
          rir: 2,
          deletedAt: null,
          isWarmup: false,
        },
      ],
    });

    expect(report).toContain('[Supino] (Target: 1x5): S1: 5x100kgxRIR2');
    expect(report).toContain('[Supino] (Target: 1x10): S1: 10x70kgxRIR2');
  });

  it('loads target identity and groups exports by routine occurrence', () => {
    const finish = read('app/session/finish.tsx');
    const summaryScreen = read('app/session/summary.tsx');
    const notion = read('services/NotionExportService.ts');
    const verdicts = read('src/utils/session-verdicts.ts');

    expect(finish).toMatch(/routineExerciseId:\s*routineExercises\.id/);
    expect(summaryScreen).toMatch(/routineExerciseId:\s*routineExercises\.id/);
    expect(notion).toMatch(/routineExerciseId:\s*routineExercises\.id/);
    expect(notion).toContain('getRoutineOccurrenceKey');
    expect(verdicts).toContain('getRoutineOccurrenceKey');
    expect(summaryScreen).not.toContain('key={v.exerciseId}');
  });
});

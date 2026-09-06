import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { db, sqlite } from '../fixtures/database';
import { AnalyticsService } from '@/services/AnalyticsService';
import { CsvExportService } from '@/services/CsvExportService';
import { exercises, sessions, sets } from '@/src/db/schema';
import { eq } from 'drizzle-orm';

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

const since = Date.UTC(2026, 0, 5);
const week = 7 * 86400000;

beforeEach(() => {
  sqlite.exec('DELETE FROM sets; DELETE FROM sessions; DELETE FROM exercises; DELETE FROM sqlite_sequence;');
});
afterAll(() => sqlite.close());

function seed(sessionCount: number, setsPerSession: number) {
  let exercise = db.select().from(exercises).where(eq(exercises.id, 1)).get();
  if (!exercise) {
    db.insert(exercises).values({ id: 1, name: 'Synthetic Exercise', type: 'strength', defaultRestSeconds: 90 }).run();
    exercise = db.select().from(exercises).where(eq(exercises.id, 1)).get()!;
  }
  db.transaction(tx => {
    for (let i = 1; i <= sessionCount; i++) {
      tx.insert(sessions).values({ id: i, routineName: 'Synthetic', startTime: since + i * 1000, endTime: since + i * 1000 + 60000 }).run();
      for (let j = 0; j < setsPerSession; j++) {
        tx.insert(sets).values({ sessionId: i, exerciseId: exercise.id, exerciseName: exercise.name,
          setNumber: j + 1, weightKg: 20 + j, reps: 10, isWarmup: j === 0 }).run();
      }
    }
  });
}

it('preserves empty weeks/sessions, excludes warmups and soft-deleted rows, and exports the same persisted sets', async () => {
  seed(3, 3);
  // Session 2 contains only a warmup; session 3 is deleted. Session 4 has no sets.
  db.update(sets).set({ deletedAt: since }).where(eq(sets.id, 2)).run();
  db.update(sets).set({ isWarmup: true }).where(eq(sets.sessionId, 2)).run();
  db.update(sessions).set({ deletedAt: since }).where(eq(sessions.id, 3)).run();
  db.insert(sessions).values({ id: 4, startTime: since + week, endTime: since + week + 60000 }).run();
  const trends = await AnalyticsService.calculateVolumeTrends(since);
  expect(trends).toHaveLength(13);
  expect(trends[0]).toEqual({ week: '2026-W02', totalVolume: 220, totalSets: 1, sessionCount: 2, avgVolumePerSession: 110 });
  expect(trends[1]).toEqual({ week: '2026-W03', totalVolume: 0, totalSets: 0, sessionCount: 1, avgVolumePerSession: 0 });
  expect(trends[2].sessionCount).toBe(0);
  const csv = await CsvExportService.exportSessionsCsv();
  expect(csv).toContain('Synthetic');
  expect(sqlite.pragma('foreign_key_check')).toEqual([]);
});

it('computes Strength Score through the real service/SQL instead of copied test formulas', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(since + week);
  try {
    expect((await AnalyticsService.calculateStrengthScore(since)).labelKey).toBe('noData');
    seed(2, 2);
    expect(await AnalyticsService.calculateStrengthScore(since)).toEqual({
      totalScore: 27, volumeScore: 2, intensityScore: 10, consistencyScore: 15, labelKey: 'beginner',
    });
  } finally {
    jest.restoreAllMocks();
  }
});

it('aggregates volume by muscle group and sorts descending, ignoring warmups, deleted sets, and unknown groups', async () => {
  db.insert(exercises).values([
    { id: 10, name: 'Supino Reto', type: 'strength', muscleGroup: 'peito' },
    { id: 20, name: 'Remada Curvada', type: 'strength', muscleGroup: 'costas' },
    { id: 30, name: 'Exercício Desconhecido', type: 'strength', muscleGroup: null },
  ]).run();

  db.insert(sessions).values({ id: 1, routineName: 'Treino A', startTime: since + 1000, endTime: since + 61000 }).run();

  db.insert(sets).values([
    // Peito: 80kg x 10 = 800, 80kg x 10 = 800 (Total = 1600)
    { sessionId: 1, exerciseId: 10, exerciseName: 'Supino Reto', setNumber: 1, weightKg: 80, reps: 10, isWarmup: false, createdAt: since + 1000 },
    { sessionId: 1, exerciseId: 10, exerciseName: 'Supino Reto', setNumber: 2, weightKg: 80, reps: 10, isWarmup: false, createdAt: since + 2000 },
    // Peito warmup: should be ignored
    { sessionId: 1, exerciseId: 10, exerciseName: 'Supino Reto', setNumber: 3, weightKg: 40, reps: 10, isWarmup: true, createdAt: since + 3000 },
    // Peito deleted: should be ignored
    { sessionId: 1, exerciseId: 10, exerciseName: 'Supino Reto', setNumber: 4, weightKg: 80, reps: 10, isWarmup: false, deletedAt: since + 4000, createdAt: since + 4000 },
    // Costas: 100kg x 10 = 1000, 110kg x 10 = 1100 (Total = 2100)
    { sessionId: 1, exerciseId: 20, exerciseName: 'Remada Curvada', setNumber: 1, weightKg: 100, reps: 10, isWarmup: false, createdAt: since + 5000 },
    { sessionId: 1, exerciseId: 20, exerciseName: 'Remada Curvada', setNumber: 2, weightKg: 110, reps: 10, isWarmup: false, createdAt: since + 6000 },
    // Desconhecido: should be ignored (no muscle group)
    { sessionId: 1, exerciseId: 30, exerciseName: 'Exercício Desconhecido', setNumber: 1, weightKg: 50, reps: 10, isWarmup: false, createdAt: since + 7000 },
  ]).run();

  const volumeMap = await AnalyticsService.volumeByMuscleGroup(since);

  expect(volumeMap).toEqual({
    costas: 2100,
    peito: 1600,
  });

  // Verify sort order descending
  expect(Object.keys(volumeMap)).toEqual(['costas', 'peito']);
});

// Opt-in timing, same real service + SQL as the correctness tests. Never assert noisy wall times in CI.
(process.env.IRON_LOG_BENCH ? it : it.skip)('benchmarks weekly volume aggregation', async () => {
  for (const sessionCount of [50, 500]) {
    sqlite.exec('DELETE FROM sets; DELETE FROM sessions;');
    seed(sessionCount, 20);
    for (let i = 0; i < 3; i++) await AnalyticsService.calculateVolumeTrends(since);
    const timings: number[] = [];
    let result;
    for (let i = 0; i < 25; i++) {
      const start = performance.now();
      result = await AnalyticsService.calculateVolumeTrends(since);
      timings.push(performance.now() - start);
    }
    timings.sort((a, b) => a - b);
    process.stdout.write(JSON.stringify({ benchmark: 'volume-trends', sessionCount, setCount: sessionCount * 20,
      samples: timings.length, medianMs: timings[12], p95Ms: timings[23],
      resultSha256: createHash('sha256').update(JSON.stringify(result)).digest('hex'),
    }) + '\n');
  }
});

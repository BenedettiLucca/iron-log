import { performance } from 'node:perf_hooks';
import { createHash } from 'node:crypto';
import { db, sqlite } from '../fixtures/database';
import { AnalyticsService } from '@/services/AnalyticsService';
import { CsvExportService } from '@/services/CsvExportService';
import { exercises, sessions, sets, programExerciseTargets, programs } from '@/src/db/schema';
import { getDoubleProgressionStatus } from '@/services/progression';
import { eq } from 'drizzle-orm';

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

const since = Date.UTC(2026, 0, 5);
const week = 7 * 86400000;

beforeEach(() => {
  sqlite.exec('DELETE FROM program_exercise_targets; DELETE FROM programs; DELETE FROM sets; DELETE FROM sessions; DELETE FROM exercises; DELETE FROM sqlite_sequence;');
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

it('aggregates volume by muscle group: maps null group to outros, explicitly stored group prevails over name, and excludes warmups/deleted sets/deleted sessions/open sessions', async () => {
  db.insert(exercises).values([
    { id: 10, name: 'Supino Reto', type: 'strength', muscleGroup: 'peito' },
    { id: 20, name: 'Remada Curvada', type: 'strength', muscleGroup: 'costas' },
    { id: 30, name: 'Exercício Desconhecido', type: 'strength', muscleGroup: null },
    // Conflicting fixture: name suggests peito, but stored muscleGroup is costas (explicit column prevails)
    { id: 40, name: 'Supino Inclinado Fechado', type: 'strength', muscleGroup: 'costas' },
    // Name suggests costas, but null group -> must go to outros, never inferred by name
    { id: 50, name: 'Puxada Frente Aberta', type: 'strength', muscleGroup: null },
  ]).run();

  db.insert(sessions).values([
    { id: 1, routineName: 'Treino A', startTime: since + 1000, endTime: since + 61000 },
    // Deleted session (should be completely excluded)
    { id: 2, routineName: 'Treino Deletado', startTime: since + 2000, endTime: since + 62000, deletedAt: since + 63000 },
    // Open session (endTime null, should be completely excluded from historical analytics C1)
    { id: 3, routineName: 'Treino Aberto', startTime: since + 3000, endTime: null },
  ]).run();

  db.insert(sets).values([
    // Peito: 80kg x 10 = 800, 80kg x 10 = 800 (Total = 1600)
    { sessionId: 1, exerciseId: 10, exerciseName: 'Supino Reto', setNumber: 1, weightKg: 80, reps: 10, isWarmup: false, createdAt: since + 1000 },
    { sessionId: 1, exerciseId: 10, exerciseName: 'Supino Reto', setNumber: 2, weightKg: 80, reps: 10, isWarmup: false, createdAt: since + 2000 },
    // Peito warmup: should be ignored
    { sessionId: 1, exerciseId: 10, exerciseName: 'Supino Reto', setNumber: 3, weightKg: 40, reps: 10, isWarmup: true, createdAt: since + 3000 },
    // Peito deleted: should be ignored
    { sessionId: 1, exerciseId: 10, exerciseName: 'Supino Reto', setNumber: 4, weightKg: 80, reps: 10, isWarmup: false, deletedAt: since + 4000, createdAt: since + 4000 },
    // Costas (Remada): 100kg x 10 = 1000, 110kg x 10 = 1100
    { sessionId: 1, exerciseId: 20, exerciseName: 'Remada Curvada', setNumber: 1, weightKg: 100, reps: 10, isWarmup: false, createdAt: since + 5000 },
    { sessionId: 1, exerciseId: 20, exerciseName: 'Remada Curvada', setNumber: 2, weightKg: 110, reps: 10, isWarmup: false, createdAt: since + 6000 },
    // Costas (Supino Inclinado stored as costas): 90kg x 10 = 900 (Total costas = 1000 + 1100 + 900 = 3000)
    { sessionId: 1, exerciseId: 40, exerciseName: 'Supino Inclinado Fechado', setNumber: 1, weightKg: 90, reps: 10, isWarmup: false, createdAt: since + 6500 },
    // Desconhecido (null group) with legacy createdAt null (fallback to sessions.startTime): 50kg x 10 = 500
    { sessionId: 1, exerciseId: 30, exerciseName: 'Exercício Desconhecido', setNumber: 1, weightKg: 50, reps: 10, isWarmup: false, createdAt: null },
    // Puxada (null group despite name): 60kg x 10 = 600 (Total outros = 500 + 600 = 1100)
    { sessionId: 1, exerciseId: 50, exerciseName: 'Puxada Frente Aberta', setNumber: 1, weightKg: 60, reps: 10, isWarmup: false, createdAt: since + 7000 },
    // Sets in deleted session (exercise 10): 200kg x 10 = 2000 (must NOT be counted)
    { sessionId: 2, exerciseId: 10, exerciseName: 'Supino Reto', setNumber: 1, weightKg: 200, reps: 10, isWarmup: false, createdAt: since + 8000 },
    // Sets in open session (exercise 20): 300kg x 10 = 3000 (must NOT be counted)
    { sessionId: 3, exerciseId: 20, exerciseName: 'Remada Curvada', setNumber: 1, weightKg: 300, reps: 10, isWarmup: false, createdAt: since + 9000 },
  ]).run();

  const volumeMap = await AnalyticsService.volumeByMuscleGroup(since);

  expect(volumeMap).toEqual({
    costas: 3000,
    peito: 1600,
    outros: 1100,
  });

  // Verify sort order descending
  expect(Object.keys(volumeMap)).toEqual(['costas', 'peito', 'outros']);
});

it('calculateEstimated1RMs excludes deleted sessions and open sessions, and falls back to session startTime for null createdAt', async () => {
  db.insert(exercises).values([
    { id: 1, name: 'Bench Press', type: 'strength' },
    { id: 2, name: 'Deadlift', type: 'strength' },
    { id: 3, name: 'Squat', type: 'strength' },
  ]).run();

  db.insert(sessions).values([
    // Finished valid session
    { id: 10, routineName: 'Valid Session', startTime: 1000, endTime: 2000 },
    // Soft-deleted session with heavier set
    { id: 20, routineName: 'Deleted Session', startTime: 3000, endTime: 4000, deletedAt: 5000 },
    // Open session (endTime null) with heavier set
    { id: 30, routineName: 'Open Session', startTime: 6000, endTime: null },
  ]).run();

  db.insert(sets).values([
    // Valid set in valid session with createdAt null (should take date from sessions.startTime = 1000)
    { sessionId: 10, exerciseId: 1, exerciseName: 'Bench Press', setNumber: 1, weightKg: 100, reps: 5, isWarmup: false, createdAt: null },
    // Warmup in valid session (must be excluded)
    { sessionId: 10, exerciseId: 1, exerciseName: 'Bench Press', setNumber: 2, weightKg: 120, reps: 5, isWarmup: true, createdAt: 1500 },
    // Deleted set in valid session (must be excluded)
    { sessionId: 10, exerciseId: 1, exerciseName: 'Bench Press', setNumber: 3, weightKg: 130, reps: 5, isWarmup: false, deletedAt: 1600, createdAt: 1500 },
    // Heavy set in deleted session (must be excluded)
    { sessionId: 20, exerciseId: 2, exerciseName: 'Deadlift', setNumber: 1, weightKg: 200, reps: 5, isWarmup: false, createdAt: 3500 },
    // Heavy set in open session (must be excluded)
    { sessionId: 30, exerciseId: 3, exerciseName: 'Squat', setNumber: 1, weightKg: 250, reps: 5, isWarmup: false, createdAt: 6500 },
  ]).run();

  const ranked = await AnalyticsService.calculateEstimated1RMs();

  // Only Bench Press from session 10 should be present
  expect(ranked).toHaveLength(1);
  expect(ranked[0].exerciseId).toBe(1);
  expect(ranked[0].exercise).toBe('Bench Press');
  expect(ranked[0].weightKg).toBe(100);
  expect(ranked[0].reps).toBe(5);
  // date should come from sessions.startTime (1000) because sets.createdAt was null
  expect(ranked[0].date).toBe(1000);
});

it('calculateTopExerciseProgressions excludes deleted and open sessions, falls back null createdAt to session startTime, and respects start-inclusive/end-exclusive boundaries', async () => {
  db.insert(exercises).values([
    { id: 1, name: 'Overhead Press', type: 'strength' },
    { id: 2, name: 'Squat', type: 'strength' },
  ]).run();

  const PREV_SINCE = since - (12 * 7 * 86400000);

  db.insert(sessions).values([
    // Prev period valid session (at PREV_SINCE, start-inclusive)
    { id: 100, routineName: 'Prev Period', startTime: PREV_SINCE, endTime: PREV_SINCE + 3600000 },
    // Recent period valid session (at since, start-inclusive)
    { id: 200, routineName: 'Recent Period', startTime: since, endTime: since + 3600000 },
    // Deleted session in recent period with huge weight
    { id: 300, routineName: 'Deleted Recent', startTime: since + 1000, endTime: since + 3600000, deletedAt: since + 2000 },
    // Open session in recent period with huge weight
    { id: 400, routineName: 'Open Recent', startTime: since + 2000, endTime: null },
  ]).run();

  db.insert(sets).values([
    // Prev period set: OHP 50kg, createdAt null (falls back to sessions.startTime = PREV_SINCE)
    { sessionId: 100, exerciseId: 1, exerciseName: 'Overhead Press', setNumber: 1, weightKg: 50, reps: 5, isWarmup: false, createdAt: null },
    // Recent period set: OHP 60kg, createdAt null (falls back to sessions.startTime = since)
    { sessionId: 200, exerciseId: 1, exerciseName: 'Overhead Press', setNumber: 1, weightKg: 60, reps: 5, isWarmup: false, createdAt: null },
    // Set in deleted session: OHP 100kg (must be excluded)
    { sessionId: 300, exerciseId: 1, exerciseName: 'Overhead Press', setNumber: 1, weightKg: 100, reps: 5, isWarmup: false, createdAt: since + 1000 },
    // Set in open session: Squat 200kg (must be excluded)
    { sessionId: 400, exerciseId: 2, exerciseName: 'Squat', setNumber: 1, weightKg: 200, reps: 5, isWarmup: false, createdAt: since + 2000 },
  ]).run();

  const progs = await AnalyticsService.calculateTopExerciseProgressions(since);

  expect(progs).toHaveLength(1);
  expect(progs[0].exerciseId).toBe(1);
  expect(progs[0].currentMaxWeight).toBe(60);
  expect(progs[0].previousMaxWeight).toBe(50);
  // (60 - 50) / 50 * 100 = 20%
  expect(progs[0].progress).toBe(20);
});

it('calculateVolumeTrends excludes open sessions and soft-deleted sessions', async () => {
  db.insert(sessions).values([
    { id: 10, routineName: 'Finished', startTime: since + 1000, endTime: since + 3600000 },
    { id: 20, routineName: 'Open', startTime: since + 2000, endTime: null },
    { id: 30, routineName: 'Deleted', startTime: since + 3000, endTime: since + 3600000, deletedAt: since + 4000 },
  ]).run();

  db.insert(exercises).values({ id: 1, name: 'Pushup', type: 'strength' }).run();

  db.insert(sets).values([
    { sessionId: 10, exerciseId: 1, exerciseName: 'Pushup', setNumber: 1, weightKg: 50, reps: 10, isWarmup: false },
    { sessionId: 20, exerciseId: 1, exerciseName: 'Pushup', setNumber: 1, weightKg: 500, reps: 10, isWarmup: false },
    { sessionId: 30, exerciseId: 1, exerciseName: 'Pushup', setNumber: 1, weightKg: 500, reps: 10, isWarmup: false },
  ]).run();

  const trends = await AnalyticsService.calculateVolumeTrends(since);
  // Only session 10 (50 * 10 = 500 volume) should be counted in week 0
  const activeWeeks = trends.filter(t => t.totalVolume > 0);
  expect(activeWeeks).toHaveLength(1);
  expect(activeWeeks[0].totalVolume).toBe(500);
  expect(activeWeeks[0].sessionCount).toBe(1);
});

it('getDoubleProgressionStatus excludes soft-deleted sessions and falls back null createdAt to session startTime', async () => {
  const programId = 1;
  const exerciseId = 99;

  db.insert(exercises).values({ id: exerciseId, name: 'Leg Press', type: 'strength' }).run();
  db.insert(programs).values({
    id: programId,
    name: 'Test Program',
    startDate: 0,
    endDate: 100000,
    weeksDuration: 4,
  }).run();
  db.insert(programExerciseTargets).values({
    id: 1,
    programId,
    exerciseId,
    targetRepsMin: 8,
    targetRepsMax: 12,
    targetSets: 1,
  }).run();

  db.insert(sessions).values([
    // Active session at t=1000
    { id: 1, startTime: 1000 },
    // Soft-deleted session at t=2000 (with higher weight)
    { id: 2, startTime: 2000, deletedAt: 3000 },
  ]).run();

  db.insert(sets).values([
    // Set in active session with null createdAt (falls back to session.startTime = 1000)
    { sessionId: 1, exerciseId, exerciseName: 'Leg Press', setNumber: 1, weightKg: 100, reps: 12, isWarmup: false, createdAt: null },
    // Set in deleted session with newer timestamp (must be excluded despite newer timestamp)
    { sessionId: 2, exerciseId, exerciseName: 'Leg Press', setNumber: 1, weightKg: 200, reps: 12, isWarmup: false, createdAt: 2000 },
  ]).run();

  const status = await getDoubleProgressionStatus(programId, exerciseId, 'Leg Press');
  expect(status).not.toBeNull();
  // Must use session 1, not deleted session 2
  expect(status!.lastPerformance).toEqual({ weight: 100, reps: 12, sets: 1 });
  expect(status!.isAtTop).toBe(true);
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

import { eq } from 'drizzle-orm';
import { db, sqlite } from '../fixtures/database';
import { programs, programWeeks, routines, sessions, sets, exercises } from '@/src/db/schema';
import {
  getCurrentWeek,
  getWeekCompletionMap,
  getWeeklyVolume,
  getAverageWeeklyVolume,
  getSessionsForWeek,
} from '@/services/program/dashboard';
import type { Program } from '@/src/types';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

function makeProgram(overrides: Partial<Program> = {}): Program {
  const now = Date.now();
  return {
    id: 1,
    name: 'Strength Program',
    description: 'Hypertrophy cycle',
    startDate: now,
    endDate: now + 6 * 7 * 86400000,
    weeksDuration: 6,
    deloadWeek: 6,
    goal: 'hypertrophy',
    isActive: true,
    createdAt: now,
    ...overrides,
  };
}

beforeEach(() => {
  sqlite.exec(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM sets;
    DELETE FROM sessions;
    DELETE FROM program_weeks;
    DELETE FROM programs;
    DELETE FROM routines; DELETE FROM exercises;
    DELETE FROM sqlite_sequence;
    PRAGMA foreign_keys = ON;
  `);
  db.insert(exercises).values({ id: 1, name: 'Bench Press', type: 'strength' }).run();
});

describe('Program Dashboard Service — Belonging, Volume & Week', () => {
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;

  describe('getCurrentWeek', () => {
    it('never returns 0 or negative before startDate', () => {
      const now = Date.now();
      const p = makeProgram({ startDate: now + 2 * msPerWeek, weeksDuration: 6 });
      expect(getCurrentWeek(p)).toBe(1);
    });

    it('clamps to range 1..weeksDuration', () => {
      const now = Date.now();
      const pFuture = makeProgram({ startDate: now + 10 * msPerWeek, weeksDuration: 4 });
      expect(getCurrentWeek(pFuture)).toBe(1);

      const pPast = makeProgram({ startDate: now - 20 * msPerWeek, weeksDuration: 4 });
      expect(getCurrentWeek(pPast)).toBe(4);
    });
  });

  describe('getWeekCompletionMap', () => {
    it('marks all weeks as future when program has not started yet', async () => {
      const now = Date.now();
      const p = makeProgram({ id: 10, startDate: now + msPerWeek, weeksDuration: 3 });
      await db.insert(programs).values(p);
      const r = await db.insert(routines).values({ name: 'Routine A' }).returning();
      await db.insert(programWeeks).values([
        { programId: 10, weekNumber: 1, routineId: r[0].id, phase: 'accumulation' },
        { programId: 10, weekNumber: 2, routineId: r[0].id, phase: 'accumulation' },
        { programId: 10, weekNumber: 3, routineId: r[0].id, phase: 'accumulation' },
      ]);

      const map = await getWeekCompletionMap(p);
      expect(map.get(1)).toBe('future');
      expect(map.get(2)).toBe('future');
      expect(map.get(3)).toBe('future');
    });

    it('does not complete week A if session is from Routine B', async () => {
      const now = Date.now();
      const p = makeProgram({ id: 11, startDate: now - 1000, weeksDuration: 3 });
      await db.insert(programs).values(p);
      const [routineA] = await db.insert(routines).values({ name: 'Routine A' }).returning();
      const [routineB] = await db.insert(routines).values({ name: 'Routine B' }).returning();

      await db.insert(programWeeks).values([
        { programId: 11, weekNumber: 1, routineId: routineA.id, phase: 'accumulation' },
        { programId: 11, weekNumber: 2, routineId: routineA.id, phase: 'accumulation' },
        { programId: 11, weekNumber: 3, routineId: routineA.id, phase: 'accumulation' },
      ]);

      // Completed session in week 1 window, but with Routine B
      await db.insert(sessions).values({
        id: 101,
        routineId: routineB.id,
        startTime: p.startDate + 1000,
        endTime: p.startDate + 4000,
      });

      const map = await getWeekCompletionMap(p);
      expect(map.get(1)).toBe('missed');
    });

    it('does not complete week if session is unfinished (endTime is null) or soft-deleted', async () => {
      const now = Date.now();
      const p = makeProgram({ id: 12, startDate: now - 1000, weeksDuration: 3 });
      await db.insert(programs).values(p);
      const [routineA] = await db.insert(routines).values({ name: 'Routine A' }).returning();

      await db.insert(programWeeks).values([
        { programId: 12, weekNumber: 1, routineId: routineA.id, phase: 'accumulation' },
      ]);

      // Session unfinished (endTime is null)
      await db.insert(sessions).values({
        id: 102,
        routineId: routineA.id,
        startTime: p.startDate + 1000,
        endTime: null,
      });

      let map = await getWeekCompletionMap(p);
      expect(map.get(1)).toBe('missed');

      // Session soft-deleted
      await db.update(sessions).set({ endTime: p.startDate + 5000, deletedAt: p.startDate + 6000 }).where(eq(sessions.id, 102));
      map = await getWeekCompletionMap(p);
      expect(map.get(1)).toBe('missed');
    });

    it('does not complete week when routineId is null, even with arbitrary finished session', async () => {
      const now = Date.now();
      const p = makeProgram({ id: 13, startDate: now - 1000, weeksDuration: 2 });
      await db.insert(programs).values(p);
      const [routineA] = await db.insert(routines).values({ name: 'Routine A' }).returning();

      await db.insert(programWeeks).values([
        { programId: 13, weekNumber: 1, routineId: null, phase: 'accumulation' },
      ]);

      // Finished session in week 1
      await db.insert(sessions).values({
        id: 103,
        routineId: routineA.id,
        startTime: p.startDate + 1000,
        endTime: p.startDate + 4000,
      });

      const map = await getWeekCompletionMap(p);
      expect(map.get(1)).toBe('missed');
    });

    it('completes week when finished session matches planned routine', async () => {
      const now = Date.now();
      const p = makeProgram({ id: 14, startDate: now - 1000, weeksDuration: 2 });
      await db.insert(programs).values(p);
      const [routineA] = await db.insert(routines).values({ name: 'Routine A' }).returning();

      await db.insert(programWeeks).values([
        { programId: 14, weekNumber: 1, routineId: routineA.id, phase: 'accumulation' },
        { programId: 14, weekNumber: 2, routineId: routineA.id, phase: 'accumulation' },
      ]);

      await db.insert(sessions).values({
        id: 104,
        routineId: routineA.id,
        startTime: p.startDate + 1000,
        endTime: p.startDate + 4000,
      });

      const map = await getWeekCompletionMap(p);
      expect(map.get(1)).toBe('done');
      expect(map.get(2)).toBe('future');
    });
  });

  describe('getWeeklyVolume', () => {
    it('returns 0 before program startDate', async () => {
      const now = Date.now();
      const p = makeProgram({ id: 20, startDate: now + msPerWeek, weeksDuration: 4 });
      await db.insert(programs).values(p);
      const vol = await getWeeklyVolume(p);
      expect(vol).toBe(0);
    });

    it('excludes soft-deleted sets, warmup sets, open sessions, deleted sessions and mismatched routines', async () => {
      const now = Date.now();
      const p = makeProgram({ id: 21, startDate: now - 1000, weeksDuration: 4 });
      await db.insert(programs).values(p);
      const [routineA] = await db.insert(routines).values({ name: 'Routine A' }).returning();
      const [routineB] = await db.insert(routines).values({ name: 'Routine B' }).returning();

      await db.insert(programWeeks).values([
        { programId: 21, weekNumber: 1, routineId: routineA.id, phase: 'accumulation' },
      ]);

      // 1. Valid session with Routine A (finished)
      await db.insert(sessions).values({
        id: 201,
        routineId: routineA.id,
        startTime: p.startDate + 1000,
        endTime: p.startDate + 4000,
      });
      await db.insert(sets).values([
        // Valid set: 100kg * 10 reps = 1000
        { id: 1, sessionId: 201, exerciseId: 1, setNumber: 1, weightKg: 100, reps: 10, isWarmup: false },
        // Soft-deleted set: 100kg * 10 reps -> MUST BE EXCLUDED
        { id: 2, sessionId: 201, exerciseId: 1, setNumber: 2, weightKg: 100, reps: 10, isWarmup: false, deletedAt: now },
        // Warmup set: 50kg * 10 reps -> MUST BE EXCLUDED
        { id: 3, sessionId: 201, exerciseId: 1, setNumber: 3, weightKg: 50, reps: 10, isWarmup: true },
      ]);

      // 2. Open session (endTime null) with Routine A -> MUST BE EXCLUDED
      await db.insert(sessions).values({
        id: 202,
        routineId: routineA.id,
        startTime: p.startDate + 5000,
        endTime: null,
      });
      await db.insert(sets).values([
        { id: 4, sessionId: 202, exerciseId: 1, setNumber: 1, weightKg: 200, reps: 10, isWarmup: false },
      ]);

      // 3. Soft-deleted session with Routine A -> MUST BE EXCLUDED
      await db.insert(sessions).values({
        id: 203,
        routineId: routineA.id,
        startTime: p.startDate + 6000,
        endTime: p.startDate + 8000,
        deletedAt: now,
      });
      await db.insert(sets).values([
        { id: 5, sessionId: 203, exerciseId: 1, setNumber: 1, weightKg: 300, reps: 10, isWarmup: false },
      ]);

      // 4. Session with Routine B (not Routine A) -> MUST BE EXCLUDED
      await db.insert(sessions).values({
        id: 204,
        routineId: routineB.id,
        startTime: p.startDate + 9000,
        endTime: p.startDate + 11000,
      });
      await db.insert(sets).values([
        { id: 6, sessionId: 204, exerciseId: 1, setNumber: 1, weightKg: 400, reps: 10, isWarmup: false },
      ]);

      const vol = await getWeeklyVolume(p);
      expect(vol).toBe(1000);
    });

    it('returns 0 when current week has no routine assigned (routineId: null)', async () => {
      const now = Date.now();
      const p = makeProgram({ id: 22, startDate: now - 1000, weeksDuration: 4 });
      await db.insert(programs).values(p);
      const [routineA] = await db.insert(routines).values({ name: 'Routine A' }).returning();

      await db.insert(programWeeks).values([
        { programId: 22, weekNumber: 1, routineId: null, phase: 'deload' },
      ]);

      await db.insert(sessions).values({
        id: 205,
        routineId: routineA.id,
        startTime: p.startDate + 1000,
        endTime: p.startDate + 4000,
      });
      await db.insert(sets).values([
        { id: 7, sessionId: 205, exerciseId: 1, setNumber: 1, weightKg: 100, reps: 10, isWarmup: false },
      ]);

      const vol = await getWeeklyVolume(p);
      expect(vol).toBe(0);
    });
  });

  describe('getAverageWeeklyVolume', () => {
    it('returns 0 before program start', async () => {
      const now = Date.now();
      const p = makeProgram({ id: 30, startDate: now + msPerWeek, weeksDuration: 4 });
      await db.insert(programs).values(p);
      const avg = await getAverageWeeklyVolume(p);
      expect(avg).toBe(0);
    });

    it('uses the same population as completion and weekly volume', async () => {
      const now = Date.now();
      // Program started 10 days ago (currently in week 2)
      const p = makeProgram({ id: 31, startDate: now - msPerWeek - 3 * 86400000, weeksDuration: 4 });
      await db.insert(programs).values(p);
      const [routineA] = await db.insert(routines).values({ name: 'Routine A' }).returning();
      const [routineB] = await db.insert(routines).values({ name: 'Routine B' }).returning();

      await db.insert(programWeeks).values([
        { programId: 31, weekNumber: 1, routineId: routineA.id, phase: 'accumulation' },
        { programId: 31, weekNumber: 2, routineId: routineB.id, phase: 'accumulation' },
      ]);

      // Week 1 valid session with Routine A: 2000 kg
      await db.insert(sessions).values({
        id: 301,
        routineId: routineA.id,
        startTime: p.startDate + 1000,
        endTime: p.startDate + 4000,
      });
      await db.insert(sets).values([
        { id: 11, sessionId: 301, exerciseId: 1, setNumber: 1, weightKg: 100, reps: 20, isWarmup: false },
        { id: 12, sessionId: 301, exerciseId: 1, setNumber: 2, weightKg: 100, reps: 20, isWarmup: false, deletedAt: now }, // deleted set
      ]);

      // Week 2 valid session with Routine B: 4000 kg
      await db.insert(sessions).values({
        id: 302,
        routineId: routineB.id,
        startTime: p.startDate + msPerWeek + 1000,
        endTime: p.startDate + msPerWeek + 4000,
      });
      await db.insert(sets).values([
        { id: 13, sessionId: 302, exerciseId: 1, setNumber: 1, weightKg: 200, reps: 20, isWarmup: false },
      ]);

      // Week 2 invalid session (Routine A instead of Routine B) -> MUST BE EXCLUDED
      await db.insert(sessions).values({
        id: 303,
        routineId: routineA.id,
        startTime: p.startDate + msPerWeek + 5000,
        endTime: p.startDate + msPerWeek + 8000,
      });
      await db.insert(sets).values([
        { id: 14, sessionId: 303, exerciseId: 1, setNumber: 1, weightKg: 500, reps: 10, isWarmup: false },
      ]);

      // Total valid volume: 2000 + 4000 = 6000 over 2 distinct weeks -> average = 3000
      const avg = await getAverageWeeklyVolume(p, 4);
      expect(avg).toBe(3000);
    });
  });

  describe('getSessionsForWeek', () => {
    it('returns only completed, non-deleted sessions belonging to the planned routine for that week', async () => {
      const now = Date.now();
      const p = makeProgram({ id: 40, startDate: now - 1000, weeksDuration: 3 });
      await db.insert(programs).values(p);
      const [routineA] = await db.insert(routines).values({ name: 'Routine A' }).returning();
      const [routineB] = await db.insert(routines).values({ name: 'Routine B' }).returning();

      await db.insert(programWeeks).values([
        { programId: 40, weekNumber: 1, routineId: routineA.id, phase: 'accumulation' },
        { programId: 40, weekNumber: 2, routineId: null, phase: 'deload' },
      ]);

      // Session 1: Valid (Routine A, finished, within week 1)
      await db.insert(sessions).values({
        id: 401,
        routineId: routineA.id,
        routineName: 'Routine A',
        startTime: p.startDate + 1000,
        endTime: p.startDate + 4000,
      });

      // Session 2: Wrong routine (Routine B)
      await db.insert(sessions).values({
        id: 402,
        routineId: routineB.id,
        routineName: 'Routine B',
        startTime: p.startDate + 2000,
        endTime: p.startDate + 5000,
      });

      // Session 3: Open session (endTime null)
      await db.insert(sessions).values({
        id: 403,
        routineId: routineA.id,
        routineName: 'Routine A',
        startTime: p.startDate + 3000,
        endTime: null,
      });

      // Session 4: Soft-deleted session
      await db.insert(sessions).values({
        id: 404,
        routineId: routineA.id,
        routineName: 'Routine A',
        startTime: p.startDate + 4000,
        endTime: p.startDate + 6000,
        deletedAt: now,
      });

      const week1Sessions = await getSessionsForWeek(p, 1);
      expect(week1Sessions.length).toBe(1);
      expect(week1Sessions[0].id).toBe(401);

      // Week 2 has routineId null -> returns empty
      const week2Sessions = await getSessionsForWeek(p, 2);
      expect(week2Sessions.length).toBe(0);
    });

    it('obeys start-inclusive, end-exclusive boundaries', async () => {
      const now = Date.now();
      const p = makeProgram({ id: 50, startDate: now - 1000, weeksDuration: 3 });
      await db.insert(programs).values(p);
      const [routineA] = await db.insert(routines).values({ name: 'Routine A' }).returning();
      const [routineB] = await db.insert(routines).values({ name: 'Routine B' }).returning();

      await db.insert(programWeeks).values([
        { programId: 50, weekNumber: 1, routineId: routineA.id, phase: 'accumulation' },
        { programId: 50, weekNumber: 2, routineId: routineB.id, phase: 'accumulation' },
      ]);

      const week1Start = p.startDate;
      const week1End = p.startDate + msPerWeek;

      // Session at exact week1Start -> belongs to week 1
      await db.insert(sessions).values({
        id: 501,
        routineId: routineA.id,
        startTime: week1Start,
        endTime: week1Start + 3000,
      });

      // Session at exact week1End -> belongs to week 2, NOT week 1
      await db.insert(sessions).values({
        id: 502,
        routineId: routineB.id,
        startTime: week1End,
        endTime: week1End + 3000,
      });

      const week1 = await getSessionsForWeek(p, 1);
      expect(week1.map(s => s.id)).toEqual([501]);

      const week2 = await getSessionsForWeek(p, 2);
      expect(week2.map(s => s.id)).toEqual([502]);
    });
  });
});

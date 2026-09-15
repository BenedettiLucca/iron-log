import { db, sqlite } from '../fixtures/database';
import { programs, programWeeks, routines } from '@/src/db/schema';
import { TodayWorkoutService } from '@/services/TodayWorkoutService';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

beforeEach(() => {
  sqlite.exec(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM program_weeks;
    DELETE FROM programs;
    DELETE FROM routines;
    DELETE FROM body_metrics;
    DELETE FROM sqlite_sequence;
    PRAGMA foreign_keys = ON;
  `);
});

describe('TodayWorkoutService.getTodayWorkout()', () => {
  it('returns resolved workout when active program has a routine for the current week', async () => {
    const now = Date.now();
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;

    const routine = await db.insert(routines).values({ name: 'Push Day' }).returning();
    const program = await db.insert(programs).values({
      name: 'Test Program',
      startDate: now - 2 * msPerWeek,
      endDate: now + 4 * msPerWeek,
      weeksDuration: 6,
      isActive: true,
    }).returning();

    await db.insert(programWeeks).values({
      programId: program[0].id,
      weekNumber: 1,
      routineId: routine[0].id,
      phase: 'accumulation',
    });
    await db.insert(programWeeks).values({
      programId: program[0].id,
      weekNumber: 2,
      routineId: routine[0].id,
      phase: 'accumulation',
    });
    await db.insert(programWeeks).values({
      programId: program[0].id,
      weekNumber: 3,
      routineId: routine[0].id,
      phase: 'intensification',
    });

    const result = await TodayWorkoutService.getTodayWorkout();

    expect(result).not.toBeNull();
    expect(result!.routineId).toBe(routine[0].id);
    expect(result!.routineName).toBe('Push Day');
    expect(result!.weekNumber).toBe(3);
    expect(result!.dayName).toBeTruthy();
  });

  it('returns null when there is no active program', async () => {
    const program = await db.insert(programs).values({
      name: 'Inactive Program',
      startDate: Date.now(),
      endDate: Date.now() + 7 * 86400000,
      weeksDuration: 4,
      isActive: false,
    }).returning();

    expect(program[0].isActive).toBe(false);

    const result = await TodayWorkoutService.getTodayWorkout();
    expect(result).toBeNull();
  });

  it('returns null when current week has no routine assigned (rest day)', async () => {
    const now = Date.now();
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;

    const program = await db.insert(programs).values({
      name: 'Test Program',
      startDate: now - msPerWeek,
      endDate: now + 6 * msPerWeek,
      weeksDuration: 4,
      isActive: true,
    }).returning();

    // Week 1 has a routine, week 2 (current) has no routine
    const routine = await db.insert(routines).values({ name: 'Existing Routine' }).returning();
    await db.insert(programWeeks).values({
      programId: program[0].id,
      weekNumber: 1,
      routineId: routine[0].id,
      phase: 'accumulation',
    });
    await db.insert(programWeeks).values({
      programId: program[0].id,
      weekNumber: 2,
      routineId: null,
      phase: 'deload',
    });

    const result = await TodayWorkoutService.getTodayWorkout();
    expect(result).toBeNull();
  });

  it('returns null when active program startDate is in the future (pre-start)', async () => {
    const now = Date.now();
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;

    const routine = await db.insert(routines).values({ name: 'Future Push' }).returning();
    const program = await db.insert(programs).values({
      name: 'Future Program',
      startDate: now + msPerWeek,
      endDate: now + 5 * msPerWeek,
      weeksDuration: 4,
      isActive: true,
    }).returning();

    await db.insert(programWeeks).values({
      programId: program[0].id,
      weekNumber: 1,
      routineId: routine[0].id,
      phase: 'accumulation',
    });

    const result = await TodayWorkoutService.getTodayWorkout();
    expect(result).toBeNull();
  });
});

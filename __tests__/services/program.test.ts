import { getCurrentWeek, getWeeksUntilDeload, getCurrentPhase } from '@/services/program/dashboard';
import { getDoubleProgressionStatus } from '@/services/progression';
import { db, sqlite } from '../fixtures/database';
import { programs, programExerciseTargets, exercises, sessions, sets } from '@/src/db/schema';
import type { Program } from '@/src/types';

jest.mock('@/src/db/client', () => jest.requireActual('../fixtures/database'));

function makeProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: 1,
    name: 'Strength Program',
    description: 'Hypertrophy cycle',
    startDate: Date.now(),
    endDate: Date.now() + 6 * 7 * 86400000,
    weeksDuration: 6,
    deloadWeek: 6,
    goal: 'hypertrophy',
    isActive: true,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe('ProgramService real production behavior', () => {

  describe('getCurrentWeek (imported from services/program/dashboard)', () => {
    it('returns week 1 for a program that just started', () => {
      const now = Date.now();
      const program = makeProgram({ startDate: now - 1000, weeksDuration: 6 });
      expect(getCurrentWeek(program)).toBe(1);
    });

    it('returns week 2 after 8 days', () => {
      const now = Date.now();
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const program = makeProgram({ startDate: now - msPerWeek - 86400000, weeksDuration: 6 });
      expect(getCurrentWeek(program)).toBe(2);
    });

    it('caps at weeksDuration', () => {
      const now = Date.now();
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const program = makeProgram({ startDate: now - 10 * msPerWeek, weeksDuration: 6 });
      expect(getCurrentWeek(program)).toBe(6);
    });
  });

  describe('getWeeksUntilDeload (imported from services/program/dashboard)', () => {
    it('returns null when no deload week set', () => {
      const program = makeProgram({ deloadWeek: null });
      expect(getWeeksUntilDeload(program)).toBeNull();
    });

    it('returns correct weeks until deload', () => {
      const now = Date.now();
      const program = makeProgram({ startDate: now, weeksDuration: 6, deloadWeek: 6 });
      expect(getWeeksUntilDeload(program)).toBe(5);
    });

    it('returns 0 when already at or past deload week', () => {
      const now = Date.now();
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const program = makeProgram({ startDate: now - 6 * msPerWeek, weeksDuration: 6, deloadWeek: 6 });
      expect(getWeeksUntilDeload(program)).toBe(0);
    });
  });

  describe('getCurrentPhase (imported from services/program/dashboard)', () => {
    it('returns accumulation in first half', () => {
      const now = Date.now();
      const program = makeProgram({ startDate: now, weeksDuration: 6, deloadWeek: 6 });
      expect(getCurrentPhase(program)).toBe('accumulation');
    });

    it('returns intensification in second half', () => {
      const now = Date.now();
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const program = makeProgram({ startDate: now - 3.5 * msPerWeek, weeksDuration: 6, deloadWeek: 6 });
      expect(getCurrentPhase(program)).toBe('intensification');
    });

    it('returns deload at deload week', () => {
      const now = Date.now();
      const msPerWeek = 7 * 24 * 60 * 60 * 1000;
      const program = makeProgram({ startDate: now - 5.5 * msPerWeek, weeksDuration: 6, deloadWeek: 6 });
      expect(getCurrentPhase(program)).toBe('deload');
    });

    it('returns accumulation when no deload week set and in first half', () => {
      const now = Date.now();
      const program = makeProgram({ startDate: now, weeksDuration: 8, deloadWeek: null });
      expect(getCurrentPhase(program)).toBe('accumulation');
    });
  });

  describe('getDoubleProgressionStatus (imported from services/progression)', () => {
    const programId = 10;
    const exerciseId = 20;

    beforeEach(() => {
      sqlite.exec('DELETE FROM sets; DELETE FROM sessions; DELETE FROM program_exercise_targets; DELETE FROM programs; DELETE FROM exercises; DELETE FROM sqlite_sequence;');
      db.insert(exercises).values({ id: exerciseId, name: 'Bench Press', type: 'strength' }).run();
      db.insert(programs).values({
        id: programId,
        name: 'Hypertrophy Block',
        startDate: Date.now() - 100000,
        endDate: Date.now() + 100000,
        weeksDuration: 4,
      }).run();
      db.insert(programExerciseTargets).values({
        id: 1,
        programId,
        exerciseId,
        targetRepsMin: 8,
        targetRepsMax: 12,
        targetSets: 3,
      }).run();
    });

    it('returns null when target not found', async () => {
      const status = await getDoubleProgressionStatus(999, 999, 'Non-existent');
      expect(status).toBeNull();
    });

    it('detects isAtTop when all sets hit targetRepsMax', async () => {
      db.insert(sessions).values({ id: 1, startTime: Date.now() }).run();
      db.insert(sets).values([
        { sessionId: 1, exerciseId, exerciseName: 'Bench Press', setNumber: 1, weightKg: 80, reps: 12, isWarmup: false, createdAt: 100 },
        { sessionId: 1, exerciseId, exerciseName: 'Bench Press', setNumber: 2, weightKg: 80, reps: 12, isWarmup: false, createdAt: 200 },
        { sessionId: 1, exerciseId, exerciseName: 'Bench Press', setNumber: 3, weightKg: 80, reps: 12, isWarmup: false, createdAt: 300 },
      ]).run();

      const status = await getDoubleProgressionStatus(programId, exerciseId, 'Bench Press');
      expect(status).not.toBeNull();
      expect(status!.isAtTop).toBe(true);
      expect(status!.lastPerformance).toEqual({ weight: 80, reps: 12, sets: 3 });
      expect(status!.trend).toBe('flat');
    });

    it('detects isAtTop false when any set is below targetRepsMax', async () => {
      db.insert(sessions).values({ id: 1, startTime: Date.now() }).run();
      db.insert(sets).values([
        { sessionId: 1, exerciseId, exerciseName: 'Bench Press', setNumber: 1, weightKg: 80, reps: 12, isWarmup: false, createdAt: 100 },
        { sessionId: 1, exerciseId, exerciseName: 'Bench Press', setNumber: 2, weightKg: 80, reps: 10, isWarmup: false, createdAt: 200 },
        { sessionId: 1, exerciseId, exerciseName: 'Bench Press', setNumber: 3, weightKg: 80, reps: 12, isWarmup: false, createdAt: 300 },
      ]).run();

      const status = await getDoubleProgressionStatus(programId, exerciseId, 'Bench Press');
      expect(status).not.toBeNull();
      expect(status!.isAtTop).toBe(false);
      expect(status!.lastPerformance?.reps).toBe(10);
    });

    it('calculates trend between last two sessions correctly', async () => {
      db.insert(sessions).values([
        { id: 1, startTime: 1000 },
        { id: 2, startTime: 2000 },
      ]).run();

      // Session 1: prev session (createdAt earlier)
      db.insert(sets).values([
        { sessionId: 1, exerciseId, exerciseName: 'Bench Press', setNumber: 1, weightKg: 80, reps: 10, isWarmup: false, createdAt: 1000 },
      ]).run();

      // Session 2: latest session (createdAt later)
      db.insert(sets).values([
        { sessionId: 2, exerciseId, exerciseName: 'Bench Press', setNumber: 1, weightKg: 85, reps: 10, isWarmup: false, createdAt: 2000 },
      ]).run();

      const status = await getDoubleProgressionStatus(programId, exerciseId, 'Bench Press');
      expect(status).not.toBeNull();
      expect(status!.trend).toBe('up');
    });
  });
});

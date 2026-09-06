import { db } from '@/src/db/client';
import { programs, programWeeks, routines } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from './logger';

export interface TodayWorkout {
  routineId: number;
  routineName: string;
  weekNumber: number;
  dayName: string;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Resolve the workout scheduled for today based on the ACTIVE program (programs.isActive).
 * Returns null when there is no active program or the current week has no routine assigned (rest day).
 */
async function getTodayWorkout(): Promise<TodayWorkout | null> {
  try {
    const programResult = await db
      .select()
      .from(programs)
      .where(eq(programs.isActive, true))
      .limit(1);

    if (!programResult[0]) return null;

    const program = programResult[0];
    const now = Date.now();
    const msPerWeek = 7 * 24 * 60 * 60 * 1000;
    const elapsed = now - program.startDate;
    const currentWeek = Math.min(Math.floor(elapsed / msPerWeek) + 1, program.weeksDuration);

    const weeksResult = await db
      .select()
      .from(programWeeks)
      .where(eq(programWeeks.programId, program.id))
      .orderBy(programWeeks.weekNumber);

    const currentWeekRow = weeksResult.find(
      (w) => w.weekNumber === currentWeek
    );

    if (!currentWeekRow || !currentWeekRow.routineId) return null;

    const routineId = currentWeekRow.routineId;
    const routineResult = await db
      .select()
      .from(routines)
      .where(eq(routines.id, routineId))
      .limit(1);

    if (!routineResult[0]) return null;

    const dayIndex = new Date(now).getDay();
    const dayName = DAY_NAMES[dayIndex] ?? '';

    return {
      routineId,
      routineName: routineResult[0].name,
      weekNumber: currentWeek,
      dayName,
    };
  } catch (e) {
    logger.error('Failed to get today workout', e);
    return null;
  }
}

export const TodayWorkoutService = {
  getTodayWorkout,
};

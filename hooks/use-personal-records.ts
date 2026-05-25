import { db } from '../src/db/client';
import { personalRecords } from '../src/db/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../services/logger';

interface CheckPRResult {
  isWeightPR: boolean;
  isRepsPR: boolean;
}

export async function checkPersonalRecords(opts: {
  exerciseId: number;
  sessionId: number;
  savedSet: { weightKg: number | null; reps: number | null; rir: number | null };
  isWarmup: boolean;
}): Promise<CheckPRResult> {
  const { exerciseId, sessionId, savedSet, isWarmup } = opts;
  const result: CheckPRResult = { isWeightPR: false, isRepsPR: false };

  // Check for Personal Records (only for non-warmup strength sets)
  if (isWarmup || !savedSet.weightKg || !savedSet.reps) {
    return result;
  }

  try {
    const now = Date.now();
    const setDetails = JSON.stringify({ weightKg: savedSet.weightKg, reps: savedSet.reps, rir: savedSet.rir });

    // Check weight PR
    const existingWeightPR = await db.select({ value: personalRecords.value })
      .from(personalRecords)
      .where(and(eq(personalRecords.exerciseId, exerciseId), eq(personalRecords.recordType, 'weight')))
      .limit(1);

    if (!existingWeightPR.length || savedSet.weightKg > existingWeightPR[0].value) {
      await db.insert(personalRecords).values({
        exerciseId,
        sessionId,
        recordType: 'weight',
        value: savedSet.weightKg,
        date: now,
        setDetails,
      }).onConflictDoUpdate({
        target: [personalRecords.exerciseId, personalRecords.recordType],
        set: { value: savedSet.weightKg, sessionId, date: now, setDetails },
      });
      result.isWeightPR = true;
    }

    // Check reps PR (at same or higher weight)
    const existingRepsPR = await db.select({ value: personalRecords.value })
      .from(personalRecords)
      .where(and(eq(personalRecords.exerciseId, exerciseId), eq(personalRecords.recordType, 'reps')))
      .limit(1);

    if (!existingRepsPR.length || savedSet.reps > existingRepsPR[0].value) {
      await db.insert(personalRecords).values({
        exerciseId,
        sessionId,
        recordType: 'reps',
        value: savedSet.reps,
        date: now,
        setDetails,
      }).onConflictDoUpdate({
        target: [personalRecords.exerciseId, personalRecords.recordType],
        set: { value: savedSet.reps, sessionId, date: now, setDetails },
      });
      result.isRepsPR = true;
    }
  } catch (prErr) {
    logger.warn('Failed to update PR', prErr);
  }

  return result;
}

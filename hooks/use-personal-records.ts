import { db } from '../src/db/client';
import { personalRecords, sets } from '../src/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { logger } from '../services/logger';

interface CheckPRResult {
  isWeightPR: boolean;
  isRepsPR: boolean;
}

export interface ReconcilePROptions {
  exerciseId?: number;
  sessionId?: number;
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

/**
 * Reconcile PR records for an exercise or all exercises in a session
 * from LIVE sets only (excluding soft-deleted sets).
 */
export async function reconcilePersonalRecords(opts: ReconcilePROptions = {}): Promise<void> {
  try {
    let exerciseIds: number[] = [];

    if (opts.exerciseId != null) {
      exerciseIds = [opts.exerciseId];
    } else if (opts.sessionId != null) {
      const sessionSets = await db.select({ exerciseId: sets.exerciseId })
        .from(sets)
        .where(eq(sets.sessionId, opts.sessionId));
      exerciseIds = Array.from(new Set(sessionSets.map(s => s.exerciseId)));
    } else {
      const allPRs = await db.select({ exerciseId: personalRecords.exerciseId })
        .from(personalRecords);
      exerciseIds = Array.from(new Set(allPRs.map(p => p.exerciseId)));
    }

    for (const exerciseId of exerciseIds) {
      const liveSets = await db.select()
        .from(sets)
        .where(and(
          eq(sets.exerciseId, exerciseId),
          isNull(sets.deletedAt),
          sql`NOT ${sets.isWarmup}`
        ));

      const validSets = liveSets.filter(s => (s.weightKg ?? 0) > 0 && (s.reps ?? 0) > 0);

      if (validSets.length === 0) {
        await db.delete(personalRecords)
          .where(eq(personalRecords.exerciseId, exerciseId));
        continue;
      }

      // Best weight PR
      const bestWeightSet = [...validSets].sort((a, b) => {
        if (b.weightKg !== a.weightKg) return b.weightKg - a.weightKg;
        if (b.reps !== a.reps) return b.reps - a.reps;
        return (b.createdAt ?? b.id ?? 0) - (a.createdAt ?? a.id ?? 0);
      })[0];

      const weightSetDetails = JSON.stringify({
        weightKg: bestWeightSet.weightKg,
        reps: bestWeightSet.reps,
        rir: bestWeightSet.rir,
      });

      await db.insert(personalRecords).values({
        exerciseId,
        sessionId: bestWeightSet.sessionId,
        recordType: 'weight',
        value: bestWeightSet.weightKg,
        date: bestWeightSet.createdAt ?? Date.now(),
        setDetails: weightSetDetails,
      }).onConflictDoUpdate({
        target: [personalRecords.exerciseId, personalRecords.recordType],
        set: {
          sessionId: bestWeightSet.sessionId,
          value: bestWeightSet.weightKg,
          date: bestWeightSet.createdAt ?? Date.now(),
          setDetails: weightSetDetails,
        },
      });

      // Best reps PR
      const bestRepsSet = [...validSets].sort((a, b) => {
        if (b.reps !== a.reps) return b.reps - a.reps;
        if (b.weightKg !== a.weightKg) return b.weightKg - a.weightKg;
        return (b.createdAt ?? b.id ?? 0) - (a.createdAt ?? a.id ?? 0);
      })[0];

      const repsSetDetails = JSON.stringify({
        weightKg: bestRepsSet.weightKg,
        reps: bestRepsSet.reps,
        rir: bestRepsSet.rir,
      });

      await db.insert(personalRecords).values({
        exerciseId,
        sessionId: bestRepsSet.sessionId,
        recordType: 'reps',
        value: bestRepsSet.reps,
        date: bestRepsSet.createdAt ?? Date.now(),
        setDetails: repsSetDetails,
      }).onConflictDoUpdate({
        target: [personalRecords.exerciseId, personalRecords.recordType],
        set: {
          sessionId: bestRepsSet.sessionId,
          value: bestRepsSet.reps,
          date: bestRepsSet.createdAt ?? Date.now(),
          setDetails: repsSetDetails,
        },
      });
    }
  } catch (err) {
    logger.error('Failed to reconcile personal records', err);
  }
}

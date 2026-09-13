import { db } from '../src/db/client';
import { personalRecords, sets, sessions } from '../src/db/schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { logger } from '../services/logger';

export interface CheckPRResult {
  isWeightPR: boolean;
  isRepsPR: boolean;
  isDurationPR?: boolean;
}

export interface CheckPROptions {
  exerciseId: number;
  sessionId: number;
  savedSet: {
    id?: number;
    weightKg: number | null;
    reps: number | null;
    rir?: number | null;
    durationSeconds?: number | null;
    setNumber?: number;
    createdAt?: number | null;
  };
  isWarmup: boolean;
  tx?: any;
  dbInstance?: any;
}

export interface ReconcilePROptions {
  exerciseId?: number;
  sessionId?: number;
  exerciseIds?: number[];
  tx?: any;
  dbInstance?: any;
}

function getDbInstance(arg1?: any, arg2?: any): any {
  if (arg1 && typeof arg1.select === 'function') {
    return arg1;
  }
  return arg2?.tx ?? arg2?.dbInstance ?? arg1?.tx ?? arg1?.dbInstance ?? db;
}

/**
 * Synchronous / tx-aware check for Personal Records (Contract C4 & C1).
 * Used during set logging and inside SQLite transactions.
 */
export function checkPersonalRecordsSync(
  opts: CheckPROptions,
  legacyTx?: any,
): CheckPRResult {
  const dbInstance = getDbInstance(legacyTx, opts);
  const { exerciseId, sessionId, savedSet, isWarmup } = opts;
  const result: CheckPRResult = { isWeightPR: false, isRepsPR: false, isDurationPR: false };

  // Skip warmups or empty sets
  if (isWarmup) {
    return result;
  }

  const isStrength = (savedSet.weightKg != null && savedSet.weightKg > 0) &&
                     (savedSet.reps != null && savedSet.reps > 0);
  const isDuration = (savedSet.durationSeconds != null && savedSet.durationSeconds > 0);

  if (!isStrength && !isDuration) {
    return result;
  }

  try {
    const now = savedSet.createdAt ?? Date.now();

    if (isStrength) {
      const weight = savedSet.weightKg!;
      const reps = savedSet.reps!;
      const rir = savedSet.rir ?? null;
      const setDetails = JSON.stringify({
        weightKg: weight,
        reps,
        rir,
        setId: savedSet.id ?? null,
        sessionId,
        setNumber: savedSet.setNumber ?? null,
      });

      // 1. Check Weight PR
      const existingWeightPR = dbInstance.select({
        id: personalRecords.id,
        value: personalRecords.value,
        setDetails: personalRecords.setDetails,
      })
        .from(personalRecords)
        .where(and(
          eq(personalRecords.exerciseId, exerciseId),
          eq(personalRecords.recordType, 'weight'),
        ))
        .get();

      if (!existingWeightPR || weight > existingWeightPR.value) {
        dbInstance.insert(personalRecords).values({
          exerciseId,
          sessionId,
          recordType: 'weight',
          value: weight,
          date: now,
          setDetails,
        }).onConflictDoUpdate({
          target: [personalRecords.exerciseId, personalRecords.recordType],
          set: { value: weight, sessionId, date: now, setDetails },
        }).run();
        result.isWeightPR = true;
      } else if (weight === existingWeightPR.value) {
        // Tie-breaker: same weight, check if reps improved
        let prevReps = 0;
        if (existingWeightPR.setDetails) {
          try {
            const p = JSON.parse(existingWeightPR.setDetails);
            if (typeof p.reps === 'number') prevReps = p.reps;
          } catch {
            // ignore
          }
        }
        if (reps > prevReps) {
          // Update details to the higher-rep set at this same weight
          dbInstance.insert(personalRecords).values({
            exerciseId,
            sessionId,
            recordType: 'weight',
            value: weight,
            date: now,
            setDetails,
          }).onConflictDoUpdate({
            target: [personalRecords.exerciseId, personalRecords.recordType],
            set: { value: weight, sessionId, date: now, setDetails },
          }).run();
        }
      }

      // 2. Check Reps PR (Contract C4 & Issue #120)
      // Rule: "promover reps estritamente maiores com carga >= referência vigente"
      const existingRepsPR = dbInstance.select({
        id: personalRecords.id,
        value: personalRecords.value,
        sessionId: personalRecords.sessionId,
        setDetails: personalRecords.setDetails,
      })
        .from(personalRecords)
        .where(and(
          eq(personalRecords.exerciseId, exerciseId),
          eq(personalRecords.recordType, 'reps'),
        ))
        .get();

      if (!existingRepsPR) {
        // Initial reps PR established
        dbInstance.insert(personalRecords).values({
          exerciseId,
          sessionId,
          recordType: 'reps',
          value: reps,
          date: now,
          setDetails,
        }).onConflictDoUpdate({
          target: [personalRecords.exerciseId, personalRecords.recordType],
          set: { value: reps, sessionId, date: now, setDetails },
        }).run();
        result.isRepsPR = true;
      } else {
        // Determine reference load
        let referenceWeight: number | null = null;
        if (existingRepsPR.setDetails) {
          try {
            const p = JSON.parse(existingRepsPR.setDetails);
            if (typeof p.weightKg === 'number' && p.weightKg > 0) {
              referenceWeight = p.weightKg;
            }
          } catch {
            // ignore
          }
        }

        // Fallback: recover reference load from live set if setDetails is missing
        if (referenceWeight == null && existingRepsPR.sessionId) {
          const fallbackSet = dbInstance.select({ weightKg: sets.weightKg })
            .from(sets)
            .innerJoin(sessions, eq(sets.sessionId, sessions.id))
            .where(and(
              eq(sets.sessionId, existingRepsPR.sessionId),
              eq(sets.exerciseId, exerciseId),
              eq(sets.reps, Math.round(existingRepsPR.value)),
              isNull(sets.deletedAt),
              isNull(sessions.deletedAt),
              sql`NOT ${sets.isWarmup}`,
            ))
            .limit(1)
            .get();

          if (fallbackSet && fallbackSet.weightKg > 0) {
            referenceWeight = fallbackSet.weightKg;
          }
        }

        // Final fallback for legacy data without reference load:
        // Treat as unconstrained reference (0) so strictly greater reps can upgrade it
        const effectiveRefWeight = referenceWeight ?? 0;

        const strictlyMoreReps = reps > existingRepsPR.value;
        const comparableWeight = weight >= effectiveRefWeight;

        if (strictlyMoreReps && comparableWeight) {
          dbInstance.insert(personalRecords).values({
            exerciseId,
            sessionId,
            recordType: 'reps',
            value: reps,
            date: now,
            setDetails,
          }).onConflictDoUpdate({
            target: [personalRecords.exerciseId, personalRecords.recordType],
            set: { value: reps, sessionId, date: now, setDetails },
          }).run();
          result.isRepsPR = true;
        }
      }
    }

    if (isDuration) {
      const duration = savedSet.durationSeconds!;
      const setDetails = JSON.stringify({
        durationSeconds: duration,
        weightKg: savedSet.weightKg ?? null,
        reps: savedSet.reps ?? null,
        rir: savedSet.rir ?? null,
        setId: savedSet.id ?? null,
        sessionId,
        setNumber: savedSet.setNumber ?? null,
      });

      const existingDurationPR = dbInstance.select({
        id: personalRecords.id,
        value: personalRecords.value,
      })
        .from(personalRecords)
        .where(and(
          eq(personalRecords.exerciseId, exerciseId),
          eq(personalRecords.recordType, 'duration'),
        ))
        .get();

      if (!existingDurationPR || duration > existingDurationPR.value) {
        dbInstance.insert(personalRecords).values({
          exerciseId,
          sessionId,
          recordType: 'duration',
          value: duration,
          date: now,
          setDetails,
        }).onConflictDoUpdate({
          target: [personalRecords.exerciseId, personalRecords.recordType],
          set: { value: duration, sessionId, date: now, setDetails },
        }).run();
        result.isDurationPR = true;
      }
    }
  } catch (prErr) {
    logger.warn('Failed to update PR', prErr);
    // If running in an explicit transaction, rethrow to prevent half-state
    if (opts.tx || (legacyTx && typeof legacyTx.select === 'function')) {
      throw prErr;
    }
  }

  return result;
}

export async function checkPersonalRecords(
  opts: CheckPROptions,
  legacyTx?: any,
): Promise<CheckPRResult> {
  return checkPersonalRecordsSync(opts, legacyTx);
}

/**
 * Synchronously reconcile PR records for an exercise or session from live sets and sessions (Contract C1 & C4).
 */
export function reconcilePersonalRecordsSync(
  optsOrTx?: ReconcilePROptions | any,
  optsIfTx?: ReconcilePROptions,
): void {
  const dbInstance = getDbInstance(optsOrTx, optsIfTx);
  const opts: ReconcilePROptions = (optsOrTx && typeof optsOrTx.select === 'function')
    ? (optsIfTx ?? {})
    : (optsOrTx ?? {});

  try {
    let exerciseIds: number[] = [];

    if (opts.exerciseIds && opts.exerciseIds.length > 0) {
      exerciseIds = Array.from(new Set(opts.exerciseIds));
    } else if (opts.exerciseId != null) {
      exerciseIds = [opts.exerciseId];
    } else if (opts.sessionId != null) {
      const sessionSets = dbInstance.select({ exerciseId: sets.exerciseId })
        .from(sets)
        .where(eq(sets.sessionId, opts.sessionId))
        .all();
      const prRows = dbInstance.select({ exerciseId: personalRecords.exerciseId })
        .from(personalRecords)
        .where(eq(personalRecords.sessionId, opts.sessionId))
        .all();
      exerciseIds = Array.from(new Set([
        ...sessionSets.map((s: { exerciseId: number }) => s.exerciseId),
        ...prRows.map((p: { exerciseId: number }) => p.exerciseId),
      ]));
    } else {
      const allPRs = dbInstance.select({ exerciseId: personalRecords.exerciseId })
        .from(personalRecords)
        .all();
      const allSets = dbInstance.select({ exerciseId: sets.exerciseId })
        .from(sets)
        .where(isNull(sets.deletedAt))
        .all();
      exerciseIds = Array.from(new Set([
        ...allPRs.map((p: { exerciseId: number }) => p.exerciseId),
        ...allSets.map((s: { exerciseId: number }) => s.exerciseId),
      ]));
    }

    for (const exerciseId of exerciseIds) {
      // Contract C1: live sets only, live sessions only, non-warmup
      // Active sessions (endTime null) ARE eligible (provisional PR during active workout)
      // Completed sessions (endTime not null) ARE eligible
      // Soft-deleted sessions (deletedAt not null) are EXCLUDED
      // Soft-deleted sets (deletedAt not null) are EXCLUDED
      const liveSets = dbInstance.select({
        id: sets.id,
        sessionId: sets.sessionId,
        exerciseId: sets.exerciseId,
        setNumber: sets.setNumber,
        weightKg: sets.weightKg,
        reps: sets.reps,
        durationSeconds: sets.durationSeconds,
        rir: sets.rir,
        isWarmup: sets.isWarmup,
        createdAt: sets.createdAt,
        sessionStartTime: sessions.startTime,
        sessionEndTime: sessions.endTime,
      })
        .from(sets)
        .innerJoin(sessions, eq(sets.sessionId, sessions.id))
        .where(and(
          eq(sets.exerciseId, exerciseId),
          isNull(sets.deletedAt),
          isNull(sessions.deletedAt),
          sql`NOT ${sets.isWarmup}`,
        ))
        .all();

      // Deterministic chronological ordering:
      // 1. session.startTime ASC
      // 2. set.createdAt ?? session.startTime ASC
      // 3. set.setNumber ASC
      // 4. set.id ASC
      liveSets.sort((a: any, b: any) => {
        const aSessionTime = a.sessionStartTime ?? 0;
        const bSessionTime = b.sessionStartTime ?? 0;
        if (aSessionTime !== bSessionTime) return aSessionTime - bSessionTime;

        const aCreated = a.createdAt ?? aSessionTime;
        const bCreated = b.createdAt ?? bSessionTime;
        if (aCreated !== bCreated) return aCreated - bCreated;

        const aSetNumber = a.setNumber ?? 0;
        const bSetNumber = b.setNumber ?? 0;
        if (aSetNumber !== bSetNumber) return aSetNumber - bSetNumber;

        return (a.id ?? 0) - (b.id ?? 0);
      });

      // 1. Reconcile Strength PRs (weight & reps)
      const validStrengthSets = liveSets.filter(
        (s: any) => (s.weightKg ?? 0) > 0 && (s.reps ?? 0) > 0,
      );

      if (validStrengthSets.length === 0) {
        dbInstance.delete(personalRecords)
          .where(and(
            eq(personalRecords.exerciseId, exerciseId),
            sql`${personalRecords.recordType} IN ('weight', 'reps')`,
          ))
          .run();
      } else {
        let currentWeightPR: { weightKg: number; reps: number; set: any } | null = null;
        let currentRepsPR: { reps: number; weightKg: number; set: any } | null = null;

        for (const s of validStrengthSets) {
          const weight = s.weightKg;
          const reps = s.reps;

          // Weight PR evaluation
          if (!currentWeightPR) {
            currentWeightPR = { weightKg: weight, reps, set: s };
          } else if (weight > currentWeightPR.weightKg) {
            currentWeightPR = { weightKg: weight, reps, set: s };
          } else if (weight === currentWeightPR.weightKg && reps > currentWeightPR.reps) {
            // Same weight, higher reps tie-breaker
            currentWeightPR = { weightKg: weight, reps, set: s };
          }

          // Reps PR evaluation (Contract C4)
          // "promover reps estritamente maiores com carga >= referência vigente"
          if (!currentRepsPR) {
            currentRepsPR = { reps, weightKg: weight, set: s };
          } else if (reps > currentRepsPR.reps && weight >= currentRepsPR.weightKg) {
            currentRepsPR = { reps, weightKg: weight, set: s };
          }
        }

        if (currentWeightPR) {
          const weightSetDetails = JSON.stringify({
            weightKg: currentWeightPR.set.weightKg,
            reps: currentWeightPR.set.reps,
            rir: currentWeightPR.set.rir ?? null,
            setId: currentWeightPR.set.id,
            sessionId: currentWeightPR.set.sessionId,
            setNumber: currentWeightPR.set.setNumber,
          });
          const weightDate = currentWeightPR.set.createdAt ?? currentWeightPR.set.sessionStartTime ?? Date.now();

          dbInstance.insert(personalRecords).values({
            exerciseId,
            sessionId: currentWeightPR.set.sessionId,
            recordType: 'weight',
            value: currentWeightPR.set.weightKg,
            date: weightDate,
            setDetails: weightSetDetails,
          }).onConflictDoUpdate({
            target: [personalRecords.exerciseId, personalRecords.recordType],
            set: {
              sessionId: currentWeightPR.set.sessionId,
              value: currentWeightPR.set.weightKg,
              date: weightDate,
              setDetails: weightSetDetails,
            },
          }).run();
        }

        if (currentRepsPR) {
          const repsSetDetails = JSON.stringify({
            weightKg: currentRepsPR.set.weightKg,
            reps: currentRepsPR.set.reps,
            rir: currentRepsPR.set.rir ?? null,
            setId: currentRepsPR.set.id,
            sessionId: currentRepsPR.set.sessionId,
            setNumber: currentRepsPR.set.setNumber,
          });
          const repsDate = currentRepsPR.set.createdAt ?? currentRepsPR.set.sessionStartTime ?? Date.now();

          dbInstance.insert(personalRecords).values({
            exerciseId,
            sessionId: currentRepsPR.set.sessionId,
            recordType: 'reps',
            value: currentRepsPR.set.reps,
            date: repsDate,
            setDetails: repsSetDetails,
          }).onConflictDoUpdate({
            target: [personalRecords.exerciseId, personalRecords.recordType],
            set: {
              sessionId: currentRepsPR.set.sessionId,
              value: currentRepsPR.set.reps,
              date: repsDate,
              setDetails: repsSetDetails,
            },
          }).run();
        }
      }

      // 2. Reconcile Duration PR
      const validDurationSets = liveSets.filter(
        (s: any) => (s.durationSeconds ?? 0) > 0,
      );

      if (validDurationSets.length === 0) {
        dbInstance.delete(personalRecords)
          .where(and(
            eq(personalRecords.exerciseId, exerciseId),
            eq(personalRecords.recordType, 'duration'),
          ))
          .run();
      } else {
        let bestDurationSet: any = null;
        for (const s of validDurationSets) {
          if (!bestDurationSet || s.durationSeconds > bestDurationSet.durationSeconds) {
            bestDurationSet = s;
          }
        }

        if (bestDurationSet) {
          const durationSetDetails = JSON.stringify({
            durationSeconds: bestDurationSet.durationSeconds,
            weightKg: bestDurationSet.weightKg ?? null,
            reps: bestDurationSet.reps ?? null,
            rir: bestDurationSet.rir ?? null,
            setId: bestDurationSet.id,
            sessionId: bestDurationSet.sessionId,
            setNumber: bestDurationSet.setNumber,
          });
          const durationDate = bestDurationSet.createdAt ?? bestDurationSet.sessionStartTime ?? Date.now();

          dbInstance.insert(personalRecords).values({
            exerciseId,
            sessionId: bestDurationSet.sessionId,
            recordType: 'duration',
            value: bestDurationSet.durationSeconds,
            date: durationDate,
            setDetails: durationSetDetails,
          }).onConflictDoUpdate({
            target: [personalRecords.exerciseId, personalRecords.recordType],
            set: {
              sessionId: bestDurationSet.sessionId,
              value: bestDurationSet.durationSeconds,
              date: durationDate,
              setDetails: durationSetDetails,
            },
          }).run();
        }
      }
    }
  } catch (err) {
    logger.error('Failed to reconcile personal records', err);
    throw err;
  }
}

/**
 * Reconcile PR records for an exercise or all exercises in a session
 * from LIVE sets only (excluding soft-deleted sets).
 */
export async function reconcilePersonalRecords(
  optsOrTx?: ReconcilePROptions | any,
  optsIfTx?: ReconcilePROptions,
): Promise<void> {
  reconcilePersonalRecordsSync(optsOrTx, optsIfTx);
}

/**
 * Command for session lifecycle / history undo-delete-restore (T08 integration).
 * Reconciles all exercises affected by a session within an optional transaction.
 */
export function reconcileSessionPRsSync(sessionId: number, tx?: any): void {
  reconcilePersonalRecordsSync({ sessionId, tx });
}

export async function reconcileSessionPRs(sessionId: number, tx?: any): Promise<void> {
  reconcilePersonalRecordsSync({ sessionId, tx });
}

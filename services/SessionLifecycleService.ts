import AsyncStorage from '@react-native-async-storage/async-storage';
import { db as defaultDb } from '@/src/db/client';
import { sessions, sets, bodyMetrics, personalRecords } from '@/src/db/schema';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { parseLocalizedDecimal } from '@/src/utils/localized-decimal';
import { rpeSchema } from '@/src/validators/forms';

export const INCOMPLETE_SESSION_KEY = 'incomplete_session';

export interface FinishSessionParams {
  sessionId: number;
  startTime?: number;
  endTime?: number;
  weight?: string | number | null;
  sRpe?: number | null;
  notes?: string | null;
}

export interface FinishSessionResult {
  success: boolean;
  sessionId: number;
  alreadyFinished: boolean;
}

export interface DiscardSessionParams {
  sessionId: number;
}

export interface DeleteSessionParams {
  sessionId: number;
}

export interface RestoreSessionParams {
  sessionId: number;
}

export interface ReconcilePROptions {
  exerciseIds?: number[];
  sessionId?: number;
}

function extractSessionId(param: number | { sessionId: number }): number {
  return typeof param === 'number' ? param : param.sessionId;
}

/**
 * Reconciles Personal Records synchronously within a SQLite transaction (Contract C4).
 * Live sets must belong to live sessions (sessions.deletedAt IS NULL).
 * Reps PR enforces comparable load and chronological promotion.
 */
export function reconcilePersonalRecordsTx(
  tx: any,
  opts: ReconcilePROptions = {}
): void {
  let exerciseIds: number[] = [];

  if (opts.sessionId != null) {
    const sessionSets = tx
      .select({ exerciseId: sets.exerciseId })
      .from(sets)
      .where(eq(sets.sessionId, opts.sessionId))
      .all();
    exerciseIds = Array.from(new Set<number>(sessionSets.map((s: any) => Number(s.exerciseId))));
  } else if (opts.exerciseIds && opts.exerciseIds.length > 0) {
    exerciseIds = Array.from(new Set<number>(opts.exerciseIds.map((id) => Number(id))));
  } else {
    const allPRs = tx
      .select({ exerciseId: personalRecords.exerciseId })
      .from(personalRecords)
      .all();
    exerciseIds = Array.from(new Set<number>(allPRs.map((p: any) => Number(p.exerciseId))));
  }

  for (const exerciseId of exerciseIds) {
    const liveSets = tx
      .select({
        id: sets.id,
        sessionId: sets.sessionId,
        exerciseId: sets.exerciseId,
        weightKg: sets.weightKg,
        reps: sets.reps,
        rir: sets.rir,
        isWarmup: sets.isWarmup,
        createdAt: sets.createdAt,
      })
      .from(sets)
      .innerJoin(sessions, eq(sets.sessionId, sessions.id))
      .where(
        and(
          eq(sets.exerciseId, exerciseId),
          isNull(sets.deletedAt),
          isNull(sessions.deletedAt),
          sql`NOT ${sets.isWarmup}`
        )
      )
      .all();

    const validSets = liveSets.filter(
      (s: any) => (s.weightKg ?? 0) > 0 && (s.reps ?? 0) > 0
    );

    if (validSets.length === 0) {
      tx.delete(personalRecords)
        .where(eq(personalRecords.exerciseId, exerciseId))
        .run();
      continue;
    }

    // 1. Weight PR (highest load, tie-breaker: highest reps, latest time)
    const bestWeightSet = [...validSets].sort((a: any, b: any) => {
      if (b.weightKg !== a.weightKg) return (b.weightKg ?? 0) - (a.weightKg ?? 0);
      if (b.reps !== a.reps) return (b.reps ?? 0) - (a.reps ?? 0);
      return (b.createdAt ?? b.id ?? 0) - (a.createdAt ?? a.id ?? 0);
    })[0];

    const weightSetDetails = JSON.stringify({
      weightKg: bestWeightSet.weightKg,
      reps: bestWeightSet.reps,
      rir: bestWeightSet.rir,
    });

    tx.insert(personalRecords)
      .values({
        exerciseId,
        sessionId: bestWeightSet.sessionId,
        recordType: 'weight',
        value: bestWeightSet.weightKg,
        date: bestWeightSet.createdAt ?? Date.now(),
        setDetails: weightSetDetails,
      })
      .onConflictDoUpdate({
        target: [personalRecords.exerciseId, personalRecords.recordType],
        set: {
          sessionId: bestWeightSet.sessionId,
          value: bestWeightSet.weightKg,
          date: bestWeightSet.createdAt ?? Date.now(),
          setDetails: weightSetDetails,
        },
      })
      .run();

    // 2. Reps PR (Contract C4: comparable load rule with chronological replay)
    // "promover reps estritamente maiores com carga >= referência vigente"
    const chronologicalSets = [...validSets].sort((a: any, b: any) => {
      const timeA = a.createdAt ?? a.id ?? 0;
      const timeB = b.createdAt ?? b.id ?? 0;
      if (timeA !== timeB) return timeA - timeB;
      return a.id - b.id;
    });

    let currentRepsRecord: typeof validSets[0] | null = null;
    for (const s of chronologicalSets) {
      if (!currentRepsRecord) {
        currentRepsRecord = s;
      } else {
        const hasMoreReps = (s.reps ?? 0) > (currentRepsRecord.reps ?? 0);
        const hasComparableLoad =
          (s.weightKg ?? 0) >= (currentRepsRecord.weightKg ?? 0);
        if (hasMoreReps && hasComparableLoad) {
          currentRepsRecord = s;
        }
      }
    }

    if (currentRepsRecord) {
      const bestRepsSet = currentRepsRecord;
      const repsSetDetails = JSON.stringify({
        weightKg: bestRepsSet.weightKg,
        reps: bestRepsSet.reps,
        rir: bestRepsSet.rir,
      });

      tx.insert(personalRecords)
        .values({
          exerciseId,
          sessionId: bestRepsSet.sessionId,
          recordType: 'reps',
          value: bestRepsSet.reps,
          date: bestRepsSet.createdAt ?? Date.now(),
          setDetails: repsSetDetails,
        })
        .onConflictDoUpdate({
          target: [personalRecords.exerciseId, personalRecords.recordType],
          set: {
            sessionId: bestRepsSet.sessionId,
            value: bestRepsSet.reps,
            date: bestRepsSet.createdAt ?? Date.now(),
            setDetails: repsSetDetails,
          },
        })
        .run();
    }
  }
}

/**
 * Finish workout session with SQLite transaction and C2 decimal parser.
 * Removes AsyncStorage recovery state only after successful commit.
 * Retry is idempotent and will not duplicate bodyMetrics.
 */
export async function finishSession(
  params: FinishSessionParams,
  db: any = defaultDb
): Promise<FinishSessionResult> {
  let alreadyFinished = false;

  db.transaction((tx: any) => {
    const session = tx
      .select()
      .from(sessions)
      .where(eq(sessions.id, params.sessionId))
      .get();

    if (!session) {
      throw new Error(`Session ${params.sessionId} not found`);
    }

    if (session.endTime != null) {
      alreadyFinished = true;
      return;
    }

    const endTimestamp = params.endTime ?? Date.now();
    const startTimestamp = params.startTime ?? session.startTime;
    const durationMinutes = Math.max(
      1,
      Math.round((endTimestamp - startTimestamp) / 60000)
    );

    const weightResult = parseLocalizedDecimal(params.weight, {
      allowNegative: false,
    });
    const parsedWeight =
      weightResult.status === 'valid' ? weightResult.value : null;

    const sRpeParsed = rpeSchema.safeParse(params.sRpe);
    const validSRpe = sRpeParsed.success ? sRpeParsed.data : (params.sRpe ?? 7);

    tx.update(sessions)
      .set({
        endTime: endTimestamp,
        durationMinutes,
        bodyWeight: parsedWeight,
        sRpe: validSRpe,
        notes: params.notes ?? session.notes ?? null,
      })
      .where(eq(sessions.id, params.sessionId))
      .run();

    if (parsedWeight !== null) {
      tx.insert(bodyMetrics)
        .values({
          date: endTimestamp,
          type: 'daily',
          weight: parsedWeight,
        })
        .run();
    }
  });

  // Post-commit step: clear incomplete session recovery marker
  await AsyncStorage.removeItem(INCOMPLETE_SESSION_KEY);

  return {
    success: true,
    sessionId: params.sessionId,
    alreadyFinished,
  };
}

/**
 * Discard workout session in a single transaction.
 * Soft-deletes session and live sets, reconciles PRs, and cleans up AsyncStorage after commit.
 */
export async function discardSession(
  param: DiscardSessionParams | number,
  db: any = defaultDb
): Promise<void> {
  const sessionId = extractSessionId(param);

  db.transaction((tx: any) => {
    const session = tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get();

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const sessionSets = tx
      .select({ exerciseId: sets.exerciseId })
      .from(sets)
      .where(eq(sets.sessionId, sessionId))
      .all();
    const exerciseIds: number[] = Array.from(new Set<number>(sessionSets.map((s: any) => Number(s.exerciseId))));

    const now = Date.now();

    tx.update(sets)
      .set({ deletedAt: now })
      .where(and(eq(sets.sessionId, sessionId), isNull(sets.deletedAt)))
      .run();

    tx.update(sessions)
      .set({ deletedAt: now })
      .where(eq(sessions.id, sessionId))
      .run();

    reconcilePersonalRecordsTx(tx, { exerciseIds });
  });

  await AsyncStorage.removeItem(INCOMPLETE_SESSION_KEY);
}

/**
 * Soft-delete session from history in a single transaction.
 * Preserves existing set tombstones (does not mark sets.deletedAt).
 * Reconciles derived PRs so phantom records are removed/downgraded.
 */
export async function deleteSession(
  param: DeleteSessionParams | number,
  db: any = defaultDb
): Promise<void> {
  const sessionId = extractSessionId(param);

  db.transaction((tx: any) => {
    const session = tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get();

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const sessionSets = tx
      .select({ exerciseId: sets.exerciseId })
      .from(sets)
      .where(eq(sets.sessionId, sessionId))
      .all();
    const exerciseIds: number[] = Array.from(new Set<number>(sessionSets.map((s: any) => Number(s.exerciseId))));

    const now = Date.now();

    // Prefer session tombstone preserving sets/previous states
    tx.update(sessions)
      .set({ deletedAt: now })
      .where(eq(sessions.id, sessionId))
      .run();

    reconcilePersonalRecordsTx(tx, { exerciseIds });
  });
}

/**
 * Restore soft-deleted session from history in a single transaction (Undo).
 * Clears sessions.deletedAt without indiscriminately restoring sets.deletedAt.
 * Reconciles PRs to restore legitimate records.
 */
export async function restoreSession(
  param: RestoreSessionParams | number,
  db: any = defaultDb
): Promise<void> {
  const sessionId = extractSessionId(param);

  db.transaction((tx: any) => {
    const session = tx
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get();

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Restore session tombstone only; never restore sets.deletedAt indiscriminately
    tx.update(sessions)
      .set({ deletedAt: null })
      .where(eq(sessions.id, sessionId))
      .run();

    const sessionSets = tx
      .select({ exerciseId: sets.exerciseId })
      .from(sets)
      .where(eq(sets.sessionId, sessionId))
      .all();
    const exerciseIds: number[] = Array.from(new Set<number>(sessionSets.map((s: any) => Number(s.exerciseId))));

    reconcilePersonalRecordsTx(tx, { exerciseIds });
  });
}

export const SessionLifecycleService = {
  finishSession,
  discardSession,
  deleteSession,
  restoreSession,
  reconcilePersonalRecordsTx,
};

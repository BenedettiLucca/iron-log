import { and, eq, isNull, sql } from 'drizzle-orm';
import { db as defaultDb } from '@/src/db/client';
import {
  sessions,
  sessionExercises,
  routineExercises,
  exercises,
  sets,
} from '@/src/db/schema';

export interface QueueItem {
  routineExerciseId: number;
  exerciseId: number;
  position: number;
}

export interface RemoveResult {
  routineExerciseId: number;
  exerciseId: number;
  position: number;
  keptSetCount: number;
}

export type RecoveryAction = 'resume' | 'advance' | 'finish';

export interface RecoveryContextShape {
  routineExerciseId: number | null;
  exerciseId: number | null;
  weight: string;
  reps: string;
  isDirty: boolean;
  [key: string]: unknown;
}

export interface RecoveryResolution {
  action: RecoveryAction;
  context: RecoveryContextShape | null;
}

type QueryRunner = {
  select: typeof defaultDb.select;
  insert: typeof defaultDb.insert;
  update: typeof defaultDb.update;
};

type DbRunner = QueryRunner & {
  transaction<T>(cb: (tx: QueryRunner) => T): T | Promise<T>;
};

function resolveDb(customDb?: unknown): DbRunner {
  return (customDb ?? defaultDb) as DbRunner;
}

/**
 * Returns pending exercises queue for an active session in routine position order.
 * If session_exercises has not yet been materialized (no removal occurred yet),
 * reads directly from routine template.
 */
export async function getPendingQueue(
  sessionId: number,
  customDb?: unknown
): Promise<QueueItem[]> {
  const dbInstance = resolveDb(customDb);

  const existingSessionExercises = dbInstance
    .select({
      routineExerciseId: sessionExercises.routineExerciseId,
      exerciseId: sessionExercises.exerciseId,
      position: sessionExercises.position,
      status: sessionExercises.status,
    })
    .from(sessionExercises)
    .where(eq(sessionExercises.sessionId, sessionId))
    .orderBy(sessionExercises.position)
    .all();

  if (existingSessionExercises.length > 0) {
    return existingSessionExercises
      .filter((row) => row.status === 'pending' && row.routineExerciseId !== null)
      .map((row) => ({
        routineExerciseId: row.routineExerciseId as number,
        exerciseId: row.exerciseId,
        position: row.position,
      }));
  }

  // Fallback to routine template (lazy materialization not triggered yet)
  const session = dbInstance
    .select({ routineId: sessions.routineId })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .get();

  if (!session || session.routineId === null) {
    return [];
  }

  const templateRows = dbInstance
    .select({
      id: routineExercises.id,
      exerciseId: routineExercises.exerciseId,
      orderIndex: routineExercises.orderIndex,
    })
    .from(routineExercises)
    .where(eq(routineExercises.routineId, session.routineId))
    .orderBy(routineExercises.orderIndex)
    .all();

  return templateRows
    .filter((row) => row.exerciseId !== null)
    .map((row) => ({
      routineExerciseId: row.id,
      exerciseId: row.exerciseId as number,
      position: row.orderIndex ?? 0,
    }));
}

/**
 * Removes an exercise occurrence from the active session without touching routine template.
 * - Shrinks the pending queue of that session.
 * - History and already-logged sets are strictly preserved.
 * - On first removal, materializes routine occurrences into session_exercises lazily.
 * - Idempotent: removing already-removed occurrence does not throw.
 */
export async function removeSessionExercise(
  params: { sessionId: number; routineExerciseId: number },
  customDb?: unknown
): Promise<RemoveResult> {
  const dbInstance = resolveDb(customDb);
  let result: RemoveResult | undefined;

  const runTx = dbInstance.transaction((tx) => {
    const session = tx
      .select({
        id: sessions.id,
        routineId: sessions.routineId,
        endTime: sessions.endTime,
        deletedAt: sessions.deletedAt,
      })
      .from(sessions)
      .where(eq(sessions.id, params.sessionId))
      .get();

    if (!session) {
      throw new Error(`Session ${params.sessionId} not found`);
    }

    if (session.endTime !== null) {
      throw new Error(`Session ${params.sessionId} is already finished`);
    }

    if (session.deletedAt !== null) {
      throw new Error(`Session ${params.sessionId} is deleted`);
    }

    const existingSessionExercises = tx
      .select({
        id: sessionExercises.id,
        routineExerciseId: sessionExercises.routineExerciseId,
        exerciseId: sessionExercises.exerciseId,
        position: sessionExercises.position,
        status: sessionExercises.status,
      })
      .from(sessionExercises)
      .where(eq(sessionExercises.sessionId, params.sessionId))
      .all();

    if (existingSessionExercises.length === 0) {
      // Lazy materialization
      if (session.routineId === null) {
        throw new Error(`Occurrence ${params.routineExerciseId} does not belong to session routine`);
      }

      const templateRows = tx
        .select({
          id: routineExercises.id,
          exerciseId: routineExercises.exerciseId,
          orderIndex: routineExercises.orderIndex,
        })
        .from(routineExercises)
        .where(eq(routineExercises.routineId, session.routineId))
        .orderBy(routineExercises.orderIndex)
        .all();

      const target = templateRows.find((r) => r.id === params.routineExerciseId);
      if (!target || target.exerciseId === null) {
        throw new Error(`Occurrence ${params.routineExerciseId} does not belong to session routine`);
      }

      const now = Date.now();
      for (const r of templateRows) {
        if (r.exerciseId === null) continue;
        const isTarget = r.id === params.routineExerciseId;
        tx.insert(sessionExercises)
          .values({
            sessionId: params.sessionId,
            routineExerciseId: r.id,
            exerciseId: r.exerciseId,
            position: r.orderIndex ?? 0,
            status: isTarget ? 'removed' : 'pending',
            removedAt: isTarget ? now : null,
          })
          .run();
      }

      const liveSets = tx
        .select({ count: sql<number>`count(*)` })
        .from(sets)
        .where(
          and(
            eq(sets.sessionId, params.sessionId),
            eq(sets.routineExerciseId, params.routineExerciseId),
            isNull(sets.deletedAt)
          )
        )
        .get();

      result = {
        routineExerciseId: params.routineExerciseId,
        exerciseId: target.exerciseId,
        position: target.orderIndex ?? 0,
        keptSetCount: Number(liveSets?.count ?? 0),
      };
      return;
    }

    // Already materialized
    const target = existingSessionExercises.find(
      (se) => se.routineExerciseId === params.routineExerciseId
    );

    if (!target) {
      throw new Error(`Occurrence ${params.routineExerciseId} not found in session exercises`);
    }

    if (target.status !== 'removed') {
      tx.update(sessionExercises)
        .set({
          status: 'removed',
          removedAt: Date.now(),
        })
        .where(
          and(
            eq(sessionExercises.sessionId, params.sessionId),
            eq(sessionExercises.routineExerciseId, params.routineExerciseId)
          )
        )
        .run();
    }

    const liveSets = tx
      .select({ count: sql<number>`count(*)` })
      .from(sets)
      .where(
        and(
          eq(sets.sessionId, params.sessionId),
          eq(sets.routineExerciseId, params.routineExerciseId),
          isNull(sets.deletedAt)
        )
      )
      .get();

    result = {
      routineExerciseId: target.routineExerciseId as number,
      exerciseId: target.exerciseId,
      position: target.position,
      keptSetCount: Number(liveSets?.count ?? 0),
    };
  });

  await Promise.resolve(runTx);

  if (!result) {
    throw new Error('Failed to remove session exercise');
  }

  return result;
}

/**
 * Restores a previously removed occurrence back to 'pending' state.
 * Preserves its original position and relative order.
 */
export async function restoreSessionExercise(
  params: { sessionId: number; routineExerciseId: number },
  customDb?: unknown
): Promise<void> {
  const dbInstance = resolveDb(customDb);

  const runTx = dbInstance.transaction((tx) => {
    const session = tx
      .select({
        id: sessions.id,
        routineId: sessions.routineId,
        endTime: sessions.endTime,
        deletedAt: sessions.deletedAt,
      })
      .from(sessions)
      .where(eq(sessions.id, params.sessionId))
      .get();

    if (!session) {
      throw new Error(`Session ${params.sessionId} not found`);
    }

    if (session.endTime !== null) {
      throw new Error(`Session ${params.sessionId} is already finished`);
    }

    if (session.deletedAt !== null) {
      throw new Error(`Session ${params.sessionId} is deleted`);
    }

    const existingSessionExercises = tx
      .select({
        id: sessionExercises.id,
        routineExerciseId: sessionExercises.routineExerciseId,
        status: sessionExercises.status,
      })
      .from(sessionExercises)
      .where(eq(sessionExercises.sessionId, params.sessionId))
      .all();

    if (existingSessionExercises.length === 0) {
      if (session.routineId === null) {
        throw new Error(`Occurrence ${params.routineExerciseId} does not belong to session routine`);
      }
      const match = tx
        .select({ id: routineExercises.id })
        .from(routineExercises)
        .where(
          and(
            eq(routineExercises.routineId, session.routineId),
            eq(routineExercises.id, params.routineExerciseId)
          )
        )
        .get();
      if (!match) {
        throw new Error(`Occurrence ${params.routineExerciseId} does not belong to session routine`);
      }
      return;
    }

    const target = existingSessionExercises.find(
      (se) => se.routineExerciseId === params.routineExerciseId
    );

    if (!target) {
      throw new Error(`Occurrence ${params.routineExerciseId} not found in session exercises`);
    }

    if (target.status === 'removed') {
      tx.update(sessionExercises)
        .set({
          status: 'pending',
          removedAt: null,
        })
        .where(
          and(
            eq(sessionExercises.sessionId, params.sessionId),
            eq(sessionExercises.routineExerciseId, params.routineExerciseId)
          )
        )
        .run();
    }
  });

  await Promise.resolve(runTx);
}

/**
 * Pure resolution of crash recovery context against SQLite state.
 * Never resurrects a removed occurrence even when logged sets exist.
 */
export async function resolveRecoveryContext(
  context: Record<string, unknown>,
  customDb?: unknown
): Promise<RecoveryResolution> {
  const dbInstance = resolveDb(customDb);
  const sessionId = typeof context?.sessionId === 'number' ? context.sessionId : Number(context?.sessionId);

  if (!sessionId || isNaN(sessionId)) {
    return { action: 'finish', context: null };
  }

  const pendingQueue = await getPendingQueue(sessionId, dbInstance);

  const currentRoutineExerciseId =
    context.routineExerciseId !== null && context.routineExerciseId !== undefined
      ? Number(context.routineExerciseId)
      : null;

  const isCurrentPending =
    currentRoutineExerciseId !== null &&
    pendingQueue.some((item) => item.routineExerciseId === currentRoutineExerciseId);

  if (isCurrentPending) {
    const resumedContext: RecoveryContextShape = {
      ...context,
      routineExerciseId: currentRoutineExerciseId,
      exerciseId: context.exerciseId !== undefined && context.exerciseId !== null ? Number(context.exerciseId) : null,
      weight: typeof context.weight === 'string' ? context.weight : '',
      reps: typeof context.reps === 'string' ? context.reps : '',
      isDirty: Boolean(context.isDirty),
    };
    return {
      action: 'resume',
      context: resumedContext,
    };
  }

  // Not pending (removed or unassigned)
  if (pendingQueue.length === 0) {
    return {
      action: 'finish',
      context: null,
    };
  }

  // Find position of the removed occurrence
  let currentPosition = -1;
  if (currentRoutineExerciseId !== null) {
    const row = dbInstance
      .select({ position: sessionExercises.position })
      .from(sessionExercises)
      .where(
        and(
          eq(sessionExercises.sessionId, sessionId),
          eq(sessionExercises.routineExerciseId, currentRoutineExerciseId)
        )
      )
      .get();

    if (row && typeof row.position === 'number') {
      currentPosition = row.position;
    } else {
      const templateRow = dbInstance
        .select({ orderIndex: routineExercises.orderIndex })
        .from(routineExercises)
        .where(eq(routineExercises.id, currentRoutineExerciseId))
        .get();
      if (templateRow?.orderIndex !== null && templateRow?.orderIndex !== undefined) {
        currentPosition = templateRow.orderIndex;
      }
    }
  }

  // Pick first pending with position > currentPosition, or first pending
  const nextItem =
    (currentPosition >= 0
      ? pendingQueue.find((item) => item.position > currentPosition)
      : null) ?? pendingQueue[0];

  const exerciseRow = dbInstance
    .select({
      name: exercises.name,
      type: exercises.type,
    })
    .from(exercises)
    .where(eq(exercises.id, nextItem.exerciseId))
    .get();

  const routineExerciseRow =
    nextItem.routineExerciseId !== null
      ? dbInstance
          .select({
            target: routineExercises.target,
            notes: routineExercises.notes,
            restSeconds: routineExercises.restSeconds,
          })
          .from(routineExercises)
          .where(eq(routineExercises.id, nextItem.routineExerciseId))
          .get()
      : null;

  const advancedContext = {
    ...context,
    routineExerciseId: nextItem.routineExerciseId,
    exerciseId: nextItem.exerciseId,
    exerciseName: exerciseRow?.name ?? (context.exerciseName as string | undefined) ?? '',
    exerciseType: exerciseRow?.type ?? (context.exerciseType as string | undefined) ?? 'strength',
    target: routineExerciseRow?.target ?? undefined,
    notes: routineExerciseRow?.notes ?? undefined,
    restSeconds: routineExerciseRow?.restSeconds ?? null,
    weight: '',
    reps: '',
    duration: '',
    rir: 0,
    isWarmupMode: false,
    isDirty: false,
    activeSetTime: 0,
    isActiveSetRunning: false,
    activeSetStartedAt: null,
    operationId: null,
  };

  return {
    action: 'advance',
    context: advancedContext,
  };
}

export const SessionOccurrenceService = {
  getPendingQueue,
  removeSessionExercise,
  restoreSessionExercise,
  resolveRecoveryContext,
};

export default SessionOccurrenceService;

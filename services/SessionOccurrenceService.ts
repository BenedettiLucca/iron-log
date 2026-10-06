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
  id?: number;
  sessionExerciseId?: number;
  routineExerciseId: number | null;
  exerciseId: number;
  position: number;
}

export interface RemoveResult {
  sessionExerciseId?: number;
  routineExerciseId: number | null;
  exerciseId: number;
  position: number;
  keptSetCount: number;
}

export interface RemoveExerciseParams {
  sessionId: number;
  routineExerciseId?: number | null;
  sessionExerciseId?: number | null;
  exerciseId?: number | null;
}

export interface RestoreExerciseParams {
  sessionId: number;
  routineExerciseId?: number | null;
  sessionExerciseId?: number | null;
  exerciseId?: number | null;
}

export type RecoveryAction = 'resume' | 'advance' | 'finish';

export interface RecoveryContextShape {
  sessionExerciseId?: number | null;
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
      id: sessionExercises.id,
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
      .filter((row) => row.status === 'pending')
      .map((row) => ({
        id: row.id,
        sessionExerciseId: row.id,
        routineExerciseId: row.routineExerciseId,
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
  params: RemoveExerciseParams,
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
        throw new Error(`Occurrence ${params.routineExerciseId ?? params.sessionExerciseId ?? params.exerciseId} does not belong to session routine`);
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
            params.routineExerciseId != null
              ? eq(sets.routineExerciseId, params.routineExerciseId)
              : isNull(sets.routineExerciseId),
            isNull(sets.deletedAt)
          )
        )
        .get();

      result = {
        sessionExerciseId: undefined,
        routineExerciseId: params.routineExerciseId ?? null,
        exerciseId: target.exerciseId,
        position: target.orderIndex ?? 0,
        keptSetCount: Number(liveSets?.count ?? 0),
      };
      return;
    }

    // Already materialized or freestyle session exercises
    const target = existingSessionExercises.find((se) => {
      if (params.sessionExerciseId != null) {
        return se.id === params.sessionExerciseId;
      }
      if (params.routineExerciseId != null) {
        return se.routineExerciseId === params.routineExerciseId;
      }
      if (params.exerciseId != null) {
        return se.exerciseId === params.exerciseId;
      }
      return false;
    });

    if (!target) {
      throw new Error(`Occurrence ${params.routineExerciseId ?? params.sessionExerciseId ?? params.exerciseId} not found in session exercises`);
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
            eq(sessionExercises.id, target.id)
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
          target.routineExerciseId !== null
            ? eq(sets.routineExerciseId, target.routineExerciseId)
            : eq(sets.exerciseId, target.exerciseId),
          isNull(sets.deletedAt)
        )
      )
      .get();

    result = {
      sessionExerciseId: target.id,
      routineExerciseId: target.routineExerciseId,
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
  params: RestoreExerciseParams,
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
        exerciseId: sessionExercises.exerciseId,
        status: sessionExercises.status,
      })
      .from(sessionExercises)
      .where(eq(sessionExercises.sessionId, params.sessionId))
      .all();

    if (existingSessionExercises.length === 0) {
      if (session.routineId === null) {
        throw new Error(`Occurrence ${params.routineExerciseId ?? params.sessionExerciseId ?? params.exerciseId} does not belong to session routine`);
      }
      const match = tx
        .select({ id: routineExercises.id })
        .from(routineExercises)
        .where(
          and(
            eq(routineExercises.routineId, session.routineId),
            params.routineExerciseId != null ? eq(routineExercises.id, params.routineExerciseId) : undefined
          )
        )
        .get();
      if (!match) {
        throw new Error(`Occurrence ${params.routineExerciseId} does not belong to session routine`);
      }
      return;
    }

    const target = existingSessionExercises.find((se) => {
      if (params.sessionExerciseId != null) {
        return se.id === params.sessionExerciseId;
      }
      if (params.routineExerciseId != null) {
        return se.routineExerciseId === params.routineExerciseId;
      }
      if (params.exerciseId != null) {
        return se.exerciseId === params.exerciseId;
      }
      return false;
    });

    if (!target) {
      throw new Error(`Occurrence ${params.routineExerciseId ?? params.sessionExerciseId ?? params.exerciseId} not found in session exercises`);
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
            eq(sessionExercises.id, target.id)
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

  const currentSessionExerciseId =
    context.sessionExerciseId !== null && context.sessionExerciseId !== undefined
      ? Number(context.sessionExerciseId)
      : null;

  const currentRoutineExerciseId =
    context.routineExerciseId !== null && context.routineExerciseId !== undefined
      ? Number(context.routineExerciseId)
      : null;

  const currentExerciseId =
    context.exerciseId !== null && context.exerciseId !== undefined
      ? Number(context.exerciseId)
      : null;

  const isCurrentPending =
    pendingQueue.some((item) => {
      if (currentSessionExerciseId !== null && item.sessionExerciseId !== undefined) {
        return item.sessionExerciseId === currentSessionExerciseId;
      }
      if (currentRoutineExerciseId !== null && item.routineExerciseId !== null) {
        return item.routineExerciseId === currentRoutineExerciseId;
      }
      if (currentExerciseId !== null) {
        return item.exerciseId === currentExerciseId;
      }
      return false;
    });

  if (isCurrentPending) {
    const resumedContext: RecoveryContextShape = {
      ...context,
      sessionExerciseId: currentSessionExerciseId,
      routineExerciseId: currentRoutineExerciseId,
      exerciseId: currentExerciseId,
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
  if (currentSessionExerciseId !== null) {
    const row = dbInstance
      .select({ position: sessionExercises.position })
      .from(sessionExercises)
      .where(
        and(
          eq(sessionExercises.sessionId, sessionId),
          eq(sessionExercises.id, currentSessionExerciseId)
        )
      )
      .get();
    if (row && typeof row.position === 'number') {
      currentPosition = row.position;
    }
  } else if (currentRoutineExerciseId !== null) {
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
  } else if (currentExerciseId !== null) {
    const row = dbInstance
      .select({ position: sessionExercises.position })
      .from(sessionExercises)
      .where(
        and(
          eq(sessionExercises.sessionId, sessionId),
          eq(sessionExercises.exerciseId, currentExerciseId)
        )
      )
      .get();
    if (row && typeof row.position === 'number') {
      currentPosition = row.position;
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
    routineExerciseId: nextItem.routineExerciseId ?? null,
    sessionExerciseId: nextItem.sessionExerciseId ?? nextItem.id,
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

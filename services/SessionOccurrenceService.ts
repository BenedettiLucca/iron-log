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
  supersetGroupId?: string | null;
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
  supersetGroupId?: string | null;
  [key: string]: unknown;
}

export interface RecoveryResolution {
  action: RecoveryAction;
  context: RecoveryContextShape | null;
}

export interface TimerState {
  timerStatus: 'idle' | 'running' | 'finished';
  timerTarget: number | null;
  timerSeconds: number | null;
}

export interface CreateGroupOptions {
  sessionId?: number;
  routineId?: number;
  groupId?: string;
}

export interface CreateGroupResult {
  groupId: string;
  occurrenceIds: number[];
  toString(): string;
}

export interface PairMidSessionOptions {
  sessionId?: number;
  groupId?: string;
  target?: string;
  notes?: string;
  restSeconds?: number | null;
  timerState?: Partial<TimerState> | null;
  runningRest?: Partial<TimerState> | null;
}

export interface PairMidSessionResult {
  groupId: string;
  existingOccurrenceId: number;
  pairedOccurrenceId: number;
  exerciseId: number;
  position: number;
  timerState: TimerState | null;
  preservedRest: TimerState | null;
}

export interface DissolveIfSingleOptions {
  sessionId?: number;
  routineId?: number;
  groupId?: string;
}

export interface DissolveIfSingleResult {
  dissolved: boolean;
  groupId?: string | null;
  dissolvedOccurrenceIds: number[];
}

export interface RemoveFromGroupResult {
  removedOccurrenceId: number;
  dissolvedGroupId: string | null;
  remainingMembers: number[];
}

export interface SharedRestSemanticsResult {
  isSuperset: boolean;
  groupId: string | null;
  isLastInGroup: boolean;
  shouldTriggerRest: boolean;
  groupMembers: QueueItem[];
}

type QueryRunner = {
  select: typeof defaultDb.select;
  insert: typeof defaultDb.insert;
  update: typeof defaultDb.update;
  delete?: typeof defaultDb.delete;
};

type DbRunner = QueryRunner & {
  transaction<T>(cb: (tx: QueryRunner) => T): T | Promise<T>;
};

function resolveDb(customDb?: unknown): DbRunner {
  return (customDb ?? defaultDb) as DbRunner;
}

// In-memory cache for preserved running rest during mid-session pairing
const preservedRestBySession = new Map<number, TimerState>();

export function getPreservedRest(sessionId: number): TimerState | null {
  return preservedRestBySession.get(sessionId) ?? null;
}

export function setPreservedRest(sessionId: number, timer: TimerState | null): void {
  if (timer) {
    preservedRestBySession.set(sessionId, { ...timer });
  } else {
    preservedRestBySession.delete(sessionId);
  }
}

export function clearPreservedRest(sessionId: number): void {
  preservedRestBySession.delete(sessionId);
}

/**
 * Materializes template occurrences into session_exercises for a given session inside a transaction.
 */
function materializeSessionExercisesTx(
  tx: QueryRunner,
  sessionId: number,
  sessionRoutineId: number | null
): void {
  if (sessionRoutineId === null) return;

  const templateRows = tx
    .select({
      id: routineExercises.id,
      exerciseId: routineExercises.exerciseId,
      orderIndex: routineExercises.orderIndex,
      supersetGroupId: routineExercises.supersetGroupId,
    })
    .from(routineExercises)
    .where(eq(routineExercises.routineId, sessionRoutineId))
    .orderBy(routineExercises.orderIndex)
    .all();

  for (const r of templateRows) {
    if (r.exerciseId === null) continue;
    tx.insert(sessionExercises)
      .values({
        sessionId,
        routineExerciseId: r.id,
        exerciseId: r.exerciseId,
        position: r.orderIndex ?? 0,
        status: 'pending',
        removedAt: null,
        supersetGroupId: r.supersetGroupId ?? null,
      })
      .run();
  }
}

/**
 * Returns pending exercises queue for an active session in routine position order.
 * If session_exercises has not yet been materialized (no removal occurred yet),
 * reads directly from routine template.
 * Groups with only one pending member dissolve automatically (supersetGroupId -> null).
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
      supersetGroupId: sessionExercises.supersetGroupId,
    })
    .from(sessionExercises)
    .where(eq(sessionExercises.sessionId, sessionId))
    .orderBy(sessionExercises.position)
    .all();

  if (existingSessionExercises.length > 0) {
    const pendingRows = existingSessionExercises.filter(
      (row) => row.status === 'pending'
    );

    // Count pending occurrences per superset group
    const groupCounts = new Map<string, number>();
    for (const row of pendingRows) {
      if (row.supersetGroupId) {
        groupCounts.set(row.supersetGroupId, (groupCounts.get(row.supersetGroupId) ?? 0) + 1);
      }
    }

    return pendingRows.map((row) => ({
      id: row.id,
      sessionExerciseId: row.id,
      routineExerciseId: row.routineExerciseId,
      exerciseId: row.exerciseId,
      position: row.position,
      // A group of one dissolves automatically:
      supersetGroupId:
        row.supersetGroupId && (groupCounts.get(row.supersetGroupId) ?? 0) >= 2
          ? row.supersetGroupId
          : null,
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
      supersetGroupId: routineExercises.supersetGroupId,
    })
    .from(routineExercises)
    .where(eq(routineExercises.routineId, session.routineId))
    .orderBy(routineExercises.orderIndex)
    .all();

  const validTemplate = templateRows.filter((row) => row.exerciseId !== null);
  const templateGroupCounts = new Map<string, number>();
  for (const row of validTemplate) {
    if (row.supersetGroupId) {
      templateGroupCounts.set(
        row.supersetGroupId,
        (templateGroupCounts.get(row.supersetGroupId) ?? 0) + 1
      );
    }
  }

  return validTemplate.map((row) => ({
    routineExerciseId: row.id,
    exerciseId: row.exerciseId as number,
    position: row.orderIndex ?? 0,
    supersetGroupId:
      row.supersetGroupId && (templateGroupCounts.get(row.supersetGroupId) ?? 0) >= 2
        ? row.supersetGroupId
        : null,
  }));
}

/**
 * Removes an exercise occurrence from the active session without touching routine template.
 * - Shrinks the pending queue of that session.
 * - History and already-logged sets are strictly preserved.
 * - On first removal, materializes routine occurrences into session_exercises lazily.
 * - If member was part of a superset group, the remaining member is left intact.
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
        supersetGroupId: sessionExercises.supersetGroupId,
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
          supersetGroupId: routineExercises.supersetGroupId,
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
            supersetGroupId: r.supersetGroupId ?? null,
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
 * Preserves original position and restores group membership if previously grouped.
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
        supersetGroupId: sessionExercises.supersetGroupId,
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
 * Creates a superset group for two or more occurrences.
 * Can be applied at plan-time (routine_exercises) or mid-session (session_exercises).
 */
export async function createGroup(
  arg1: number[] | { sessionId?: number; routineId?: number; occurrenceIds: number[]; groupId?: string },
  arg2?: CreateGroupOptions | unknown,
  arg3?: unknown
): Promise<CreateGroupResult> {
  let occurrenceIds: number[];
  let options: CreateGroupOptions = {};
  let customDb: unknown;

  if (Array.isArray(arg1)) {
    occurrenceIds = arg1;
    if (typeof arg2 === 'object' && arg2 !== null && !('select' in arg2)) {
      options = arg2 as CreateGroupOptions;
      customDb = arg3;
    } else {
      customDb = arg2;
    }
  } else if (typeof arg1 === 'object' && arg1 !== null) {
    occurrenceIds = arg1.occurrenceIds ?? [];
    options = arg1;
    customDb = arg2;
  } else {
    throw new Error('Invalid arguments to createGroup');
  }

  if (!occurrenceIds || occurrenceIds.length < 2) {
    throw new Error('A superset group requires at least 2 exercise occurrences');
  }

  const dbInstance = resolveDb(customDb);
  const groupId = options.groupId ?? `ss_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  const runTx = dbInstance.transaction((tx) => {
    if (options.sessionId) {
      const session = tx
        .select({ id: sessions.id, routineId: sessions.routineId })
        .from(sessions)
        .where(eq(sessions.id, options.sessionId))
        .get();

      if (!session) {
        throw new Error(`Session ${options.sessionId} not found`);
      }

      const existingSessionExercises = tx
        .select({ id: sessionExercises.id, routineExerciseId: sessionExercises.routineExerciseId })
        .from(sessionExercises)
        .where(eq(sessionExercises.sessionId, options.sessionId))
        .all();

      if (existingSessionExercises.length === 0) {
        materializeSessionExercisesTx(tx, options.sessionId, session.routineId);
      }

      for (const occurrenceId of occurrenceIds) {
        tx.update(sessionExercises)
          .set({ supersetGroupId: groupId })
          .where(
            and(
              eq(sessionExercises.sessionId, options.sessionId),
              eq(sessionExercises.routineExerciseId, occurrenceId)
            )
          )
          .run();
      }
    } else {
      for (const occurrenceId of occurrenceIds) {
        tx.update(routineExercises)
          .set({ supersetGroupId: groupId })
          .where(eq(routineExercises.id, occurrenceId))
          .run();
      }
    }
  });

  await Promise.resolve(runTx);

  const result: CreateGroupResult = {
    groupId,
    occurrenceIds: [...occurrenceIds],
    toString() {
      return this.groupId;
    },
  };

  return result;
}

/**
 * Pairs an existing occurrence with a new exercise mid-session into a superset group.
 * Preserves running rest timer once if active.
 */
export async function pairMidSession(
  arg1:
    | number
    | {
        sessionId?: number;
        existingOccurrenceId: number;
        newExercise: number | { id?: number; exerciseId?: number };
        timerState?: Partial<TimerState> | null;
        runningRest?: Partial<TimerState> | null;
        target?: string;
        notes?: string;
        restSeconds?: number | null;
        groupId?: string;
      },
  arg2?: number | { id?: number; exerciseId?: number } | PairMidSessionOptions | unknown,
  arg3?: PairMidSessionOptions | unknown,
  arg4?: unknown
): Promise<PairMidSessionResult> {
  let sessionId: number | undefined;
  let existingOccurrenceId: number;
  let newExercise: number | { id?: number; exerciseId?: number };
  let options: PairMidSessionOptions = {};
  let customDb: unknown;

  if (typeof arg1 === 'object' && arg1 !== null && 'existingOccurrenceId' in arg1) {
    sessionId = arg1.sessionId;
    existingOccurrenceId = arg1.existingOccurrenceId;
    newExercise = arg1.newExercise;
    options = arg1;
    customDb = arg2;
  } else if (typeof arg1 === 'number' && typeof arg2 === 'number' && (typeof arg3 === 'number' || typeof arg3 === 'object')) {
    sessionId = arg1;
    existingOccurrenceId = arg2;
    newExercise = arg3 as number | { id?: number; exerciseId?: number };
    options = (typeof arg4 === 'object' && arg4 !== null && !('select' in arg4) ? arg4 : {}) as PairMidSessionOptions;
    customDb = typeof arg4 === 'object' && arg4 !== null && 'select' in arg4 ? arg4 : undefined;
  } else if (typeof arg1 === 'number') {
    existingOccurrenceId = arg1;
    newExercise = arg2 as number | { id?: number; exerciseId?: number };
    if (typeof arg3 === 'object' && arg3 !== null && !('select' in arg3)) {
      options = arg3 as PairMidSessionOptions;
      sessionId = options.sessionId;
      customDb = arg4;
    } else {
      customDb = arg3;
    }
  } else {
    throw new Error('Invalid arguments to pairMidSession');
  }

  const dbInstance = resolveDb(customDb);

  if (!sessionId) {
    const existingSe = dbInstance
      .select({ sessionId: sessionExercises.sessionId })
      .from(sessionExercises)
      .where(eq(sessionExercises.routineExerciseId, existingOccurrenceId))
      .get();
    if (existingSe) {
      sessionId = existingSe.sessionId;
    } else {
      const activeSession = dbInstance
        .select({ id: sessions.id })
        .from(sessions)
        .where(isNull(sessions.endTime))
        .get();
      if (activeSession) {
        sessionId = activeSession.id;
      }
    }
  }

  if (!sessionId) {
    throw new Error('sessionId could not be resolved for pairMidSession');
  }

  const finalSessionId = sessionId;
  let result: PairMidSessionResult | undefined;

  const runTx = dbInstance.transaction((tx) => {
    const session = tx
      .select({ id: sessions.id, routineId: sessions.routineId, endTime: sessions.endTime, deletedAt: sessions.deletedAt })
      .from(sessions)
      .where(eq(sessions.id, finalSessionId))
      .get();

    if (!session) {
      throw new Error(`Session ${finalSessionId} not found`);
    }
    if (session.endTime !== null) {
      throw new Error(`Session ${finalSessionId} is already finished`);
    }
    if (session.deletedAt !== null) {
      throw new Error(`Session ${finalSessionId} is deleted`);
    }

    let existingRows = tx
      .select({
        id: sessionExercises.id,
        routineExerciseId: sessionExercises.routineExerciseId,
        exerciseId: sessionExercises.exerciseId,
        position: sessionExercises.position,
        status: sessionExercises.status,
        supersetGroupId: sessionExercises.supersetGroupId,
      })
      .from(sessionExercises)
      .where(eq(sessionExercises.sessionId, finalSessionId))
      .orderBy(sessionExercises.position)
      .all();

    if (existingRows.length === 0) {
      materializeSessionExercisesTx(tx, finalSessionId, session.routineId);
      existingRows = tx
        .select({
          id: sessionExercises.id,
          routineExerciseId: sessionExercises.routineExerciseId,
          exerciseId: sessionExercises.exerciseId,
          position: sessionExercises.position,
          status: sessionExercises.status,
          supersetGroupId: sessionExercises.supersetGroupId,
        })
        .from(sessionExercises)
        .where(eq(sessionExercises.sessionId, finalSessionId))
        .orderBy(sessionExercises.position)
        .all();
    }

    const existingOccurrence = existingRows.find(
      (se) => se.routineExerciseId === existingOccurrenceId
    );

    if (!existingOccurrence) {
      throw new Error(`Occurrence ${existingOccurrenceId} not found in session exercises`);
    }

    const groupId =
      existingOccurrence.supersetGroupId ??
      options.groupId ??
      `ss_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    if (existingOccurrence.supersetGroupId !== groupId) {
      tx.update(sessionExercises)
        .set({ supersetGroupId: groupId })
        .where(
          and(
            eq(sessionExercises.sessionId, finalSessionId),
            eq(sessionExercises.routineExerciseId, existingOccurrenceId)
          )
        )
        .run();
    }

    let pairedOccurrenceId: number;
    let pairedExerciseId: number;
    const targetPosition = existingOccurrence.position + 1;

    // Check if newExercise is an existing occurrence or exercise ID in the session
    const rawExerciseId =
      typeof newExercise === 'number'
        ? newExercise
        : (newExercise.exerciseId ?? newExercise.id);

    if (rawExerciseId === undefined) {
      throw new Error('newExercise ID is required');
    }

    const existingMatch = existingRows.find(
      (r) =>
        (r.routineExerciseId === rawExerciseId || r.exerciseId === rawExerciseId) &&
        r.routineExerciseId !== existingOccurrenceId &&
        r.status === 'pending'
    );

    if (existingMatch && existingMatch.routineExerciseId !== null) {
      // Pair existing occurrence
      pairedOccurrenceId = existingMatch.routineExerciseId;
      pairedExerciseId = existingMatch.exerciseId;

      tx.update(sessionExercises)
        .set({
          supersetGroupId: groupId,
          position: targetPosition,
        })
        .where(
          and(
            eq(sessionExercises.sessionId, finalSessionId),
            eq(sessionExercises.routineExerciseId, pairedOccurrenceId)
          )
        )
        .run();
    } else {
      // Add new exercise ad-hoc mid-session (routineId = null keeps routine template untouched)
      const insertedRoutineExercise = tx
        .insert(routineExercises)
        .values({
          routineId: null,
          exerciseId: rawExerciseId,
          orderIndex: targetPosition,
          target: options.target ?? null,
          notes: options.notes ?? null,
          restSeconds: options.restSeconds ?? null,
          supersetGroupId: groupId,
        })
        .returning({ id: routineExercises.id })
        .get();

      pairedOccurrenceId = insertedRoutineExercise.id;
      pairedExerciseId = rawExerciseId;

      // Shift existing exercises after existingOccurrence
      for (const row of existingRows) {
        if (row.position >= targetPosition && row.routineExerciseId !== existingOccurrenceId) {
          tx.update(sessionExercises)
            .set({ position: row.position + 1 })
            .where(
              and(
                eq(sessionExercises.sessionId, finalSessionId),
                eq(sessionExercises.id, row.id)
              )
            )
            .run();
        }
      }

      tx.insert(sessionExercises)
        .values({
          sessionId: finalSessionId,
          routineExerciseId: pairedOccurrenceId,
          exerciseId: pairedExerciseId,
          position: targetPosition,
          status: 'pending',
          removedAt: null,
          supersetGroupId: groupId,
        })
        .run();
    }

    // Preserve running rest timer once if active
    const incomingTimer = options.timerState ?? options.runningRest ?? null;
    let preservedRest: TimerState | null = null;
    if (incomingTimer) {
      preservedRest = {
        timerStatus: incomingTimer.timerStatus ?? 'running',
        timerTarget: incomingTimer.timerTarget ?? null,
        timerSeconds: incomingTimer.timerSeconds ?? null,
      };
      setPreservedRest(finalSessionId, preservedRest);
    }

    result = {
      groupId,
      existingOccurrenceId,
      pairedOccurrenceId,
      exerciseId: pairedExerciseId,
      position: targetPosition,
      timerState: preservedRest,
      preservedRest,
    };
  });

  await Promise.resolve(runTx);

  if (!result) {
    throw new Error('Failed to pair mid-session');
  }

  return result;
}

/**
 * Automatically dissolves superset group if it has only one pending member remaining.
 */
export async function dissolveIfSingle(
  arg1: string | number | { sessionId?: number; routineId?: number; groupId?: string },
  arg2?: DissolveIfSingleOptions | unknown,
  arg3?: unknown
): Promise<DissolveIfSingleResult> {
  let sessionId: number | undefined;
  let routineId: number | undefined;
  let groupId: string | undefined;
  let customDb: unknown;

  if (typeof arg1 === 'object' && arg1 !== null) {
    sessionId = arg1.sessionId;
    routineId = arg1.routineId;
    groupId = arg1.groupId;
    customDb = arg2;
  } else if (typeof arg1 === 'string') {
    groupId = arg1;
    if (typeof arg2 === 'object' && arg2 !== null && !('select' in arg2)) {
      const opts = arg2 as DissolveIfSingleOptions;
      sessionId = opts.sessionId;
      routineId = opts.routineId;
      customDb = arg3;
    } else if (typeof arg2 === 'number') {
      sessionId = arg2;
      customDb = arg3;
    } else {
      customDb = arg2;
    }
  } else if (typeof arg1 === 'number') {
    sessionId = arg1;
    customDb = arg2;
  }

  const dbInstance = resolveDb(customDb);
  let dissolved = false;
  const dissolvedOccurrenceIds: number[] = [];

  const runTx = dbInstance.transaction((tx) => {
    if (sessionId) {
      let rows = tx
        .select({
          routineExerciseId: sessionExercises.routineExerciseId,
          supersetGroupId: sessionExercises.supersetGroupId,
          status: sessionExercises.status,
        })
        .from(sessionExercises)
        .where(eq(sessionExercises.sessionId, sessionId))
        .all();

      if (rows.length === 0) {
        const session = tx
          .select({ routineId: sessions.routineId })
          .from(sessions)
          .where(eq(sessions.id, sessionId))
          .get();
        if (session && session.routineId !== null) {
          materializeSessionExercisesTx(tx, sessionId, session.routineId);
          rows = tx
            .select({
              routineExerciseId: sessionExercises.routineExerciseId,
              supersetGroupId: sessionExercises.supersetGroupId,
              status: sessionExercises.status,
            })
            .from(sessionExercises)
            .where(eq(sessionExercises.sessionId, sessionId))
            .all();
        }
      }

      const groupsToCheck = groupId ? [groupId] : Array.from(new Set(rows.map((r) => r.supersetGroupId).filter(Boolean) as string[]));

      for (const gid of groupsToCheck) {
        const pendingInGroup = rows.filter((r) => r.supersetGroupId === gid && r.status === 'pending');
        if (pendingInGroup.length === 1) {
          dissolved = true;
          for (const member of pendingInGroup) {
            if (member.routineExerciseId) {
              dissolvedOccurrenceIds.push(member.routineExerciseId);
            }
          }
          tx.update(sessionExercises)
            .set({ supersetGroupId: null })
            .where(
              and(
                eq(sessionExercises.sessionId, sessionId),
                eq(sessionExercises.supersetGroupId, gid)
              )
            )
            .run();
        }
      }
    } else if (routineId) {
      const rows = tx
        .select({
          id: routineExercises.id,
          supersetGroupId: routineExercises.supersetGroupId,
        })
        .from(routineExercises)
        .where(eq(routineExercises.routineId, routineId))
        .all();

      const groupsToCheck = groupId ? [groupId] : Array.from(new Set(rows.map((r) => r.supersetGroupId).filter(Boolean) as string[]));

      for (const gid of groupsToCheck) {
        const members = rows.filter((r) => r.supersetGroupId === gid);
        if (members.length === 1) {
          dissolved = true;
          for (const m of members) {
            dissolvedOccurrenceIds.push(m.id);
          }
          tx.update(routineExercises)
            .set({ supersetGroupId: null })
            .where(
              and(
                eq(routineExercises.routineId, routineId),
                eq(routineExercises.supersetGroupId, gid)
              )
            )
            .run();
        }
      }
    } else if (groupId) {
      // Global check by groupId across routine_exercises
      const rows = tx
        .select({ id: routineExercises.id })
        .from(routineExercises)
        .where(eq(routineExercises.supersetGroupId, groupId))
        .all();

      if (rows.length === 1) {
        dissolved = true;
        for (const m of rows) {
          dissolvedOccurrenceIds.push(m.id);
        }
        tx.update(routineExercises)
          .set({ supersetGroupId: null })
          .where(eq(routineExercises.supersetGroupId, groupId))
          .run();
      }
    }
  });

  await Promise.resolve(runTx);

  return {
    dissolved,
    groupId: groupId ?? null,
    dissolvedOccurrenceIds,
  };
}

/**
 * Removes an exercise occurrence from its superset group without removing it from the session.
 * If the remaining group only has one member, dissolves the remaining group automatically.
 */
export async function removeFromGroup(
  params: { sessionId?: number; routineId?: number; routineExerciseId: number } | number,
  customDb?: unknown
): Promise<RemoveFromGroupResult> {
  const routineExerciseId = typeof params === 'number' ? params : params.routineExerciseId;
  const sessionId = typeof params === 'object' ? params.sessionId : undefined;
  const routineId = typeof params === 'object' ? params.routineId : undefined;
  const dbInstance = resolveDb(customDb);

  let dissolvedGroupId: string | null = null;
  const remainingMembers: number[] = [];

  const runTx = dbInstance.transaction((tx) => {
    if (sessionId) {
      const target = tx
        .select({ supersetGroupId: sessionExercises.supersetGroupId })
        .from(sessionExercises)
        .where(
          and(
            eq(sessionExercises.sessionId, sessionId),
            eq(sessionExercises.routineExerciseId, routineExerciseId)
          )
        )
        .get();

      if (!target || !target.supersetGroupId) {
        return;
      }

      const gid = target.supersetGroupId;

      tx.update(sessionExercises)
        .set({ supersetGroupId: null })
        .where(
          and(
            eq(sessionExercises.sessionId, sessionId),
            eq(sessionExercises.routineExerciseId, routineExerciseId)
          )
        )
        .run();

      const remaining = tx
        .select({ routineExerciseId: sessionExercises.routineExerciseId })
        .from(sessionExercises)
        .where(
          and(
            eq(sessionExercises.sessionId, sessionId),
            eq(sessionExercises.supersetGroupId, gid),
            eq(sessionExercises.status, 'pending')
          )
        )
        .all();

      if (remaining.length <= 1) {
        dissolvedGroupId = gid;
        tx.update(sessionExercises)
          .set({ supersetGroupId: null })
          .where(
            and(
              eq(sessionExercises.sessionId, sessionId),
              eq(sessionExercises.supersetGroupId, gid)
            )
          )
          .run();
      } else {
        for (const r of remaining) {
          if (r.routineExerciseId) remainingMembers.push(r.routineExerciseId);
        }
      }
    } else {
      const target = tx
        .select({ supersetGroupId: routineExercises.supersetGroupId, routineId: routineExercises.routineId })
        .from(routineExercises)
        .where(eq(routineExercises.id, routineExerciseId))
        .get();

      if (!target || !target.supersetGroupId) {
        return;
      }

      const gid = target.supersetGroupId;

      tx.update(routineExercises)
        .set({ supersetGroupId: null })
        .where(eq(routineExercises.id, routineExerciseId))
        .run();

      const rId = routineId ?? target.routineId;
      const remaining = tx
        .select({ id: routineExercises.id })
        .from(routineExercises)
        .where(
          rId
            ? and(eq(routineExercises.routineId, rId), eq(routineExercises.supersetGroupId, gid))
            : eq(routineExercises.supersetGroupId, gid)
        )
        .all();

      if (remaining.length <= 1) {
        dissolvedGroupId = gid;
        tx.update(routineExercises)
          .set({ supersetGroupId: null })
          .where(
            rId
              ? and(eq(routineExercises.routineId, rId), eq(routineExercises.supersetGroupId, gid))
              : eq(routineExercises.supersetGroupId, gid)
          )
          .run();
      } else {
        for (const r of remaining) {
          remainingMembers.push(r.id);
        }
      }
    }
  });

  await Promise.resolve(runTx);

  return {
    removedOccurrenceId: routineExerciseId,
    dissolvedGroupId,
    remainingMembers,
  };
}

/**
 * Resolves shared rest semantics for an occurrence in an active session.
 * - In a superset round: rest timer is NOT triggered until the last exercise of the group round.
 * - Single exercises and dissolved groups always trigger their normal rest timer.
 */
export async function resolveSharedRestSemantics(
  params: {
    sessionId: number;
    routineExerciseId: number;
    pendingQueue?: QueueItem[];
  },
  customDb?: unknown
): Promise<SharedRestSemanticsResult> {
  const queue = params.pendingQueue ?? (await getPendingQueue(params.sessionId, customDb));
  const current = queue.find((item) => item.routineExerciseId === params.routineExerciseId);

  if (!current || !current.supersetGroupId) {
    return {
      isSuperset: false,
      groupId: null,
      isLastInGroup: false,
      shouldTriggerRest: true,
      groupMembers: current ? [current] : [],
    };
  }

  const groupMembers = queue.filter((item) => item.supersetGroupId === current.supersetGroupId);

  if (groupMembers.length <= 1) {
    // Single member has dissolved automatically: leaves rest intact
    return {
      isSuperset: false,
      groupId: current.supersetGroupId,
      isLastInGroup: false,
      shouldTriggerRest: true,
      groupMembers,
    };
  }

  const lastMember = groupMembers[groupMembers.length - 1];
  const isLastInGroup = lastMember.routineExerciseId === current.routineExerciseId;

  return {
    isSuperset: true,
    groupId: current.supersetGroupId,
    isLastInGroup,
    shouldTriggerRest: isLastInGroup,
    groupMembers,
  };
}

/**
 * Pure resolution of crash recovery context against SQLite state.
 * Never resurrects a removed occurrence even when logged sets exist.
 * Keeps superset group membership intact.
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
  const currentItem = pendingQueue.find(
    (item) => item.routineExerciseId === currentRoutineExerciseId
  );

  if (isCurrentPending) {
    const resumedContext: RecoveryContextShape = {
      ...context,
      sessionExerciseId: currentSessionExerciseId,
      routineExerciseId: currentRoutineExerciseId,
      exerciseId: currentExerciseId,
      weight: typeof context.weight === 'string' ? context.weight : '',
      reps: typeof context.reps === 'string' ? context.reps : '',
      isDirty: Boolean(context.isDirty),
      supersetGroupId: currentItem?.supersetGroupId ?? (context.supersetGroupId as string | undefined) ?? null,
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
    supersetGroupId: nextItem.supersetGroupId ?? null,
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
  createGroup,
  pairMidSession,
  dissolveIfSingle,
  removeFromGroup,
  resolveSharedRestSemantics,
  getPreservedRest,
  setPreservedRest,
  clearPreservedRest,
};

export default SessionOccurrenceService;

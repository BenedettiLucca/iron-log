// services/MicroSessionService.ts — IL-66 micro-session service implementation
import { db as defaultDb } from '@/src/db/client';
import { exercises, sessions, sets } from '@/src/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import {
  finishSession,
  discardSession,
  type FinishSessionResult,
} from '@/services/SessionLifecycleService';

export const MICRO_SESSION_MARKER = '__micro__';

export class MicroSessionAlreadyActiveError extends Error {
  readonly code = 'MICRO_SESSION_ALREADY_ACTIVE';

  constructor(message = 'A micro session is already active') {
    super(message);
    this.name = 'MicroSessionAlreadyActiveError';
  }
}

export class MicroSetLimitError extends Error {
  readonly code = 'MICRO_SET_LIMIT_EXCEEDED';

  constructor(message = 'Only one set per exercise is allowed in micro session') {
    super(message);
    this.name = 'MicroSetLimitError';
  }
}

export class MicroSessionNotFoundError extends Error {
  readonly code = 'MICRO_SESSION_NOT_FOUND';

  constructor(message = 'Micro session not found') {
    super(message);
    this.name = 'MicroSessionNotFoundError';
  }
}

export interface MicroSessionDraft {
  routineName: string;
  startTime?: number;
  routineId?: number | null;
}

export interface MicroSetInput {
  exerciseId: number;
  weightKg: number;
  reps: number;
  setNumber?: number;
}

export interface FinishMicroSessionParams {
  sessionId?: number;
  startTime?: number;
  endTime?: number;
  weight?: string | number | null;
  sRpe?: number | null;
  notes?: string | null;
}

export type MicroSessionDb = typeof defaultDb;

export function resumeMicroSession(
  db: MicroSessionDb = defaultDb
): typeof sessions.$inferSelect | null {
  const row = db
    .select()
    .from(sessions)
    .where(
      and(
        eq(sessions.notes, MICRO_SESSION_MARKER),
        isNull(sessions.endTime),
        isNull(sessions.deletedAt)
      )
    )
    .orderBy(desc(sessions.id))
    .get();

  return row ?? null;
}

export function createMicroSession(
  draft: MicroSessionDraft,
  db: MicroSessionDb = defaultDb
): number {
  const openSession = resumeMicroSession(db);
  if (openSession) {
    throw new MicroSessionAlreadyActiveError();
  }

  const insertResult = db
    .insert(sessions)
    .values({
      routineId: draft.routineId ?? null,
      routineName: draft.routineName,
      startTime: draft.startTime ?? Date.now(),
      endTime: null,
      bodyWeight: null,
      sRpe: null,
      notes: MICRO_SESSION_MARKER,
      durationMinutes: null,
      deletedAt: null,
    })
    .run();

  const rawResult = insertResult as unknown as Record<string, unknown>;
  const insertedId =
    typeof rawResult.lastInsertRowid === 'number' || typeof rawResult.lastInsertRowid === 'bigint'
      ? Number(rawResult.lastInsertRowid)
      : typeof rawResult.lastInsertRowId === 'number'
        ? rawResult.lastInsertRowId
        : undefined;

  if (insertedId !== undefined && insertedId > 0) {
    return insertedId;
  }

  const created = resumeMicroSession(db);
  if (!created) {
    throw new Error('Failed to create micro session');
  }

  return created.id;
}

export function addMicroSet(
  input: MicroSetInput,
  db: MicroSessionDb = defaultDb
): typeof sets.$inferSelect {
  let openSession = resumeMicroSession(db);
  if (!openSession) {
    const newSessionId = createMicroSession({ routineName: 'Micro Treino' }, db);
    openSession = db
      .select()
      .from(sessions)
      .where(eq(sessions.id, newSessionId))
      .get() ?? null;
  }

  if (!openSession) {
    throw new Error('Failed to resolve active micro session');
  }

  const existingSet = db
    .select({ id: sets.id })
    .from(sets)
    .where(
      and(
        eq(sets.sessionId, openSession.id),
        eq(sets.exerciseId, input.exerciseId),
        isNull(sets.deletedAt)
      )
    )
    .get();

  if (existingSet) {
    throw new MicroSetLimitError();
  }

  const exerciseRow = db
    .select({ name: exercises.name })
    .from(exercises)
    .where(eq(exercises.id, input.exerciseId))
    .get();

  const now = Date.now();
  const opId = `micro_${openSession.id}_${input.exerciseId}_${now}_${Math.random().toString(36).slice(2, 8)}`;

  const insertResult = db
    .insert(sets)
    .values({
      sessionId: openSession.id,
      exerciseId: input.exerciseId,
      exerciseName: exerciseRow?.name ?? null,
      setNumber: input.setNumber ?? 1,
      weightKg: input.weightKg,
      reps: input.reps,
      durationSeconds: null,
      rir: null,
      isWarmup: false,
      isEdited: false,
      createdAt: now,
      deletedAt: null,
      routineExerciseId: null,
      operationId: opId,
    })
    .run();

  const rawResult = insertResult as unknown as Record<string, unknown>;
  const insertedId =
    typeof rawResult.lastInsertRowid === 'number' || typeof rawResult.lastInsertRowid === 'bigint'
      ? Number(rawResult.lastInsertRowid)
      : typeof rawResult.lastInsertRowId === 'number'
        ? rawResult.lastInsertRowId
        : undefined;

  if (insertedId !== undefined) {
    const created = db.select().from(sets).where(eq(sets.id, insertedId)).get();
    if (created) return created;
  }

  const fallback = db
    .select()
    .from(sets)
    .where(eq(sets.operationId, opId))
    .get();

  if (!fallback) {
    throw new Error('Failed to retrieve inserted micro set');
  }

  return fallback;
}

export async function finishMicroSession(
  params: FinishMicroSessionParams,
  db: MicroSessionDb = defaultDb
): Promise<FinishSessionResult> {
  let targetSessionId = params.sessionId;
  if (targetSessionId === undefined) {
    const active = resumeMicroSession(db);
    if (!active) {
      throw new MicroSessionNotFoundError('No active micro session found to finish');
    }
    targetSessionId = active.id;
  }

  // Fetch full session row and validate micro discipline
  const session = db
    .select()
    .from(sessions)
    .where(eq(sessions.id, targetSessionId))
    .get();

  if (
    !session ||
    session.notes !== MICRO_SESSION_MARKER ||
    session.endTime !== null ||
    session.deletedAt !== null
  ) {
    throw new MicroSessionNotFoundError(
      `Micro session ${targetSessionId} not found or not active`
    );
  }

  return finishSession(
    {
      sessionId: targetSessionId,
      startTime: params.startTime,
      endTime: params.endTime,
      weight: params.weight,
      sRpe: params.sRpe,
      notes: params.notes,
    },
    db
  );
}

export async function discardMicroSession(
  sessionId?: number,
  db: MicroSessionDb = defaultDb
): Promise<void> {
  let targetSessionId = sessionId;
  if (targetSessionId === undefined) {
    const active = resumeMicroSession(db);
    if (!active) {
      return;
    }
    targetSessionId = active.id;
  }

  await discardSession({ sessionId: targetSessionId }, db);
}
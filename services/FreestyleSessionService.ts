import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { db as defaultDb } from '@/src/db/client';
import {
  sessions,
  sessionExercises,
  exercises,
  sets,
} from '@/src/db/schema';
import {
  getPendingQueue,
  removeSessionExercise,
  restoreSessionExercise,
  resolveRecoveryContext,
  QueueItem,
  RemoveResult,
  RemoveExerciseParams,
  RestoreExerciseParams,
  RecoveryResolution,
} from './SessionOccurrenceService';

export interface StartFreestyleOptions {
  startTime?: number;
  routineName?: string | null;
  notes?: string | null;
  bodyWeight?: number | null;
}

export interface FreestyleSessionResult {
  id: number;
  sessionId: number;
  routineId: null;
  routineName: string | null;
  startTime: number;
  endTime: null;
  notes: string | null;
  bodyWeight: number | null;
}

export interface PrefillSet {
  setNumber: number;
  weightKg: number;
  reps: number;
  durationSeconds?: number | null;
  rir?: number | null;
  isWarmup?: boolean;
}

export interface ExercisePrefill {
  hasHistory: boolean;
  lastSessionId: number | null;
  lastSessionDate: number | null;
  weight: string;
  reps: string;
  rir: number;
  durationSeconds: number | null;
  setCount: number;
  sets: PrefillSet[];
  firstSet?: PrefillSet | null;
  lastSet?: PrefillSet | null;
}

export interface AddExerciseOptions {
  customDb?: unknown;
}

export interface AddExerciseResult {
  sessionExerciseId: number;
  sessionId: number;
  exerciseId: number;
  exerciseName: string;
  exerciseType: string;
  position: number;
  prefill: ExercisePrefill;
  weight: string;
  reps: string;
  rir: number;
  durationSeconds: number | null;
  sets: PrefillSet[];
  setCount: number;
  hasHistory: boolean;
  lastSessionId: number | null;
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
 * Starts a freestyle session (a workout session without a routine template).
 * Persists with routineId: null and routineName: null (or custom snapshot label).
 */
export async function startFreestyle(
  optionsOrDb?: StartFreestyleOptions | unknown,
  customDb?: unknown
): Promise<FreestyleSessionResult> {
  let options: StartFreestyleOptions = {};
  let dbInstance: DbRunner;

  if (optionsOrDb && typeof (optionsOrDb as Record<string, unknown>).select === 'function') {
    dbInstance = resolveDb(optionsOrDb);
  } else {
    options = (optionsOrDb as StartFreestyleOptions) || {};
    dbInstance = resolveDb(customDb);
  }

  const startTime = options.startTime ?? Date.now();

  const inserted = dbInstance
    .insert(sessions)
    .values({
      routineId: null,
      routineName: options.routineName ?? null,
      startTime,
      endTime: null,
      bodyWeight: options.bodyWeight ?? null,
      sRpe: null,
      notes: options.notes ?? null,
      durationMinutes: null,
      deletedAt: null,
    })
    .returning()
    .all();

  const sessionRow = inserted[0];
  const id = Number(sessionRow.id);

  return {
    id,
    sessionId: id,
    routineId: null,
    routineName: sessionRow.routineName,
    startTime: sessionRow.startTime,
    endTime: null,
    notes: sessionRow.notes,
    bodyWeight: sessionRow.bodyWeight,
  };
}

/**
 * Resolves the athlete's last execution of an exercise from real tables.
 *
 * Joins `sets` and `sessions` with non-deleted filters.
 *
 * Ordering / Tie-break precedence:
 * 1. `sessions.startTime DESC` — the most recent session chronologically
 * 2. `coalesce(sets.createdAt, sessions.startTime) DESC` — most recent set creation
 * 3. `sessions.id DESC` — tie-break on identical timestamps (higher session ID wins)
 * 4. `sets.id DESC` — tie-break on identical sets
 *
 * Within the winning session, sets are ordered by:
 * - `sets.setNumber ASC`, then `sets.id ASC`
 */
export async function getLastExecution(
  exerciseId: number,
  options?: { excludeSessionId?: number; customDb?: unknown }
): Promise<ExercisePrefill> {
  const dbInstance = resolveDb(options?.customDb);
  const excludeSessionId = options?.excludeSessionId;

  const lastSessionRows = dbInstance
    .select({
      sessionId: sets.sessionId,
      startTime: sessions.startTime,
      createdAt: sets.createdAt,
    })
    .from(sets)
    .innerJoin(sessions, eq(sets.sessionId, sessions.id))
    .where(
      and(
        eq(sets.exerciseId, exerciseId),
        excludeSessionId != null ? ne(sets.sessionId, excludeSessionId) : undefined,
        isNull(sets.deletedAt),
        isNull(sessions.deletedAt)
      )
    )
    .orderBy(
      desc(sessions.startTime),
      desc(sql`coalesce(${sets.createdAt}, ${sessions.startTime})`),
      desc(sessions.id),
      desc(sets.id)
    )
    .limit(1)
    .all();

  if (lastSessionRows.length === 0) {
    return {
      hasHistory: false,
      lastSessionId: null,
      lastSessionDate: null,
      weight: '',
      reps: '',
      rir: 0,
      durationSeconds: null,
      setCount: 0,
      sets: [],
      firstSet: null,
      lastSet: null,
    };
  }

  const winningSessionId = lastSessionRows[0].sessionId;
  const winningSessionDate = lastSessionRows[0].startTime;

  const lastSets = dbInstance
    .select({
      id: sets.id,
      setNumber: sets.setNumber,
      weightKg: sets.weightKg,
      reps: sets.reps,
      durationSeconds: sets.durationSeconds,
      rir: sets.rir,
      isWarmup: sets.isWarmup,
    })
    .from(sets)
    .where(
      and(
        eq(sets.sessionId, winningSessionId),
        eq(sets.exerciseId, exerciseId),
        isNull(sets.deletedAt)
      )
    )
    .orderBy(sets.setNumber, sets.id)
    .all();

  if (lastSets.length === 0) {
    return {
      hasHistory: false,
      lastSessionId: null,
      lastSessionDate: null,
      weight: '',
      reps: '',
      rir: 0,
      durationSeconds: null,
      setCount: 0,
      sets: [],
      firstSet: null,
      lastSet: null,
    };
  }

  const prefillSets: PrefillSet[] = lastSets.map((s) => ({
    setNumber: s.setNumber,
    weightKg: s.weightKg,
    reps: s.reps,
    durationSeconds: s.durationSeconds,
    rir: s.rir,
    isWarmup: s.isWarmup,
  }));

  const firstSet = prefillSets[0];
  const lastSet = prefillSets[prefillSets.length - 1];

  return {
    hasHistory: true,
    lastSessionId: winningSessionId,
    lastSessionDate: winningSessionDate,
    weight: firstSet.weightKg != null ? firstSet.weightKg.toString() : '',
    reps: firstSet.reps != null ? firstSet.reps.toString() : '',
    rir: firstSet.rir ?? 0,
    durationSeconds: firstSet.durationSeconds ?? null,
    setCount: prefillSets.length,
    sets: prefillSets,
    firstSet,
    lastSet,
  };
}

/**
 * Adds an exercise to an active freestyle session on the fly.
 * - Resolves prefill from athlete's last execution (most recent non-deleted prior session).
 * - Enforces #81 occurrence semantics: inserts into session_exercises with routineExerciseId: null.
 * - Re-adding an exercise after removal prefills from last execution, NOT from the removed in-session state.
 */
export async function addExerciseWithPrefill(
  sessionIdOrParams: number | { sessionId: number; exerciseId: number },
  exerciseIdOrOptions?: number | unknown,
  optionsOrDb?: unknown,
  customDb?: unknown
): Promise<AddExerciseResult> {
  let sessionId: number;
  let exerciseId: number;
  let dbInstance: DbRunner;

  if (typeof sessionIdOrParams === 'object' && sessionIdOrParams !== null) {
    sessionId = sessionIdOrParams.sessionId;
    exerciseId = sessionIdOrParams.exerciseId;
    dbInstance = resolveDb(exerciseIdOrOptions);
  } else {
    sessionId = sessionIdOrParams;
    exerciseId = exerciseIdOrOptions as number;
    if (optionsOrDb && typeof (optionsOrDb as Record<string, unknown>).select === 'function') {
      dbInstance = resolveDb(optionsOrDb);
    } else {
      dbInstance = resolveDb(customDb);
    }
  }

  let result: AddExerciseResult | undefined;

  const runTx = dbInstance.transaction((tx) => {
    const session = tx
      .select({
        id: sessions.id,
        endTime: sessions.endTime,
        deletedAt: sessions.deletedAt,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .get();

    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.endTime !== null) {
      throw new Error(`Session ${sessionId} is already finished`);
    }

    if (session.deletedAt !== null) {
      throw new Error(`Session ${sessionId} is deleted`);
    }

    const exerciseRow = tx
      .select({
        id: exercises.id,
        name: exercises.name,
        type: exercises.type,
      })
      .from(exercises)
      .where(eq(exercises.id, exerciseId))
      .get();

    if (!exerciseRow) {
      throw new Error(`Exercise ${exerciseId} not found`);
    }

    const existingExercises = tx
      .select({ position: sessionExercises.position })
      .from(sessionExercises)
      .where(eq(sessionExercises.sessionId, sessionId))
      .all();

    const maxPosition =
      existingExercises.length > 0
        ? Math.max(...existingExercises.map((e) => e.position))
        : -1;
    const nextPosition = maxPosition + 1;

    const insertedRows = tx
      .insert(sessionExercises)
      .values({
        sessionId,
        routineExerciseId: null,
        exerciseId,
        position: nextPosition,
        status: 'pending',
        removedAt: null,
      })
      .returning()
      .all();

    const sessionExerciseId = Number(insertedRows[0].id);

    result = {
      sessionExerciseId,
      sessionId,
      exerciseId,
      exerciseName: exerciseRow.name,
      exerciseType: exerciseRow.type ?? 'strength',
      position: nextPosition,
      prefill: {
        hasHistory: false,
        lastSessionId: null,
        lastSessionDate: null,
        weight: '',
        reps: '',
        rir: 0,
        durationSeconds: null,
        setCount: 0,
        sets: [],
        firstSet: null,
        lastSet: null,
      },
      weight: '',
      reps: '',
      rir: 0,
      durationSeconds: null,
      sets: [],
      setCount: 0,
      hasHistory: false,
      lastSessionId: null,
    };
  });

  await Promise.resolve(runTx);

  if (!result) {
    throw new Error('Failed to add exercise to session');
  }

  // Resolve last execution outside transaction (reads historical tables)
  const prefill = await getLastExecution(exerciseId, {
    excludeSessionId: sessionId,
    customDb: dbInstance,
  });

  result.prefill = prefill;
  result.weight = prefill.weight;
  result.reps = prefill.reps;
  result.rir = prefill.rir;
  result.durationSeconds = prefill.durationSeconds;
  result.sets = prefill.sets;
  result.setCount = prefill.setCount;
  result.hasHistory = prefill.hasHistory;
  result.lastSessionId = prefill.lastSessionId;

  return result;
}

export const FreestyleSessionService = {
  startFreestyle,
  getLastExecution,
  addExerciseWithPrefill,
  removeExercise: removeSessionExercise,
  restoreExercise: restoreSessionExercise,
  getPendingQueue,
  resolveRecoveryContext,
};

export {
  getPendingQueue,
  removeSessionExercise,
  restoreSessionExercise,
  resolveRecoveryContext,
  QueueItem,
  RemoveResult,
  RemoveExerciseParams,
  RestoreExerciseParams,
  RecoveryResolution,
};

export default FreestyleSessionService;

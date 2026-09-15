import { z } from 'zod';
import { db as defaultDb } from '@/src/db/client';
import { exercises, routineExercises, routines } from '@/src/db/schema';
import { eq } from 'drizzle-orm';
import { logger } from './logger';
import { normalizeExerciseName } from '@/services/RoutineShareService';
import { isRoutineNameUniqueConstraintError } from '@/src/utils/routine-name';

export type RoutineImportErrorCode =
  | 'EMPTY_PAYLOAD'
  | 'INVALID_JSON'
  | 'INVALID_STRUCTURE'
  | 'DUPLICATE_ROUTINE_NAME'
  | 'DATABASE_ERROR';

export class RoutineImportError extends Error {
  constructor(
    public readonly code: RoutineImportErrorCode,
    message?: string,
    public readonly cause?: unknown,
    public readonly routineName?: string
  ) {
    super(message || code);
    this.name = 'RoutineImportError';
  }
}

export const routineImportExerciseSchema = z.object({
  name: z.string().trim().min(1, 'Exercise name cannot be empty'),
  target: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  rest: z.union([z.number(), z.string()]).nullable().optional(),
  restSeconds: z.union([z.number(), z.string()]).nullable().optional(),
  type: z.enum(['strength', 'duration']).optional().default('strength'),
  orderIndex: z.coerce.number().int().min(1).optional(),
  muscleGroup: z.string().nullable().optional(),
});

export const routineImportSchema = z.object({
  version: z.number().int().optional().default(1),
  name: z.string().trim().min(1, 'Routine name cannot be empty'),
  description: z.string().nullable().optional().default(''),
  folder: z.string().nullable().optional().default('Geral'),
  exercises: z.array(routineImportExerciseSchema),
});

export type RoutineImportPayload = z.infer<typeof routineImportSchema>;

export interface RoutineImportResult {
  success: boolean;
  routineId: number;
  routineName: string;
  exercisesCount: number;
  customExercisesCreated: number;
}

function parseRestSeconds(
  restSeconds: number | string | null | undefined,
  rest: number | string | null | undefined
): number | null {
  const candidate = restSeconds ?? rest;
  if (candidate == null || candidate === '') return null;
  const num = Number(candidate);
  return Number.isFinite(num) && num >= 0 ? Math.round(num) : null;
}

export function validateRoutineImportPayload(payload: unknown): RoutineImportPayload {
  let rawData = payload;

  if (typeof payload === 'string') {
    const trimmed = payload.trim();
    if (!trimmed) {
      throw new RoutineImportError('EMPTY_PAYLOAD', 'Payload string is empty');
    }

    try {
      rawData = JSON.parse(trimmed);
    } catch (err) {
      throw new RoutineImportError(
        'INVALID_JSON',
        `Malformed JSON: ${err instanceof Error ? err.message : String(err)}`,
        err
      );
    }
  }

  if (rawData == null || typeof rawData !== 'object') {
    throw new RoutineImportError('INVALID_STRUCTURE', 'Payload must be a JSON object');
  }

  const result = routineImportSchema.safeParse(rawData);
  if (!result.success) {
    throw new RoutineImportError(
      'INVALID_STRUCTURE',
      `Invalid routine structure: ${result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
      result.error
    );
  }

  return result.data;
}

/**
 * Imports a routine from JSON payload atomically.
 *
 * Requirements:
 * - Validates payload completely before any DB write.
 * - Exact normalized lookup for exercises without SQL LIKE wildcards.
 * - Preserves A/B/A exercise repetitions and occurrence attributes (target, rest, notes).
 * - Enforces C6 conflict policy: fails if routine name already exists (no overwrite).
 * - Uses a single SQLite transaction with complete rollback on any failure.
 * - Batch exercises lookup and batch insertion (no N+1 per-item queries).
 */
export async function importRoutine(
  payload: unknown,
  database: any = defaultDb
): Promise<RoutineImportResult> {
  const validated = validateRoutineImportPayload(payload);
  const trimmedRoutineName = validated.name.trim();
  const db = database || defaultDb;

  let importResult: RoutineImportResult | null = null;

  try {
    db.transaction((tx: any) => {
      // 1. Conflict policy check (C6): explicit conflict, no overwrite
      const existingRoutine = tx
        .select({ id: routines.id, name: routines.name })
        .from(routines)
        .where(eq(routines.name, trimmedRoutineName))
        .all();

      if (existingRoutine.length > 0) {
        throw new RoutineImportError(
          'DUPLICATE_ROUTINE_NAME',
          trimmedRoutineName,
          undefined,
          trimmedRoutineName
        );
      }

      // 2. Batch lookup: fetch existing exercises once to avoid per-item queries
      const existingExercises = tx
        .select({
          id: exercises.id,
          name: exercises.name,
          type: exercises.type,
        })
        .from(exercises)
        .all();

      const exerciseMap = new Map<string, { id: number; name: string; type: string }>();
      for (const ex of existingExercises) {
        exerciseMap.set(normalizeExerciseName(ex.name), ex);
      }

      // 3. Collect unique new exercises to batch insert
      const newExercisesToCreate: Array<{
        name: string;
        type: 'strength' | 'duration';
        muscleGroup: string | null;
        defaultRestSeconds: number;
        normalizedKey: string;
      }> = [];
      const seenNewKeys = new Set<string>();

      for (const item of validated.exercises) {
        const rawName = item.name.trim();
        const key = normalizeExerciseName(rawName);
        if (!exerciseMap.has(key) && !seenNewKeys.has(key)) {
          seenNewKeys.add(key);
          const parsedRest = parseRestSeconds(item.restSeconds, item.rest);
          newExercisesToCreate.push({
            name: rawName,
            type: item.type === 'duration' ? 'duration' : 'strength',
            muscleGroup: item.muscleGroup ?? null,
            defaultRestSeconds: parsedRest != null ? parsedRest : 90,
            normalizedKey: key,
          });
        }
      }

      let customExercisesCreated = 0;
      if (newExercisesToCreate.length > 0) {
        const inserted = tx
          .insert(exercises)
          .values(
            newExercisesToCreate.map((ex) => ({
              name: ex.name,
              type: ex.type,
              muscleGroup: ex.muscleGroup,
              defaultRestSeconds: ex.defaultRestSeconds,
            }))
          )
          .returning({ id: exercises.id, name: exercises.name, type: exercises.type })
          .all();

        for (let i = 0; i < inserted.length; i++) {
          const item = inserted[i];
          const key = newExercisesToCreate[i].normalizedKey;
          exerciseMap.set(key, item);
        }
        customExercisesCreated = inserted.length;
      }

      // 4. Insert new routine row
      const createdRoutine = tx
        .insert(routines)
        .values({
          name: trimmedRoutineName,
          description: validated.description || '',
          folder: validated.folder || 'Geral',
          isTemplate: false,
        })
        .returning({ id: routines.id, name: routines.name })
        .get();

      if (!createdRoutine) {
        throw new RoutineImportError('DATABASE_ERROR', 'Failed to create routine row');
      }

      // 5. Batch insert routineExercises preserving order, targets, notes, and rest
      if (validated.exercises.length > 0) {
        let orderCounter = 1;
        const routineExerciseRows = validated.exercises.map((item) => {
          const rawName = item.name.trim();
          const key = normalizeExerciseName(rawName);
          const exerciseInfo = exerciseMap.get(key);

          if (!exerciseInfo) {
            throw new RoutineImportError(
              'DATABASE_ERROR',
              `Exercise "${rawName}" could not be resolved`
            );
          }

          const parsedRest = parseRestSeconds(item.restSeconds, item.rest);
          const finalOrder = item.orderIndex ?? orderCounter++;

          return {
            routineId: createdRoutine.id,
            exerciseId: exerciseInfo.id,
            orderIndex: finalOrder,
            target: item.target ?? null,
            notes: item.notes ?? null,
            restSeconds: parsedRest,
          };
        });

        tx.insert(routineExercises).values(routineExerciseRows).run();
      }

      importResult = {
        success: true,
        routineId: createdRoutine.id,
        routineName: createdRoutine.name,
        exercisesCount: validated.exercises.length,
        customExercisesCreated,
      };
    });
  } catch (error) {
    if (error instanceof RoutineImportError) {
      throw error;
    }
    if (isRoutineNameUniqueConstraintError(error)) {
      throw new RoutineImportError(
        'DUPLICATE_ROUTINE_NAME',
        trimmedRoutineName,
        error,
        trimmedRoutineName
      );
    }
    logger.error('Failed to import routine', error);
    throw new RoutineImportError(
      'DATABASE_ERROR',
      error instanceof Error ? error.message : 'Database error',
      error
    );
  }

  if (!importResult) {
    throw new RoutineImportError('DATABASE_ERROR', 'Transaction completed without producing a result');
  }

  return importResult;
}

export const RoutineImportService = {
  importRoutine,
  validateRoutineImportPayload,
};

import { z } from 'zod';
import { db as defaultDb } from '@/src/db/client';
import { exercises, routineExercises, routines } from '@/src/db/schema';
import { eq, asc } from 'drizzle-orm';
import { logger } from './logger';

export const routineExerciseShareSchema = z.object({
  name: z.string().min(1),
  orderIndex: z.coerce.number().int().min(1).optional(),
  target: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  restSeconds: z.coerce.number().int().min(0).nullable().optional(),
  rest: z.coerce.number().int().min(0).nullable().optional(),
  type: z.enum(['strength', 'duration']).optional(),
  muscleGroup: z.string().nullable().optional(),
});

export const routineSharePayloadSchema = z.object({
  version: z.number().int().min(1).max(1).default(1),
  name: z.string().min(1),
  description: z.string().nullable().optional().default(''),
  folder: z.string().nullable().optional().default('Geral'),
  exercises: z.array(routineExerciseShareSchema).default([]),
});

export interface RoutineShareExercisePayload {
  name: string;
  orderIndex?: number;
  target?: string | null;
  notes?: string | null;
  restSeconds?: number | null;
  rest?: number | null;
  type?: 'strength' | 'duration';
  muscleGroup?: string | null;
}

export interface RoutineSharePayload {
  version: number;
  name: string;
  description?: string | null;
  folder?: string | null;
  exercises: RoutineShareExercisePayload[];
}

export interface ImportRoutineResult {
  success: boolean;
  id: number;
  routineId: number;
  name: string;
  routineName: string;
  exercisesCount: number;
  customExercisesCreated: number;
}

export function normalizeExerciseName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

export function resolveUniqueRoutineName(existingNames: Set<string>, baseName: string): string {
  const trimmed = baseName.trim();
  if (!existingNames.has(trimmed.toLowerCase())) {
    return trimmed;
  }

  let counter = 2;
  while (existingNames.has(`${trimmed} (${counter})`.toLowerCase())) {
    counter++;
  }
  return `${trimmed} (${counter})`;
}

/**
 * Exports a routine and its full exercise graph into a versioned JSON payload.
 */
export async function exportRoutine(
  routineId: number,
  database: any = defaultDb
): Promise<RoutineSharePayload> {
  const db = database || defaultDb;

  const routineRows = await db
    .select()
    .from(routines)
    .where(eq(routines.id, routineId));

  if (!routineRows || routineRows.length === 0) {
    throw new Error(`Routine with id ${routineId} not found`);
  }

  const routine = routineRows[0];

  const exerciseRows = await db
    .select({
      orderIndex: routineExercises.orderIndex,
      target: routineExercises.target,
      notes: routineExercises.notes,
      restSeconds: routineExercises.restSeconds,
      name: exercises.name,
      type: exercises.type,
      muscleGroup: exercises.muscleGroup,
    })
    .from(routineExercises)
    .innerJoin(exercises, eq(routineExercises.exerciseId, exercises.id))
    .where(eq(routineExercises.routineId, routineId))
    .orderBy(asc(routineExercises.orderIndex));

  return {
    version: 1,
    name: routine.name,
    description: routine.description ?? null,
    folder: routine.folder ?? 'Geral',
    exercises: exerciseRows.map((ex: any, idx: number) => ({
      orderIndex: ex.orderIndex ?? (idx + 1),
      name: ex.name,
      target: ex.target ?? null,
      notes: ex.notes ?? null,
      restSeconds: ex.restSeconds ?? null,
      type: (ex.type as 'strength' | 'duration') || 'strength',
      muscleGroup: ex.muscleGroup ?? null,
    })),
  };
}

/**
 * Serializes exported routine payload to formatted JSON string.
 */
export async function exportRoutineJson(
  routineId: number,
  database: any = defaultDb
): Promise<string> {
  const payload = await exportRoutine(routineId, database);
  return JSON.stringify(payload, null, 2);
}

/**
 * Validates payload with Zod BEFORE any DB operations, then atomically imports
 * as a NEW routine (non-destructive merge: auto-suffixes name if duplicate).
 * Maps existing exercises case/accent-insensitively, or creates custom exercises.
 */
export async function importRoutine(
  payload: unknown,
  database: any = defaultDb
): Promise<ImportRoutineResult> {
  let rawData = payload;
  if (typeof payload === 'string') {
    try {
      rawData = JSON.parse(payload);
    } catch (err) {
      throw new Error(`Invalid JSON format: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Validate with Zod BEFORE any DB write or interaction
  const validated = routineSharePayloadSchema.parse(rawData);

  const db = database || defaultDb;
  let result: ImportRoutineResult | null = null;

  try {
    db.transaction((tx: any) => {
      // 1. Fetch existing routines to handle non-destructive naming merge
      const existingRoutines = tx
        .select({ id: routines.id, name: routines.name })
        .from(routines)
        .all();

      const existingRoutineNames = new Set<string>(
        existingRoutines.map((r: { name: string }) => r.name.trim().toLowerCase())
      );

      const targetRoutineName = resolveUniqueRoutineName(existingRoutineNames, validated.name);

      // 2. Insert new routine row
      const createdRoutine = tx
        .insert(routines)
        .values({
          name: targetRoutineName,
          description: validated.description || '',
          folder: validated.folder || 'Geral',
          isTemplate: false,
        })
        .returning()
        .get();

      if (!createdRoutine) {
        throw new Error('Failed to create routine row');
      }

      const routineId = createdRoutine.id;

      // 3. Build lookup cache of existing exercises
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

      let customExercisesCreated = 0;
      let orderCounter = 1;

      // 4. Process exercises and routineExercises
      for (const item of validated.exercises) {
        const rawName = item.name.trim();
        const normalizedKey = normalizeExerciseName(rawName);
        let exerciseInfo = exerciseMap.get(normalizedKey);

        let exerciseId: number;

        if (!exerciseInfo) {
          const isDuration = item.type === 'duration';
          const createdCustom = tx
            .insert(exercises)
            .values({
              name: rawName,
              type: isDuration ? 'duration' : 'strength',
              muscleGroup: item.muscleGroup ?? null,
              defaultRestSeconds: item.restSeconds ?? item.rest ?? 90,
            })
            .returning({ id: exercises.id, name: exercises.name, type: exercises.type })
            .get();

          if (!createdCustom) {
            throw new Error(`Failed to create custom exercise: ${rawName}`);
          }

          exerciseInfo = {
            id: createdCustom.id,
            name: createdCustom.name,
            type: createdCustom.type,
          };
          exerciseMap.set(normalizedKey, exerciseInfo);
          customExercisesCreated++;
        }

        exerciseId = exerciseInfo.id;
        const finalOrderIndex = item.orderIndex ?? orderCounter;
        orderCounter++;

        tx.insert(routineExercises)
          .values({
            routineId,
            exerciseId,
            orderIndex: finalOrderIndex,
            target: item.target ?? null,
            notes: item.notes ?? null,
            restSeconds: item.restSeconds ?? item.rest ?? null,
          })
          .run();
      }

      result = {
        success: true,
        id: routineId,
        routineId,
        name: targetRoutineName,
        routineName: targetRoutineName,
        exercisesCount: validated.exercises.length,
        customExercisesCreated,
      };
    });
  } catch (error) {
    logger.error('Failed to import routine', error);
    throw error;
  }

  if (!result) {
    throw new Error('Import transaction completed without producing a result');
  }

  return result;
}

export const RoutineShareService = {
  exportRoutine,
  exportRoutineJson,
  importRoutine,
  normalizeExerciseName,
  resolveUniqueRoutineName,
};

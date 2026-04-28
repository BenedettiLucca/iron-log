import { z } from 'zod';
import { logger } from '@/services/logger';

/**
 * Route parameter validation schemas
 * Prevents NaN from Number(params.xxx) and ensures type safety
 */

// Helper to coerce string param to number with validation
const numericParam = z.coerce.number().int().positive();

// Session exercise screen params
export const exerciseParamsSchema = z.object({
  sessionId: numericParam,
  exerciseId: numericParam,
  exerciseName: z.string().min(1),
  routineId: z.string().optional().nullable().transform(v => v ? Number(v) : null),
  target: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  restSeconds: z.string().optional().nullable().transform(v => v ? Number(v) : null),
  startTime: z.string().optional().transform(v => v ? Number(v) : Date.now()),
});

export type ExerciseParams = z.infer<typeof exerciseParamsSchema>;

// Session screen params (routine-based)
export const sessionParamsSchema = z.object({
  routineId: z.string().min(1),
  routineName: z.string().optional().default(''),
  _ts: z.string().optional(),
});

export type SessionParams = z.infer<typeof sessionParamsSchema>;

// Summary screen params
export const summaryParamsSchema = z.object({
  sessionId: numericParam,
});

export type SummaryParams = z.infer<typeof summaryParamsSchema>;

// Finish screen params
export const finishParamsSchema = z.object({
  sessionId: numericParam,
  startTime: z.string().optional().transform(v => v ? Number(v) : Date.now()),
});

export type FinishParams = z.infer<typeof finishParamsSchema>;

// Routine editor params
export const routineEditorParamsSchema = z.object({
  id: z.string().optional(),
});

export type RoutineEditorParams = z.infer<typeof routineEditorParamsSchema>;


// Routine preview screen params
export const routinePreviewParamsSchema = z.object({
  routineId: numericParam,
  routineName: z.string().optional().default(''),
});

export type RoutinePreviewParams = z.infer<typeof routinePreviewParamsSchema>;

/**
 * Safe parse helper — returns parsed data or null with error log
 */
export function safeParseParams<T>(
  schema: z.ZodSchema<T>,
  params: Record<string, unknown>,
  screenName: string
): T | null {
  const result = schema.safeParse(params);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    logger.warn(`[IronLog] Invalid params on ${screenName}:`, errors);
    return null;
  }
  return result.data;
}

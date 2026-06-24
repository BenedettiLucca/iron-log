import { z } from 'zod';

/**
 * Form input validation schemas
 * Prevents invalid data from reaching the database
 */

// Daily weight input
export const weightInputSchema = z.object({
  weight: z.coerce.number()
    .positive('Peso deve ser positivo')
    .max(500, 'Peso inválido')
    .finite(),
});

export type WeightInput = z.infer<typeof weightInputSchema>;

// Monthly check-in input (aligned with checkin-validation.ts — empty string = undefined, NOT 0)
export const monthlyCheckinSchema = z.object({
  waist: z.preprocess(
    (v) => v === '' || v == null ? undefined : Number(v),
    z.number().min(0).max(300).optional(),
  ),
  armRight: z.preprocess(
    (v) => v === '' || v == null ? undefined : Number(v),
    z.number().min(0).max(100).optional(),
  ),
  thighRight: z.preprocess(
    (v) => v === '' || v == null ? undefined : Number(v),
    z.number().min(0).max(200).optional(),
  ),
  chest: z.preprocess(
    (v) => v === '' || v == null ? undefined : Number(v),
    z.number().min(0).max(300).optional(),
  ),
  calf: z.preprocess(
    (v) => v === '' || v == null ? undefined : Number(v),
    z.number().min(0).max(100).optional(),
  ),
});

export type MonthlyCheckinInput = z.infer<typeof monthlyCheckinSchema>;

// Set input (during exercise)
export const setInputSchema = z.object({
  weightKg: z.coerce.number()
    .min(0, 'Peso deve ser ≥ 0')
    .max(999, 'Peso máximo: 999kg')
    .finite(),
  reps: z.coerce.number()
    .int('Reps deve ser inteiro')
    .min(0, 'Reps deve ser ≥ 0')
    .max(999, 'Reps máximo: 999'),
  durationSeconds: z.coerce.number().min(0).optional().nullable(),
  rir: z.coerce.number().int().min(-1).max(10).optional().nullable(),
  isWarmup: z.boolean().optional().default(false),
});

export type SetInput = z.infer<typeof setInputSchema>;

// Goal input
export const goalInputSchema = z.object({
  type: z.enum(['weight', 'waist', 'armRight', 'thighRight', 'chest', 'calf']),
  targetValue: z.coerce.number()
    .positive('Valor alvo deve ser positivo')
    .max(9999, 'Valor muito alto'),
  targetDate: z.date().refine(d => d.getTime() > Date.now(), {
    message: 'Data alvo deve ser no futuro',
  }),
});

export type GoalInput = z.infer<typeof goalInputSchema>;

// Routine name input
export const routineNameSchema = z.object({
  name: z.string()
    .min(1, 'Nome é obrigatório')
    .max(100, 'Nome muito longo'),
  description: z.string().max(500, 'Descrição muito longa').optional().default(''),
  folder: z.string().max(50).optional().default('Geral'),
});

export type RoutineNameInput = z.infer<typeof routineNameSchema>;

// RPE scale
export const rpeSchema = z.coerce.number().int().min(1).max(10);

/**
 * Validate a single field and return error message or null
 */
export function validateField<T>(
  schema: z.ZodSchema<T>,
  value: unknown
): string | null {
  const result = schema.safeParse(value);
  if (result.success) return null;
  const firstError = result.error.issues[0];
  return firstError?.message ?? 'Valor inválido';
}

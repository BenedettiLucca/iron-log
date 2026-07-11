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

/** Raw string inputs from the SetEditor modal */
export interface EditedSetRawInput {
  weight: string;
  reps?: string;
  duration?: string;
  rir?: string;
  isDuration: boolean;
}

/** Field-level errors returned when validation fails */
export interface EditedSetFieldErrors {
  weight?: string;
  reps?: string;
  duration?: string;
  rir?: string;
}

/** Success result from parseEditedSetInput */
export interface EditedSetParsedOk {
  ok: true;
  weightKg: number;
  reps?: number;
  durationSeconds?: number;
  rir?: number;
}

/** Failure result from parseEditedSetInput */
export interface EditedSetParsedErr {
  ok: false;
  errors: EditedSetFieldErrors;
  /** The first field that has an error, for focus management */
  firstErrorField: keyof EditedSetFieldErrors;
}

export type ParseEditedSetResult = EditedSetParsedOk | EditedSetParsedErr;

/**
 * Validates and parses raw SetEditor inputs.
 * Returns typed values on success or field-level errors on failure.
 * Reuses setInputSchema to stay aligned with the DB write contract.
 */
export function parseEditedSetInput(input: EditedSetRawInput): ParseEditedSetResult {
  const errors: EditedSetFieldErrors = {};

  const weightKg = Number(input.weight);
  if (!Number.isFinite(weightKg) || weightKg < 0) {
    errors.weight = 'invalid';
  }

  if (input.isDuration) {
    const durationSeconds = Number(input.duration ?? '');
    if (!Number.isInteger(durationSeconds) || durationSeconds <= 0) {
      errors.duration = 'invalid';
    }

    if (Object.keys(errors).length > 0) {
      return { ok: false, errors, firstErrorField: (Object.keys(errors)[0] as keyof EditedSetFieldErrors) };
    }

    // Cross-validate with schema
    const schema = setInputSchema.safeParse({ weightKg, reps: 0, durationSeconds });
    if (!schema.success) {
      const issue = schema.error.issues[0];
      const field: keyof EditedSetFieldErrors = issue?.path[0] === 'durationSeconds' ? 'duration' : 'weight';
      return { ok: false, errors: { [field]: 'invalid' }, firstErrorField: field };
    }

    return { ok: true, weightKg, durationSeconds };
  } else {
    const reps = Number(input.reps ?? '');
    if (!Number.isInteger(reps) || reps <= 0) {
      errors.reps = 'invalid';
    }

    // RIR: null/undefined means no-RIR; empty string = no-RIR; valid integer 0..10 is OK
    let rir: number | undefined;
    if (input.rir !== undefined && input.rir !== '') {
      const rirParsed = Number(input.rir);
      if (!Number.isInteger(rirParsed) || rirParsed < 0 || rirParsed > 10) {
        errors.rir = 'invalid';
      } else {
        rir = rirParsed;
      }
    }

    if (Object.keys(errors).length > 0) {
      return { ok: false, errors, firstErrorField: (Object.keys(errors)[0] as keyof EditedSetFieldErrors) };
    }

    // Cross-validate with schema
    const schema = setInputSchema.safeParse({ weightKg, reps, rir: rir ?? null });
    if (!schema.success) {
      const issue = schema.error.issues[0];
      const path = issue?.path[0];
      const field: keyof EditedSetFieldErrors = path === 'reps' ? 'reps' : path === 'rir' ? 'rir' : 'weight';
      return { ok: false, errors: { [field]: 'invalid' }, firstErrorField: field };
    }

    return { ok: true, weightKg, reps, rir };
  }
}

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

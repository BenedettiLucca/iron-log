/**
 * Monthly check-in data validation and preparation.
 *
 * Handles the gap between raw form state (strings from TextInput)
 * and the DB schema (numbers or null).
 *
 * Key concern: `Number('') === 0` in JavaScript, so empty strings
 * must be treated as "not provided" (undefined), NOT as zero.
 */

import { z } from 'zod';

/**
 * Preprocesses a string-or-undefined field:
 * - '' → undefined (not provided)
 * - whitespace-only → undefined
 * - numeric string → number
 * - non-numeric → lets Zod handle the error
 */
const optionalNumber = z.preprocess(
  (val) => {
    if (val === undefined || val === null) return undefined;
    const s = String(val).trim();
    if (s === '') return undefined;
    return Number(s);
  },
  z.number().min(0).max(999).optional(),
);

/**
 * Schema for monthly check-in measurements.
 * Empty strings are treated as "not provided" (omitted from output).
 * Invalid values (negative, NaN, >999) cause validation failure.
 */
export const strictMonthlyCheckinSchema = z.object({
  waist: optionalNumber,
  armRight: optionalNumber,
  thighRight: optionalNumber,
  chest: optionalNumber,
  calf: optionalNumber,
});

export type StrictMonthlyCheckin = z.infer<typeof strictMonthlyCheckinSchema>;

export interface MonthlyCheckinValidationResult {
  success: boolean;
  data?: StrictMonthlyCheckin;
  errors?: Record<string, string[]>;
}

/**
 * Validates raw monthly check-in form data.
 * Returns structured result — never throws.
 */
export function validateMonthlyCheckin(
  rawData: Record<string, string>,
): MonthlyCheckinValidationResult {
  const result = strictMonthlyCheckinSchema.safeParse(rawData);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors: Record<string, string[]> = {};
  const fieldErrors = result.error.flatten().fieldErrors;

  for (const [field, msgs] of Object.entries(fieldErrors)) {
    if (msgs && msgs.length > 0) {
      errors[field] = msgs;
    }
  }

  return { success: false, errors };
}

/**
 * Builds the entry data object for DB insertion/update.
 * Only includes provided (non-undefined) measurement values.
 * Falls back to existing DB values for omitted fields.
 */
export function buildCheckinEntryData(params: {
  validated: StrictMonthlyCheckin;
  existingData?: Record<string, any>;
  photos: { front: string | null; back: string | null; side: string | null };
  photoNotes: Record<string, string>;
  weight: number;
  date: number;
}) {
  const { validated, existingData, photos, photoNotes, weight, date } = params;
  const fallback = (field: string) => existingData?.[field] ?? 0;

  return {
    date,
    type: 'monthly' as const,
    weight,
    waist: validated.waist ?? fallback('waist'),
    armRight: validated.armRight ?? fallback('armRight'),
    thighRight: validated.thighRight ?? fallback('thighRight'),
    chest: validated.chest ?? fallback('chest'),
    calf: validated.calf ?? fallback('calf'),
    photoFront: photos.front ?? existingData?.photoFront ?? null,
    photoBack: photos.back ?? existingData?.photoBack ?? null,
    photoSide: photos.side ?? existingData?.photoSide ?? null,
    photoNotes: JSON.stringify(photoNotes),
  };
}

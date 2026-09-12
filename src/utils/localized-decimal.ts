/**
 * Localized decimal parsing helper (Contract C2).
 *
 * Rules:
 * - Accepts single dot or single comma as decimal separator.
 * - Rejects mixed separators (both dot and comma) and multiple separators.
 * - Never infers thousands grouping (e.g. 1.500 is 1.5, never 1500).
 * - Distinguishes between empty (null, undefined, whitespace) and invalid.
 * - Never truncates invalid trailing characters (no parseFloat behavior).
 * - Distinguishes negative numbers according to domain options.
 */

export type LocalizedDecimalStatus = 'valid' | 'empty' | 'invalid';

export type LocalizedDecimalInvalidReason =
  | 'invalid_format'
  | 'mixed_separators'
  | 'multiple_separators'
  | 'not_finite'
  | 'negative_not_allowed';

export interface LocalizedDecimalValid {
  status: 'valid';
  value: number;
}

export interface LocalizedDecimalEmpty {
  status: 'empty';
  value: undefined;
}

export interface LocalizedDecimalInvalid {
  status: 'invalid';
  reason: LocalizedDecimalInvalidReason;
  value?: undefined;
}

export type LocalizedDecimalResult =
  | LocalizedDecimalValid
  | LocalizedDecimalEmpty
  | LocalizedDecimalInvalid;

export interface ParseLocalizedDecimalOptions {
  /**
   * Whether negative values are allowed.
   * Defaults to true (general decimal parser allows negative values).
   * Set to false for domain fields like weight, body measurements, etc.
   */
  allowNegative?: boolean;

  /**
   * Optional locale hint (e.g. 'pt-BR', 'en-US', 'es', 'zh').
   * Single comma and single dot are accepted uniformly regardless of locale.
   */
  locale?: string;
}

const STRICT_DECIMAL_REGEX = /^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/;

/**
 * Parses a numeric or string input into a normalized decimal number.
 * Conforms to Contract C2.
 */
export function parseLocalizedDecimal(
  input: unknown,
  options?: ParseLocalizedDecimalOptions,
): LocalizedDecimalResult {
  const allowNegative = options?.allowNegative ?? true;

  if (input === null || input === undefined) {
    return { status: 'empty', value: undefined };
  }

  if (typeof input === 'number') {
    if (Number.isNaN(input) || !Number.isFinite(input)) {
      return { status: 'invalid', reason: 'not_finite' };
    }
    if (input < 0 && !allowNegative) {
      return { status: 'invalid', reason: 'negative_not_allowed' };
    }
    // Normalize -0 to 0
    return { status: 'valid', value: input === 0 ? 0 : input };
  }

  if (typeof input !== 'string') {
    return { status: 'invalid', reason: 'invalid_format' };
  }

  const trimmed = input.trim();

  if (trimmed === '') {
    return { status: 'empty', value: undefined };
  }

  if (
    trimmed === 'Infinity' ||
    trimmed === '+Infinity' ||
    trimmed === '-Infinity' ||
    trimmed === 'NaN'
  ) {
    return { status: 'invalid', reason: 'not_finite' };
  }

  const hasDot = trimmed.includes('.');
  const hasComma = trimmed.includes(',');

  if (hasDot && hasComma) {
    return { status: 'invalid', reason: 'mixed_separators' };
  }

  const dotCount = (trimmed.match(/\./g) || []).length;
  const commaCount = (trimmed.match(/,/g) || []).length;

  if (dotCount > 1 || commaCount > 1) {
    return { status: 'invalid', reason: 'multiple_separators' };
  }

  if (!STRICT_DECIMAL_REGEX.test(trimmed)) {
    return { status: 'invalid', reason: 'invalid_format' };
  }

  const isNegative = trimmed.startsWith('-');
  if (isNegative && !allowNegative) {
    return { status: 'invalid', reason: 'negative_not_allowed' };
  }

  const normalized = trimmed.replace(',', '.');
  const parsed = Number(normalized);

  if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
    return { status: 'invalid', reason: 'not_finite' };
  }

  if (parsed < 0 && !allowNegative) {
    return { status: 'invalid', reason: 'negative_not_allowed' };
  }

  return { status: 'valid', value: parsed === 0 ? 0 : parsed };
}

/**
 * Convenience helper for schemas/forms where an optional/nullable decimal
 * is needed as number | undefined (with NaN signaling an invalid entry).
 */
export function toOptionalDecimal(
  input: unknown,
  options?: ParseLocalizedDecimalOptions,
): number | undefined {
  const result = parseLocalizedDecimal(input, options);
  if (result.status === 'valid') return result.value;
  if (result.status === 'empty') return undefined;
  return Number.NaN;
}

/**
 * Convenience helper returning number | null.
 * Returns null if input is empty or invalid.
 */
export function toNullableDecimal(
  input: unknown,
  options?: ParseLocalizedDecimalOptions,
): number | null {
  const result = parseLocalizedDecimal(input, options);
  if (result.status === 'valid') return result.value;
  return null;
}

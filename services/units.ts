/**
 * @file services/units.ts
 *
 * Iron Log Unit Conversion Service
 * ================================
 * Pure logic module for unit conversions between Metric and Imperial systems.
 *
 * CANONICAL STORAGE CONTRACT:
 * - The database and business logic canonical units are ALWAYS METRIC:
 *   - Weight / Load / Body Weight: Kilograms (`kg`)
 *   - Length / Circumference / Height: Centimeters (`cm`)
 * - All database persistence (`sets.weightKg`, `sessions.bodyWeight`, `bodyMetrics.weight`,
 *   `bodyMetrics.waist`, `userSettings.height`, etc.) MUST store canonical metric values.
 * - Conversions to Imperial (`lb`, `in`) occur strictly at presentation and input edges.
 *
 * EXACT CONVERSION CONSTANTS:
 * - Pound: 1 lb = 0.45359237 kg (exact international avoirdupois pound factor,
 *   conforming with FitNotes, Hevy, and Strong importers).
 * - Kilogram in pounds: 1 kg = 1 / 0.45359237 lb ≈ 2.2046226218487757 lb.
 * - Inch: 1 in = 2.54 cm (exact international yard and pound agreement of 1959).
 * - Centimeter in inches: 1 cm = 1 / 2.54 in ≈ 0.3937007874015748 in.
 *
 * EXPLICIT ROUNDING & PRECISION RULES:
 * 1. Default Display Precision:
 *    - Weight: 2 decimal places (`DEFAULT_WEIGHT_DECIMALS = 2`).
 *      Ensures exact known reference: 100 kg -> 220.46 lb.
 *    - Length: 2 decimal places (`DEFAULT_LENGTH_DECIMALS = 2`).
 *      Ensures high precision for body measurements and heights (e.g., 180 cm -> 70.87 in).
 * 2. Rounding Method:
 *    - Symmetric round half-up (away from zero):
 *      `sign * (Math.round((Math.abs(val) + Number.EPSILON) * 10^decimals) / 10^decimals)`
 *    - `Number.EPSILON` acts strictly as an IEEE-754 tie-breaking helper for small decimal
 *      edge cases around 1 (e.g. 1.005 rounding correctly half-up to 1.01 instead of 1.00).
 *    - `Number.EPSILON` does NOT prevent float drift during multi-step unit conversions or
 *      round-trips. At display precision (0.01), Number.EPSILON (2.22e-16) is many orders
 *      of magnitude smaller than the display resolution.
 *    - Negative zero (-0) is normalized to positive zero (0).
 * 3. Step Rounding:
 *    - Internal `roundToStep(val, step)` supports gym loading increments (e.g. 0.5 kg / 0.5 cm).
 *    - Clamped to 2 decimal places (display precision ceiling).
 * 4. Round-Trip Stability:
 *    - Round-trip stability is governed by exact conversion constants and display precision
 *      rounding, not an epsilon comparison guard.
 *    - Over a dense realistic weight grid (20..300 kg with step 0.5), round-trip
 *      `lbToKg(kgToLb(kg))` produces ZERO drift (`diff === 0`).
 *    - Over a dense realistic length grid (60..250 cm with step 0.5), round-trip
 *      `inToCm(cmToIn(cm))` produces maximum drift <= 0.01 cm (exactly one display step at 2 decimals),
 *      well within the 0.5 cm gym increment.
 * 5. String Formatting & Parsing:
 *    - `format(x)` produces clean human-readable strings, supporting optional units and fixed decimals.
 *    - `parse(str)` safely parses strings into numbers, supporting both period and comma decimal
 *      delimiters (for pt/es/de locales) and trailing unit labels.
 *    - Ambiguous inputs (e.g. multiple decimal points like `"100.5.5"` or extra characters) are rejected (return `NaN`).
 *    - Invariant: `parse(format(x)) === x` for all values at display precision.
 */

export type UnitSystem = 'metric' | 'imperial';
export type WeightUnit = 'kg' | 'lb';
export type LengthUnit = 'cm' | 'in';

/** Exact international avoirdupois pound in kilograms */
export const POUND_IN_KG = 0.45359237;

/** Kilograms to pounds ratio */
export const KG_IN_LB = 1 / POUND_IN_KG;

/** Exact international inch in centimeters */
export const INCH_IN_CM = 2.54;

/** Centimeters to inches ratio */
export const CM_IN_IN = 1 / INCH_IN_CM;

/** Standard display precision for weight (kg / lb) */
export const DEFAULT_WEIGHT_DECIMALS = 2;

/** Standard display precision for length (cm / in) */
export const DEFAULT_LENGTH_DECIMALS = 2;

export interface FormatOptions {
  decimals?: number;
  fixedDecimals?: boolean;
  unit?: string;
}

/**
 * Rounds a number to a specified number of decimal places using symmetric round half-up.
 * Normalizes -0 to 0.
 */
function roundTo(value: number, decimals: number = 2): number {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  const sign = value < 0 ? -1 : 1;
  const rounded = sign * (Math.round((Math.abs(value) + Number.EPSILON) * factor) / factor);
  return rounded === 0 ? 0 : rounded;
}

/**
 * Rounds a number to the nearest step (e.g. 0.5 for standard gym plates/measurements).
 * Note: Clamped to 2 decimal places display precision ceiling via roundTo.
 */
function roundToStep(value: number, step: number = 0.5): number {
  if (!Number.isFinite(value) || step <= 0) return value;
  const rounded = Math.round(value / step) * step;
  return roundTo(rounded, 2);
}

// ---------------------------------------------------------------------------
// Pure mathematical conversions (unrounded raw values)
// ---------------------------------------------------------------------------

function kgToLbRaw(kg: number): number {
  return kg / POUND_IN_KG;
}

function lbToKgRaw(lb: number): number {
  return lb * POUND_IN_KG;
}

function cmToInRaw(cm: number): number {
  return cm / INCH_IN_CM;
}

function inToCmRaw(inches: number): number {
  return inches * INCH_IN_CM;
}

// ---------------------------------------------------------------------------
// Display-precision conversions
// ---------------------------------------------------------------------------

/**
 * Converts kilograms to pounds, rounded to display precision.
 */
export function kgToLb(kg: number, decimals: number = DEFAULT_WEIGHT_DECIMALS): number {
  return roundTo(kgToLbRaw(kg), decimals);
}

/**
 * Converts pounds to kilograms, rounded to display precision.
 */
export function lbToKg(lb: number, decimals: number = DEFAULT_WEIGHT_DECIMALS): number {
  return roundTo(lbToKgRaw(lb), decimals);
}

/**
 * Converts centimeters to inches, rounded to display precision.
 */
export function cmToIn(cm: number, decimals: number = DEFAULT_LENGTH_DECIMALS): number {
  return roundTo(cmToInRaw(cm), decimals);
}

/**
 * Converts inches to centimeters, rounded to display precision.
 */
export function inToCm(inches: number, decimals: number = DEFAULT_LENGTH_DECIMALS): number {
  return roundTo(inToCmRaw(inches), decimals);
}

// ---------------------------------------------------------------------------
// Unit system edge converters (canonical metric <-> user preference)
// ---------------------------------------------------------------------------

/**
 * Returns the weight unit corresponding to a unit system.
 */
export function getWeightUnit(system: UnitSystem): WeightUnit {
  return system === 'imperial' ? 'lb' : 'kg';
}

/**
 * Returns the length unit corresponding to a unit system.
 */
export function getLengthUnit(system: UnitSystem): LengthUnit {
  return system === 'imperial' ? 'in' : 'cm';
}

/**
 * Converts canonical weight (kg) to display value in the given unit system.
 */
export function toDisplayWeight(
  kg: number,
  system: UnitSystem,
  decimals: number = DEFAULT_WEIGHT_DECIMALS
): number {
  return system === 'imperial' ? kgToLb(kg, decimals) : roundTo(kg, decimals);
}

/**
 * Converts user display weight from the given unit system back to canonical metric (kg).
 */
export function fromDisplayWeight(
  displayValue: number,
  system: UnitSystem,
  decimals: number = DEFAULT_WEIGHT_DECIMALS
): number {
  return system === 'imperial' ? lbToKg(displayValue, decimals) : roundTo(displayValue, decimals);
}

/**
 * Converts canonical length (cm) to display value in the given unit system.
 */
export function toDisplayLength(
  cm: number,
  system: UnitSystem,
  decimals: number = DEFAULT_LENGTH_DECIMALS
): number {
  return system === 'imperial' ? cmToIn(cm, decimals) : roundTo(cm, decimals);
}

/**
 * Converts user display length from the given unit system back to canonical metric (cm).
 */
export function fromDisplayLength(
  displayValue: number,
  system: UnitSystem,
  decimals: number = DEFAULT_LENGTH_DECIMALS
): number {
  return system === 'imperial' ? inToCm(displayValue, decimals) : roundTo(displayValue, decimals);
}

// ---------------------------------------------------------------------------
// String formatting and parsing
// ---------------------------------------------------------------------------

/**
 * Formats a numeric value for display, optionally including unit suffix.
 *
 * Satisfies `parse(format(x)) === x` for values at display precision.
 */
export function format(value: number, options?: FormatOptions | string): string {
  const opts: FormatOptions = typeof options === 'string' ? { unit: options } : options ?? {};
  const decimals = opts.decimals ?? DEFAULT_WEIGHT_DECIMALS;
  const rounded = roundTo(value, decimals);
  const numStr = opts.fixedDecimals ? rounded.toFixed(decimals) : String(rounded);
  return opts.unit ? `${numStr} ${opts.unit}` : numStr;
}

/**
 * Parses a display string or number into a numeric value.
 *
 * Handles:
 * - Comma decimal separators for Portuguese/Spanish locales (e.g. `"75,5"` -> `75.5`).
 * - Unit suffixes (e.g. `"100 kg"` -> `100`, `"220.46 lb"` -> `220.46`).
 * - Leading negative signs and leading decimals (e.g. `".5 cm"` -> `0.5`).
 * - Normalizes `-0` to `0`.
 *
 * Rejects ambiguous input (such as multiple decimal points or invalid characters),
 * returning `NaN`.
 */
export function parse(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) return NaN;
    return input === 0 ? 0 : input;
  }
  if (typeof input !== 'string') {
    return NaN;
  }
  const trimmed = input.trim().replace(/,/g, '.');
  const match = trimmed.match(/^([-+]?(?:\d+(?:\.\d*)?|\.\d+))(?:\s*[a-zA-Z]+)?$/);
  if (!match) return NaN;
  const val = Number(match[1]);
  if (!Number.isFinite(val)) return NaN;
  return val === 0 ? 0 : val;
}

/**
 * Formats a weight value with unit suffix (e.g. `formatWeight(100, 'kg')` -> `"100 kg"`).
 */
export function formatWeight(
  value: number,
  unit: WeightUnit = 'kg',
  options?: Omit<FormatOptions, 'unit'>
): string {
  return format(value, { ...options, unit });
}

/**
 * Parses a weight string to number.
 */
export function parseWeight(input: string | number): number {
  return parse(input);
}

/**
 * Formats a length value with unit suffix (e.g. `formatLength(180, 'cm')` -> `"180 cm"`).
 */
export function formatLength(
  value: number,
  unit: LengthUnit = 'cm',
  options?: Omit<FormatOptions, 'unit'>
): string {
  return format(value, { ...options, unit });
}

/**
 * Parses a length string to number.
 */
export function parseLength(input: string | number): number {
  return parse(input);
}

/**
 * Formats canonical weight (kg) according to user unit preference.
 */
export function formatCanonicalWeight(
  canonicalKg: number,
  system: UnitSystem,
  options?: Omit<FormatOptions, 'unit'>
): string {
  const displayVal = toDisplayWeight(canonicalKg, system, options?.decimals);
  const unit = getWeightUnit(system);
  return format(displayVal, { ...options, unit });
}

/**
 * Formats canonical length (cm) according to user unit preference.
 */
export function formatCanonicalLength(
  canonicalCm: number,
  system: UnitSystem,
  options?: Omit<FormatOptions, 'unit'>
): string {
  const displayVal = toDisplayLength(canonicalCm, system, options?.decimals);
  const unit = getLengthUnit(system);
  return format(displayVal, { ...options, unit });
}

/**
 * Parses a weight input string from active unit system directly back to canonical kg.
 */
export function parseWeightInputToCanonical(
  input: string | number,
  system: UnitSystem,
  decimals: number = DEFAULT_WEIGHT_DECIMALS
): number {
  const parsed = parse(input);
  if (!Number.isFinite(parsed)) return NaN;
  return fromDisplayWeight(parsed, system, decimals);
}

/**
 * Parses a length input string from active unit system directly back to canonical cm.
 */
export function parseLengthInputToCanonical(
  input: string | number,
  system: UnitSystem,
  decimals: number = DEFAULT_LENGTH_DECIMALS
): number {
  const parsed = parse(input);
  if (!Number.isFinite(parsed)) return NaN;
  return fromDisplayLength(parsed, system, decimals);
}

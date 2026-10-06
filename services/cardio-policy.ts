/**
 * Cardio Exercise Type Policy
 *
 * Implements the contract defined in `docs/plans/il82-cardio-contract.md`:
 * 1. Canonical fields stored (distance_meters, duration_seconds); derived pace/speed display-only helpers.
 * 2. PR detection: fastest time per standard distance (tunable list), longest distance per duration;
 *    cardio NEVER enters strength tonnage or e1RM aggregates.
 * 3. History/reports treatment: excluded from strength volume, aggregated as cardio metrics lines.
 * 4. Adheres to #136 unit conventions: metric stored canonical, imperial display-only.
 */

// ---------------------------------------------------------------------------
// Constants & Configuration
// ---------------------------------------------------------------------------

/**
 * Standard running/cardio distances in meters for benchmark PR evaluation.
 * Tunable default per contract §5.1:
 * 500m, 1k, 1.5k, 3k, 5k, 10k, half-marathon (21.0975k), marathon (42.195k).
 */
export const STANDARD_CARDIO_DISTANCES_METERS: readonly number[] = Object.freeze([
  500,
  1000,
  1500,
  3000,
  5000,
  10000,
  21097,
  42195,
]);

export const METERS_PER_KILOMETER = 1000;
export const METERS_PER_MILE = 1609.344;
export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 3600;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UnitSystem = 'metric' | 'imperial';

export interface CardioSetLike {
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  weightKg?: number | null;
  reps?: number | null;
  isWarmup?: boolean | null;
  exerciseName?: string | null;
}

export interface CardioExerciseLike {
  id?: number;
  name?: string;
  type?: string | null; // 'strength' | 'duration' | 'cardio'
}

export interface CardioMetricsSummary {
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  setsCount: number;
  averagePaceMinPerKm: string | null;
  averageSpeedKmh: number | null;
}

export interface CardioPREvaluationResult {
  isPR: boolean;
  recordType: 'fastest_time' | 'longest_distance';
  benchmarkMetric: number; // distance in meters for fastest_time, duration in seconds for longest_distance
  recordValue: number; // duration in seconds for fastest_time, distance in meters for longest_distance
}

// ---------------------------------------------------------------------------
// 1. Classification & Strength Exclusion Policies
// ---------------------------------------------------------------------------

/**
 * Checks whether an exercise is classified as cardio.
 * Per contract §1.1, 'duration' is the existing canonical non-strength type in DB,
 * and future records may use 'cardio'.
 */
export function isCardioExercise(exercise?: CardioExerciseLike | null): boolean {
  if (!exercise || !exercise.type) return false;
  const normalized = exercise.type.trim().toLowerCase();
  return normalized === 'duration' || normalized === 'cardio';
}

/**
 * Determines if an individual set represents cardio activity.
 * Sets with distance > 0, or duration-based sets with zero weight and reps, are cardio.
 */
export function isCardioSet(
  set?: CardioSetLike | null,
  exercise?: CardioExerciseLike | null,
): boolean {
  if (!set) return false;
  if (set.distanceMeters != null && set.distanceMeters > 0) return true;
  if (isCardioExercise(exercise)) return true;
  if (
    set.durationSeconds != null &&
    set.durationSeconds > 0 &&
    (set.weightKg == null || set.weightKg === 0) &&
    (set.reps == null || set.reps === 0)
  ) {
    return true;
  }
  return false;
}

/**
 * Contract rule: cardio NEVER enters strength tonnage/volume aggregates.
 * Volume in strength is strictly (weightKg * reps) where weight > 0 and reps > 0.
 */
export function shouldExcludeFromStrengthVolume(
  set?: CardioSetLike | null,
  exercise?: CardioExerciseLike | null,
): boolean {
  if (!set) return true;
  if (isCardioSet(set, exercise)) return true;
  if (set.weightKg == null || set.weightKg <= 0) return true;
  if (set.reps == null || set.reps <= 0) return true;
  return false;
}

/**
 * Contract rule: cardio NEVER enters estimated 1RM (e1RM) calculations.
 * e1RM formulas (Brzycki, Epley) are undefined and invalid for distance/duration work.
 */
export function shouldExcludeFromE1RM(
  set?: CardioSetLike | null,
  exercise?: CardioExerciseLike | null,
): boolean {
  return shouldExcludeFromStrengthVolume(set, exercise);
}

// ---------------------------------------------------------------------------
// 2. PR Detection Policy
// ---------------------------------------------------------------------------

/**
 * Checks if a distance matches one of the standard benchmark distances.
 * @param distanceMeters Distance in meters
 * @param toleranceMeters Optional tolerance for GPS drift / slight course variance (default: 0)
 */
export function isStandardDistance(distanceMeters: number, toleranceMeters = 0): boolean {
  if (distanceMeters <= 0) return false;
  return STANDARD_CARDIO_DISTANCES_METERS.some(
    (std) => Math.abs(std - distanceMeters) <= toleranceMeters,
  );
}

/**
 * Finds the closest standard distance within the allowed tolerance.
 */
export function findMatchingStandardDistance(
  distanceMeters: number,
  toleranceMeters = 50,
): number | null {
  if (distanceMeters <= 0) return null;
  for (const std of STANDARD_CARDIO_DISTANCES_METERS) {
    if (Math.abs(std - distanceMeters) <= toleranceMeters) {
      return std;
    }
  }
  return null;
}

/**
 * Fastest time PR logic for a fixed distance:
 * LOWER duration_seconds is BETTER.
 */
export function isFasterCardioTime(
  candidateDurationSeconds: number,
  currentRecordDurationSeconds: number | null | undefined,
): boolean {
  if (candidateDurationSeconds <= 0) return false;
  if (currentRecordDurationSeconds == null || currentRecordDurationSeconds <= 0) return true;
  return candidateDurationSeconds < currentRecordDurationSeconds;
}

/**
 * Longest distance PR logic for a fixed duration:
 * HIGHER distance_meters is BETTER.
 */
export function isLongerCardioDistance(
  candidateDistanceMeters: number,
  currentRecordDistanceMeters: number | null | undefined,
): boolean {
  if (candidateDistanceMeters <= 0) return false;
  if (currentRecordDistanceMeters == null || currentRecordDistanceMeters <= 0) return true;
  return candidateDistanceMeters > currentRecordDistanceMeters;
}

/**
 * Evaluates whether a cardio set qualifies as a Personal Record.
 *
 * Scenarios:
 * 1. Fixed / Standard Distance (e.g. 5k, 10k): Evaluates fastest time (lowest duration_seconds).
 * 2. Fixed Duration (e.g. 30min run): Evaluates longest distance (highest distance_meters).
 */
export function evaluateCardioPR(params: {
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  existingRecordValue?: number | null;
  evalMode?: 'fastest_time_for_distance' | 'longest_distance_for_duration';
}): CardioPREvaluationResult | null {
  const { distanceMeters, durationSeconds, existingRecordValue, evalMode } = params;

  if (evalMode === 'longest_distance_for_duration') {
    if (!durationSeconds || durationSeconds <= 0 || !distanceMeters || distanceMeters <= 0) {
      return null;
    }
    const isPR = isLongerCardioDistance(distanceMeters, existingRecordValue);
    return {
      isPR,
      recordType: 'longest_distance',
      benchmarkMetric: durationSeconds,
      recordValue: distanceMeters,
    };
  }

  // Default: fastest time for a distance
  if (!distanceMeters || distanceMeters <= 0 || !durationSeconds || durationSeconds <= 0) {
    return null;
  }

  const isPR = isFasterCardioTime(durationSeconds, existingRecordValue);
  return {
    isPR,
    recordType: 'fastest_time',
    benchmarkMetric: distanceMeters,
    recordValue: durationSeconds,
  };
}

// ---------------------------------------------------------------------------
// 3. Derived Pace & Speed Display-Only Helpers (#136 Conventions)
// ---------------------------------------------------------------------------

/**
 * Calculates raw pace in seconds per kilometer.
 * Display-only helper; never stored in DB.
 */
export function calculatePaceSecondsPerKm(
  durationSeconds?: number | null,
  distanceMeters?: number | null,
): number | null {
  if (!durationSeconds || durationSeconds <= 0 || !distanceMeters || distanceMeters <= 0) {
    return null;
  }
  const km = distanceMeters / METERS_PER_KILOMETER;
  return durationSeconds / km;
}

/**
 * Formats pace in standard `min/km` representation (e.g. `4:30/km`).
 */
export function formatPaceMinPerKm(
  durationSeconds?: number | null,
  distanceMeters?: number | null,
): string | null {
  const secondsPerKm = calculatePaceSecondsPerKm(durationSeconds, distanceMeters);
  if (secondsPerKm == null) return null;

  const totalSeconds = Math.round(secondsPerKm);
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const remainderSeconds = totalSeconds % SECONDS_PER_MINUTE;
  const paddedSeconds = remainderSeconds.toString().padStart(2, '0');

  return `${minutes}:${paddedSeconds}/km`;
}

/**
 * Calculates raw pace in seconds per mile.
 * Imperial display-only helper; never stored in DB.
 */
export function calculatePaceSecondsPerMile(
  durationSeconds?: number | null,
  distanceMeters?: number | null,
): number | null {
  if (!durationSeconds || durationSeconds <= 0 || !distanceMeters || distanceMeters <= 0) {
    return null;
  }
  const miles = distanceMeters / METERS_PER_MILE;
  return durationSeconds / miles;
}

/**
 * Formats pace in imperial `min/mi` representation (e.g. `7:15/mi`).
 */
export function formatPaceMinPerMile(
  durationSeconds?: number | null,
  distanceMeters?: number | null,
): string | null {
  const secondsPerMile = calculatePaceSecondsPerMile(durationSeconds, distanceMeters);
  if (secondsPerMile == null) return null;

  const totalSeconds = Math.round(secondsPerMile);
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const remainderSeconds = totalSeconds % SECONDS_PER_MINUTE;
  const paddedSeconds = remainderSeconds.toString().padStart(2, '0');

  return `${minutes}:${paddedSeconds}/mi`;
}

/**
 * Calculates speed in kilometers per hour (km/h).
 */
export function calculateSpeedKmh(
  durationSeconds?: number | null,
  distanceMeters?: number | null,
): number | null {
  if (!durationSeconds || durationSeconds <= 0 || !distanceMeters || distanceMeters <= 0) {
    return null;
  }
  const km = distanceMeters / METERS_PER_KILOMETER;
  const hours = durationSeconds / SECONDS_PER_HOUR;
  const speed = km / hours;
  return Number(speed.toFixed(2));
}

/**
 * Calculates speed in miles per hour (mph).
 * Imperial display-only helper; never stored in DB.
 */
export function calculateSpeedMph(
  durationSeconds?: number | null,
  distanceMeters?: number | null,
): number | null {
  if (!durationSeconds || durationSeconds <= 0 || !distanceMeters || distanceMeters <= 0) {
    return null;
  }
  const miles = distanceMeters / METERS_PER_MILE;
  const hours = durationSeconds / SECONDS_PER_HOUR;
  const speed = miles / hours;
  return Number(speed.toFixed(2));
}

/**
 * Formats distance with unit suffix according to metric/imperial setting.
 * Metric (canonical): `m` if < 1000m, `km` if >= 1000m.
 * Imperial (display only): `mi`.
 */
export function formatDistance(distanceMeters?: number | null, unit: UnitSystem = 'metric'): string {
  if (distanceMeters == null || distanceMeters < 0) return '0 m';

  if (unit === 'imperial') {
    const miles = distanceMeters / METERS_PER_MILE;
    return `${miles.toFixed(2)} mi`;
  }

  if (distanceMeters < METERS_PER_KILOMETER) {
    return `${Math.round(distanceMeters)} m`;
  }

  const km = distanceMeters / METERS_PER_KILOMETER;
  return `${Number(km.toFixed(2))} km`;
}

// ---------------------------------------------------------------------------
// 4. History / Reports Treatment Helpers
// ---------------------------------------------------------------------------

/**
 * Summarizes cardio metrics across a list of sets.
 * Excludes warmups and non-cardio sets.
 */
export function extractCardioMetrics(
  sets: readonly CardioSetLike[],
  exercise?: CardioExerciseLike | null,
): CardioMetricsSummary {
  let totalDistanceMeters = 0;
  let totalDurationSeconds = 0;
  let setsCount = 0;

  for (const set of sets) {
    if (set.isWarmup) continue;
    if (!isCardioSet(set, exercise)) continue;

    if (set.distanceMeters && set.distanceMeters > 0) {
      totalDistanceMeters += set.distanceMeters;
    }
    if (set.durationSeconds && set.durationSeconds > 0) {
      totalDurationSeconds += set.durationSeconds;
    }
    setsCount++;
  }

  const averagePaceMinPerKm = formatPaceMinPerKm(totalDurationSeconds, totalDistanceMeters);
  const averageSpeedKmh = calculateSpeedKmh(totalDurationSeconds, totalDistanceMeters);

  return {
    totalDistanceMeters,
    totalDurationSeconds,
    setsCount,
    averagePaceMinPerKm,
    averageSpeedKmh,
  };
}

/**
 * Separates sets into pure strength sets vs cardio sets.
 */
export function partitionSetsByDiscipline<T extends CardioSetLike>(
  sets: readonly T[],
  exercise?: CardioExerciseLike | null,
): { strengthSets: T[]; cardioSets: T[] } {
  const strengthSets: T[] = [];
  const cardioSets: T[] = [];

  for (const set of sets) {
    if (isCardioSet(set, exercise)) {
      cardioSets.push(set);
    } else {
      strengthSets.push(set);
    }
  }

  return { strengthSets, cardioSets };
}

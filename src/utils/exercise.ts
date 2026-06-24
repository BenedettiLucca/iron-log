import { Colors } from '@/constants/colors';

/**
 * Parse target string to extract the target number of sets.
 * Supports patterns like "3x8-12", "4x10", "3x8"
 * Returns null for duration-based exercises or invalid targets.
 */
export function parseTargetSets(target: string | null | undefined): number | null {
  if (!target) return null;
  // Match patterns like "3x8-12", "4x10", "3x8" - must have "x" between numbers
  const match = target.match(/(\d+)x/);
  if (match) {
    return parseInt(match[1], 10);
  }
  // Duration-based exercises don't have set targets
  return null;
}

/**
 * Returns the hex color string associated with a given Reps in Reserve (RiR) value.
 */
export function getRirColor(rir: number): string {
  if (rir <= 1) return Colors.red400;
  if (rir <= 3) return Colors.success;
  return Colors.secondary;
}


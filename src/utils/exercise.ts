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

type RoutineIdentity = { id: number };

export function normalizeRoutineName(name: string) {
  return name.trim();
}

export function hasRoutineNameConflict(
  matches: RoutineIdentity[],
  currentRoutineId?: number,
) {
  return matches.some((routine) => routine.id !== currentRoutineId);
}

export function isRoutineNameUniqueConstraintError(error: unknown) {
  let current: unknown = error;
  const visited = new Set<unknown>();

  while (current != null && !visited.has(current)) {
    visited.add(current);
    const message = current instanceof Error ? current.message : String(current);
    if (message.includes('UNIQUE constraint failed: routines.name')) return true;
    current = current instanceof Error ? current.cause : undefined;
  }

  return false;
}

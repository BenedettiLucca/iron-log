type RoutineIdentity = {
  id: number | string;
  name: string;
};

type SessionStartRoute = {
  pathname: '/session/[routineId]';
  params: {
    routineId: string;
    routineName: string;
    _ts: string;
  };
};

function normalizeName(name: string | null | undefined): string | null {
  const trimmed = name?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function buildSessionStartRoute(
  routine: RoutineIdentity,
  timestamp: string = Date.now().toString()
): SessionStartRoute {
  return {
    pathname: '/session/[routineId]',
    params: {
      routineId: routine.id.toString(),
      routineName: normalizeName(routine.name) ?? '',
      _ts: timestamp,
    },
  };
}

export function resolveSessionRoutineName(
  routeRoutineName: string | null | undefined,
  fetchedRoutineName: string | null | undefined
): string | null {
  return normalizeName(routeRoutineName) ?? normalizeName(fetchedRoutineName);
}

export function resolveCanonicalSessionRoutineName(
  fetchedRoutineName: string | null | undefined,
  routeRoutineName: string | null | undefined
): string | null {
  return normalizeName(fetchedRoutineName) ?? normalizeName(routeRoutineName);
}

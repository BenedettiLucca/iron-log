import { InteractionManager } from 'react-native';

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

type NavigationGate = {
  run: (navigate: () => void) => boolean;
  reset: () => void;
};

function normalizeName(name: string | null | undefined): string | null {
  const trimmed = name?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

export function createNavigationGate(): NavigationGate {
  let locked = false;

  return {
    run(navigate) {
      if (locked) return false;
      locked = true;

      try {
        navigate();
        return true;
      } catch (error) {
        locked = false;
        throw error;
      }
    },
    reset() {
      locked = false;
    },
  };
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

type ModalCloseDeferral = {
  defer: (navigate: () => void) => void;
  flush: () => Promise<void>;
};

/**
 * #144 — Navigating synchronously from inside a RN Modal's onStart callback
 * races the modal unmount: React Navigation cancels the push while the target
 * screen has already run its side effects (e.g. INSERTing a session), leaving
 * an orphan row. Deferring navigation until the modal close animations and
 * pending interactions settle guarantees the push lands after the modal is
 * gone. Duplicate defers are coalesced so double-taps navigate once.
 */
export function createModalCloseDeferral(): ModalCloseDeferral {
  let pending: (() => void) | null = null;
  let scheduled = false;

  return {
    defer(navigate) {
      if (scheduled) return;
      scheduled = true;
      pending = navigate;
    },
    flush() {
      const navigate = pending;
      pending = null;
      scheduled = false;
      if (!navigate) return Promise.resolve();

      return new Promise<void>((resolve) => {
        let settled = false;
        const run = () => {
          if (settled) return;
          settled = true;
          navigate();
          resolve();
        };

        // Double rAF: first frame commits the modal unmount, second frame
        // guarantees the navigator is free before we push. A plain
        // setTimeout(0) fires in the SAME tick as the unmount and loses the
        // race (that was the original #144 bug shape).
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              try {
                void InteractionManager.runAfterInteractions(run);
                setTimeout(run, 600);
              } catch {
                setTimeout(run, 0);
              }
            });
          });
        } else {
          setTimeout(run, 600);
        }
      });
    },
  };
}

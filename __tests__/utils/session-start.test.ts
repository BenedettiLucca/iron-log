import { buildSessionStartRoute, resolveCanonicalSessionRoutineName, resolveSessionRoutineName } from '@/src/utils/session-start';

describe('session start metadata', () => {
  describe('buildSessionStartRoute', () => {
    it('passes routine name when quick-starting from the routines list', () => {
      expect(buildSessionStartRoute({ id: 7, name: 'Full Body A' }, '1714000000000')).toEqual({
        pathname: '/session/[routineId]',
        params: {
          routineId: '7',
          routineName: 'Full Body A',
          _ts: '1714000000000',
        },
      });
    });

    it('trims routine name before passing it to the session route', () => {
      expect(buildSessionStartRoute({ id: 11, name: '  Upper A  ' }, '1714000000001').params.routineName)
        .toBe('Upper A');
    });
  });

  describe('resolveSessionRoutineName', () => {
    it('uses the route routine name when it is present', () => {
      expect(resolveSessionRoutineName('Push Day', 'Fetched Name')).toBe('Push Day');
    });

    it('falls back to the fetched routine name when the route name is blank', () => {
      expect(resolveSessionRoutineName('', 'Full Body B')).toBe('Full Body B');
    });

    it('returns null when neither route nor fetched name can identify the routine', () => {
      expect(resolveSessionRoutineName('   ', null)).toBeNull();
    });
  });

  describe('resolveCanonicalSessionRoutineName', () => {
    it('prefers the fetched canonical routine name over route params', () => {
      expect(resolveCanonicalSessionRoutineName('Canonical Name', 'Spoofed Name')).toBe('Canonical Name');
    });

    it('falls back to the route routine name when the routine lookup is unavailable', () => {
      expect(resolveCanonicalSessionRoutineName(null, 'Route Name')).toBe('Route Name');
    });
  });
});

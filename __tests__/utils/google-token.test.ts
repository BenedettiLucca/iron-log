import { calculateTokenExpiresAt, isTokenExpired } from '@/src/utils/google-token';

describe('Google Auth Token expiry calculations (#106)', () => {
  const BASE_TIME_SEC = 1710000000;
  const BASE_TIME_MS = BASE_TIME_SEC * 1000;

  describe('calculateTokenExpiresAt', () => {
    it('correctly converts issuedAt in SECONDS to milliseconds', () => {
      const expiresInSec = 3600;
      const result = calculateTokenExpiresAt(BASE_TIME_SEC, expiresInSec, BASE_TIME_MS);
      // Expected: (1710000000 * 1000) + (3600 * 1000) = 1710003600000
      expect(result).toBe(BASE_TIME_MS + 3600 * 1000);
    });

    it('handles issuedAt when provided directly in milliseconds', () => {
      const expiresInSec = 3600;
      const result = calculateTokenExpiresAt(BASE_TIME_MS, expiresInSec, BASE_TIME_MS);
      expect(result).toBe(BASE_TIME_MS + 3600 * 1000);
    });

    it('falls back to nowMs when issuedAt is undefined', () => {
      const expiresInSec = 1800;
      const result = calculateTokenExpiresAt(undefined, expiresInSec, BASE_TIME_MS);
      expect(result).toBe(BASE_TIME_MS + 1800 * 1000);
    });

    it('uses default 3600s expiry when expiresIn is undefined', () => {
      const result = calculateTokenExpiresAt(BASE_TIME_SEC, undefined, BASE_TIME_MS);
      expect(result).toBe(BASE_TIME_MS + 3600 * 1000);
    });
  });

  describe('isTokenExpired', () => {
    it('returns true if tokenExpiresAt is null or undefined', () => {
      expect(isTokenExpired(null)).toBe(true);
      expect(isTokenExpired(undefined as unknown as null)).toBe(true);
    });

    it('returns false when token is fresh (e.g. 50 mins remaining)', () => {
      const tokenExpiresAt = BASE_TIME_MS + 50 * 60 * 1000;
      const now = BASE_TIME_MS;
      expect(isTokenExpired(tokenExpiresAt, now)).toBe(false);
    });

    it('returns true when token is within 5-minute buffer window (e.g. 3 mins remaining)', () => {
      const tokenExpiresAt = BASE_TIME_MS + 3 * 60 * 1000;
      const now = BASE_TIME_MS;
      expect(isTokenExpired(tokenExpiresAt, now)).toBe(true);
    });

    it('returns true when token has already expired in the past', () => {
      const tokenExpiresAt = BASE_TIME_MS - 1000;
      const now = BASE_TIME_MS;
      expect(isTokenExpired(tokenExpiresAt, now)).toBe(true);
    });

    it('respects custom buffer window', () => {
      const tokenExpiresAt = BASE_TIME_MS + 8 * 60 * 1000; // 8 mins left
      const now = BASE_TIME_MS;
      // With 10 min buffer, 8 min remaining is considered expired
      expect(isTokenExpired(tokenExpiresAt, now, 10 * 60 * 1000)).toBe(true);
      // With 5 min buffer, 8 min remaining is NOT expired
      expect(isTokenExpired(tokenExpiresAt, now, 5 * 60 * 1000)).toBe(false);
    });
  });
});

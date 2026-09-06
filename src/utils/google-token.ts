/**
 * Pure helper for Google Auth token expiration math (#106)
 */

/**
 * Calculate token expiration time in milliseconds since epoch.
 * - Handles `issuedAt` in seconds (OAuth standard) or milliseconds.
 * - Handles `expiresIn` in seconds.
 */
export function calculateTokenExpiresAt(
  issuedAt?: number,
  expiresIn?: number,
  now: number = Date.now()
): number {
  const issuedAtMs =
    issuedAt !== undefined
      ? (issuedAt < 10000000000 ? issuedAt * 1000 : issuedAt)
      : now;
  const expiresInMs = (expiresIn ?? 3600) * 1000;
  return issuedAtMs + expiresInMs;
}

/**
 * Check whether a token is expired or close to expiring within a buffer window.
 */
export function isTokenExpired(
  tokenExpiresAt: number | null,
  now: number = Date.now(),
  bufferMs: number = 5 * 60 * 1000
): boolean {
  if (tokenExpiresAt === null || tokenExpiresAt === undefined) return true;
  return now > tokenExpiresAt - bufferMs;
}

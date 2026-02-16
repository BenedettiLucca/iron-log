/**
 * Shared timer formatting utility
 * Formats seconds into MM:SS string format
 */
export const formatTimer = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

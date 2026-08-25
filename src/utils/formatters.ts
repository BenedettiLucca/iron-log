export function formatCompactKilograms(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k kg`;
  }
  return `${value.toFixed(0)} kg`;
}

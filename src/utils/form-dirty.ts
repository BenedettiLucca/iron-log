export function isFormDirty(current: readonly unknown[], initial: readonly unknown[]): boolean {
  return current.length !== initial.length || current.some((value, index) => !Object.is(value, initial[index]));
}

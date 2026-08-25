export type PendingSetState = {
  isDirty: boolean;
  exerciseType: string;
  activeSetTime: number;
  isActiveSetRunning: boolean;
};

export function shouldSavePendingSet(state: PendingSetState): boolean {
  if (state.exerciseType === 'duration') {
    return state.isDirty || (!state.isActiveSetRunning && state.activeSetTime > 0);
  }
  return state.isDirty;
}

export function canNavigateAfterPendingSave(
  needsSave: boolean,
  saveSucceeded: boolean,
): boolean {
  return !needsSave || saveSucceeded;
}

export function canActOnFinishStats(
  isStatsLoading: boolean,
  hasStatsError: boolean,
): boolean {
  return !isStatsLoading && !hasStatsError;
}

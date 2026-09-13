import type { SessionDraft } from './session-draft';
import { hasPendingSessionDraft } from './session-draft';

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

export type RecoveredDraftVerdict =
  | { kind: 'none' }
  | { kind: 'committed'; operationId: string }
  | { kind: 'real_pending'; operationId: string }
  | { kind: 'ambiguous_legacy' };

/**
 * Classifies a recovered session draft against SQLite committed state.
 * Contract C3:
 * - If draft has operationId and it's already committed in DB -> committed (reconciled).
 * - If draft has operationId and not committed in DB -> real_pending.
 * - If draft has pending changes but no operationId -> ambiguous_legacy.
 * - Never dedupes by weight/reps.
 */
export function classifyRecoveredDraft(
  draft: SessionDraft | null,
  isOperationCommitted: boolean,
): RecoveredDraftVerdict {
  if (!draft || !hasPendingSessionDraft(draft)) {
    return { kind: 'none' };
  }

  const opId = draft.operationId?.trim();
  if (opId && opId.length > 0) {
    if (isOperationCommitted) {
      return { kind: 'committed', operationId: opId };
    }
    return { kind: 'real_pending', operationId: opId };
  }

  return { kind: 'ambiguous_legacy' };
}

export type NavigationAction =
  | { type: 'navigate_immediately' }
  | { type: 'auto_save_and_navigate' }
  | { type: 'prompt_recovery_decision'; reason: 'real_pending' | 'ambiguous_legacy' };

export interface ResolveNavigationActionParams {
  hasPendingSet: boolean;
  isRecoveredPending: boolean;
  recoveredKind?: 'real_pending' | 'ambiguous_legacy' | null;
}

/**
 * Determines navigation behavior on advance/finish.
 * - If no pending set -> navigate_immediately.
 * - If pending set came from recovery -> prompt_recovery_decision (never silent save or forced phantom reps).
 * - If pending set created in active session -> auto_save_and_navigate (preserves intentional autosave).
 */
export function resolveNavigationAction(
  params: ResolveNavigationActionParams,
): NavigationAction {
  if (!params.hasPendingSet) {
    return { type: 'navigate_immediately' };
  }

  if (params.isRecoveredPending) {
    return {
      type: 'prompt_recovery_decision',
      reason: params.recoveredKind ?? 'real_pending',
    };
  }

  return { type: 'auto_save_and_navigate' };
}

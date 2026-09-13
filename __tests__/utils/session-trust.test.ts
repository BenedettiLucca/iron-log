import { parseEditedSetInput } from '@/src/validators/forms';
import {
  canActOnFinishStats,
  canNavigateAfterPendingSave,
  shouldSavePendingSet,
  classifyRecoveredDraft,
  resolveNavigationAction,
} from '@/src/utils/session-trust';
import type { SessionDraft } from '@/src/utils/session-draft';

describe('set editor validation', () => {
  it.each([
    [{ weight: 'abc', reps: '8', rir: '2', isDuration: false }, 'weight'],
    [{ weight: '80', reps: '3.5', rir: '2', isDuration: false }, 'reps'],
    [{ weight: '0', duration: '1.5', isDuration: true }, 'duration'],
    [{ weight: '80', reps: '8', rir: '11', isDuration: false }, 'rir'],
  ] as const)('rejects invalid %s input', (input, expectedField) => {
    const result = parseEditedSetInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[expectedField]).toBeDefined();
      expect(result.firstErrorField).toBe(expectedField);
    }
  });

  it('preserves valid RIR zero', () => {
    expect(parseEditedSetInput({
      weight: '80',
      reps: '8',
      rir: '0',
      isDuration: false,
    })).toEqual({
      ok: true,
      weightKg: 80,
      reps: 8,
      rir: 0,
    });
  });
});

describe('session trust guards', () => {
  it('requires a save for dirty strength input', () => {
    expect(shouldSavePendingSet({
      isDirty: true,
      exerciseType: 'strength',
      activeSetTime: 0,
      isActiveSetRunning: false,
    })).toBe(true);
  });

  it('requires a save for a completed duration set or edited extra weight', () => {
    expect(shouldSavePendingSet({
      isDirty: false,
      exerciseType: 'duration',
      activeSetTime: 45,
      isActiveSetRunning: false,
    })).toBe(true);
    expect(shouldSavePendingSet({
      isDirty: true,
      exerciseType: 'duration',
      activeSetTime: 0,
      isActiveSetRunning: false,
    })).toBe(true);
  });

  it('blocks navigation when the required save fails', () => {
    expect(canNavigateAfterPendingSave(true, false)).toBe(false);
    expect(canNavigateAfterPendingSave(true, true)).toBe(true);
    expect(canNavigateAfterPendingSave(false, false)).toBe(true);
  });

  it('blocks finish decisions until stats load without error', () => {
    expect(canActOnFinishStats(true, false)).toBe(false);
    expect(canActOnFinishStats(false, true)).toBe(false);
    expect(canActOnFinishStats(false, false)).toBe(true);
  });
});

describe('Contract C3: classifyRecoveredDraft', () => {
  const baseDraft: SessionDraft = {
    weight: '100',
    reps: '5',
    duration: '',
    rir: 2,
    isWarmupMode: false,
    isDirty: true,
    activeSetTime: 0,
    isActiveSetRunning: false,
    activeSetStartedAt: null,
  };

  it('returns none for null or empty draft', () => {
    expect(classifyRecoveredDraft(null, false)).toEqual({ kind: 'none' });
    expect(classifyRecoveredDraft({ ...baseDraft, isDirty: false, activeSetTime: 0 }, false)).toEqual({ kind: 'none' });
  });

  it('classifies committed draft when operationId is in SQLite (crash after insert before clear)', () => {
    const draft: SessionDraft = { ...baseDraft, operationId: 'op-committed-1' };
    expect(classifyRecoveredDraft(draft, true)).toEqual({
      kind: 'committed',
      operationId: 'op-committed-1',
    });
  });

  it('classifies real uncommitted draft when operationId is NOT in SQLite', () => {
    const draft: SessionDraft = { ...baseDraft, operationId: 'op-uncommitted-2' };
    expect(classifyRecoveredDraft(draft, false)).toEqual({
      kind: 'real_pending',
      operationId: 'op-uncommitted-2',
    });
  });

  it('classifies legacy draft without token as ambiguous_legacy without guessing', () => {
    const legacyDraft: SessionDraft = { ...baseDraft, operationId: null };
    expect(classifyRecoveredDraft(legacyDraft, false)).toEqual({
      kind: 'ambiguous_legacy',
    });

    const legacyDraftBlank: SessionDraft = { ...baseDraft, operationId: '   ' };
    expect(classifyRecoveredDraft(legacyDraftBlank, false)).toEqual({
      kind: 'ambiguous_legacy',
    });
  });
});

describe('Contract C3: resolveNavigationAction', () => {
  it('navigates immediately when there is no pending set', () => {
    expect(resolveNavigationAction({
      hasPendingSet: false,
      isRecoveredPending: false,
    })).toEqual({ type: 'navigate_immediately' });

    expect(resolveNavigationAction({
      hasPendingSet: false,
      isRecoveredPending: true,
      recoveredKind: 'real_pending',
    })).toEqual({ type: 'navigate_immediately' });
  });

  it('preserves intentional auto-save for active workout flow (not recovered)', () => {
    expect(resolveNavigationAction({
      hasPendingSet: true,
      isRecoveredPending: false,
    })).toEqual({ type: 'auto_save_and_navigate' });
  });

  it('prompts explicit recovery decision for recovered pending drafts instead of silent save', () => {
    expect(resolveNavigationAction({
      hasPendingSet: true,
      isRecoveredPending: true,
      recoveredKind: 'real_pending',
    })).toEqual({
      type: 'prompt_recovery_decision',
      reason: 'real_pending',
    });

    expect(resolveNavigationAction({
      hasPendingSet: true,
      isRecoveredPending: true,
      recoveredKind: 'ambiguous_legacy',
    })).toEqual({
      type: 'prompt_recovery_decision',
      reason: 'ambiguous_legacy',
    });
  });
});

import {
  hasPendingSessionDraft,
  resolveSessionDraft,
} from '@/src/utils/session-draft';

const persisted = {
  sessionId: 42,
  exerciseId: 7,
  weight: '80',
  reps: '8',
  duration: '',
  rir: 0,
  isWarmupMode: true,
  isDirty: true,
  activeSetTime: 0,
};

describe('session draft recovery', () => {
  it('restores a dirty draft only for the same session and exercise', () => {
    expect(resolveSessionDraft(persisted, { sessionId: 42, exerciseId: 7 })).toEqual({
      weight: '80',
      reps: '8',
      duration: '',
      rir: 0,
      isWarmupMode: true,
      isDirty: true,
      activeSetTime: 0,
    });

    expect(resolveSessionDraft(persisted, { sessionId: 99, exerciseId: 7 })).toBeNull();
    expect(resolveSessionDraft(persisted, { sessionId: 42, exerciseId: 99 })).toBeNull();
  });

  it('restores a stopped duration draft even when no text field is dirty', () => {
    expect(resolveSessionDraft(
      { ...persisted, isDirty: false, activeSetTime: 73 },
      { sessionId: 42, exerciseId: 7 },
    )).toEqual({
      weight: '80',
      reps: '8',
      duration: '',
      rir: 0,
      isWarmupMode: true,
      isDirty: false,
      activeSetTime: 73,
    });
  });

  it('ignores clean, malformed, and invalid persisted contexts', () => {
    expect(resolveSessionDraft(
      { ...persisted, isDirty: false, activeSetTime: 0 },
      { sessionId: 42, exerciseId: 7 },
    )).toBeNull();
    expect(resolveSessionDraft('{not-json}', { sessionId: 42, exerciseId: 7 })).toBeNull();
    expect(resolveSessionDraft({ ...persisted, sessionId: '42' }, { sessionId: 42, exerciseId: 7 })).toBeNull();
    expect(resolveSessionDraft({ ...persisted, exerciseId: '7' }, { sessionId: 42, exerciseId: 7 })).toBeNull();
    expect(resolveSessionDraft({ ...persisted, rir: 99 }, { sessionId: 42, exerciseId: 7 })).toBeNull();
    expect(resolveSessionDraft(null, { sessionId: 42, exerciseId: 7 })).toBeNull();
  });

  it('detects text, warm-up, or duration work as pending', () => {
    expect(hasPendingSessionDraft({ isDirty: true, activeSetTime: 0, isActiveSetRunning: false })).toBe(true);
    expect(hasPendingSessionDraft({ isDirty: false, activeSetTime: 20, isActiveSetRunning: false })).toBe(true);
    expect(hasPendingSessionDraft({ isDirty: false, activeSetTime: 0, isActiveSetRunning: true })).toBe(true);
    expect(hasPendingSessionDraft({ isDirty: false, activeSetTime: 0, isActiveSetRunning: false })).toBe(false);
  });
});

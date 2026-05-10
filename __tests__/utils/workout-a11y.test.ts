import { buildWorkoutA11y } from '../../src/utils/workout-a11y';

describe('workout-a11y', () => {
  const labels = {
    endSession: 'End session',
    warmupSwitch: 'Warm-up mode',
    undoLastSetLabel: 'Undo last set',
    undoLastSetHint: 'Removes the last registered set',
    durationStart: 'Start set timer',
    durationStop: 'Stop set timer',
    running: 'Running',
    history: 'Open history',
  };

  it('builds end session a11y props', () => {
    const a11y = buildWorkoutA11y(labels);
    expect(a11y.endSession).toEqual({
      accessibilityRole: 'button',
      accessibilityLabel: 'End session',
      hitSlop: { top: 10, bottom: 10, left: 10, right: 10 }
    });
  });

  it('builds exercise card a11y props', () => {
    const a11y = buildWorkoutA11y(labels);

    // pending
    expect(a11y.exerciseCard({
      name: 'Bench Press',
      progress: '0/3 sets',
      status: 'Tap to start',
      isActive: false,
      isComplete: false,
    })).toEqual({
      accessibilityRole: 'button',
      accessibilityLabel: 'Bench Press, 0/3 sets. Tap to start',
      accessibilityState: {
        selected: false,
        checked: false,
      }
    });

    // in-progress
    expect(a11y.exerciseCard({
      name: 'Bench Press',
      progress: '1/3 sets',
      status: 'In progress...',
      isActive: true,
      isComplete: false,
    })).toEqual({
      accessibilityRole: 'button',
      accessibilityLabel: 'Bench Press, 1/3 sets. In progress...',
      accessibilityState: {
        selected: true,
        checked: false,
      }
    });

    // completed
    expect(a11y.exerciseCard({
      name: 'Bench Press',
      progress: '3/3 sets',
      status: 'Completed',
      isActive: true,
      isComplete: true,
    })).toEqual({
      accessibilityRole: 'button',
      accessibilityLabel: 'Bench Press, 3/3 sets. Completed',
      accessibilityState: {
        selected: true,
        checked: true,
      }
    });
  });

  it('builds warmup switch a11y props', () => {
    const a11y = buildWorkoutA11y(labels);
    expect(a11y.warmupSwitch(true)).toEqual({
      accessibilityRole: 'switch',
      accessibilityLabel: 'Warm-up mode',
      accessibilityState: { checked: true }
    });
    expect(a11y.warmupSwitch(false)).toEqual({
      accessibilityRole: 'switch',
      accessibilityLabel: 'Warm-up mode',
      accessibilityState: { checked: false }
    });
  });

  it('builds undo a11y props', () => {
    const a11y = buildWorkoutA11y(labels);
    expect(a11y.undo).toEqual({
      accessibilityRole: 'button',
      accessibilityLabel: 'Undo last set',
      accessibilityHint: 'Removes the last registered set'
    });
  });

  it('builds duration control a11y props for stopped state', () => {
    const a11y = buildWorkoutA11y(labels);
    expect(a11y.durationControl(false)).toEqual({
      accessibilityRole: 'button',
      accessibilityLabel: 'Start set timer',
      accessibilityState: { selected: false }
    });
  });

  it('builds duration control a11y props for running state', () => {
    const a11y = buildWorkoutA11y(labels);
    expect(a11y.durationControl(true)).toEqual({
      accessibilityRole: 'button',
      accessibilityLabel: 'Running. Stop set timer',
      accessibilityState: { selected: true }
    });
  });

  it('builds history button a11y props', () => {
    const a11y = buildWorkoutA11y(labels);
    expect(a11y.history).toEqual({
      accessibilityRole: 'button',
      accessibilityLabel: 'Open history',
    });
  });
});

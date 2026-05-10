export interface WorkoutA11yLabels {
  endSession: string;
  warmupSwitch: string;
  undoLastSetLabel: string;
  undoLastSetHint: string;
  durationStart: string;
  durationStop: string;
  running: string;
  history: string;
}

export function buildWorkoutA11y(labels: WorkoutA11yLabels) {
  return {
    endSession: {
      accessibilityRole: 'button' as const,
      accessibilityLabel: labels.endSession,
      hitSlop: { top: 10, bottom: 10, left: 10, right: 10 },
    },
    exerciseCard: (
      exercise: { name: string; progress: string; status: string; isActive: boolean; isComplete: boolean }
    ) => {
      return {
        accessibilityRole: 'button' as const,
        accessibilityLabel: `${exercise.name}, ${exercise.progress}. ${exercise.status}`,
        accessibilityState: {
          selected: exercise.isActive,
          checked: exercise.isComplete,
        },
      };
    },
    warmupSwitch: (isWarmupMode: boolean) => ({
      accessibilityRole: 'switch' as const,
      accessibilityLabel: labels.warmupSwitch,
      accessibilityState: { checked: isWarmupMode },
    }),
    undo: {
      accessibilityRole: 'button' as const,
      accessibilityLabel: labels.undoLastSetLabel,
      accessibilityHint: labels.undoLastSetHint,
    },
    durationControl: (isRunning: boolean) => ({
      accessibilityRole: 'button' as const,
      accessibilityLabel: isRunning
        ? `${labels.running}. ${labels.durationStop}`
        : labels.durationStart,
      accessibilityState: { selected: isRunning },
    }),
    history: {
      accessibilityRole: 'button' as const,
      accessibilityLabel: labels.history,
    },
  };
}

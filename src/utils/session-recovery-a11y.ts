export interface SessionRecoveryA11yLabels {
  title: string;
  description: string;
  dontAskAgain: string;
  resume: string;
  saveWorkout: string;
  cancel: string;
  dismiss: string;
  dismissHint: string;
  checkboxHint: string;
}

function joinAccessibilitySentences(title: string, description: string) {
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();

  if (!trimmedTitle) return trimmedDescription;
  if (!trimmedDescription) return trimmedTitle;

  const separator = /[.!?。！？]$/.test(trimmedTitle) ? ' ' : '. ';
  return `${trimmedTitle}${separator}${trimmedDescription}`;
}

export function buildSessionRecoveryA11y(labels: SessionRecoveryA11yLabels, dontShowAgain: boolean) {
  return {
    modal: {
      accessibilityViewIsModal: true,
      accessibilityLabel: joinAccessibilitySentences(labels.title, labels.description),
    },
    backdrop: {
      accessibilityRole: 'button' as const,
      accessibilityLabel: labels.dismiss,
      accessibilityHint: labels.dismissHint,
    },
    dontAskAgainCheckbox: {
      accessibilityRole: 'checkbox' as const,
      accessibilityLabel: labels.dontAskAgain,
      accessibilityState: { checked: dontShowAgain },
      accessibilityHint: labels.checkboxHint,
    },
    actions: {
      resume: {
        accessibilityRole: 'button' as const,
        accessibilityLabel: labels.resume,
      },
      save: {
        accessibilityRole: 'button' as const,
        accessibilityLabel: labels.saveWorkout,
      },
      cancel: {
        accessibilityRole: 'button' as const,
        accessibilityLabel: labels.cancel,
      },
    },
  };
}

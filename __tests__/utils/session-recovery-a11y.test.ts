import { buildSessionRecoveryA11y } from '@/src/utils/session-recovery-a11y';

describe('session recovery accessibility', () => {
  const labels = {
    title: 'Retomar Treino?',
    description: 'Você tem um treino em andamento. Deseja continuar ou salvar?',
    dontAskAgain: 'Não perguntar novamente',
    resume: 'Retomar',
    saveWorkout: 'Salvar Treino',
    cancel: 'Cancelar',
    dismiss: 'Fechar aviso de recuperação de treino',
    dismissHint: 'Fecha o aviso sem retomar o treino atual.',
    checkboxHint: 'Alterna se este aviso será exibido novamente.',
  };

  it('describes the recovery modal title and body as a modal dialog', () => {
    expect(buildSessionRecoveryA11y(labels, false).modal).toEqual({
      accessibilityViewIsModal: true,
      accessibilityLabel: 'Retomar Treino? Você tem um treino em andamento. Deseja continuar ou salvar?',
    });
  });

  it('adds a sentence break when the title has no final punctuation', () => {
    expect(buildSessionRecoveryA11y({ ...labels, title: 'Retomar Treino' }, false).modal.accessibilityLabel)
      .toBe('Retomar Treino. Você tem um treino em andamento. Deseja continuar ou salvar?');
  });

  it('exposes the dismiss backdrop as a labelled button', () => {
    expect(buildSessionRecoveryA11y(labels, false).backdrop).toEqual({
      accessibilityRole: 'button',
      accessibilityLabel: 'Fechar aviso de recuperação de treino',
      accessibilityHint: 'Fecha o aviso sem retomar o treino atual.',
    });
  });

  it('exposes the opt-out control as a checkbox with checked state', () => {
    expect(buildSessionRecoveryA11y(labels, true).dontAskAgainCheckbox).toEqual({
      accessibilityRole: 'checkbox',
      accessibilityLabel: 'Não perguntar novamente',
      accessibilityState: { checked: true },
      accessibilityHint: 'Alterna se este aviso será exibido novamente.',
    });
  });

  it('exposes all recovery actions as labelled buttons', () => {
    expect(buildSessionRecoveryA11y(labels, false).actions).toEqual({
      resume: { accessibilityRole: 'button', accessibilityLabel: 'Retomar' },
      save: { accessibilityRole: 'button', accessibilityLabel: 'Salvar Treino' },
      cancel: { accessibilityRole: 'button', accessibilityLabel: 'Cancelar' },
    });
  });
});

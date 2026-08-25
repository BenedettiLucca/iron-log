import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import SetCard from '@/components/SetCard';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mockTrigger = jest.fn();

jest.mock('react-native-reanimated', () => {
  const springify = jest.fn(() => 'set-entry');
  return {
    __esModule: true,
    default: { View: 'AnimatedView' },
    FadeInDown: {
      springify,
    },
  };
});

jest.mock('react-native/Libraries/Components/Touchable/TouchableOpacity', () => ({
  __esModule: true,
  default: 'TouchableOpacity',
}));

jest.mock('react-native/Libraries/Components/View/View', () => ({
  __esModule: true,
  default: 'View',
}));

jest.mock('react-native/Libraries/Text/Text', () => ({
  __esModule: true,
  default: 'Text',
}));

jest.mock('react-native/Libraries/StyleSheet/StyleSheet', () => ({
  __esModule: true,
  default: {
    flatten: (style: unknown) => style ?? {},
  },
}));

jest.mock('react-native/Libraries/Alert/Alert', () => ({
  __esModule: true,
  default: { alert: jest.fn() },
}));

jest.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({ trigger: mockTrigger }),
}));

jest.mock('@/src/i18n/index', () => ({
  useI18n: () => ({
    t: (key: string, options?: Record<string, number>) =>
      ({
        'common.cancel': 'Cancelar',
        'common.delete': 'Excluir',
        'common.edit': 'Editar',
        'exercise.reps': 'reps',
        'setCard.accessibilityLabel': `Série ${options?.setNumber}`,
        'setCard.actionsHint': 'Use o botão de ações.',
        'setCard.actionsTitle': 'Ações da série',
        'setCard.deleteAction': 'Excluir série',
        'setCard.durationSeconds': `${options?.duration}s`,
        'setCard.edited': 'Editado',
        'setCard.editAction': 'Editar série',
        'setCard.noWeight': 'sem carga',
        'setCard.openActions': 'Abrir ações da série',
        'setCard.repsCount': `${options?.reps} repetições`,
        'setCard.rir': `RIR ${options?.rir}`,
        'setCard.warmup': 'Aquecimento',
      })[key] ?? key,
  }),
}));

function renderCard(overrides: Record<string, unknown> = {}) {
  return render(
    <SetCard
      setNumber={1}
      weight={80}
      reps={8}
      rir={2}
      onEdit={jest.fn()}
      onDelete={jest.fn()}
      {...overrides}
    />
  );
}

describe('SetCard actions and local entry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('offers visible native edit and delete alternatives to swipe', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const result = renderCard({ onEdit, onDelete });

    const actionsButton = result.getByLabelText('Abrir ações da série');
    expect(actionsButton.props.className).toContain('w-11 h-11');
    fireEvent.press(actionsButton);

    expect(mockTrigger).toHaveBeenCalledWith('selection');
    expect(Alert.alert).toHaveBeenCalledTimes(1);
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2];
    buttons.find((button: { text: string }) => button.text === 'Editar').onPress();
    buttons.find((button: { text: string }) => button.text === 'Excluir').onPress();
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('animates only when the parent marks this set as changed', () => {
    const result = renderCard({ animateEntry: false });
    expect(result.UNSAFE_getByType('AnimatedView' as any).props.entering).toBeUndefined();

    result.rerender(
      <SetCard
        setNumber={1}
        weight={82.5}
        reps={8}
        rir={2}
        animateEntry
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    expect(result.UNSAFE_getByType('AnimatedView' as any).props.entering).toBe('set-entry');
  });

  it('renders warm-up and edited state as one status line', () => {
    const result = renderCard({ isWarmup: true, isEdited: true });
    expect(result.getByText('Aquecimento · Editado')).toBeTruthy();
  });
});

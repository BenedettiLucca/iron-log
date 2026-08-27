import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
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

jest.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({
    overlay: 'rgba(0, 0, 0, 0.5)',
  }),
}));

jest.mock('react-native/Libraries/Modal/Modal', () => ({
  __esModule: true,
  default: 'Modal',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock('@/components/Button', () => ({
  Button: (props: Record<string, unknown>) => React.createElement('Button', props),
}));

jest.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({ trigger: mockTrigger }),
}));

jest.mock('@/hooks/use-reactive-reduced-motion', () => ({
  useReactiveReducedMotion: () => false,
}));

jest.mock('@/src/utils/accessibility', () => ({
  focusAccessibilityNode: jest.fn(),
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

  it('shows themed action dialog instead of native Alert', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const result = renderCard({ onEdit, onDelete });

    const actionsButton = result.getByLabelText('Abrir ações da série');
    expect(actionsButton.props.className).toContain('w-11 h-11');

    act(() => {
      fireEvent.press(actionsButton);
    });

    expect(mockTrigger).toHaveBeenCalledWith('selection');
    expect(Alert.alert).not.toHaveBeenCalled();

    const buttons = result.UNSAFE_getAllByType('Button' as any);
    const editBtn = buttons.find((b: any) => b.props.title === 'Editar');
    const deleteBtn = buttons.find((b: any) => b.props.title === 'Excluir');
    const cancelBtn = buttons.find((b: any) => b.props.title === 'Cancelar');
    expect(editBtn).toBeTruthy();
    expect(deleteBtn).toBeTruthy();
    expect(cancelBtn).toBeTruthy();
  });

  it('calls onEdit when Edit is pressed in the themed dialog', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const result = renderCard({ onEdit, onDelete });

    act(() => {
      fireEvent.press(result.getByLabelText('Abrir ações da série'));
    });

    const editBtn = result.UNSAFE_getAllByType('Button' as any).find((b: any) => b.props.title === 'Editar');
    act(() => {
      fireEvent.press(editBtn!);
    });

    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it('calls onDelete when Delete is pressed in the themed dialog', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const result = renderCard({ onEdit, onDelete });

    act(() => {
      fireEvent.press(result.getByLabelText('Abrir ações da série'));
    });

    const deleteBtn = result.UNSAFE_getAllByType('Button' as any).find((b: any) => b.props.title === 'Excluir');
    act(() => {
      fireEvent.press(deleteBtn!);
    });

    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('closes the themed dialog on Cancel without calling onEdit or onDelete', () => {
    const onEdit = jest.fn();
    const onDelete = jest.fn();
    const result = renderCard({ onEdit, onDelete });

    act(() => {
      fireEvent.press(result.getByLabelText('Abrir ações da série'));
    });

    const cancelBtn = result.UNSAFE_getAllByType('Button' as any).find((b: any) => b.props.title === 'Cancelar');
    act(() => {
      fireEvent.press(cancelBtn!);
    });

    expect(onEdit).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
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

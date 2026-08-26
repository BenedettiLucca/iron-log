import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { EmptyState } from '@/components/EmptyState';
import { SetEditor } from '@/components/SetEditor';
import { StatTile } from '@/components/StatTile';
import { Stopwatch } from '@/components/Stopwatch';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

jest.mock('react-native/Libraries/Modal/Modal', () => ({
  __esModule: true,
  default: 'Modal',
}));
jest.mock('react-native/Libraries/Components/TextInput/TextInput', () => ({
  __esModule: true,
  default: (jest.requireActual('react') as typeof React).forwardRef(
    (props: Record<string, unknown>, _ref: React.ForwardedRef<unknown>) =>
      React.createElement('TextInput', props),
  ),
}));
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
jest.mock('@/components/Card', () => ({
  Card: ({ children, ...props }: Record<string, unknown>) =>
    React.createElement('View', props, children as React.ReactNode),
}));
jest.mock('@/components/Button', () => ({
  Button: (props: Record<string, unknown>) => React.createElement('Button', props),
}));
jest.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({ trigger: jest.fn() }),
}));
jest.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({
    primaryText: '#111',
    secondaryText: '#222',
    warningText: '#333',
    successText: '#444',
  }),
}));
jest.mock('@/src/i18n/index', () => ({
  useI18n: () => ({
    t: (key: string, vars?: Record<string, string | number>) =>
      key === 'setEditor.title' ? `Editar série ${vars?.number}` : key,
  }),
}));

describe('Sprint 6 core component accessibility', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('exposes SetEditor as a modal with a heading and named fields', () => {
    const result = render(
      <SetEditor
        visible
        setNumber={2}
        initialWeight={80}
        initialReps={8}
        initialRir={2}
        isDuration={false}
        onSave={jest.fn(async () => true)}
        onCancel={jest.fn()}
      />,
    );
    const modal = result.UNSAFE_getByType('Modal' as any);
    const fields = result.UNSAFE_getAllByType('TextInput' as any);
    const heading = result
      .UNSAFE_getAllByType('Text' as any)
      .find((node) => node.props.children === 'Editar série 2');

    expect(modal.props.accessibilityViewIsModal).toBe(true);
    expect(heading?.props.accessibilityRole).toBe('header');
    expect(fields.map((field) => field.props.accessibilityLabel)).toEqual([
      'exercise.weight',
      'setEditor.repetitions',
      'exercise.rir',
    ]);
  });

  it('announces SetEditor validation errors without moving focus away from the form', async () => {
    const result = render(
      <SetEditor
        visible
        setNumber={1}
        initialWeight={80}
        initialReps={0}
        initialRir={2}
        isDuration={false}
        onSave={jest.fn(async () => true)}
        onCancel={jest.fn()}
      />,
    );
    const save = result.UNSAFE_getAllByType('Button' as any)
      .find((button) => button.props.title === 'common.save');

    await act(async () => {
      save!.props.onPress();
    });

    const error = result
      .UNSAFE_getAllByType('Text' as any)
      .find((node) => node.props.children === 'exercise.enterReps');
    expect(error?.props.accessibilityLiveRegion).toBe('polite');
  });

  it('exposes the stopwatch as a stable timer without a per-second live region', () => {
    const result = render(<Stopwatch startTime={0} />);

    const timer = result.UNSAFE_getByType('Text' as any);
    expect(timer.props.accessibilityRole).toBe('timer');
    expect(timer.props.accessibilityLabel).toBe('exerciseSession.elapsedTime: 00:00');
    expect(timer.props.accessibilityLiveRegion).toBeUndefined();
  });

  it('groups a stat value, label and delta into one concise announcement', () => {
    const result = render(<StatTile value="12" label="Séries" delta="+2" />);
    const root = result.UNSAFE_getAllByType('View' as any)[0];

    expect(root.props.accessible).toBe(true);
    expect(root.props.accessibilityRole).toBe('summary');
    expect(root.props.accessibilityLabel).toBe('Séries: 12, +2');
  });

  it('keeps empty-state emoji decorative and exposes its CTA as a button', () => {
    const result = render(
      <EmptyState icon="📋" title="Sem treinos" actionLabel="Criar" onAction={jest.fn()} />,
    );
    const icon = result
      .UNSAFE_getAllByType('Text' as any)
      .find((node) => node.props.children === '📋');
    const action = result.UNSAFE_getByType('TouchableOpacity' as any);

    expect(icon?.props.accessible).toBe(false);
    expect(action.props.accessibilityRole).toBe('button');
    expect(action.props.accessibilityLabel).toBe('Criar');
  });
});
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { Platform, StyleSheet } from 'react-native';
import { DatePicker } from '@/components/DatePicker';

(global as typeof globalThis & { React: typeof React }).React = React;

const theme = {
  primaryText: '#9E422E',
  dangerText: '#B42332',
  border: '#D6CFB8',
  subtext: '#686878',
  primary: '#9E422E',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

jest.mock('react-native/Libraries/Utilities/Platform', () => {
  const platform = {
    OS: 'android',
    select: (options: Record<string, unknown>) => options[platform.OS] ?? options.default,
  };
  return { __esModule: true, default: platform };
});
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  __esModule: true,
  default: jest.fn(() => 'light'),
}));
jest.mock('react-native/Libraries/StyleSheet/StyleSheet', () => {
  const flatten = (style: unknown): Record<string, unknown> => {
    if (!style) return {};
    if (Array.isArray(style)) return Object.assign({}, ...style.map(flatten));
    return typeof style === 'object' ? (style as Record<string, unknown>) : {};
  };

  return {
    __esModule: true,
    default: {
      create: (styles: Record<string, unknown>) => styles,
      flatten,
    },
  };
});
jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => ({
  __esModule: true,
  default: 'Pressable',
}));
jest.mock('react-native/Libraries/Components/Touchable/TouchableOpacity', () => ({
  __esModule: true,
  default: 'TouchableOpacity',
}));
jest.mock('react-native/Libraries/Modal/Modal', () => ({
  __esModule: true,
  default: 'Modal',
}));
jest.mock('react-native/Libraries/Components/View/View', () => ({
  __esModule: true,
  default: 'View',
}));
jest.mock('react-native/Libraries/Text/Text', () => ({
  __esModule: true,
  default: 'Text',
}));
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: 'DateTimePicker',
}));
jest.mock('@/constants/colors', () => ({
  getThemeColors: () => theme,
}));
jest.mock('@/src/i18n', () => ({
  useI18n: () => ({
    language: 'pt',
    t: (key: string) =>
      ({
        'datePicker.placeholder': 'Selecionar data',
        'datePicker.title': 'Selecionar data',
        'datePicker.done': 'Concluído',
      })[key] || key,
  }),
  getLocaleForLanguage: () => 'pt-BR',
}));

describe('DatePicker', () => {
  const originalPlatform = Platform.OS;

  afterAll(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform, configurable: true });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  });

  it('uses a >=44dp accessible trigger and shows focus while open', () => {
    const { UNSAFE_getByType } = render(
      <DatePicker label="Data inicial" value={null} onChange={jest.fn()} />
    );

    let trigger = UNSAFE_getByType('Pressable' as any);
    expect(StyleSheet.flatten(trigger.props.style).minHeight).toBeGreaterThanOrEqual(44);
    expect(StyleSheet.flatten(trigger.props.style).borderColor).toBe(theme.border);
    expect(trigger.props.accessibilityRole).toBe('button');
    expect(trigger.props.accessibilityLabel).toBe('Data inicial');
    expect(trigger.props.accessibilityValue).toEqual({ text: 'Selecionar data' });
    expect(trigger.props.accessibilityState).toEqual({ disabled: false, expanded: false });

    fireEvent.press(trigger);
    trigger = UNSAFE_getByType('Pressable' as any);
    expect(StyleSheet.flatten(trigger.props.style).borderColor).toBe(theme.primaryText);
    expect(trigger.props.accessibilityState).toEqual({ disabled: false, expanded: true });
    expect(UNSAFE_getByType('DateTimePicker' as any)).toBeTruthy();
  });

  it('announces a selected value without styling it as focused', () => {
    const selectedDate = new Date(2026, 6, 20);
    const formattedDate = selectedDate.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const { UNSAFE_getByType } = render(
      <DatePicker label="Data inicial" value={selectedDate} onChange={jest.fn()} />
    );
    const trigger = UNSAFE_getByType('Pressable' as any);

    expect(StyleSheet.flatten(trigger.props.style).borderColor).toBe(theme.border);
    expect(trigger.props.accessibilityValue).toEqual({ text: formattedDate });
  });

  it('renders and announces error without losing it to the open state', () => {
    const { UNSAFE_getByType, UNSAFE_getAllByType } = render(
      <DatePicker
        label="Data inicial"
        value={null}
        onChange={jest.fn()}
        error="Data obrigatória"
      />
    );

    let trigger = UNSAFE_getByType('Pressable' as any);
    expect(StyleSheet.flatten(trigger.props.style).borderColor).toBe(theme.dangerText);
    expect(trigger.props.accessibilityHint).toBe('Data obrigatória');

    fireEvent.press(trigger);
    trigger = UNSAFE_getByType('Pressable' as any);
    expect(StyleSheet.flatten(trigger.props.style).borderColor).toBe(theme.dangerText);

    const errorText = UNSAFE_getAllByType('Text' as any).find(
      (node) => node.props.children === 'Data obrigatória'
    );
    expect(errorText?.props.accessibilityLiveRegion).toBe('polite');
  });

  it('does not open and exposes a muted disabled state', () => {
    const { UNSAFE_getByType, UNSAFE_queryByType } = render(
      <DatePicker label="Data inicial" value={null} onChange={jest.fn()} disabled />
    );
    const trigger = UNSAFE_getByType('Pressable' as any);

    expect(trigger.props.disabled).toBe(true);
    expect(trigger.props.accessibilityState).toEqual({ disabled: true, expanded: false });
    expect(trigger.props.className).toContain('opacity-60');

    fireEvent.press(trigger);
    expect(UNSAFE_queryByType('DateTimePicker' as any)).toBeNull();
  });

  it('closes and ignores late native changes when disabled while open', () => {
    const onChange = jest.fn();
    const selectedDate = new Date(2026, 6, 20);
    const { rerender, UNSAFE_getByType, UNSAFE_queryByType } = render(
      <DatePicker label="Data inicial" value={null} onChange={onChange} />
    );

    fireEvent.press(UNSAFE_getByType('Pressable' as any));
    const staleNativeChange = UNSAFE_getByType('DateTimePicker' as any).props.onChange;

    rerender(
      <DatePicker label="Data inicial" value={null} onChange={onChange} disabled />
    );

    const trigger = UNSAFE_getByType('Pressable' as any);
    expect(UNSAFE_queryByType('DateTimePicker' as any)).toBeNull();
    expect(trigger.props.accessibilityState).toEqual({ disabled: true, expanded: false });
    expect(StyleSheet.flatten(trigger.props.style).borderColor).toBe(theme.border);

    act(() => {
      staleNativeChange({ type: 'set', nativeEvent: {} }, selectedDate);
    });
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <DatePicker label="Data inicial" value={null} onChange={onChange} disabled={false} />
    );
    expect(UNSAFE_queryByType('DateTimePicker' as any)).toBeNull();
    expect(UNSAFE_getByType('Pressable' as any).props.accessibilityState).toEqual({
      disabled: false,
      expanded: false,
    });
  });

  it('opens and closes the iOS modal through a >=44dp Done target', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    const { rerender, UNSAFE_getAllByType, UNSAFE_getByType } = render(
      <DatePicker label="Data inicial" value={null} onChange={jest.fn()} />
    );

    let pressables = UNSAFE_getAllByType('Pressable' as any);
    const trigger = pressables.find((node) => node.props.accessibilityLabel === 'Data inicial');
    let done = pressables.find((node) => node.props.accessibilityLabel === 'Concluído');

    expect(UNSAFE_getByType('Modal' as any).props.visible).toBe(false);
    fireEvent.press(trigger!);
    expect(UNSAFE_getByType('Modal' as any).props.visible).toBe(true);

    rerender(<DatePicker label="Data inicial" value={null} onChange={jest.fn()} disabled />);
    expect(UNSAFE_getByType('Modal' as any).props.visible).toBe(false);
    expect(
      UNSAFE_getAllByType('Pressable' as any).find(
        (node) => node.props.accessibilityLabel === 'Data inicial'
      )?.props.accessibilityState
    ).toEqual({ disabled: true, expanded: false });

    rerender(<DatePicker label="Data inicial" value={null} onChange={jest.fn()} />);
    expect(UNSAFE_getByType('Modal' as any).props.visible).toBe(false);
    pressables = UNSAFE_getAllByType('Pressable' as any);
    fireEvent.press(
      pressables.find((node) => node.props.accessibilityLabel === 'Data inicial')!
    );
    expect(UNSAFE_getByType('Modal' as any).props.visible).toBe(true);

    pressables = UNSAFE_getAllByType('Pressable' as any);
    done = pressables.find((node) => node.props.accessibilityLabel === 'Concluído');
    expect(done?.props.className).toContain('min-h-[44px]');
    expect(done?.props.className).toContain('min-w-[44px]');

    fireEvent.press(done!);
    expect(UNSAFE_getByType('Modal' as any).props.visible).toBe(false);
  });

  it('forwards a selected Android date and closes the picker', () => {
    const onChange = jest.fn();
    const selectedDate = new Date(2026, 6, 20);
    const { UNSAFE_getByType, UNSAFE_queryByType } = render(
      <DatePicker value={null} onChange={onChange} />
    );

    fireEvent.press(UNSAFE_getByType('Pressable' as any));
    act(() => {
      UNSAFE_getByType('DateTimePicker' as any).props.onChange(
        { type: 'set', nativeEvent: {} },
        selectedDate
      );
    });

    expect(onChange).toHaveBeenCalledWith(selectedDate);
    expect(UNSAFE_queryByType('DateTimePicker' as any)).toBeNull();
  });
});

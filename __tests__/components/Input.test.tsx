import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { Input } from '@/components/Input';

(global as typeof globalThis & { React: typeof React }).React = React;

const mockTrigger = jest.fn();
const theme = {
  primaryText: '#9E422E',
  dangerText: '#B42332',
  border: '#D6CFB8',
  subtext: '#686878',
};

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
jest.mock('react-native/Libraries/Components/TextInput/TextInput', () => ({
  __esModule: true,
  default: 'TextInput',
}));
jest.mock('react-native/Libraries/Components/View/View', () => ({
  __esModule: true,
  default: 'View',
}));
jest.mock('react-native/Libraries/Text/Text', () => ({
  __esModule: true,
  default: 'Text',
}));

jest.mock('@/constants/colors', () => ({
  getThemeColors: () => theme,
}));
jest.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({ trigger: mockTrigger }),
}));

describe('Input', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enforces a 44dp floor while preserving larger caller heights', () => {
    const { UNSAFE_getByType, rerender } = render(
      <Input value="90" onChangeText={jest.fn()} style={{ minHeight: 36 }} />
    );

    let input = UNSAFE_getByType('TextInput' as any);
    expect(StyleSheet.flatten(input.props.style).minHeight).toBe(44);

    rerender(<Input value="90" onChangeText={jest.fn()} style={{ minHeight: 64 }} />);
    input = UNSAFE_getByType('TextInput' as any);
    expect(StyleSheet.flatten(input.props.style).minHeight).toBe(64);
  });

  it('keeps the floor with multiline, explicit height and style arrays', () => {
    const { UNSAFE_getByType, rerender } = render(
      <Input
        multiline
        value="Notas"
        onChangeText={jest.fn()}
        style={[{ height: 36, minHeight: 32 }, { minHeight: 60 }]}
      />
    );

    let style = StyleSheet.flatten(UNSAFE_getByType('TextInput' as any).props.style);
    expect(style.height).toBe(36);
    expect(style.minHeight).toBe(60);

    rerender(
      <Input multiline value="Notas" onChangeText={jest.fn()} style={[{ height: 36 }]} />
    );
    style = StyleSheet.flatten(UNSAFE_getByType('TextInput' as any).props.style);
    expect(style.height).toBe(36);
    expect(style.minHeight).toBe(44);
  });

  it('keeps internal focus state while forwarding focus and blur callbacks', () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const { UNSAFE_getByType } = render(
      <Input value="Treino A" onChangeText={jest.fn()} onFocus={onFocus} onBlur={onBlur} />
    );

    let input = UNSAFE_getByType('TextInput' as any);
    expect(StyleSheet.flatten(input.props.style).borderColor).toBe(theme.border);

    fireEvent(input, 'focus', { nativeEvent: {} });
    input = UNSAFE_getByType('TextInput' as any);
    expect(StyleSheet.flatten(input.props.style).borderColor).toBe(theme.primaryText);
    expect(onFocus).toHaveBeenCalledTimes(1);
    expect(mockTrigger).not.toHaveBeenCalled();

    fireEvent(input, 'blur', { nativeEvent: {} });
    input = UNSAFE_getByType('TextInput' as any);
    expect(StyleSheet.flatten(input.props.style).borderColor).toBe(theme.border);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('keeps the error state visible while focused and announces its message', () => {
    const { UNSAFE_getByType, UNSAFE_getAllByType } = render(
      <Input
        label="Nome"
        value=""
        onChangeText={jest.fn()}
        error="Nome obrigatório"
      />
    );

    let input = UNSAFE_getByType('TextInput' as any);
    expect(StyleSheet.flatten(input.props.style).borderColor).toBe(theme.dangerText);
    expect(input.props.accessibilityHint).toBe('Nome obrigatório');

    fireEvent(input, 'focus', { nativeEvent: {} });
    input = UNSAFE_getByType('TextInput' as any);
    expect(StyleSheet.flatten(input.props.style).borderColor).toBe(theme.dangerText);

    const errorText = UNSAFE_getAllByType('Text' as any).find(
      (node) => node.props.children === 'Nome obrigatório'
    );
    expect(errorText?.props.accessibilityLiveRegion).toBe('polite');
  });

  it('preserves error and caller semantics in the disabled state', () => {
    const { UNSAFE_getByType } = render(
      <Input
        label="Nome"
        value="Treino A"
        onChangeText={jest.fn()}
        editable={false}
        error="Nome inválido"
        className="text-center"
        accessibilityLabel="Nome da rotina"
        accessibilityState={{ busy: true }}
      />
    );
    const input = UNSAFE_getByType('TextInput' as any);

    expect(input.props.editable).toBe(false);
    expect(input.props.accessibilityState).toEqual({ busy: true, disabled: true });
    expect(input.props.accessibilityLabel).toBe('Nome da rotina');
    expect(input.props.className).toContain('opacity-60');
    expect(input.props.className).toContain('text-center');
    expect(StyleSheet.flatten(input.props.style).borderColor).toBe(theme.dangerText);
  });

  it('preserves native keyboard submission props', () => {
    const onSubmitEditing = jest.fn();
    const { UNSAFE_getByType } = render(
      <Input
        value="85"
        onChangeText={jest.fn()}
        returnKeyType="done"
        submitBehavior="submit"
        onSubmitEditing={onSubmitEditing}
      />
    );
    const input = UNSAFE_getByType('TextInput' as any);

    expect(input.props.returnKeyType).toBe('done');
    expect(input.props.submitBehavior).toBe('submit');
    input.props.onSubmitEditing({ nativeEvent: { text: '85' } });
    expect(onSubmitEditing).toHaveBeenCalledTimes(1);
  });

  it('preserves character count behavior', () => {
    const { UNSAFE_getAllByType } = render(
      <Input
        value="Força"
        onChangeText={jest.fn()}
        maxLength={60}
        showCharacterCount
      />
    );

    expect(
      UNSAFE_getAllByType('Text' as any).some((node) =>
        Array.isArray(node.props.children)
          ? node.props.children.join('') === '5/60'
          : node.props.children === '5/60'
      )
    ).toBe(true);
  });
});

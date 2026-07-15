import React from 'react';
import { render } from '@testing-library/react-native';
import { useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { Button } from '@/components/Button';

(global as typeof globalThis & { React: typeof React }).React = React;

const mockTrigger = jest.fn();

jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => ({
  __esModule: true,
  default: 'Pressable',
}));
jest.mock('react-native/Libraries/Text/Text', () => ({ __esModule: true, default: 'Text' }));
jest.mock('react-native/Libraries/Components/View/View', () => ({
  __esModule: true,
  default: 'View',
}));
jest.mock('react-native/Libraries/Components/ActivityIndicator/ActivityIndicator', () => ({
  __esModule: true,
  default: 'ActivityIndicator',
}));

jest.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({ trigger: mockTrigger }),
}));

jest.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({
    onPrimary: '#F4F1DE',
    secondaryText: '#3D5A80',
    onDanger: '#F4F1DE',
    subtext: '#686878',
    onSuccess: '#1D1917',
  }),
}));

const mockUseReducedMotion = useReducedMotion as jest.MockedFunction<typeof useReducedMotion>;
const mockUseSharedValue = useSharedValue as jest.MockedFunction<typeof useSharedValue>;
const mockWithTiming = withTiming as jest.MockedFunction<typeof withTiming>;

describe('Button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseReducedMotion.mockReturnValue(false);
  });

  it.each(['sm', 'md', 'lg'] as const)('preserves sentence case for the %s size', (size) => {
    const { UNSAFE_getByType } = render(
      <Button title="Salvar treino" size={size} onPress={jest.fn()} />
    );
    const text = UNSAFE_getByType('Text' as any);

    expect(text.props.children).toBe('Salvar treino');
    expect(text.props.className).not.toMatch(/\b(?:uppercase|tracking-wider|tracking-widest)\b/);
  });

  it('exposes the title or explicit override as its accessible label', () => {
    const { UNSAFE_getByType, rerender } = render(
      <Button title="Salvar treino" onPress={jest.fn()} />
    );

    expect(UNSAFE_getByType('Pressable' as any).props.accessibilityLabel).toBe('Salvar treino');
    expect(UNSAFE_getByType('Pressable' as any).props.accessibilityState).toEqual({
      disabled: false,
      busy: false,
    });

    rerender(
      <Button
        title="Salvar treino"
        accessibilityLabel="Salvar alterações do treino"
        onPress={jest.fn()}
      />
    );

    expect(UNSAFE_getByType('Pressable' as any).props.accessibilityLabel).toBe(
      'Salvar alterações do treino'
    );
  });

  it('forwards the VoiceOver escape handler to its accessible pressable', () => {
    const onAccessibilityEscape = jest.fn();
    const { UNSAFE_getByType } = render(
      <Button
        title="Cancelar"
        onPress={jest.fn()}
        onAccessibilityEscape={onAccessibilityEscape}
      />
    );
    const button = UNSAFE_getByType('Pressable' as any);

    button.props.onAccessibilityEscape();

    expect(onAccessibilityEscape).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['primary', 'text-onPrimary'],
    ['secondary', 'text-secondaryText'],
    ['danger', 'text-onDanger'],
    ['ghost', 'text-subtext'],
    ['success', 'text-onSuccess'],
  ] as const)('uses a contrast-safe foreground for the %s variant', (variant, textClass) => {
    const { UNSAFE_getByType } = render(
      <Button title={variant} variant={variant} onPress={jest.fn()} />
    );

    expect(UNSAFE_getByType('Text' as any).props.className).toContain(textClass);
  });

  it.each([
    ['primary', '#F4F1DE'],
    ['secondary', '#3D5A80'],
    ['danger', '#F4F1DE'],
    ['ghost', '#686878'],
    ['success', '#1D1917'],
  ] as const)('uses a contrast-safe loading indicator for the %s variant', (variant, color) => {
    const { UNSAFE_getByType } = render(
      <Button title={variant} variant={variant} loading onPress={jest.fn()} />
    );

    expect(UNSAFE_getByType('ActivityIndicator' as any).props.color).toBe(color);
  });

  it.each([
    ['primary', 'medium'],
    ['secondary', 'light'],
    ['danger', 'warning'],
    ['ghost', 'light'],
    ['success', 'medium'],
  ] as const)('uses the expected haptic semantics for the %s variant', (variant, haptic) => {
    const onPress = jest.fn();
    const { UNSAFE_getByType } = render(
      <Button title={variant} variant={variant} onPress={onPress} />
    );

    UNSAFE_getByType('Pressable' as any).props.onPress();

    expect(mockTrigger).toHaveBeenCalledWith(haptic);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it.each([
    { disabled: true, loading: false },
    { disabled: false, loading: true },
  ])('stays silent and inert when unavailable: %o', (state) => {
    const onPress = jest.fn();
    const { UNSAFE_getByType } = render(
      <Button title="Salvar" onPress={onPress} {...state} />
    );
    const button = UNSAFE_getByType('Pressable' as any);

    button.props.onPress();
    button.props.onPressIn();
    button.props.onPressOut();

    expect(button.props.disabled).toBe(true);
    expect(button.props.accessibilityState).toEqual({ disabled: true, busy: state.loading });
    expect(button.props.style[1]).toEqual({ opacity: state.disabled ? 0.6 : 1 });
    expect(mockTrigger).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
    expect(mockWithTiming).not.toHaveBeenCalled();
  });

  it('uses restrained timing motion while pressed', () => {
    const { UNSAFE_getByType } = render(<Button title="Continuar" onPress={jest.fn()} />);
    const button = UNSAFE_getByType('Pressable' as any);

    button.props.onPressIn();
    button.props.onPressOut();

    expect(mockWithTiming).toHaveBeenNthCalledWith(1, 0.98, { duration: 80 });
    expect(mockWithTiming).toHaveBeenNthCalledWith(2, 1, { duration: 120 });
  });

  it('resets a pressed scale when the button becomes loading before press-out', () => {
    const onPress = jest.fn();
    const { UNSAFE_getByType, rerender } = render(
      <Button title="Salvar" onPress={onPress} />
    );
    const pressedButton = UNSAFE_getByType('Pressable' as any);
    const scale = mockUseSharedValue.mock.results[0].value;

    pressedButton.props.onPressIn();
    expect(scale.value).toBe(0.98);

    rerender(<Button title="Salvar" loading onPress={onPress} />);
    UNSAFE_getByType('Pressable' as any).props.onPressOut();

    expect(scale.value).toBe(1);
    expect(mockWithTiming).toHaveBeenCalledTimes(1);
  });

  it('does not animate when Reduce Motion is enabled', () => {
    mockUseReducedMotion.mockReturnValue(true);
    const { UNSAFE_getByType } = render(<Button title="Continuar" onPress={jest.fn()} />);
    const button = UNSAFE_getByType('Pressable' as any);

    button.props.onPressIn();
    button.props.onPressOut();

    expect(mockUseReducedMotion).toHaveBeenCalled();
    expect(mockWithTiming).not.toHaveBeenCalled();
  });
});

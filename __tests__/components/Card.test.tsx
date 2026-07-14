import React from 'react';
import { render } from '@testing-library/react-native';
import { Card } from '@/components/Card';

(global as typeof globalThis & { React: typeof React }).React = React;

const mockTrigger = jest.fn();

jest.mock('react-native/Libraries/Components/Pressable/Pressable', () => ({
  __esModule: true,
  default: 'Pressable',
}));
jest.mock('react-native/Libraries/Components/Touchable/TouchableOpacity', () => ({
  __esModule: true,
  default: 'TouchableOpacity',
}));
jest.mock('react-native/Libraries/Components/View/View', () => ({
  __esModule: true,
  default: 'View',
}));

jest.mock('@/hooks/use-haptics', () => ({
  useHaptics: () => ({ trigger: mockTrigger }),
}));

describe('Card', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['default', 'bordered'] as const)('keeps the %s variant flat', (variant) => {
    const { UNSAFE_getByType } = render(<Card variant={variant}>Conteúdo</Card>);

    const card = UNSAFE_getByType('View' as any);
    expect(card.props.className).toContain('bg-card');
    expect(card.props.className).toContain('border-border');
    expect(card.props.className).not.toMatch(/\bshadow-(?:sm|md|lg|xl|2xl)\b/);
  });

  it('preserves padding and explicit elevation classes from the call site', () => {
    const { UNSAFE_getByType, rerender } = render(
      <Card className="shadow-lg test-card">Conteúdo</Card>
    );

    let card = UNSAFE_getByType('View' as any);
    expect(card.props.className).toContain('p-4');
    expect(card.props.className).toContain('shadow-lg test-card');

    rerender(
      <Card contentPadding={false} className="shadow-lg test-card">
        Conteúdo
      </Card>
    );
    card = UNSAFE_getByType('View' as any);
    expect(card.props.className).not.toMatch(/\bp-4\b/);
    expect(card.props.className).toContain('shadow-lg test-card');
  });

  it('renders a static View unless both pressable and onPress are provided', () => {
    const { UNSAFE_getByType, UNSAFE_queryByType, rerender } = render(
      <Card pressable>Conteúdo</Card>
    );

    expect(UNSAFE_getByType('View' as any)).toBeTruthy();
    expect(UNSAFE_queryByType('Pressable' as any)).toBeNull();

    rerender(<Card onPress={jest.fn()}>Conteúdo</Card>);
    expect(UNSAFE_getByType('View' as any)).toBeTruthy();
    expect(UNSAFE_queryByType('Pressable' as any)).toBeNull();
  });

  it('uses NativeWind active state without automatic haptics', () => {
    const onPress = jest.fn();
    const style = { marginTop: 8 };
    const { UNSAFE_getByType } = render(
      <Card pressable onPress={onPress} style={style}>
        Programa ativo
      </Card>
    );
    const card = UNSAFE_getByType('Pressable' as any);

    expect(card.props.className).toContain('active:opacity-[0.92]');
    expect(card.props.style).toBe(style);
    expect(card.props.activeOpacity).toBeUndefined();

    card.props.onPress();
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(mockTrigger).not.toHaveBeenCalled();
  });

  it('exposes button semantics and supports link semantics for interactive cards', () => {
    const { UNSAFE_getByType, rerender } = render(
      <Card pressable onPress={jest.fn()} accessibilityLabel="Abrir programa">
        Programa
      </Card>
    );

    expect(UNSAFE_getByType('Pressable' as any).props.accessibilityRole).toBe('button');
    expect(UNSAFE_getByType('Pressable' as any).props.accessibilityLabel).toBe('Abrir programa');

    rerender(
      <Card
        pressable
        onPress={jest.fn()}
        accessibilityLabel="Abrir detalhes"
        accessibilityRole="link"
      >
        Programa
      </Card>
    );

    expect(UNSAFE_getByType('Pressable' as any).props.accessibilityRole).toBe('link');
  });
});

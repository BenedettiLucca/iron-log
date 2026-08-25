import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { useSharedValue, withTiming } from 'react-native-reanimated';
import { WarmupToggle } from '@/components/session/WarmupToggle';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

let mockReducedMotion = false;

jest.mock('@/hooks/use-reactive-reduced-motion', () => ({
  useReactiveReducedMotion: () => mockReducedMotion,
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

jest.mock('react-native/Libraries/StyleSheet/StyleSheet', () => ({
  __esModule: true,
  default: { flatten: (style: unknown) => style ?? {} },
}));

const mockUseSharedValue = useSharedValue as jest.Mock;
const mockWithTiming = withTiming as jest.Mock;

const buildToggle = (value: boolean, onValueChange = jest.fn()) => (
  <WarmupToggle
    value={value}
    onValueChange={onValueChange}
    label="Aquecimento"
    accessibilityLabel="Modo de aquecimento"
  />
);

const renderToggle = (value: boolean, onValueChange = jest.fn()) =>
  render(buildToggle(value, onValueChange));

describe('WarmupToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReducedMotion = false;
  });

  it('exposes a 44dp switch target and emits the next checked state', () => {
    const onValueChange = jest.fn();
    const result = renderToggle(false, onValueChange);
    const toggle = result.getByLabelText('Modo de aquecimento');

    expect(toggle.props.accessibilityRole).toBe('switch');
    expect(toggle.props.accessibilityState).toEqual({ checked: false });
    expect(toggle.props.className).toContain('w-12 h-11');

    fireEvent.press(toggle);
    expect(onValueChange).toHaveBeenCalledWith(true);
  });

  it('animates only value changes with the shared interaction duration', () => {
    const result = renderToggle(false);
    expect(mockWithTiming).not.toHaveBeenCalled();

    result.rerender(buildToggle(true));

    expect(mockWithTiming).toHaveBeenCalledWith(1, { duration: 160 });
  });

  it('does not animate when only the Reduce Motion preference changes', () => {
    const result = renderToggle(false);
    mockReducedMotion = true;
    result.rerender(buildToggle(false));

    mockReducedMotion = false;
    result.rerender(buildToggle(false));

    expect(mockWithTiming).not.toHaveBeenCalled();
  });

  it('jumps directly to the new state under Reduce Motion', () => {
    const result = renderToggle(false);
    const sharedValue = mockUseSharedValue.mock.results[0].value as { value: number };
    mockReducedMotion = true;

    result.rerender(buildToggle(true));

    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(sharedValue.value).toBe(1);
  });
});

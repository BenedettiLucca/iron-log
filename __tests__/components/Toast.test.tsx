import React from 'react';
import { act, render } from '@testing-library/react-native';
import { Toast } from '@/components/Toast';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mockSetValue = jest.fn();
const mockStopAnimation = jest.fn();
const mockSpringStart = jest.fn();
type AnimationEnd = { finished: boolean };
const mockTimingCallbacks: ((result: AnimationEnd) => void)[] = [];
const mockTimingStart = jest.fn((callback?: (result: AnimationEnd) => void) => {
  if (callback) mockTimingCallbacks.push(callback);
});
const mockSpring = jest.fn(() => ({ start: mockSpringStart }));
const mockTiming = jest.fn(() => ({ start: mockTimingStart }));
const mockAnimatedValue = {
  setValue: mockSetValue,
  stopAnimation: mockStopAnimation,
};
let mockReducedMotion = false;

jest.mock('react-native/Libraries/Animated/Animated', () => ({
  __esModule: true,
  default: {
    Value: jest.fn(() => mockAnimatedValue),
    View: 'AnimatedView',
    spring: mockSpring,
    timing: mockTiming,
  },
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
    create: (styles: Record<string, unknown>) => styles,
    flatten: (style: unknown) =>
      Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style,
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 34, left: 0 }),
}));
jest.mock('@/hooks/use-reactive-reduced-motion', () => ({
  useReactiveReducedMotion: () => mockReducedMotion,
}));

function flattenStyle(style: unknown) {
  return Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
}

describe('Toast', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockTimingCallbacks.length = 0;
    mockReducedMotion = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('positions itself from the real top safe area', () => {
    const result = render(<Toast visible message="Salvo" />);
    const animated = result.UNSAFE_getByType('AnimatedView' as any);

    expect(flattenStyle(animated.props.style)).toEqual(
      expect.objectContaining({ top: 56, left: 0, right: 0, position: 'absolute' })
    );
  });

  it.each([
    ['error', 'assertive'],
    ['success', 'polite'],
    ['info', 'polite'],
  ] as const)('announces %s messages as an alert with a %s live region', (type, liveRegion) => {
    const result = render(<Toast visible message="Mensagem importante" type={type} />);
    const alert = result.UNSAFE_getByType('View' as any);

    expect(alert.props.accessible).toBe(true);
    expect(alert.props.accessibilityRole).toBe('alert');
    expect(alert.props.accessibilityLiveRegion).toBe(liveRegion);
    expect(alert.props.accessibilityLabel).toBe('Mensagem importante');
  });

  it('runs entrance, dwell, and exit once before hiding', () => {
    const onHide = jest.fn();
    render(<Toast visible message="Salvo" duration={1000} onHide={onHide} />);

    expect(mockSpring).toHaveBeenCalledWith(
      mockAnimatedValue,
      expect.objectContaining({ toValue: 0, useNativeDriver: true })
    );
    expect(mockTiming).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);

    expect(mockTiming).toHaveBeenCalledWith(mockAnimatedValue, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    });
    expect(onHide).not.toHaveBeenCalled();

    act(() => mockTimingCallbacks[0]({ finished: true }));

    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('restarts the dwell time when a new message replaces a visible toast', () => {
    const onHide = jest.fn();
    const result = render(
      <Toast visible message="Primeira" duration={1000} onHide={onHide} />
    );

    jest.advanceTimersByTime(500);
    result.rerender(
      <Toast visible message="Segunda" duration={1000} onHide={onHide} />
    );
    jest.advanceTimersByTime(600);

    expect(mockTiming).not.toHaveBeenCalled();
    expect(onHide).not.toHaveBeenCalled();

    jest.advanceTimersByTime(400);
    expect(mockTiming).toHaveBeenCalledTimes(1);
    expect(onHide).not.toHaveBeenCalled();

    act(() => mockTimingCallbacks[0]({ finished: true }));

    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('cancels an old exit when a replacement arrives and hides only after the new exit finishes', () => {
    const onHide = jest.fn();
    const result = render(
      <Toast visible message="Primeira" duration={1000} onHide={onHide} />
    );

    jest.advanceTimersByTime(1000);
    expect(mockTimingCallbacks).toHaveLength(1);

    result.rerender(
      <Toast visible message="Segunda" duration={1000} onHide={onHide} />
    );
    act(() => mockTimingCallbacks[0]({ finished: false }));

    expect(onHide).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);
    expect(mockTimingCallbacks).toHaveLength(2);
    act(() => mockTimingCallbacks[1]({ finished: true }));

    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('stops an active exit animation without hiding after unmount', () => {
    const onHide = jest.fn();
    const result = render(
      <Toast visible message="Salvo" duration={1000} onHide={onHide} />
    );

    jest.advanceTimersByTime(1000);
    expect(mockTiming).toHaveBeenCalledTimes(1);

    result.unmount();
    act(() => mockTimingCallbacks[0]({ finished: false }));
    jest.runOnlyPendingTimers();

    expect(mockStopAnimation).toHaveBeenCalled();
    expect(onHide).not.toHaveBeenCalled();
  });

  it('uses immediate values instead of spring or timing under Reduce Motion', () => {
    mockReducedMotion = true;
    const onHide = jest.fn();
    render(<Toast visible message="Salvo" duration={1000} onHide={onHide} />);

    expect(mockSetValue).toHaveBeenCalledWith(0);
    expect(mockSpring).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1000);

    expect(mockSetValue).toHaveBeenCalledWith(-100);
    expect(mockTiming).not.toHaveBeenCalled();
    expect(onHide).toHaveBeenCalledTimes(1);
  });

  it('cancels motion and becomes static when Reduce Motion changes while visible', () => {
    const result = render(<Toast visible message="Salvo" duration={1000} />);
    expect(mockSpring).toHaveBeenCalledTimes(1);

    mockReducedMotion = true;
    result.rerender(<Toast visible message="Salvo" duration={1000} />);

    expect(mockStopAnimation).toHaveBeenCalled();
    expect(mockSetValue).toHaveBeenCalledWith(0);
    expect(mockSpring).toHaveBeenCalledTimes(1);
  });
});

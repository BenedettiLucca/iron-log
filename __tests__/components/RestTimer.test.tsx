import React from 'react';
import { act, render } from '@testing-library/react-native';
import { RestTimer } from '@/components/RestTimer';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mockSetValue = jest.fn();
const mockStopAnimation = jest.fn();
const mockInterpolate = jest.fn(() => 'translateY');
const mockSpringStart = jest.fn();
const mockTimingStart = jest.fn((callback?: () => void) => callback?.());
const mockSpring = jest.fn(() => ({ start: mockSpringStart }));
const mockTiming = jest.fn(() => ({ start: mockTimingStart }));
const mockAnimatedValue = {
  setValue: mockSetValue,
  stopAnimation: mockStopAnimation,
  interpolate: mockInterpolate,
};
const mockDismissKeyboard = jest.fn();
const mockAnnounce = jest.fn();
const mockFocusAccessibilityNode = jest.fn();
let mockReducedMotion = false;
let mockPanResponderConfig: Record<string, (...args: any[]) => unknown> = {};

jest.mock('react-native/Libraries/Animated/Animated', () => ({
  __esModule: true,
  default: {
    Value: jest.fn(() => mockAnimatedValue),
    View: 'AnimatedView',
    spring: mockSpring,
    timing: mockTiming,
  },
}));
jest.mock('react-native/Libraries/Interaction/PanResponder', () => ({
  __esModule: true,
  default: {
    create: jest.fn((config) => {
      mockPanResponderConfig = config;
      return { panHandlers: { testPanResponder: true } };
    }),
  },
}));
jest.mock('react-native/Libraries/Components/Keyboard/Keyboard', () => ({
  __esModule: true,
  default: { dismiss: mockDismissKeyboard },
}));
jest.mock(
  'react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo',
  () => ({
    __esModule: true,
    default: { announceForAccessibility: mockAnnounce },
  })
);
jest.mock('react-native/Libraries/Modal/Modal', () => ({
  __esModule: true,
  default: 'Modal',
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
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, right: 0, bottom: 34, left: 0 }),
}));
jest.mock('@/hooks/use-reactive-reduced-motion', () => ({
  useReactiveReducedMotion: () => mockReducedMotion,
}));
jest.mock('@/src/utils/accessibility', () => ({
  focusAccessibilityNode: (...args: unknown[]) => mockFocusAccessibilityNode(...args),
}));
jest.mock('@/src/i18n', () => ({
  useI18n: () => ({
    t: (key: string) =>
      ({
        'restTimer.rest': 'Descanso',
        'restTimer.resting': 'Descansando...',
        'restTimer.readyForNextSet': 'Pronto para a próxima série!',
        'restTimer.add30sAccessibility': 'Adicionar 30 segundos',
        'restTimer.minus10sAccessibility': 'Diminuir 10 segundos',
        'restTimer.continueAccessibility': 'Continuar treino',
        'restTimer.skipAccessibility': 'Pular descanso',
        'restTimer.continue': 'Continuar',
        'restTimer.skip': 'Pular',
        'restTimer.nextExerciseLabel': 'Próximo:',
      })[key] ?? key,
  }),
}));

function renderTimer(overrides: Record<string, unknown> = {}) {
  return render(
    <RestTimer
      visible
      seconds={90}
      status="running"
      onClose={jest.fn()}
      onSkip={jest.fn()}
      onAddTime={jest.fn()}
      {...overrides}
    />
  );
}

describe('RestTimer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReducedMotion = false;
    mockPanResponderConfig = {};
  });

  it('uses a native modal and the real bottom safe area', () => {
    const onClose = jest.fn();
    const result = renderTimer({ onClose });
    const modal = result.UNSAFE_getByType('Modal' as any);
    const sheet = result
      .UNSAFE_getAllByType('View' as any)
      .find((node) => node.props.className?.includes('bg-card'));

    expect(modal.props.visible).toBe(true);
    expect(modal.props.transparent).toBe(true);
    expect(modal.props.statusBarTranslucent).toBe(true);
    expect(modal.props.navigationBarTranslucent).toBe(true);
    expect(sheet?.props.style).toEqual({ paddingBottom: 34 });

    modal.props.onRequestClose();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('dismisses the keyboard and focuses the heading when shown', () => {
    const result = renderTimer();
    const modal = result.UNSAFE_getByType('Modal' as any);
    const heading = result
      .UNSAFE_getAllByType('Text' as any)
      .find((node) => node.props.children === 'Descanso');

    modal.props.onShow();

    expect(mockDismissKeyboard).toHaveBeenCalledTimes(1);
    expect(mockFocusAccessibilityNode).toHaveBeenCalledTimes(1);
    expect(heading?.props.accessibilityRole).toBe('header');
    expect(heading?.props.accessible).toBe(true);
  });

  it('keeps the changing countdown queryable but out of live regions', () => {
    const result = renderTimer({ seconds: 90 });
    const timer = result
      .UNSAFE_getAllByType('Text' as any)
      .find((node) => node.props.children === '1:30');

    expect(timer?.props.accessible).toBe(true);
    expect(timer?.props.accessibilityRole).toBe('timer');
    expect(timer?.props.accessibilityLabel).toBe('Descanso: 1:30');
    expect(timer?.props.accessibilityLiveRegion).toBeUndefined();
  });

  it('announces the finished state exactly once per rest period', () => {
    const result = renderTimer({ seconds: 1, status: 'running' });

    result.rerender(
      <RestTimer
        visible
        seconds={0}
        status="finished"
        onClose={jest.fn()}
        onSkip={jest.fn()}
        onAddTime={jest.fn()}
      />
    );
    result.rerender(
      <RestTimer
        visible
        seconds={0}
        status="finished"
        onClose={jest.fn()}
        onSkip={jest.fn()}
        onAddTime={jest.fn()}
      />
    );

    expect(mockAnnounce).toHaveBeenCalledTimes(1);
    expect(mockAnnounce).toHaveBeenCalledWith('Pronto para a próxima série!');
  });

  it('stops animation work on unmount', () => {
    const result = renderTimer();

    expect(mockSpring).toHaveBeenCalledWith(mockAnimatedValue, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    });
    result.unmount();

    expect(mockStopAnimation).toHaveBeenCalled();
  });

  it('opens immediately without spring under Reduce Motion', () => {
    mockReducedMotion = true;
    renderTimer();

    expect(mockSetValue).toHaveBeenCalledWith(0);
    expect(mockSpring).not.toHaveBeenCalled();
  });

  it('claims the sheet responder at touch start but never steals button presses', () => {
    renderTimer();

    // Inside an Android Modal, if the sheet does not claim the responder at
    // touch start, native claims the stream after the first move and JS never
    // sees the rest of the gesture (device-verified S5 QA round 3).
    expect(mockPanResponderConfig.onStartShouldSetPanResponder?.({}, {})).toBe(true);
    // Capture must stay false so child buttons win the negotiation at start.
    expect(mockPanResponderConfig.onStartShouldSetPanResponderCapture?.({}, {})).toBe(false);
  });

  it('returns the sheet to rest when another responder interrupts the swipe', () => {
    renderTimer();
    mockSpring.mockClear();

    act(() => {
      mockPanResponderConfig.onPanResponderTerminate?.();
    });

    expect(mockSpring).toHaveBeenCalledWith(mockAnimatedValue, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    });
  });

  it('dismisses on a short fast downward swipe', () => {
    const onClose = jest.fn();
    renderTimer({ onClose });

    act(() => {
      mockPanResponderConfig.onPanResponderRelease?.({}, { dy: 60, vy: 1.2 });
    });

    expect(mockTiming).toHaveBeenCalledWith(mockAnimatedValue, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the shared 200ms timing for an accepted swipe dismissal', () => {
    const onClose = jest.fn();
    renderTimer({ onClose });

    act(() => {
      mockPanResponderConfig.onPanResponderRelease?.({}, { dy: 120 });
    });

    expect(mockTiming).toHaveBeenCalledWith(mockAnimatedValue, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the current Reduce Motion value in swipe-to-dismiss callbacks', () => {
    const onClose = jest.fn();
    const result = renderTimer({ onClose });
    expect(mockSpring).toHaveBeenCalledTimes(1);

    mockReducedMotion = true;
    result.rerender(
      <RestTimer
        visible
        seconds={90}
        status="running"
        onClose={onClose}
        onSkip={jest.fn()}
        onAddTime={jest.fn()}
      />
    );

    act(() => {
      mockPanResponderConfig.onPanResponderRelease?.({}, { dy: 120 });
    });

    expect(mockTiming).not.toHaveBeenCalled();
    expect(mockSetValue).toHaveBeenCalledWith(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the backdrop and every focused element escape', () => {
    const onClose = jest.fn();
    const result = renderTimer({ onClose });
    const touchables = result.UNSAFE_getAllByType('TouchableOpacity' as any);
    const backdrop = touchables.find((node) => node.props.className?.includes('bg-black/40'));
    const actions = touchables.filter((node) => node.props.accessibilityRole === 'button');
    const accessibleTexts = result
      .UNSAFE_getAllByType('Text' as any)
      .filter((node) => node.props.accessible === true);
    const animated = result.UNSAFE_getByType('AnimatedView' as any);

    expect(backdrop).toBeDefined();
    expect(actions).toHaveLength(3);
    expect(accessibleTexts).toHaveLength(3);
    expect(animated.props.accessible).toBe(false);
    expect(animated.props.onAccessibilityEscape).toBeUndefined();

    backdrop!.props.onPress();
    actions.forEach((action) => action.props.onAccessibilityEscape());
    accessibleTexts.forEach((node) => node.props.onAccessibilityEscape());

    expect(onClose).toHaveBeenCalledTimes(7);
    expect(animated.props.accessibilityViewIsModal).toBe(true);
  });
});

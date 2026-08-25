import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import {
  cancelAnimation,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Skeleton, SkeletonList } from '@/components/Skeleton';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

let mockReduceMotionListener: ((enabled: boolean) => void) | undefined;
const mockIsReduceMotionEnabled = jest.fn<Promise<boolean>, []>();
const mockRemoveReduceMotionListener = jest.fn();
const mockAddReduceMotionListener = jest.fn(
  (_event: string, listener: (enabled: boolean) => void) => {
    mockReduceMotionListener = listener;
    return { remove: mockRemoveReduceMotionListener };
  }
);

jest.mock(
  'react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo',
  () => ({
    __esModule: true,
    default: {
      isReduceMotionEnabled: mockIsReduceMotionEnabled,
      addEventListener: mockAddReduceMotionListener,
    },
  })
);

jest.mock('react-native/Libraries/Components/View/View', () => ({
  __esModule: true,
  default: 'View',
}));

jest.mock('@/hooks/use-theme-colors', () => ({
  useThemeColors: () => ({ border: '#D1D5DB' }),
}));

const mockCancelAnimation = cancelAnimation as jest.Mock;
const mockUseReducedMotion = useReducedMotion as jest.Mock;
const mockUseSharedValue = useSharedValue as jest.Mock;
const mockWithRepeat = withRepeat as jest.Mock;
const mockWithTiming = withTiming as jest.Mock;

function flattenStyle(style: unknown) {
  if (!Array.isArray(style)) return style ?? {};
  return Object.assign({}, ...style.filter(Boolean));
}

function getSkeletons(result: ReturnType<typeof render>) {
  return result.UNSAFE_getAllByType('View' as any).filter(
    (node) =>
      node.props.accessible === false &&
      node.props.accessibilityElementsHidden === true &&
      node.props.importantForAccessibility === 'no-hide-descendants'
  );
}

function getAnimatedSkeletons(result: ReturnType<typeof render>) {
  return result.UNSAFE_getAllByType('AnimatedView' as any);
}

describe('Skeleton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReduceMotionListener = undefined;
    mockIsReduceMotionEnabled.mockResolvedValue(false);
    mockUseReducedMotion.mockReturnValue(false);
  });

  it('applies numeric and percentage dimensions to a NativeWind-safe wrapper', () => {
    const result = render(<Skeleton width="60%" height={20} className="mb-2" />);
    const [container] = getSkeletons(result);
    const [animatedFill] = getAnimatedSkeletons(result);

    expect(container.props.style).toEqual({ width: '60%', height: 20 });
    expect(container.props.testID).toBeUndefined();
    expect(container.props.className).toBe('mb-2');
    expect(container.props.accessible).toBe(false);
    expect(container.props.accessibilityElementsHidden).toBe(true);
    expect(container.props.importantForAccessibility).toBe('no-hide-descendants');

    expect(animatedFill.props.className).toBeUndefined();
    expect(flattenStyle(animatedFill.props.style)).toEqual(
      expect.objectContaining({
        width: '100%',
        height: '100%',
        backgroundColor: '#D1D5DB',
        borderRadius: 8,
      })
    );

    result.rerender(<Skeleton width={128} height={12} />);
    expect(getSkeletons(result)[0].props.style).toEqual({ width: 128, height: 12 });
  });

  it('preserves every percentage width used by SkeletonCard and SkeletonList', () => {
    const result = render(<SkeletonList count={1} />);
    const widths = getSkeletons(result).map((node) => node.props.style.width);

    expect(widths).toEqual(['60%', '80%', '100%', '40%']);
  });

  it('starts one reversible pulse in an effect and does not restart on rerender', () => {
    const result = render(<Skeleton />);

    expect(mockWithTiming).toHaveBeenCalledTimes(1);
    expect(mockWithTiming).toHaveBeenCalledWith(0.3, { duration: 800 });
    expect(mockWithRepeat).toHaveBeenCalledTimes(1);
    expect(mockWithRepeat).toHaveBeenCalledWith(0.3, -1, true);

    result.rerender(<Skeleton height={48} />);

    expect(mockWithTiming).toHaveBeenCalledTimes(1);
    expect(mockWithRepeat).toHaveBeenCalledTimes(1);
  });

  it('cancels its infinite pulse on unmount', () => {
    const result = render(<Skeleton />);
    const sharedValue = mockUseSharedValue.mock.results[0].value;

    expect(mockAddReduceMotionListener).toHaveBeenCalledWith(
      'reduceMotionChanged',
      expect.any(Function)
    );
    result.unmount();

    expect(mockCancelAnimation).toHaveBeenCalledTimes(1);
    expect(mockCancelAnimation).toHaveBeenCalledWith(sharedValue);
    expect(mockRemoveReduceMotionListener).toHaveBeenCalledTimes(1);
  });

  it('stays static under Reduce Motion without creating an animation', () => {
    mockUseReducedMotion.mockReturnValue(true);
    mockIsReduceMotionEnabled.mockResolvedValue(true);
    const result = render(<Skeleton />);
    const sharedValue = mockUseSharedValue.mock.results[0].value;

    expect(sharedValue.value).toBe(0.5);
    expect(mockWithTiming).not.toHaveBeenCalled();
    expect(mockWithRepeat).not.toHaveBeenCalled();

    result.unmount();
    expect(mockCancelAnimation).not.toHaveBeenCalled();
  });

  it('cancels a running pulse and becomes static on the native Reduce Motion event', async () => {
    const result = render(<Skeleton />);
    const sharedValue = mockUseSharedValue.mock.results[0].value;

    expect(mockReduceMotionListener).toBeDefined();
    act(() => {
      mockReduceMotionListener?.(true);
    });

    await waitFor(() => {
      expect(mockCancelAnimation).toHaveBeenCalledTimes(1);
      expect(mockCancelAnimation).toHaveBeenCalledWith(sharedValue);
      expect(sharedValue.value).toBe(0.5);
    });
    expect(mockWithRepeat).toHaveBeenCalledTimes(1);

    result.unmount();
    expect(mockRemoveReduceMotionListener).toHaveBeenCalledTimes(1);
  });

  it('owns and cleans up every animation created by SkeletonList', () => {
    const result = render(<SkeletonList count={2} />);

    expect(getSkeletons(result)).toHaveLength(8);
    expect(mockWithRepeat).toHaveBeenCalledTimes(8);

    result.unmount();
    expect(mockCancelAnimation).toHaveBeenCalledTimes(8);
  });
});

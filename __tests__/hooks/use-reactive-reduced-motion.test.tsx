import { act, renderHook } from '@testing-library/react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { useReactiveReducedMotion } from '@/hooks/use-reactive-reduced-motion';

const mockUseReducedMotion = useReducedMotion as jest.MockedFunction<typeof useReducedMotion>;
const mockAddEventListener = jest.fn();
const mockIsReduceMotionEnabled = jest.fn();

jest.mock(
  'react-native/Libraries/Components/AccessibilityInfo/AccessibilityInfo',
  () => ({
    __esModule: true,
    default: {
      addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
      isReduceMotionEnabled: () => mockIsReduceMotionEnabled(),
    },
  })
);

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

describe('useReactiveReducedMotion', () => {
  let listener: ((enabled: boolean) => void) | undefined;
  const remove = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    listener = undefined;
    mockUseReducedMotion.mockReturnValue(false);
    mockAddEventListener.mockImplementation((event, handler) => {
      expect(event).toBe('reduceMotionChanged');
      listener = handler;
      return { remove };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('applies the async native value when no newer event has arrived', async () => {
    mockIsReduceMotionEnabled.mockResolvedValue(true);
    const { result } = renderHook(() => useReactiveReducedMotion());

    expect(result.current).toBe(false);
    await act(async () => undefined);

    expect(result.current).toBe(true);
  });

  it('reacts to changes, ignores a stale async result, and cleans up safely', async () => {
    const initial = deferred<boolean>();
    mockIsReduceMotionEnabled.mockReturnValue(initial.promise);
    const { result, unmount } = renderHook(() => useReactiveReducedMotion());
    expect(mockAddEventListener).toHaveBeenCalledTimes(1);

    act(() => listener?.(true));
    expect(result.current).toBe(true);

    await act(async () => initial.resolve(false));
    expect(result.current).toBe(true);

    unmount();
    expect(remove).toHaveBeenCalledTimes(1);

    act(() => listener?.(false));
    expect(result.current).toBe(true);
  });
});

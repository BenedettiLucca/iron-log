import { act, renderHook } from '@testing-library/react-native';
import { useSessionTimer } from '@/hooks/use-session-timer';

describe('active set timer recovery', () => {
  it('restores a duration draft in the paused state', () => {
    const { result } = renderHook(() => useSessionTimer());

    act(() => result.current.restoreActiveSetTime(42));

    expect(result.current.activeSetTime).toBe(42);
    expect(result.current.isActiveSetRunning).toBe(false);
  });

  it('resets a saved duration set so it cannot be submitted twice', () => {
    const { result } = renderHook(() => useSessionTimer());

    act(() => {
      result.current.restoreActiveSetTime(42);
      result.current.toggleActiveSet();
    });
    expect(result.current.isActiveSetRunning).toBe(true);

    act(() => result.current.resetActiveSet());

    expect(result.current.activeSetTime).toBe(0);
    expect(result.current.isActiveSetRunning).toBe(false);
  });

  it('restores a running duration timer from its persisted start timestamp', () => {
    const now = jest.spyOn(Date, 'now').mockReturnValue(100_000);
    const { result } = renderHook(() => useSessionTimer());

    act(() => result.current.restoreActiveSetTime(2, 95_000));

    expect(result.current.activeSetTime).toBe(5);
    expect(result.current.isActiveSetRunning).toBe(true);
    expect(result.current.activeSetStart).toBe(95_000);
    now.mockRestore();
  });

  it('never reduces recovered elapsed time when the wall clock moves backward', () => {
    jest.useFakeTimers();
    jest.setSystemTime(100_000);
    const { result, unmount } = renderHook(() => useSessionTimer());

    act(() => result.current.restoreActiveSetTime(5, 95_000));
    expect(result.current.activeSetTime).toBe(5);

    jest.setSystemTime(90_000);
    act(() => jest.advanceTimersByTime(1_000));
    expect(result.current.activeSetTime).toBe(5);

    unmount();
    expect(jest.getTimerCount()).toBe(0);
    jest.useRealTimers();
  });
});

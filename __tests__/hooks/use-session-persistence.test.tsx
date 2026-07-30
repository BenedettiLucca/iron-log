import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';
import { useSessionPersistence } from '@/hooks/use-session-persistence';

jest.mock('react-native/Libraries/AppState/AppState', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

const opts = {
  sessionId: 42,
  exerciseId: 7,
  routineId: 3,
  exerciseName: 'Agachamento',
  currentName: 'Agachamento',
  exerciseType: 'strength',
  weight: '80',
  reps: '8',
  duration: '',
  rir: 0,
  isWarmupMode: true,
  isDirty: true,
  activeSetTime: 37,
  startTime: 123456,
  target: '3x8',
  notes: 'Controle',
  restSeconds: 90,
};

describe('session persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists the complete pending draft', async () => {
    const { result } = renderHook(() => useSessionPersistence(opts));

    await act(async () => {
      await result.current.saveSessionContext();
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('incomplete_session', expect.any(String));
    const stored = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[0][1]);
    expect(stored).toEqual(expect.objectContaining({
      sessionId: 42,
      exerciseId: 7,
      weight: '80',
      reps: '8',
      rir: 0,
      isWarmupMode: true,
      isDirty: true,
      activeSetTime: 37,
    }));
  });

  it('loads the persisted context for screen-level validation', async () => {
    const stored = { ...opts, exerciseName: opts.currentName };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(stored));
    const { result } = renderHook(() => useSessionPersistence(opts));

    let loaded: unknown;
    await act(async () => {
      loaded = await result.current.loadSessionContext();
    });

    expect(AsyncStorage.getItem).toHaveBeenCalledWith('incomplete_session');
    expect(loaded).toEqual(stored);
  });

  it('returns null instead of throwing for malformed storage', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('{broken-json');
    const { result } = renderHook(() => useSessionPersistence(opts));

    let loaded: unknown;
    await act(async () => {
      loaded = await result.current.loadSessionContext();
    });

    expect(loaded).toBeNull();
  });

  it('serializes writes so a newer clean draft cannot be overwritten by an older write', async () => {
    let releaseFirstWrite: (() => void) | undefined;
    (AsyncStorage.setItem as jest.Mock)
      .mockImplementationOnce(() => new Promise<void>((resolve) => {
        releaseFirstWrite = resolve;
      }))
      .mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useSessionPersistence(opts));
    const dirtyWrite = result.current.saveSessionContext();
    const cleanWrite = result.current.saveSessionContext({
      isDirty: false,
      activeSetTime: 0,
    });

    await Promise.resolve();
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);

    releaseFirstWrite?.();
    await act(async () => {
      await Promise.all([dirtyWrite, cleanWrite]);
    });

    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
    const cleanPayload = JSON.parse((AsyncStorage.setItem as jest.Mock).mock.calls[1][1]);
    expect(cleanPayload).toEqual(expect.objectContaining({
      isDirty: false,
      activeSetTime: 0,
    }));
  });

  it('waits for queued writes before loading and can remove stale recovery state', async () => {
    let releaseWrite: (() => void) | undefined;
    (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(
      () => new Promise<void>((resolve) => {
        releaseWrite = resolve;
      }),
    );
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify({
      ...opts,
      exerciseName: opts.currentName,
    }));

    const { result } = renderHook(() => useSessionPersistence(opts));
    const pendingWrite = result.current.saveSessionContext();
    const pendingLoad = result.current.loadSessionContext();

    await Promise.resolve();
    expect(AsyncStorage.getItem).not.toHaveBeenCalled();

    releaseWrite?.();
    await act(async () => {
      await Promise.all([pendingWrite, pendingLoad]);
      await result.current.clearSessionContext();
    });

    expect(AsyncStorage.getItem).toHaveBeenCalledWith('incomplete_session');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('incomplete_session');
  });

  it('keeps fallback cleanup atomic so a newer queued draft is written after removal', async () => {
    const operations: string[] = [];
    (AsyncStorage.setItem as jest.Mock)
      .mockImplementationOnce(async () => {
        operations.push('clean-write');
        throw new Error('write failed');
      })
      .mockImplementationOnce(async (_key: string, payload: string) => {
        operations.push(`newer-write:${JSON.parse(payload).reps}`);
      });
    (AsyncStorage.removeItem as jest.Mock).mockImplementationOnce(async () => {
      operations.push('fallback-remove');
    });

    const { result } = renderHook(() => useSessionPersistence(opts));
    const cleanup = result.current.saveSessionContext(
      { isDirty: false, activeSetTime: 0 },
      { clearOnFailure: true },
    );
    const newerDraft = result.current.saveSessionContext({ reps: '9', isDirty: true });

    await act(async () => {
      await Promise.all([cleanup, newerDraft]);
    });

    expect(operations).toEqual([
      'clean-write',
      'fallback-remove',
      'newer-write:9',
    ]);
  });

  it('rejects when both the clean write and atomic fallback removal fail', async () => {
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('write failed'));
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(new Error('remove failed'));

    const { result } = renderHook(() => useSessionPersistence(opts));

    await expect(result.current.saveSessionContext(
      { isDirty: false, activeSetTime: 0 },
      { clearOnFailure: true },
    )).rejects.toThrow('remove failed');
  });
});

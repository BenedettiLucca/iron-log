import React from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { programWeeks, routineExercises, routines, sessions } from '@/src/db/schema';
import { useRoutines } from '@/hooks/use-routines';

(globalThis as typeof globalThis & { React: typeof React }).React = React;

type Operation =
  | { kind: 'delete'; table: unknown }
  | { kind: 'update'; table: unknown; values: Record<string, unknown> };

const mockTransaction = jest.fn();
const mockFrom = jest.fn();
const mockLoggerError = jest.fn();
let committedOperations: Operation[] = [];
let attemptedOperations: Operation[] = [];
let failureAtOperation: number | undefined;
let injectedFailure: Error | undefined;

jest.mock('@/src/db/client', () => ({
  db: {
    transaction: (...args: unknown[]) => mockTransaction(...args),
    select: () => ({ from: (...args: unknown[]) => mockFrom(...args) }),
  },
}));

jest.mock('@/services/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

function runOperation(operation: Operation) {
  attemptedOperations.push(operation);
  if (attemptedOperations.length === failureAtOperation) {
    throw injectedFailure;
  }
  committedOperations.push(operation);
}

function createTransaction() {
  return {
    delete: (table: unknown) => ({
      where: () => ({
        run: () => runOperation({ kind: 'delete', table }),
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Record<string, unknown>) => ({
        where: () => ({
          run: () => runOperation({ kind: 'update', table, values }),
        }),
      }),
    }),
  };
}

describe('useRoutines deleteRoutine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    committedOperations = [];
    attemptedOperations = [];
    failureAtOperation = undefined;
    injectedFailure = undefined;
    mockFrom.mockResolvedValue([]);
    mockTransaction.mockImplementation((callback) => {
      const snapshot = [...committedOperations];
      try {
        const result = callback(createTransaction());
        if (result instanceof Promise) {
          throw new Error('Expo SQLite transaction callback must be synchronous');
        }
        return result;
      } catch (error) {
        committedOperations = snapshot;
        throw error;
      }
    });
  });

  it('atomically detaches historical children before deleting the routine', async () => {
    const { result } = renderHook(() => useRoutines());
    let deleted = false;

    await act(async () => {
      deleted = await result.current.deleteRoutine(7);
    });

    const expectedOperations: Operation[] = [
      { kind: 'delete', table: routineExercises },
      { kind: 'update', table: sessions, values: { routineId: null } },
      { kind: 'update', table: programWeeks, values: { routineId: null } },
      { kind: 'delete', table: routines },
    ];

    expect(deleted).toBe(true);
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(attemptedOperations).toEqual(expectedOperations);
    expect(committedOperations).toEqual(expectedOperations);
    expect(mockFrom).toHaveBeenCalledWith(routines);
  });

  it('rolls back earlier writes when a later mutation fails', async () => {
    injectedFailure = new Error('FOREIGN KEY constraint failed');
    failureAtOperation = 3;
    const { result } = renderHook(() => useRoutines());
    let deleted = true;

    await act(async () => {
      deleted = await result.current.deleteRoutine(7);
    });

    expect(deleted).toBe(false);
    expect(attemptedOperations).toEqual([
      { kind: 'delete', table: routineExercises },
      { kind: 'update', table: sessions, values: { routineId: null } },
      { kind: 'update', table: programWeeks, values: { routineId: null } },
    ]);
    expect(committedOperations).toEqual([]);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith('Failed to delete routine', injectedFailure);
  });
});

describe('useRoutines folders', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    committedOperations = [];
    attemptedOperations = [];
    failureAtOperation = undefined;
    injectedFailure = undefined;
    mockFrom.mockResolvedValue([]);
    mockTransaction.mockImplementation((callback) => {
      const snapshot = [...committedOperations];
      try {
        const result = callback(createTransaction());
        if (result instanceof Promise) {
          throw new Error('Expo SQLite transaction callback must be synchronous');
        }
        return result;
      } catch (error) {
        committedOperations = snapshot;
        throw error;
      }
    });
  });

  async function setupRoutines(routineData: { id: number; name: string; description: string; folder: string | null; isTemplate: boolean }[]) {
    mockFrom.mockResolvedValue(routineData);
    const { result } = renderHook(() => useRoutines());
    await act(async () => {
      await result.current.fetchRoutines();
    });
    return { result };
  }

  it('excludes "Geral" from folders when it is the only folder (no custom folders)', async () => {
    const { result } = await setupRoutines([
      { id: 1, name: 'Treino A', description: 'A', folder: null, isTemplate: false },
      { id: 2, name: 'Treino B', description: 'B', folder: 'Geral', isTemplate: false },
    ]);
    expect(result.current.folders).toEqual(['Todos']);
  });

  it('includes "Geral" when custom folders also exist', async () => {
    const { result } = await setupRoutines([
      { id: 1, name: 'Treino A', description: 'A', folder: 'Push', isTemplate: false },
      { id: 2, name: 'Treino B', description: 'B', folder: 'Geral', isTemplate: false },
    ]);
    expect(result.current.folders).toEqual(['Todos', 'Push', 'Geral']);
  });

  it('includes all distinct custom folders alongside "Geral"', async () => {
    const { result } = await setupRoutines([
      { id: 1, name: 'Treino A', description: 'A', folder: 'Push', isTemplate: false },
      { id: 2, name: 'Treino B', description: 'B', folder: 'Leg', isTemplate: false },
      { id: 3, name: 'Treino C', description: 'C', folder: 'Geral', isTemplate: false },
    ]);
    expect(result.current.folders).toEqual(['Todos', 'Push', 'Leg', 'Geral']);
  });

  it('returns only ["Todos"] when there are no routines', async () => {
    mockFrom.mockResolvedValue([]);
    const { result } = renderHook(() => useRoutines());
    await act(async () => {
      await result.current.fetchRoutines();
    });
    expect(result.current.folders).toEqual(['Todos']);
  });

  it('getFilteredRoutines still filters correctly when Geral is absent from folders', async () => {
    const { result } = await setupRoutines([
      { id: 1, name: 'Treino A', description: 'A', folder: 'Push', isTemplate: false },
      { id: 2, name: 'Treino B', description: 'B', folder: null, isTemplate: false },
    ]);
    expect(result.current.getFilteredRoutines('Todos')).toHaveLength(2);
    expect(result.current.getFilteredRoutines('Push')).toHaveLength(1);
    expect(result.current.getFilteredRoutines('Geral')).toHaveLength(1);
  });

  it('keeps legacy folder case variants reachable through the fallback chips', async () => {
    const { result } = await setupRoutines([
      { id: 1, name: 'Treino A', description: 'A', folder: 'geral', isTemplate: false },
      { id: 2, name: 'Treino B', description: 'B', folder: 'Push', isTemplate: false },
      { id: 3, name: 'Treino C', description: 'C', folder: 'push', isTemplate: false },
    ]);

    expect(result.current.folders).toEqual(['Todos', 'Geral', 'Push']);
    expect(result.current.getFilteredRoutines('Geral')).toHaveLength(1);
    expect(result.current.getFilteredRoutines('Push')).toHaveLength(2);
  });
});

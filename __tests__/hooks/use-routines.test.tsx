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

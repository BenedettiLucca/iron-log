import {
  hasRoutineNameConflict,
  isRoutineNameUniqueConstraintError,
  normalizeRoutineName,
} from '@/src/utils/routine-name';

describe('routine name persistence guards', () => {
  it('normalizes surrounding whitespace before querying or saving', () => {
    expect(normalizeRoutineName('  Treino A  ')).toBe('Treino A');
  });

  it('detects another routine with the same normalized name', () => {
    expect(hasRoutineNameConflict([{ id: 7 }])).toBe(true);
    expect(hasRoutineNameConflict([{ id: 7 }], 8)).toBe(true);
  });

  it('allows an edited routine to keep its own name', () => {
    expect(hasRoutineNameConflict([{ id: 7 }], 7)).toBe(false);
    expect(hasRoutineNameConflict([])).toBe(false);
  });

  it('recognizes the Expo SQLite unique-name error through nested causes', () => {
    const error = new Error('Call to NativeStatement.runSync has been rejected', {
      cause: new Error('Error code: UNIQUE constraint failed: routines.name'),
    });

    expect(isRoutineNameUniqueConstraintError(error)).toBe(true);
    expect(isRoutineNameUniqueConstraintError(new Error('FOREIGN KEY constraint failed'))).toBe(false);
  });
});

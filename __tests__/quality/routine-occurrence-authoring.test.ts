import fs from 'fs';
import path from 'path';
import { buildRoutineExerciseRows } from '@/src/utils/routine-template-integrity';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('routine occurrence authoring contract', () => {
  it('preserves repeated exercises as independent ordered rows', () => {
    expect(buildRoutineExerciseRows(42, [
      { id: 7, target: 'heavy' },
      { id: 8, target: 'middle' },
      { id: 7, target: 'backoff' },
    ])).toEqual([
      expect.objectContaining({ routineId: 42, exerciseId: 7, orderIndex: 1, target: 'heavy' }),
      expect.objectContaining({ routineId: 42, exerciseId: 8, orderIndex: 2, target: 'middle' }),
      expect.objectContaining({ routineId: 42, exerciseId: 7, orderIndex: 3, target: 'backoff' }),
    ]);
  });

  it('hydrates editor rows with their occurrence identity rather than only exercise identity', () => {
    const editor = read('app/routines/editor.tsx');

    expect(editor).toMatch(/routineExerciseId:\s*routineExercises\.id/);
    expect(editor).toMatch(/routineExerciseId:\s*j\.routineExerciseId/);
  });

  it('keeps template occurrences individually keyed while never reusing their source ids', () => {
    const templates = read('app/routines/templates.tsx');
    const integrity = read('src/utils/routine-template-integrity.ts');

    expect(templates).toMatch(/routineExerciseId:\s*routineExercises\.id/);
    expect(templates).toContain('key={ex.routineExerciseId}');
    expect(integrity).toContain('routineExerciseId: number;');
    expect(integrity).toMatch(/routineExerciseId:\s*row\.routineExerciseId/);

    const rows = buildRoutineExerciseRows(42, [
      { id: 7, routineExerciseId: 100 },
      { id: 7, routineExerciseId: 101 },
    ]);
    expect(rows.every((row) => !('id' in row) && !('routineExerciseId' in row))).toBe(true);
  });
});

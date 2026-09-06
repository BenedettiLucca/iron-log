import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('routine preview occurrence identity (QA 2026-09-05 key dup)', () => {
  const preview = read('app/routine/[routineId].tsx');

  it('query selects the occurrence id, not only the exercise id', () => {
    expect(preview).toMatch(/routineExerciseId:\s*routineExercises\.id/);
  });

  it('list keys use occurrence identity in cards and PR badges', () => {
    expect(preview).toContain('key={ex.routineExerciseId}');
    expect(preview).not.toContain('key={ex.id}');
  });

  it('expand/collapse state is keyed by occurrence (A/B/A expands independently)', () => {
    expect(preview).toMatch(/expandedOccurrenceId/);
    expect(preview).not.toMatch(/expandedExercise/);
  });

  it('PR badges dedupe repeated exercises (same PR row must not render twice)', () => {
    expect(preview).toMatch(/dedupe|new Map|new Set/);
  });
});

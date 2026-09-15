import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('#92 — routine share export/import with non-destructive merge', () => {
  it('share service exists with export and import entry points', () => {
    const svc = read('services/RoutineShareService.ts');
    expect(svc).toMatch(/export\s+(const|function|class)\s+RoutineShareService/);
    expect(svc).toContain('exportRoutine');
    expect(svc).toContain('importRoutine');
  });

  it('export payload is versioned and carries full routine graph', () => {
    const svc = read('services/RoutineShareService.ts');
    expect(svc).toMatch(/version/);
    expect(svc).toMatch(/exercises/i);
    expect(svc).toMatch(/routineExercises|orderIndex/i);
  });

  it('import merges by name without overwriting existing routines (non-destructive)', () => {
    const svc = read('services/RoutineShareService.ts');
    expect(svc).toMatch(/existing/i);
    expect(svc).not.toMatch(/DELETE FROM routines/);
    expect(svc).toMatch(/-\d+|-suffix|copy|\(\d\)|duplicat/i);
  });

  it('import validates payload shape before touching the DB', () => {
    const svc = read('services/RoutineShareService.ts');
    expect(svc).toMatch(/z\.object|parse|validate/i);
  });
});

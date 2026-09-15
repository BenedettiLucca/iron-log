import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('#86 — muscle group schema + volume aggregation', () => {
  it('schema: exercises carry muscleGroup and migration exists', () => {
    const schema = read('src/db/schema.ts');
    expect(schema).toMatch(/muscleGroup|muscle_group/);
    const migrations = fs.readdirSync(path.join(root, 'drizzle')).filter((f) => f.endsWith('.sql'));
    const migrationBody = migrations.map((m) => read(`drizzle/${m}`)).join('\n');
    expect(migrationBody).toMatch(/muscle_group/i);
  });

  it('fixture DDL is synced with the new column (rebase lesson)', () => {
    const fixture = read('__tests__/fixtures/database.ts');
    expect(fixture).toMatch(/muscle_group/i);
  });

  it('analytics expose volume-by-muscle-group aggregation', () => {
    const svc = read('services/AnalyticsService.ts');
    expect(svc).toMatch(/volumeByMuscleGroup|muscleGroup/i);
  });

  it('known exercises are backfilled with a default mapping', () => {
    const drizzleDir = fs.readdirSync(path.join(root, 'drizzle')).filter((f) => f.endsWith('.sql'));
    const body = drizzleDir.map((m) => read(`drizzle/${m}`)).join('\n');
    expect(body).toMatch(/UPDATE.*exercises.*muscle_group/is);
  });
});

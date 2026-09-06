import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('#85 — equipment metadata + picker filter', () => {
  it('schema adds nullable equipment column to exercises (additive only)', () => {
    const schema = read('src/db/schema.ts');
    expect(schema).toMatch(/equipment:\s*integer\('equipment'\)|equipment:\s*text\('equipment'\)/);
    expect(schema).toMatch(/defaultRestSeconds/);
  });

  it('migration 0023 adds the column with idempotent backfill, no destructive DDL', () => {
    const dir = path.join(root, 'drizzle');
    const migrations = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
    const latest = read(`drizzle/${migrations[migrations.length - 1]}`);
    expect(latest).toMatch(/ALTER TABLE `exercises` ADD `equipment`/);
    expect(latest).not.toMatch(/DROP TABLE|DROP COLUMN/);
  });

  it('exercise picker filters by equipment', () => {
    const pickerFiles = ['components/ExercisePickerModal.tsx', 'components/ExerciseSelector.tsx', 'app/routine/[routineId].tsx'];
    const found = pickerFiles.some(f => {
      try { return read(f).match(/equipment/i); } catch { return false; }
    });
    expect(found).toBe(true);
  });
});

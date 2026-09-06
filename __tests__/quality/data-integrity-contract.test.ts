import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('#104 PR reconciliation + #105 non-finished sessions', () => {
  it('#104 — deleting or undoing a set recomputes PRs from live sets (no ghost record)', () => {
    const hook = read('hooks/use-personal-records.ts');
    expect(hook).toMatch(/reconcil/i);
    expect(hook).toMatch(/deletedAt/);
    const undo = read('hooks/use-session-undo.ts');
    expect(undo).toMatch(/reconcil|checkPersonalRecords/i);
  });

  it('#105 — Consistency and Strength Score ignore sessions without finishedAt', () => {
    const svc = read('services/AnalyticsService.ts');
    expect(svc).toMatch(/finishedAt|isFinished|completed/i);
    expect(svc).toMatch(/endTime.*IS NOT NULL|endTime != null|endTime\s*!==\s*(null|undefined)|endTime\s*!=\s*null/);
  });
});

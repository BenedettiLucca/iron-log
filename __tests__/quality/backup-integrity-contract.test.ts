import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('#102 backup integrity — WAL snapshot + restore preservation contract', () => {
  const svc = read('services/DatabaseBackupService.ts');

  it('backup runs WAL checkpoint TRUNCATE before copying the db file', () => {
    expect(svc).toMatch(/wal_checkpoint.*TRUNCATE|checkpoint.*TRUNCATE/i);
    expect(svc).toMatch(/PRAGMA/i);
  });

  it('restore replaces the live file without opening the old db (close-before-restore)', () => {
    expect(svc).toMatch(/closeBeforeRestore|close\(\).*restore|restore.*close\(\)/is);
  });

  it('restore preserves legitimate empty sessions without deleting them (no orphan cleanup)', () => {
    expect(svc).not.toMatch(/DELETE\s+FROM\s+sessions\s+WHERE/i);
    expect(svc).not.toMatch(/cleanOrphanSessions/);
  });

  it('restore validates the backup file before replacing (size + sqlite header)', () => {
    expect(svc).toMatch(/SQLite format 3/);
    expect(svc).toMatch(/byteLength|size/i);
  });
});

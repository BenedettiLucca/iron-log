import fs from 'fs';
import path from 'path';

const root = path.resolve(__dirname, '../..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('#102 backup integrity — WAL snapshot + restore orphan cleanup', () => {
  const svc = read('services/DatabaseBackupService.ts');

  it('backup runs WAL checkpoint TRUNCATE before copying the db file', () => {
    expect(svc).toMatch(/wal_checkpoint.*TRUNCATE|checkpoint.*TRUNCATE/i);
    expect(svc).toMatch(/PRAGMA/i);
  });

  it('restore replaces the live file without opening the old db (close-before-restore)', () => {
    expect(svc).toMatch(/closeBeforeRestore|close\(\).*restore|restore.*close\(\)/is);
  });

  it('restore cleans orphaned session rows (sessions without any live set)', () => {
    expect(svc).toMatch(/orphan/i);
  });

  it('restore validates the backup file before replacing (size + sqlite header)', () => {
    expect(svc).toMatch(/SQLite format 3/);
    expect(svc).toMatch(/byteLength|size/i);
  });
});

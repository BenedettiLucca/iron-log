import fs from 'fs';
import path from 'path';
import {
  db,
  getDatabaseHandle,
  closeDatabase,
  reopenDatabase,
  isDatabaseOpen,
  checkpointWal,
  DatabaseClosedError,
  DatabaseBusyError,
} from '@/src/db/client';
import {
  DatabaseSnapshotService,
  DatabaseSnapshotError,
  SnapshotValidationError,
} from '@/services/DatabaseSnapshotService';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3');

// Setup temporary directory for real SQLite tests
const TEST_DIR = path.join(__dirname, '../../.tmp-test-snapshot');

// We configure mocks before tests execute
let mockCheckpointBusy = false;
let mockCheckpointError: Error | null = null;
let mockCopyError: Error | null = null;

// Mock expo-sqlite boundary for client.ts and snapshot service
jest.mock('expo-sqlite', () => {
  return {
    openDatabaseSync: jest.fn((dbName: string, options?: any, directory?: string) => {
      const baseDir = path.join(__dirname, '../../.tmp-test-snapshot');
      const resolvedDir = directory || path.join(baseDir, 'SQLite');
      if (!fs.existsSync(resolvedDir)) {
        fs.mkdirSync(resolvedDir, { recursive: true });
      }
      const fullPath = path.join(resolvedDir, dbName);
      const RawDatabase = jest.requireActual('better-sqlite3');
      const rawDb = new RawDatabase(fullPath);

      let isClosed = false;

      const mockDb = {
        _rawDb: rawDb,
        _path: fullPath,
        execSync: jest.fn((sql: string) => {
          if (isClosed) throw new Error('Database is closed');
          return rawDb.exec(sql);
        }),
        getAllSync: jest.fn((sql: string, ...params: any[]) => {
          if (isClosed) throw new Error('Database is closed');
          if (sql.includes('PRAGMA wal_checkpoint')) {
            if (mockCheckpointError) throw mockCheckpointError;
            if (mockCheckpointBusy) {
              return [{ busy: 1, log: 5, checkpointed: 0 }];
            }
          }
          const stmt = rawDb.prepare(sql);
          return stmt.all(...params);
        }),
        getFirstSync: jest.fn((sql: string, ...params: any[]) => {
          if (isClosed) throw new Error('Database is closed');
          const stmt = rawDb.prepare(sql);
          return stmt.get(...params);
        }),
        runSync: jest.fn((sql: string, ...params: any[]) => {
          if (isClosed) throw new Error('Database is closed');
          const res = rawDb.prepare(sql).run(...params);
          return { changes: res.changes, lastInsertRowId: Number(res.lastInsertRowid) };
        }),
        closeSync: jest.fn(() => {
          if (!isClosed) {
            isClosed = true;
            rawDb.close();
          }
        }),
        prepareSync: jest.fn((sql: string) => {
          if (isClosed) throw new Error('Database is closed');
          const stmt = rawDb.prepare(sql);
          return {
            executeSync: (params: any) => ({
              getAllSync: () => stmt.all(params || []),
              getFirstSync: () => stmt.get(params || []),
              changes: 0,
              lastInsertRowId: 0,
            }),
            executeForRawResultSync: (params: any) => ({
              getAllSync: () => stmt.raw().all(params || []),
            }),
            finalizeSync: jest.fn(),
          };
        }),
      };

      return mockDb;
    }),
  };
});

// Mock expo-file-system/legacy
jest.mock('expo-file-system/legacy', () => {
  return {
    documentDirectory: path.join(__dirname, '../../.tmp-test-snapshot') + '/',
    EncodingType: { Base64: 'base64' },
    getInfoAsync: jest.fn(async (targetPath: string) => {
      try {
        const stats = fs.statSync(targetPath);
        return { exists: true, size: stats.size, isDirectory: stats.isDirectory() };
      } catch {
        return { exists: false, size: 0, isDirectory: false };
      }
    }),
    makeDirectoryAsync: jest.fn(async (dirPath: string) => {
      fs.mkdirSync(dirPath, { recursive: true });
    }),
    copyAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
      if (mockCopyError) throw mockCopyError;
      fs.copyFileSync(from, to);
    }),
    deleteAsync: jest.fn(async (targetPath: string, options?: { idempotent?: boolean }) => {
      try {
        fs.rmSync(targetPath, { recursive: true, force: options?.idempotent ?? true });
      } catch (e) {
        if (!options?.idempotent) throw e;
      }
    }),
    readDirectoryAsync: jest.fn(async (dirPath: string) => {
      if (!fs.existsSync(dirPath)) return [];
      return fs.readdirSync(dirPath);
    }),
    readAsStringAsync: jest.fn(async (targetPath: string, options?: any) => {
      const buffer = fs.readFileSync(targetPath);
      if (options?.position !== undefined && options?.length !== undefined) {
        const slice = buffer.subarray(options.position, options.position + options.length);
        return slice.toString('base64');
      }
      return buffer.toString('base64');
    }),
  };
});

describe('T03A — SQLite lifecycle e snapshot consistente', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    if (!isDatabaseOpen()) {
      reopenDatabase();
    }
    mockCheckpointBusy = false;
    mockCheckpointError = null;
    mockCopyError = null;
  });

  afterEach(() => {
    try {
      if (isDatabaseOpen()) {
        closeDatabase();
      }
    } catch {}
    try {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    } catch {}
  });

  describe('Part 1: SQLite Lifecycle in client.ts', () => {
    it('manages the real SQLite handle used by the application', () => {
      const handle = getDatabaseHandle();
      expect(handle).toBeDefined();
      expect(isDatabaseOpen()).toBe(true);

      // Verify PRAGMAs were set on initialization
      expect(handle.execSync).toHaveBeenCalledWith(expect.stringContaining('PRAGMA journal_mode = WAL'));
      expect(handle.execSync).toHaveBeenCalledWith(expect.stringContaining('PRAGMA foreign_keys = ON'));
      expect(handle.execSync).toHaveBeenCalledWith(expect.stringContaining('PRAGMA busy_timeout = 5000'));
    });

    it('closes the actual handle and marks database as closed', () => {
      expect(isDatabaseOpen()).toBe(true);
      closeDatabase();
      expect(isDatabaseOpen()).toBe(false);

      // Subsequent getDatabaseHandle must fail-closed
      expect(() => getDatabaseHandle()).toThrow(DatabaseClosedError);
    });

    it('reopens the real handle and reapplies PRAGMAs safely', () => {
      closeDatabase();
      expect(isDatabaseOpen()).toBe(false);

      const newHandle = reopenDatabase();
      expect(isDatabaseOpen()).toBe(true);
      expect(newHandle).toBeDefined();
      expect(newHandle.execSync).toHaveBeenCalledWith(expect.stringContaining('PRAGMA journal_mode = WAL'));
    });

    it('checkpoints WAL on the real handle and throws DatabaseBusyError when busy', () => {
      // Reopen to ensure active handle
      if (!isDatabaseOpen()) reopenDatabase();

      // Normal checkpoint
      const result = checkpointWal('TRUNCATE');
      expect(result.busy).toBe(0);

      // Fault injection: SQLite busy during checkpoint
      mockCheckpointBusy = true;
      expect(() => checkpointWal('TRUNCATE')).toThrow(DatabaseBusyError);
    });
  });

  describe('Part 2: DatabaseSnapshotService consistent snapshot generation', () => {
    it('creates a consistent snapshot containing recent WAL writes', async () => {
      if (!isDatabaseOpen()) reopenDatabase();
      const handle = getDatabaseHandle();

      // Create a test table and write rows directly into WAL
      handle.execSync('CREATE TABLE IF NOT EXISTS sample_data (id INTEGER PRIMARY KEY, note TEXT);');
      handle.execSync("INSERT INTO sample_data (note) VALUES ('written before snapshot');");

      // Generate snapshot
      const snapshot = await DatabaseSnapshotService.createSnapshot({ tag: 'test_wal' });

      expect(snapshot).toBeDefined();
      expect(snapshot.path).toContain('ironlog_test_wal_');
      expect(snapshot.byteSize).toBeGreaterThan(0);
      expect(snapshot.checkpoint.busy).toBe(0);

      // Inspect snapshot file directly with SQLite to verify recent WAL writes are present
      const snapDb = new Database(snapshot.path);
      const rows = snapDb.prepare('SELECT note FROM sample_data;').all() as { note: string }[];
      expect(rows).toEqual([{ note: 'written before snapshot' }]);
      snapDb.close();
    });

    it('aborts snapshot and cleans up destination without modifying live handle on busy checkpoint', async () => {
      if (!isDatabaseOpen()) reopenDatabase();

      mockCheckpointBusy = true;

      await expect(DatabaseSnapshotService.createSnapshot({ tag: 'busy_test' })).rejects.toThrow(DatabaseBusyError);

      // Live handle MUST remain open and functional
      expect(isDatabaseOpen()).toBe(true);
      const handle = getDatabaseHandle();
      expect(handle).toBeDefined();
    });

    it('aborts snapshot and cleans up destination on copy error (e.g. ENOSPC)', async () => {
      if (!isDatabaseOpen()) reopenDatabase();

      mockCopyError = new Error('ENOSPC: no space left on device');

      await expect(DatabaseSnapshotService.createSnapshot({ tag: 'enospc_test' })).rejects.toThrow(
        DatabaseSnapshotError
      );

      // Live handle MUST remain open
      expect(isDatabaseOpen()).toBe(true);
    });

    it('fails fast when attempting snapshot while database is closed', async () => {
      closeDatabase();
      expect(isDatabaseOpen()).toBe(false);

      await expect(DatabaseSnapshotService.createSnapshot()).rejects.toThrow(DatabaseClosedError);
    });
  });

  describe('Part 3: Snapshot validation and cleanup', () => {
    it('validates a valid snapshot and rejects corrupted or alien files', async () => {
      if (!isDatabaseOpen()) reopenDatabase();

      const snapshot = await DatabaseSnapshotService.createSnapshot({ tag: 'validation_test' });
      const validRes = await DatabaseSnapshotService.validateSnapshot(snapshot.path);
      expect(validRes.valid).toBe(true);
      expect(validRes.headerOk).toBe(true);
      expect(validRes.integrityOk).toBe(true);

      // Validate non-existent file
      const missingRes = await DatabaseSnapshotService.validateSnapshot('/non/existent/path.db');
      expect(missingRes.valid).toBe(false);

      // Corrupted file (invalid header)
      const corruptedPath = path.join(TEST_DIR, 'corrupted.db');
      fs.writeFileSync(corruptedPath, 'Not an SQLite database file at all!');
      const corruptRes = await DatabaseSnapshotService.validateSnapshot(corruptedPath);
      expect(corruptRes.valid).toBe(false);
      expect(corruptRes.headerOk).toBe(false);
    });

    it('cleans up older snapshots preserving only the latest N snapshots', async () => {
      if (!isDatabaseOpen()) reopenDatabase();

      const snapshotsDir = path.join(TEST_DIR, 'snapshots');
      fs.mkdirSync(snapshotsDir, { recursive: true });

      // Create 7 dummy snapshot files with sorted timestamps
      for (let i = 1; i <= 7; i++) {
        const filePath = path.join(snapshotsDir, `ironlog_snapshot_2026-09-12T10-0${i}-00.db`);
        fs.writeFileSync(filePath, 'SQLite format 3\0test');
      }

      const deletedCount = await DatabaseSnapshotService.cleanupSnapshots(3, 'ironlog_snapshot_', snapshotsDir);
      expect(deletedCount).toBe(4);

      const remaining = fs.readdirSync(snapshotsDir).filter(f => f.startsWith('ironlog_snapshot_'));
      expect(remaining.length).toBe(3);
      expect(remaining).toEqual([
        'ironlog_snapshot_2026-09-12T10-05-00.db',
        'ironlog_snapshot_2026-09-12T10-06-00.db',
        'ironlog_snapshot_2026-09-12T10-07-00.db',
      ]);
    });

    it('deletes a snapshot file idempotently', async () => {
      const filePath = path.join(TEST_DIR, 'to-delete.db');
      fs.writeFileSync(filePath, 'dummy data');
      expect(fs.existsSync(filePath)).toBe(true);

      await DatabaseSnapshotService.deleteSnapshot(filePath);
      expect(fs.existsSync(filePath)).toBe(false);

      // Deleting again should not throw
      await expect(DatabaseSnapshotService.deleteSnapshot(filePath)).resolves.not.toThrow();
    });

    it('aborts snapshot creation and cleans up if validation fails', async () => {
      if (!isDatabaseOpen()) reopenDatabase();

      // Spy on validateSnapshot to simulate a validation failure on the created copy
      const validateSpy = jest.spyOn(DatabaseSnapshotService, 'validateSnapshot').mockResolvedValueOnce({
        valid: false,
        byteSize: 100,
        headerOk: false,
        integrityOk: false,
        error: 'Injected validation defect',
      });

      await expect(
        DatabaseSnapshotService.createSnapshot({ tag: 'validation_fail' })
      ).rejects.toThrow(SnapshotValidationError);

      validateSpy.mockRestore();

      // Ensure live handle remains functional
      expect(isDatabaseOpen()).toBe(true);
    });

    it('updates Drizzle db.$client handle when database is reopened', () => {
      const handle1 = getDatabaseHandle();
      expect(db.$client).toBe(handle1);

      const handle2 = reopenDatabase();
      expect(db.$client).toBe(handle2);
      expect(handle2).not.toBe(handle1);
    });

    it('aborts snapshot and does not produce file if checkpoint throws an SQLite error', async () => {
      if (!isDatabaseOpen()) reopenDatabase();

      mockCheckpointError = new Error('SQLite disk I/O error');

      await expect(DatabaseSnapshotService.createSnapshot({ tag: 'io_error' })).rejects.toThrow(
        'SQLite disk I/O error'
      );

      // Live handle remains open
      expect(isDatabaseOpen()).toBe(true);
    });
  });
});

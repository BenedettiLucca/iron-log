import fs from 'fs';
import path from 'path';
import {
  db,
  getDatabaseHandle,
  closeDatabase,
  reopenDatabase,
  isDatabaseOpen,
  DatabaseBusyError,
} from '@/src/db/client';
import { DatabaseBackupService } from '@/services/DatabaseBackupService';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Database = require('better-sqlite3');

const TEST_DIR = path.join(__dirname, '../../.tmp-test-backup-matrix');

// Fault injection flags
let mockCheckpointBusy = false;
let mockCheckpointError: Error | null = null;
let mockCopyError: Error | null = null;
let mockSnapshotCopyError: Error | null = null;
let mockMoveError: Error | null = null;
let mockCandidateIntegrityFailure = false;
let mockPostRestoreIntegrityFailure = false;
let mockUploadFailure = false;
let mockPickedUri: string | null = null;

// Mock expo-sqlite boundary for client.ts, snapshot service, and backup service
jest.mock('expo-sqlite', () => {
  return {
    openDatabaseSync: jest.fn((dbName: string, options?: any, directory?: string) => {
      const baseDir = path.join(__dirname, '../../.tmp-test-backup-matrix');
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
          if (sql.includes('PRAGMA integrity_check')) {
            if (mockCandidateIntegrityFailure && (fullPath.includes('staging') || fullPath.includes('candidate'))) {
              return [{ integrity_check: '*** in database main *** Page 1 is corrupt' }];
            }
            if (mockPostRestoreIntegrityFailure && !fullPath.includes('staging') && !fullPath.includes('snapshots') && !fullPath.includes('candidate')) {
              return [{ integrity_check: '*** in database main *** Page 3 is corrupt' }];
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
            try {
              rawDb.close();
            } catch {}
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
  const rootDir = path.join(__dirname, '../../.tmp-test-backup-matrix');
  return {
    documentDirectory: rootDir + '/',
    cacheDirectory: path.join(rootDir, 'cache') + '/',
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
      if (mockSnapshotCopyError && to.includes('snapshots')) throw mockSnapshotCopyError;
      if (mockCopyError && (to.includes('staging') || !to.includes('snapshots'))) throw mockCopyError;
      const targetDir = path.dirname(to);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.copyFileSync(from, to);
    }),
    moveAsync: jest.fn(async ({ from, to }: { from: string; to: string }) => {
      if (mockMoveError) throw mockMoveError;
      const targetDir = path.dirname(to);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      fs.renameSync(from, to);
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
    uploadAsync: jest.fn(async (url: string, fileUri: string) => {
      if (mockUploadFailure) {
        return { status: 500, body: 'Server Error' };
      }
      return {
        status: 200,
        body: JSON.stringify({ id: 'mock-drive-file-id-123' }),
      };
    }),
  };
});

// Mock expo-sharing
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => {}),
}));

// Mock expo-document-picker
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => {
    if (!mockPickedUri) {
      return { canceled: true, assets: null };
    }
    return {
      canceled: false,
      assets: [{ uri: mockPickedUri, name: 'backup.db', size: 1024 }],
    };
  }),
}));

function setupTestDatabaseSchema(handle: ReturnType<typeof getDatabaseHandle>): void {
  handle.execSync(`
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'strength',
      muscle_group TEXT,
      equipment TEXT,
      default_rest_seconds INTEGER DEFAULT 90
    );
    CREATE TABLE IF NOT EXISTS routines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      folder TEXT DEFAULT 'Geral',
      is_template INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS routine_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_id INTEGER,
      exercise_id INTEGER,
      order_index INTEGER,
      target TEXT,
      notes TEXT,
      rest_seconds INTEGER
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      routine_id INTEGER,
      routine_name TEXT,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      body_weight REAL,
      s_rpe INTEGER,
      notes TEXT,
      duration_minutes INTEGER,
      deleted_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      set_order INTEGER NOT NULL,
      reps INTEGER,
      weight REAL,
      rpe REAL,
      completed INTEGER NOT NULL DEFAULT 1,
      deleted_at INTEGER
    );
  `);
}

function createCandidateFile(
  filePath: string,
  populateFn?: (rawDb: any) => void
): string {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const RawDatabase = jest.requireActual('better-sqlite3');
  const db = new RawDatabase(filePath);
  db.exec(`
    CREATE TABLE exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL);
    CREATE TABLE routines (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE);
    CREATE TABLE routine_exercises (id INTEGER PRIMARY KEY AUTOINCREMENT, routine_id INTEGER, exercise_id INTEGER);
    CREATE TABLE sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, routine_id INTEGER, routine_name TEXT, start_time INTEGER NOT NULL, end_time INTEGER, body_weight REAL, s_rpe INTEGER, notes TEXT, duration_minutes INTEGER, deleted_at INTEGER);
    CREATE TABLE sets (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL, exercise_id INTEGER NOT NULL, set_order INTEGER NOT NULL, reps INTEGER, weight REAL, rpe REAL, completed INTEGER NOT NULL DEFAULT 1, deleted_at INTEGER);
  `);
  if (populateFn) {
    populateFn(db);
  }
  db.close();
  return filePath;
}

describe('T03B — Backup / Export / Restore Failure Matrix & Preservation', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
    const sqliteDir = path.join(TEST_DIR, 'SQLite');
    if (!fs.existsSync(sqliteDir)) {
      fs.mkdirSync(sqliteDir, { recursive: true });
    }

    mockCheckpointBusy = false;
    mockCheckpointError = null;
    mockCopyError = null;
    mockSnapshotCopyError = null;
    mockMoveError = null;
    mockCandidateIntegrityFailure = false;
    mockPostRestoreIntegrityFailure = false;
    mockUploadFailure = false;
    mockPickedUri = null;

    if (!isDatabaseOpen()) {
      reopenDatabase();
    }
    setupTestDatabaseSchema(getDatabaseHandle());

    // Mock global fetch for Google Drive PATCH
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as any);
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
    jest.clearAllMocks();
  });

  describe('Part 1: Consistent WAL Snapshot across all three backup paths', () => {
    it('exportDb flushes uncheckpointed WAL writes and passes consistent backup to Sharing.shareAsync', async () => {
      const handle = getDatabaseHandle();
      handle.execSync("INSERT INTO exercises (name) VALUES ('Supino Reto');");
      handle.execSync("INSERT INTO sessions (start_time, routine_name) VALUES (1700000000, 'Treino Peito');");
      handle.execSync("INSERT INTO sets (session_id, exercise_id, set_order, reps, weight) VALUES (1, 1, 1, 10, 80.0);");

      await DatabaseBackupService.exportDb();

      expect(Sharing.shareAsync).toHaveBeenCalledTimes(1);
      const sharedPath = (Sharing.shareAsync as jest.Mock).mock.calls[0][0];
      expect(sharedPath).toContain('ironlog_backup_');

      // Verify the exported file contains recent uncheckpointed writes
      const snapDb = new Database(sharedPath);
      const sets = snapDb.prepare('SELECT reps, weight FROM sets;').all();
      expect(sets).toEqual([{ reps: 10, weight: 80.0 }]);
      snapDb.close();
    });

    it('uploadToDrive creates a consistent snapshot containing WAL writes, uploads it, and cleans up snapshot', async () => {
      const handle = getDatabaseHandle();
      handle.execSync("INSERT INTO exercises (name) VALUES ('Agachamento');");
      handle.execSync("INSERT INTO sessions (start_time, routine_name) VALUES (1700000001, 'Treino Pernas');");
      handle.execSync("INSERT INTO sets (session_id, exercise_id, set_order, reps, weight) VALUES (1, 1, 1, 5, 120.0);");

      const result = await DatabaseBackupService.uploadToDrive('mock-token-abc');

      expect(result).toEqual({ id: 'mock-drive-file-id-123' });
      expect(FileSystem.uploadAsync).toHaveBeenCalledTimes(1);
      const uploadedFile = (FileSystem.uploadAsync as jest.Mock).mock.calls[0][1];
      expect(uploadedFile).toContain('ironlog_drive_');

      // Snapshot must be deleted after upload completes
      expect(fs.existsSync(uploadedFile)).toBe(false);
    });

    it('importDb creates pre-import snapshot containing WAL writes before modifying live database', async () => {
      const handle = getDatabaseHandle();
      handle.execSync("INSERT INTO exercises (name) VALUES ('Levantamento Terra');");
      handle.execSync("INSERT INTO sessions (start_time) VALUES (1700000002);");

      const candidatePath = path.join(TEST_DIR, 'valid_candidate.db');
      createCandidateFile(candidatePath, (rawDb) => {
        rawDb.exec("INSERT INTO exercises (name) VALUES ('Remada Curvada');");
      });

      const success = await DatabaseBackupService.importDb(candidatePath);
      expect(success).toBe(true);

      // Verify pre_import snapshot was created in snapshots directory
      const snapshotsDir = path.join(TEST_DIR, 'SQLite/snapshots');
      expect(fs.existsSync(snapshotsDir)).toBe(true);
      const snapshots = fs.readdirSync(snapshotsDir).filter(f => f.startsWith('ironlog_pre_import_'));
      expect(snapshots.length).toBeGreaterThanOrEqual(1);

      // Check that the pre_import snapshot contains the pre-import live data
      const preSnapDb = new Database(path.join(snapshotsDir, snapshots[0]));
      const preExercises = preSnapDb.prepare('SELECT name FROM exercises;').all();
      expect(preExercises).toEqual([{ name: 'Levantamento Terra' }]);
      preSnapDb.close();
    });

    it('exportDb aborts with DatabaseBusyError without false success or sharing when checkpoint is busy', async () => {
      mockCheckpointBusy = true;

      await expect(DatabaseBackupService.exportDb()).rejects.toThrow(DatabaseBusyError);
      expect(Sharing.shareAsync).not.toHaveBeenCalled();
      expect(isDatabaseOpen()).toBe(true);
    });

    it('uploadToDrive aborts with DatabaseBusyError without false success when checkpoint is busy', async () => {
      mockCheckpointBusy = true;

      await expect(DatabaseBackupService.uploadToDrive('token-xyz')).rejects.toThrow(DatabaseBusyError);
      expect(FileSystem.uploadAsync).not.toHaveBeenCalled();
      expect(isDatabaseOpen()).toBe(true);
    });

    it('importDb aborts without modifying live DB when pre-import snapshot encounters busy checkpoint', async () => {
      const handle = getDatabaseHandle();
      handle.execSync("INSERT INTO exercises (name) VALUES ('Original Live Data');");

      mockCheckpointBusy = true;

      const candidatePath = path.join(TEST_DIR, 'candidate_busy.db');
      createCandidateFile(candidatePath);

      await expect(DatabaseBackupService.importDb(candidatePath)).rejects.toThrow(DatabaseBusyError);

      // Live database must be open and original data intact
      expect(isDatabaseOpen()).toBe(true);
      const rows = getDatabaseHandle().getAllSync<{ name: string }>('SELECT name FROM exercises;');
      expect(rows).toEqual([{ name: 'Original Live Data' }]);
    });
  });

  describe('Part 2: Candidate Backup Deep Validation (Pre-replacement fail-closed)', () => {
    it('rejects candidate file that does not exist or is 0 bytes, leaving live DB untouched', async () => {
      const emptyFile = path.join(TEST_DIR, 'empty_candidate.db');
      fs.writeFileSync(emptyFile, '');

      await expect(DatabaseBackupService.importDb(emptyFile)).rejects.toThrow('services.invalidBackup');

      expect(isDatabaseOpen()).toBe(true);
    });

    it('rejects non-SQLite file (invalid header) with services.invalidBackupFormat, leaving live DB untouched', async () => {
      const invalidHeaderFile = path.join(TEST_DIR, 'invalid_header.db');
      fs.writeFileSync(invalidHeaderFile, 'NOT AN SQLITE DATABASE AT ALL 123456');

      await expect(DatabaseBackupService.importDb(invalidHeaderFile)).rejects.toThrow(
        'services.invalidBackupFormat'
      );

      expect(isDatabaseOpen()).toBe(true);
    });

    it('rejects alien SQLite schema missing required tables, leaving live DB untouched', async () => {
      const alienPath = path.join(TEST_DIR, 'alien_schema.db');
      const alienDb = new Database(alienPath);
      alienDb.exec('CREATE TABLE unrelated_foreign_data (id INT, title TEXT);');
      alienDb.close();

      await expect(DatabaseBackupService.importDb(alienPath)).rejects.toThrow('services.invalidBackup');

      expect(isDatabaseOpen()).toBe(true);
    });

    it('rejects candidate file with corrupted SQLite pages (failing integrity_check), leaving live DB untouched', async () => {
      const candidatePath = path.join(TEST_DIR, 'corrupted_candidate.db');
      createCandidateFile(candidatePath);

      mockCandidateIntegrityFailure = true;

      await expect(DatabaseBackupService.importDb(candidatePath)).rejects.toThrow('services.invalidBackup');

      expect(isDatabaseOpen()).toBe(true);
    });

    it('rejects candidate when staging copy fails (e.g. ENOSPC), leaving live DB untouched', async () => {
      const candidatePath = path.join(TEST_DIR, 'candidate_enospc.db');
      createCandidateFile(candidatePath);

      mockCopyError = new Error('ENOSPC: no space left on device');

      await expect(DatabaseBackupService.importDb(candidatePath)).rejects.toThrow('services.invalidBackup');

      expect(isDatabaseOpen()).toBe(true);
    });

    it('aborts import when pre-import snapshot copy fails (e.g. ENOSPC), leaving live DB untouched', async () => {
      const candidatePath = path.join(TEST_DIR, 'candidate_snapshot_enospc.db');
      createCandidateFile(candidatePath);

      mockSnapshotCopyError = new Error('ENOSPC: disk full during snapshot');

      await expect(DatabaseBackupService.importDb(candidatePath)).rejects.toThrow();

      expect(isDatabaseOpen()).toBe(true);
    });
  });

  describe('Part 3: Replacement Boundary Fault Injection & Rollback Matrix', () => {
    it('restores original database and reopens handle when live DB move fails during replacement', async () => {
      const handle = getDatabaseHandle();
      handle.execSync("INSERT INTO exercises (name) VALUES ('Live Original Exercise');");

      const candidatePath = path.join(TEST_DIR, 'candidate_move_fail.db');
      createCandidateFile(candidatePath, (rawDb) => {
        rawDb.exec("INSERT INTO exercises (name) VALUES ('Candidate Exercise');");
      });

      // Inject move failure on the first move call (moving DB_PATH to prevDbPath)
      mockMoveError = new Error('EACCES: permission denied during rename');

      await expect(DatabaseBackupService.importDb(candidatePath)).rejects.toThrow('services.invalidBackup');

      // Database handle must be open and original data restored
      expect(isDatabaseOpen()).toBe(true);
      const rows = getDatabaseHandle().getAllSync<{ name: string }>('SELECT name FROM exercises;');
      expect(rows).toEqual([{ name: 'Live Original Exercise' }]);
    });

    it('restores original database from pre-import snapshot when post-restore integrity check fails', async () => {
      const handle = getDatabaseHandle();
      handle.execSync("INSERT INTO exercises (name) VALUES ('Safe Original Data');");

      const candidatePath = path.join(TEST_DIR, 'candidate_post_corrupt.db');
      createCandidateFile(candidatePath, (rawDb) => {
        rawDb.exec("INSERT INTO exercises (name) VALUES ('Bad Candidate');");
      });

      // Simulate integrity failure occurring on the restored live database
      mockPostRestoreIntegrityFailure = true;

      await expect(DatabaseBackupService.importDb(candidatePath)).rejects.toThrow('services.invalidBackup');

      // Live database must be reopened and restored from pre-import snapshot
      expect(isDatabaseOpen()).toBe(true);
      const rows = getDatabaseHandle().getAllSync<{ name: string }>('SELECT name FROM exercises;');
      expect(rows).toEqual([{ name: 'Safe Original Data' }]);
    });
  });

  describe('Part 4: Legitimate Empty Session Preservation (Contract C1)', () => {
    it('preserves legitimate empty sessions (sessions with 0 sets) upon restore without orphan deletion', async () => {
      const candidatePath = path.join(TEST_DIR, 'candidate_empty_sessions.db');
      createCandidateFile(candidatePath, (rawDb) => {
        rawDb.exec(`
          INSERT INTO exercises (id, name) VALUES (1, 'Barra Fixa');
          INSERT INTO sessions (id, routine_name, start_time, end_time, notes)
          VALUES (1, 'Treino Costas', 1700001000, 1700004600, 'Treino completo com séries');
          INSERT INTO sets (id, session_id, exercise_id, set_order, reps, weight)
          VALUES (1, 1, 1, 1, 8, 0.0);

          -- Legitimate empty session (started workout with no logged sets)
          INSERT INTO sessions (id, routine_name, start_time, end_time, notes)
          VALUES (2, 'Treino Rápido Vazio', 1700005000, NULL, 'Sessão iniciada sem séries registradas');
        `);
      });

      const success = await DatabaseBackupService.importDb(candidatePath);
      expect(success).toBe(true);

      expect(isDatabaseOpen()).toBe(true);
      const restoredHandle = getDatabaseHandle();

      const allSessions = restoredHandle.getAllSync<{ id: number; routine_name: string; start_time: number }>(
        'SELECT id, routine_name, start_time FROM sessions ORDER BY id ASC;'
      );

      // Both sessions must exist — empty session #2 was NOT wiped out by orphan cleanup!
      expect(allSessions).toHaveLength(2);
      expect(allSessions).toEqual([
        { id: 1, routine_name: 'Treino Costas', start_time: 1700001000 },
        { id: 2, routine_name: 'Treino Rápido Vazio', start_time: 1700005000 },
      ]);
    });
  });

  describe('Part 5: Functional Client Lifecycle after Restore and Rollback', () => {
    it('leaves functional client after restore, allowing Drizzle queries and inserts', async () => {
      const candidatePath = path.join(TEST_DIR, 'candidate_lifecycle.db');
      createCandidateFile(candidatePath, (rawDb) => {
        rawDb.exec("INSERT INTO exercises (name) VALUES ('Desenvolvimento Ombros');");
      });

      const success = await DatabaseBackupService.importDb(candidatePath);
      expect(success).toBe(true);
      expect(isDatabaseOpen()).toBe(true);

      // Verify db.$client points to active handle and can perform writes
      const currentHandle = getDatabaseHandle();
      expect(db.$client).toBe(currentHandle);

      currentHandle.execSync("INSERT INTO exercises (name) VALUES ('Elevação Lateral');");
      const exercises = currentHandle.getAllSync<{ name: string }>('SELECT name FROM exercises ORDER BY id ASC;');
      expect(exercises).toEqual([
        { name: 'Desenvolvimento Ombros' },
        { name: 'Elevação Lateral' },
      ]);
    });

    it('leaves functional client after rollback, allowing subsequent read and write operations', async () => {
      const handle = getDatabaseHandle();
      handle.execSync("INSERT INTO exercises (name) VALUES ('Initial Exercise');");

      // Corrupt candidate to force rollback
      const candidatePath = path.join(TEST_DIR, 'candidate_corrupt_rollback.db');
      fs.writeFileSync(candidatePath, 'not a valid db file');

      await expect(DatabaseBackupService.importDb(candidatePath)).rejects.toThrow();

      // Ensure client is open and functional
      expect(isDatabaseOpen()).toBe(true);
      const restoredHandle = getDatabaseHandle();
      expect(db.$client).toBe(restoredHandle);

      // Reads work
      const initial = restoredHandle.getAllSync<{ name: string }>('SELECT name FROM exercises;');
      expect(initial).toEqual([{ name: 'Initial Exercise' }]);

      // Writes work
      restoredHandle.execSync("INSERT INTO exercises (name) VALUES ('Post-Rollback Exercise');");
      const after = restoredHandle.getAllSync<{ name: string }>('SELECT name FROM exercises;');
      expect(after).toEqual([
        { name: 'Initial Exercise' },
        { name: 'Post-Rollback Exercise' },
      ]);
    });

    it('handles document picker cancellation cleanly returning false', async () => {
      mockPickedUri = null; // simulate cancellation
      const success = await DatabaseBackupService.importDb();
      expect(success).toBe(false);
      expect(isDatabaseOpen()).toBe(true);
    });
  });
});

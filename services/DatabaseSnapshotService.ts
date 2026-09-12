import * as FileSystem from 'expo-file-system/legacy';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { logger } from '@/services/logger';
import {
  checkpointWal,
  isDatabaseOpen,
  DatabaseClosedError,
  DatabaseBusyError,
  DB_NAME,
  type CheckpointResult,
} from '@/src/db/client';

export const DB_DIR = `${FileSystem.documentDirectory ?? ''}SQLite/`;
export const DB_PATH = `${DB_DIR}${DB_NAME}`;
export const SNAPSHOTS_DIR = `${FileSystem.documentDirectory ?? ''}SQLite/snapshots/`;
export const DEFAULT_MAX_SNAPSHOTS = 5;

export class DatabaseSnapshotError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DatabaseSnapshotError';
  }
}

export class SnapshotValidationError extends DatabaseSnapshotError {
  readonly details?: SnapshotValidationResult;
  constructor(message: string, details?: SnapshotValidationResult) {
    super(message);
    this.name = 'SnapshotValidationError';
    this.details = details;
  }
}

export interface SnapshotOptions {
  /** Optional custom destination file path. If omitted, generates a timestamped file in SNAPSHOTS_DIR. */
  destinationPath?: string;
  /** Tag or category name included in the generated filename (e.g. 'pre_import', 'backup', 'drive'). Default: 'snapshot'. */
  tag?: string;
  /** Whether to validate the snapshot (size, header, integrity check) upon creation. Default: true. */
  validate?: boolean;
}

export interface SnapshotResult {
  path: string;
  byteSize: number;
  createdAt: Date;
  checkpoint: CheckpointResult;
}

export interface SnapshotValidationResult {
  valid: boolean;
  byteSize: number;
  headerOk: boolean;
  integrityOk: boolean;
  error?: string;
}

function decodeBase64(base64: string): string {
  if (typeof atob === 'function') {
    return atob(base64);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(base64, 'base64').toString('binary');
  }
  return '';
}

function openDatabaseAtPath(filePath: string): SQLiteDatabase {
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash !== -1) {
    const dir = filePath.substring(0, lastSlash);
    const fileName = filePath.substring(lastSlash + 1);
    return openDatabaseSync(fileName, undefined, dir);
  }
  return openDatabaseSync(filePath);
}

export const DatabaseSnapshotService = {
  /**
   * Creates a consistent, standalone SQLite snapshot of the current database.
   * Flushes WAL pages into the database file via checkpointWal('TRUNCATE').
   * If checkpoint indicates busy or fails, the operation aborts without creating or returning a stale snapshot.
   * The live database handle remains open and uncorrupted.
   */
  async createSnapshot(options?: SnapshotOptions): Promise<SnapshotResult> {
    if (!isDatabaseOpen()) {
      throw new DatabaseClosedError('Cannot create snapshot: database handle is closed');
    }

    // 1. Checkpoint WAL on the active handle to ensure all uncommitted/WAL pages are in DB_PATH
    const checkpoint = checkpointWal('TRUNCATE');

    // 2. Prepare destination path and directory
    const tag = options?.tag ?? 'snapshot';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const destinationPath = options?.destinationPath ?? `${SNAPSHOTS_DIR}ironlog_${tag}_${timestamp}.db`;

    const lastSlash = destinationPath.lastIndexOf('/');
    const destinationDir = lastSlash !== -1 ? destinationPath.substring(0, lastSlash) : SNAPSHOTS_DIR;

    try {
      const dirInfo = await FileSystem.getInfoAsync(destinationDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(destinationDir, { intermediates: true });
      }

      // Check source file exists
      const sourceInfo = await FileSystem.getInfoAsync(DB_PATH);
      if (!sourceInfo.exists) {
        throw new DatabaseSnapshotError(`Source database file not found at ${DB_PATH}`);
      }

      // 3. Copy consistent DB to destination
      await FileSystem.copyAsync({
        from: DB_PATH,
        to: destinationPath,
      });

      // 4. Validate created snapshot if requested
      if (options?.validate !== false) {
        const validation = await this.validateSnapshot(destinationPath);
        if (!validation.valid) {
          await this.deleteSnapshot(destinationPath);
          throw new SnapshotValidationError(
            `Snapshot validation failed: ${validation.error ?? 'unknown error'}`,
            validation
          );
        }
      }

      const destInfo = await FileSystem.getInfoAsync(destinationPath);
      const byteSize = destInfo.exists && destInfo.size !== undefined ? destInfo.size : 0;

      return {
        path: destinationPath,
        byteSize,
        createdAt: new Date(),
        checkpoint,
      };
    } catch (error) {
      // Clean up any partially copied destination file on failure
      await this.deleteSnapshot(destinationPath);

      if (error instanceof DatabaseSnapshotError || error instanceof DatabaseBusyError || error instanceof DatabaseClosedError) {
        throw error;
      }
      logger.error('[DatabaseSnapshotService] Snapshot creation failed:', error);
      throw new DatabaseSnapshotError(
        `Failed to create database snapshot: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  },

  /**
   * Validates a snapshot file:
   * - Verifies file exists and size > 0
   * - Verifies first 16 bytes contain SQLite 3 magic header ("SQLite format 3\0")
   * - Verifies PRAGMA integrity_check returns "ok"
   */
  async validateSnapshot(filePath: string): Promise<SnapshotValidationResult> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (!fileInfo.exists || (fileInfo.size !== undefined && fileInfo.size === 0)) {
        return {
          valid: false,
          byteSize: 0,
          headerOk: false,
          integrityOk: false,
          error: 'Snapshot file does not exist or is empty',
        };
      }

      const byteSize = fileInfo.size ?? 0;

      // Header check: first 16 bytes
      let headerOk = false;
      try {
        const headerBase64 = await FileSystem.readAsStringAsync(filePath, {
          encoding: FileSystem.EncodingType.Base64,
          position: 0,
          length: 16,
        });
        const header = decodeBase64(headerBase64);
        headerOk = header.startsWith('SQLite format 3');
      } catch (e) {
        logger.warn('[DatabaseSnapshotService] Header check failed or unsupported:', e);
      }

      if (!headerOk) {
        return {
          valid: false,
          byteSize,
          headerOk: false,
          integrityOk: false,
          error: 'File does not have a valid SQLite 3 header',
        };
      }

      // SQLite integrity check
      let integrityOk = false;
      let integrityError: string | undefined;
      try {
        const testDb = openDatabaseAtPath(filePath);
        try {
          const rows = testDb.getAllSync<Record<string, unknown>>('PRAGMA integrity_check;');
          const status = rows.length > 0 ? Object.values(rows[0])[0] : null;
          if (status === 'ok') {
            integrityOk = true;
          } else {
            integrityError = `PRAGMA integrity_check returned: ${status}`;
          }
        } finally {
          testDb.closeSync();
        }
      } catch (e: any) {
        integrityError = `Integrity check failed: ${e?.message ?? String(e)}`;
      }

      if (!integrityOk) {
        return {
          valid: false,
          byteSize,
          headerOk: true,
          integrityOk: false,
          error: integrityError,
        };
      }

      return {
        valid: true,
        byteSize,
        headerOk: true,
        integrityOk: true,
      };
    } catch (e: any) {
      return {
        valid: false,
        byteSize: 0,
        headerOk: false,
        integrityOk: false,
        error: e?.message ?? String(e),
      };
    }
  },

  /**
   * Cleans up old snapshots in SNAPSHOTS_DIR (or specified directory), keeping only the latest maxKeep files.
   * Returns the count of deleted snapshot files.
   */
  async cleanupSnapshots(
    maxKeep = DEFAULT_MAX_SNAPSHOTS,
    prefix = 'ironlog_',
    directory = SNAPSHOTS_DIR
  ): Promise<number> {
    try {
      const dirInfo = await FileSystem.getInfoAsync(directory);
      if (!dirInfo.exists) return 0;

      const files = await FileSystem.readDirectoryAsync(directory);
      const snapshotFiles = files
        .filter(f => f.startsWith(prefix) && f.endsWith('.db'))
        .sort();

      const normalizedDir = directory.endsWith('/') ? directory : `${directory}/`;
      let deletedCount = 0;
      while (snapshotFiles.length > maxKeep) {
        const oldest = snapshotFiles.shift();
        if (oldest) {
          await FileSystem.deleteAsync(`${normalizedDir}${oldest}`, { idempotent: true });
          deletedCount++;
        }
      }

      return deletedCount;
    } catch (e) {
      logger.warn('[DatabaseSnapshotService] Error during snapshot cleanup:', e);
      return 0;
    }
  },

  /**
   * Safely deletes a snapshot file idempotently.
   */
  async deleteSnapshot(filePath: string): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(filePath);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(filePath, { idempotent: true });
      }
    } catch (e) {
      logger.warn(`[DatabaseSnapshotService] Failed to delete snapshot ${filePath}:`, e);
    }
  },
};

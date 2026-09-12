import { logger } from '@/services/logger';
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import * as schema from './schema';

export const DB_NAME = 'ironlog.db';

export class DatabaseClosedError extends Error {
  constructor(message = 'Database handle is closed') {
    super(message);
    this.name = 'DatabaseClosedError';
  }
}

export class DatabaseBusyError extends Error {
  readonly busyCode: number;
  constructor(message = 'Database is busy during operation', busyCode = 1) {
    super(message);
    this.name = 'DatabaseBusyError';
    this.busyCode = busyCode;
  }
}

export interface CheckpointResult {
  busy: number;
  log: number;
  checkpointed: number;
}

export type CheckpointMode = 'PASSIVE' | 'FULL' | 'RESTART' | 'TRUNCATE';

function configurePragmas(targetDb: SQLiteDatabase): void {
  try {
    targetDb.execSync('PRAGMA journal_mode = WAL;');
    targetDb.execSync('PRAGMA foreign_keys = ON;');
    targetDb.execSync('PRAGMA busy_timeout = 5000;');
  } catch (e) {
    logger.error('Failed to set PRAGMA', e);
  }
}

function openInitialDatabase(): SQLiteDatabase {
  const sqliteDb = openDatabaseSync(DB_NAME);
  configurePragmas(sqliteDb);
  return sqliteDb;
}

let currentExpoDb: SQLiteDatabase | null = openInitialDatabase();

export let db: ExpoSQLiteDatabase<typeof schema> & { $client: SQLiteDatabase } = drizzle(currentExpoDb, { schema });

/**
 * Returns the active SQLiteDatabase instance currently used by Drizzle.
 * Throws DatabaseClosedError if the database was closed.
 */
export function getDatabaseHandle(): SQLiteDatabase {
  if (!currentExpoDb) {
    throw new DatabaseClosedError();
  }
  return currentExpoDb;
}

/**
 * Checks whether the database handle is currently open and usable.
 */
export function isDatabaseOpen(): boolean {
  return currentExpoDb !== null;
}

/**
 * Closes the real database handle held by client.ts.
 * Idempotent: safe to call if already closed.
 */
export function closeDatabase(): void {
  if (currentExpoDb) {
    try {
      currentExpoDb.closeSync();
    } catch (e) {
      logger.warn('[IronLog] Error closing database handle:', e);
      throw e;
    } finally {
      currentExpoDb = null;
    }
  }
}

/**
 * Reopens the database handle, applies essential PRAGMAs (WAL, foreign keys, busy_timeout),
 * and points Drizzle to the refreshed handle.
 */
export function reopenDatabase(): SQLiteDatabase {
  if (currentExpoDb) {
    try {
      currentExpoDb.closeSync();
    } catch (e) {
      logger.warn('[IronLog] Warning closing existing handle before reopen:', e);
    }
    currentExpoDb = null;
  }
  currentExpoDb = openDatabaseSync(DB_NAME);
  configurePragmas(currentExpoDb);
  db = drizzle(currentExpoDb, { schema });
  return currentExpoDb;
}

/**
 * Executes PRAGMA wal_checkpoint on the real database handle.
 * If SQLite indicates busy (busy !== 0), throws DatabaseBusyError to prevent false success.
 */
export function checkpointWal(
  mode: CheckpointMode = 'TRUNCATE',
  customHandle?: SQLiteDatabase
): CheckpointResult {
  const handle = customHandle ?? getDatabaseHandle();
  const rows = handle.getAllSync<{ busy?: number; log?: number; checkpointed?: number }>(
    `PRAGMA wal_checkpoint(${mode});`
  );
  const row = rows?.[0];
  const busy = Number(row?.busy ?? Object.values(row ?? {})[0] ?? 0);
  const log = Number(row?.log ?? Object.values(row ?? {})[1] ?? 0);
  const checkpointed = Number(row?.checkpointed ?? Object.values(row ?? {})[2] ?? 0);

  if (busy !== 0) {
    throw new DatabaseBusyError(
      `wal_checkpoint(${mode}) failed with busy status (busy=${busy}, log=${log}, checkpointed=${checkpointed})`,
      busy
    );
  }

  return { busy, log, checkpointed };
}

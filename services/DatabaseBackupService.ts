import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { logger } from '@/services/logger';
import {
  closeDatabase,
  reopenDatabase,
  getDatabaseHandle,
  isDatabaseOpen,
} from '@/src/db/client';
import {
  DatabaseSnapshotService,
  DB_DIR,
  DB_PATH,
  DEFAULT_MAX_SNAPSHOTS,
} from '@/services/DatabaseSnapshotService';

export const REQUIRED_SCHEMA_TABLES = ['sessions', 'sets', 'exercises'] as const;

/**
 * Ensures the real active SQLite database handle is cleanly closed before restoring files.
 * Uses client.ts closeDatabase() rather than an arbitrary detached handle.
 */
function closeBeforeRestore(): void {
  closeDatabase();
}

/**
 * Open SQLite database at arbitrary filesystem path.
 */
function openDatabaseAtPath(filePath: string): SQLiteDatabase {
  const lastSlash = filePath.lastIndexOf('/');
  if (lastSlash !== -1) {
    const dir = filePath.substring(0, lastSlash);
    const fileName = filePath.substring(lastSlash + 1);
    return openDatabaseSync(fileName, undefined, dir);
  }
  return openDatabaseSync(filePath);
}

/**
 * Safely delete a file if it exists, without throwing unhandled exceptions.
 */
async function safeDeleteFile(filePath: string): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(filePath);
    if (info.exists) {
      await FileSystem.deleteAsync(filePath, { idempotent: true });
    }
  } catch (e) {
    logger.warn(`[IronLog] Failed to delete file at ${filePath}:`, e);
  }
}

/**
 * Validates candidate backup file:
 * 1. File exists, byteLength / size > 0.
 * 2. SQLite format 3 magic header.
 * 3. PRAGMA integrity_check returns 'ok'.
 * 4. Compatible schema: contains required core tables (sessions, sets, exercises).
 */
async function validateCandidateBackup(filePath: string): Promise<{ valid: boolean; error?: string }> {
  // 1. Base snapshot validation: exists, size > 0, SQLite format 3 header, PRAGMA integrity_check
  const baseValidation = await DatabaseSnapshotService.validateSnapshot(filePath);
  if (!baseValidation.valid) {
    return {
      valid: false,
      error: baseValidation.error ?? 'Invalid SQLite database file',
    };
  }

  // 2. Schema compatibility: verify required core tables
  let testDb: SQLiteDatabase | null = null;
  try {
    testDb = openDatabaseAtPath(filePath);
    const rows = testDb.getAllSync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';"
    );
    const foundTables = new Set(rows.map(r => r.name));
    const missing = REQUIRED_SCHEMA_TABLES.filter(table => !foundTables.has(table));
    if (missing.length > 0) {
      return {
        valid: false,
        error: `Incompatible backup schema: missing required table(s): ${missing.join(', ')}`,
      };
    }
    return { valid: true };
  } catch (e: any) {
    return {
      valid: false,
      error: `Failed inspecting candidate schema: ${e?.message ?? String(e)}`,
    };
  } finally {
    if (testDb) {
      try {
        testDb.closeSync();
      } catch {}
    }
  }
}

export const DatabaseBackupService = {
  /**
   * Exports the current database to a shareable SQLite file.
   * Executes WAL checkpoint TRUNCATE via DatabaseSnapshotService.createSnapshot()
   * (running PRAGMA wal_checkpoint(TRUNCATE) on the real handle) so uncheckpointed WAL pages
   * are fully committed into the exported database file.
   */
  async exportDb(): Promise<void> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(DB_PATH);
      if (!fileInfo.exists) {
        throw new Error('services.dbNotFound');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `ironlog_backup_${timestamp}.db`;
      const backupPath = `${FileSystem.cacheDirectory ?? ''}${backupName}`;

      // Centralized consistent snapshot: flushes WAL and verifies integrity
      await DatabaseSnapshotService.createSnapshot({
        tag: 'backup',
        destinationPath: backupPath,
        validate: true,
      });

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(backupPath, {
          dialogTitle: 'Exportar Backup do Iron Log',
          UTI: 'public.database', // iOS
          mimeType: 'application/x-sqlite3', // Android
        });
      } else {
        throw new Error('services.sharingUnavailable');
      }
    } catch (error) {
      logger.error('Erro ao exportar backup', error);
      throw error;
    }
  },

  /**
   * Imports a candidate SQLite backup database file in a fail-closed, atomic manner.
   *
   * 1. Validates candidate exists and byte length / size > 0.
   * 2. Creates a pre-import safety snapshot of the live DB (flushing WAL via TRUNCATE).
   *    If snapshot fails or checkpoint is busy, aborts immediately without touching live DB.
   * 3. Stages candidate file in DB_DIR and validates:
   *    - SQLite format 3 header
   *    - PRAGMA integrity_check
   *    - Compatible schema containing required core tables (sessions, sets, exercises).
   * 4. Closes the real database handle (client.ts closeDatabase via closeBeforeRestore).
   * 5. Atomically replaces live DB files.
   * 6. Reopens database handle with proper PRAGMAs (WAL, foreign keys, busy_timeout).
   * 7. Validates reopened DB integrity.
   * 8. Preserves legitimate empty sessions without deleting them (no orphan cleanup).
   * 9. On any fault: restores original database files and reopens handle to leave app functional.
   */
  async importDb(customSourceUri?: string): Promise<boolean> {
    let sourceUri = customSourceUri;

    // 1. Pick file if not provided
    if (!sourceUri) {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/x-sqlite3', 'application/vnd.sqlite3', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return false;
      }
      sourceUri = result.assets[0].uri;
    }

    try {
      // 2. Pre-check candidate existence and size
      const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
      if (!sourceInfo.exists || (sourceInfo.size !== undefined && sourceInfo.size === 0)) {
        throw new Error('services.invalidBackup');
      }

      const dirInfo = await FileSystem.getInfoAsync(DB_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DB_DIR, { intermediates: true });
      }

      // 3. Pre-import snapshot of current live DB (if exists)
      const liveDbInfo = await FileSystem.getInfoAsync(DB_PATH);
      let preImportSnapshotPath: string | null = null;

      if (liveDbInfo.exists) {
        // Fail-closed: if snapshot or checkpoint fails, aborts immediately before modifying anything
        const snapshotResult = await DatabaseSnapshotService.createSnapshot({
          tag: 'pre_import',
          validate: true,
        });
        preImportSnapshotPath = snapshotResult.path;
        await DatabaseSnapshotService.cleanupSnapshots(DEFAULT_MAX_SNAPSHOTS, 'ironlog_pre_import_');
      }

      // 4. Stage candidate file and deeply validate it before touching active live files
      const stagingPath = `${DB_DIR}ironlog_restore_staging_${Date.now()}.db`;
      try {
        await FileSystem.copyAsync({
          from: sourceUri,
          to: stagingPath,
        });
      } catch (copyErr) {
        await safeDeleteFile(stagingPath);
        logger.error('[IronLog] Failed to copy candidate to staging path:', copyErr);
        throw new Error('services.invalidBackup');
      }

      const candidateValidation = await validateCandidateBackup(stagingPath);
      if (!candidateValidation.valid) {
        await safeDeleteFile(stagingPath);
        logger.error(`[IronLog] Candidate backup rejected: ${candidateValidation.error}`);
        if (
          candidateValidation.error?.includes('header') ||
          candidateValidation.error?.includes('SQLite format 3')
        ) {
          throw new Error('services.invalidBackupFormat');
        }
        throw new Error('services.invalidBackup');
      }

      // 5. ATOMIC REPLACEMENT & FAIL-CLOSED BOUNDARY
      const prevDbPath = `${DB_DIR}ironlog_prev_${Date.now()}.db`;
      const prevWalPath = `${DB_DIR}ironlog_prev_${Date.now()}.db-wal`;
      const prevShmPath = `${DB_DIR}ironlog_prev_${Date.now()}.db-shm`;
      let dbRenamed = false;
      let walRenamed = false;
      let shmRenamed = false;

      try {
        // Close the real active database handle
        closeBeforeRestore();

        // Move live database files aside
        if (liveDbInfo.exists) {
          await FileSystem.moveAsync({ from: DB_PATH, to: prevDbPath });
          dbRenamed = true;

          const walInfo = await FileSystem.getInfoAsync(DB_PATH + '-wal');
          if (walInfo.exists) {
            await FileSystem.moveAsync({ from: DB_PATH + '-wal', to: prevWalPath });
            walRenamed = true;
          }

          const shmInfo = await FileSystem.getInfoAsync(DB_PATH + '-shm');
          if (shmInfo.exists) {
            await FileSystem.moveAsync({ from: DB_PATH + '-shm', to: prevShmPath });
            shmRenamed = true;
          }
        }

        // Move staging candidate into live position
        await FileSystem.moveAsync({ from: stagingPath, to: DB_PATH });

        // Reopen database handle with pragmas configured
        reopenDatabase();

        // Validate live handle
        const handle = getDatabaseHandle();
        const integrityRows = handle.getAllSync<Record<string, unknown>>('PRAGMA integrity_check;');
        const integrityStatus = integrityRows.length > 0 ? Object.values(integrityRows[0])[0] : null;

        if (integrityStatus !== 'ok') {
          throw new Error(`Integrity check on restored database failed: ${integrityStatus}`);
        }

        // Clean up temporary prev files
        if (dbRenamed) await safeDeleteFile(prevDbPath);
        if (walRenamed) await safeDeleteFile(prevWalPath);
        if (shmRenamed) await safeDeleteFile(prevShmPath);

        logger.info('[IronLog] Database restore succeeded with legitimate empty sessions preserved');
        return true;
      } catch (replaceErr) {
        logger.error('[IronLog] Replacement failed, initiating fail-closed rollback:', replaceErr);

        // Rollback sequence
        try {
          if (isDatabaseOpen()) {
            closeDatabase();
          }
        } catch (e) {
          logger.warn('[IronLog] Warning closing handle during rollback:', e);
        }

        await safeDeleteFile(DB_PATH);
        await safeDeleteFile(DB_PATH + '-wal');
        await safeDeleteFile(DB_PATH + '-shm');
        await safeDeleteFile(stagingPath);

        if (dbRenamed) {
          try {
            await FileSystem.moveAsync({ from: prevDbPath, to: DB_PATH });
            if (walRenamed) {
              await FileSystem.moveAsync({ from: prevWalPath, to: DB_PATH + '-wal' });
            }
            if (shmRenamed) {
              await FileSystem.moveAsync({ from: prevShmPath, to: DB_PATH + '-shm' });
            }
          } catch (moveBackErr) {
            logger.error('[IronLog] Failed to move prev files back, attempting restore from pre-import snapshot:', moveBackErr);
            if (preImportSnapshotPath) {
              try {
                await FileSystem.copyAsync({ from: preImportSnapshotPath, to: DB_PATH });
              } catch (snapRestoreErr) {
                logger.error('[IronLog] Failed to restore from pre-import snapshot during rollback:', snapRestoreErr);
              }
            }
          }
        } else if (preImportSnapshotPath) {
          try {
            await FileSystem.copyAsync({ from: preImportSnapshotPath, to: DB_PATH });
          } catch (snapRestoreErr) {
            logger.error('[IronLog] Failed to restore from pre-import snapshot during rollback:', snapRestoreErr);
          }
        }

        await safeDeleteFile(prevDbPath);
        await safeDeleteFile(prevWalPath);
        await safeDeleteFile(prevShmPath);

        // Reopen database handle to preserve functional client
        try {
          reopenDatabase();
        } catch (reopenErr) {
          logger.error('[IronLog] Critical: Failed to reopen database after rollback:', reopenErr);
        }

        throw new Error('services.invalidBackup');
      }
    } catch (error) {
      logger.error('Erro ao importar backup', error);
      throw error;
    }
  },

  /**
   * Uploads a consistent database backup to Google Drive.
   * Centralizes snapshot generation via DatabaseSnapshotService.createSnapshot(),
   * ensuring recent WAL pages are flushed and validated before upload.
   * Cleans up the temporary snapshot file after upload completes.
   */
  async uploadToDrive(accessToken: string): Promise<any> {
    try {
      const fileInfo = await FileSystem.getInfoAsync(DB_PATH);
      if (!fileInfo.exists) throw new Error('services.dbNotFound');

      // Centralized consistent snapshot with WAL checkpoint
      const snapshot = await DatabaseSnapshotService.createSnapshot({
        tag: 'drive',
        validate: true,
      });

      const fileName = `ironlog_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
      const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=media';

      let fileData: any;
      try {
        const uploadResponse = await FileSystem.uploadAsync(uploadUrl, snapshot.path, {
          httpMethod: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/x-sqlite3',
          },
        });

        if (uploadResponse.status !== 200) {
          throw new Error(`Falha no upload: ${uploadResponse.status}`);
        }

        fileData = JSON.parse(uploadResponse.body);
        const fileId = fileData.id;

        const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;
        const metadata = {
          name: fileName,
          description: 'Iron Log automatic backup',
        };

        const metadataResponse = await fetch(metadataUrl, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(metadata),
        });

        if (!metadataResponse.ok) {
          logger.warn('Falha ao renomear arquivo no Drive');
        }
      } finally {
        await DatabaseSnapshotService.deleteSnapshot(snapshot.path);
      }

      return fileData;
    } catch (error) {
      logger.error('Drive upload error', error);
      throw error;
    }
  },
};

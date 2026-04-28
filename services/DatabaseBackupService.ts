import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert, Platform } from 'react-native';
import { logger } from '@/services/logger';

const DB_NAME = 'ironlog.db';
const DB_DIR = FileSystem.documentDirectory + 'SQLite/';
const DB_PATH = DB_DIR + DB_NAME;
const SNAPSHOTS_DIR = FileSystem.documentDirectory + 'SQLite/snapshots/';
const MAX_SNAPSHOTS = 5;

async function createPreImportSnapshot(): Promise<string | null> {
  try {
    const fileInfo = await FileSystem.getInfoAsync(DB_PATH);
    if (!fileInfo.exists) return null;

    const dirInfo = await FileSystem.getInfoAsync(SNAPSHOTS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(SNAPSHOTS_DIR, { intermediates: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotPath = `${SNAPSHOTS_DIR}ironlog_pre_import_${timestamp}.db`;
    await FileSystem.copyAsync({ from: DB_PATH, to: snapshotPath });

    // Cleanup old snapshots
    const files = await FileSystem.readDirectoryAsync(SNAPSHOTS_DIR);
    const snapshots = files
      .filter(f => f.startsWith('ironlog_pre_import_'))
      .sort();
    
    while (snapshots.length > MAX_SNAPSHOTS) {
      const oldest = snapshots.shift();
      if (oldest) {
        await FileSystem.deleteAsync(`${SNAPSHOTS_DIR}${oldest}`, { idempotent: true });
      }
    }

    return snapshotPath;
  } catch (e) {
    logger.warn('[IronLog] Failed to create pre-import snapshot:', e);
    return null;
  }
}

export const DatabaseBackupService = {
  async exportDb() {
    try {
      // 1. Check if DB exists
      const fileInfo = await FileSystem.getInfoAsync(DB_PATH);
      if (!fileInfo.exists) {
        throw new Error('Banco de dados não encontrado.');
      }

      // 2. Create a backup file name with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `ironlog_backup_${timestamp}.db`;
      const backupPath = FileSystem.cacheDirectory + backupName;

      // 3. Copy DB to cache
      await FileSystem.copyAsync({
        from: DB_PATH,
        to: backupPath,
      });

      // 4. Share the file
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(backupPath, {
          dialogTitle: 'Exportar Backup do Iron Log',
          UTI: 'public.database', // iOS
          mimeType: 'application/x-sqlite3', // Android
        });
      } else {
        throw new Error('Compartilhamento não disponível neste dispositivo.');
      }
    } catch (error) {
      logger.error('Erro ao exportar backup', error);
      throw error;
    }
  },

  async importDb() {
    try {
      // 1. Pick file
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/x-sqlite3', 'application/vnd.sqlite3', 'application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return false;

      const sourceUri = result.assets[0].uri;

      // 2. Safety check: size > 0
      const sourceInfo = await FileSystem.getInfoAsync(sourceUri);
      if (!sourceInfo.exists || sourceInfo.size === 0) {
        throw new Error('Arquivo de backup inválido ou vazio.');
      }

      // 3. Confirm with user (handled in UI usually, but we can double check here or just proceed)

      // 3.5 Create safety snapshot of current database
      const snapshotPath = await createPreImportSnapshot();
      if (snapshotPath) {
        logger.debug('[IronLog] Pre-import snapshot created:', snapshotPath);
      }

      // 4. Ensure SQLite dir exists
      const dirInfo = await FileSystem.getInfoAsync(DB_DIR);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DB_DIR, { intermediates: true });
      }

      // 5. Replace DB file
      await FileSystem.deleteAsync(DB_PATH, { idempotent: true });
      await FileSystem.copyAsync({
        from: sourceUri,
        to: DB_PATH,
      });

      return true;
    } catch (error) {
      logger.error('Erro ao importar backup', error);
      throw error;
    }
  },

  async uploadToDrive(accessToken: string) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(DB_PATH);
      if (!fileInfo.exists) throw new Error('DB não encontrado');

      const fileName = `ironlog_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`;

      const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=media';
      
      const uploadResponse = await FileSystem.uploadAsync(uploadUrl, DB_PATH, {
        httpMethod: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/x-sqlite3',
        },
      });

      if (uploadResponse.status !== 200) {
        throw new Error(`Falha no upload: ${uploadResponse.status}`);
      }

      const fileData = JSON.parse(uploadResponse.body);
      const fileId = fileData.id;

      const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}`;
      const metadata = {
        name: fileName,
        description: 'Backup automático do Iron Log',
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

      return fileData;
    } catch (error) {
      logger.error('Drive upload error', error);
      throw error;
    }
  }
};

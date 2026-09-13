import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { logger } from '@/services/logger';
import { detectTracker } from './csv';
import { FitNotesImporter } from './FitNotesImporter';
import { HevyImporter } from './HevyImporter';
import { StrongImporter } from './StrongImporter';
import type { ImportResult, TrackerType } from './types';

export const TrackerImportService = {
  /**
   * Imports workout history from raw CSV text, automatically detecting the tracker format if not specified.
   */
  importFromCsv(
    csvContent: string,
    preferredTracker?: TrackerType,
    database?: any
  ): ImportResult {
    if (!csvContent || !csvContent.trim()) {
      return {
        success: false,
        sessionsCreated: 0,
        setsImported: 0,
        customExercisesCreated: 0,
        skippedSessions: 0,
        error: 'emptyFile',
      };
    }

    const tracker = preferredTracker || detectTracker(csvContent);

    if (!tracker) {
      return {
        success: false,
        sessionsCreated: 0,
        setsImported: 0,
        customExercisesCreated: 0,
        skippedSessions: 0,
        error: 'unsupportedFormat',
      };
    }

    switch (tracker) {
      case 'strong':
        return StrongImporter.importCsv(csvContent, database);
      case 'hevy':
        return HevyImporter.importCsv(csvContent, database);
      case 'fitnotes':
        return FitNotesImporter.importCsv(csvContent, database);
    }
  },

  /**
   * Opens the native document picker, reads the chosen CSV file, and imports it.
   */
  async importFromFile(preferredTracker?: TrackerType): Promise<ImportResult> {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]?.uri) {
        return {
          success: false,
          sessionsCreated: 0,
          setsImported: 0,
          customExercisesCreated: 0,
          skippedSessions: 0,
          error: 'canceled',
        };
      }

      const fileUri = result.assets[0].uri;
      const csvContent = await FileSystem.readAsStringAsync(fileUri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      if (!csvContent || !csvContent.trim()) {
        return {
          success: false,
          sessionsCreated: 0,
          setsImported: 0,
          customExercisesCreated: 0,
          skippedSessions: 0,
          error: 'emptyFile',
        };
      }

      return this.importFromCsv(csvContent, preferredTracker);
    } catch (e) {
      logger.error('Failed to import tracker CSV file', e);
      throw e;
    }
  },
};

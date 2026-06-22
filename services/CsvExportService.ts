import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { db } from '@/src/db/client';
import { sessions, sets, bodyMetrics, exercises } from '@/src/db/schema';
import { desc, asc, isNull, eq, and } from 'drizzle-orm';
import { logger } from '@/services/logger';

/**
 * CSV Export Service for Iron Log
 * Generates CSV files for sessions, sets, and body metrics.
 */

function escapeCsvField(value: unknown): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: unknown[]): string {
  return fields.map(escapeCsvField).join(',');
}

function formatDateBR(epoch: number | null): string {
  if (!epoch) return '';
  const d = new Date(epoch);
  return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
}

export const CsvExportService = {

  /**
   * Export all sessions with their sets as a single CSV
   */
  async exportSessionsCsv(): Promise<string> {
    const allSessions = await db.select()
      .from(sessions)
      .where(isNull(sessions.deletedAt))
      .orderBy(desc(sessions.startTime));

    const allSets = await db.select()
      .from(sets)
      .where(isNull(sets.deletedAt))
      .orderBy(asc(sets.sessionId), asc(sets.setNumber));

    const setsBySession = new Map<number, typeof allSets>();
    allSets.forEach(s => {
      const list = setsBySession.get(s.sessionId) || [];
      list.push(s);
      setsBySession.set(s.sessionId, list);
    });

    const rows: string[] = [];

    // Header
    rows.push(toCsvRow([
      'Date', 'Routine', 'Duration (min)', 'Body Weight (kg)',
      'sRPE', 'Notes', 'Exercise', 'Set #', 'Weight (kg)',
      'Reps', 'Duration (s)', 'RIR', 'Warmup'
    ]));

    for (const session of allSessions) {
      const sessionSets = setsBySession.get(session.id) || [];

      if (sessionSets.length === 0) {
        // Session with no sets
        rows.push(toCsvRow([
          formatDateBR(session.startTime),
          session.routineName || '',
          session.durationMinutes || '',
          session.bodyWeight || '',
          session.sRpe || '',
          session.notes || '',
          '', '', '', '', '', '', ''
        ]));
      } else {
        for (const set of sessionSets) {
          rows.push(toCsvRow([
            formatDateBR(session.startTime),
            session.routineName || '',
            session.durationMinutes || '',
            session.bodyWeight || '',
            session.sRpe || '',
            session.notes || '',
            set.exerciseName || '',
            set.setNumber,
            set.weightKg,
            set.reps,
            set.durationSeconds || '',
            set.rir ?? '',
            set.isWarmup ? 'Yes' : 'No',
          ]));
        }
      }
    }

    return rows.join('\n');
  },

  /**
   * Export body metrics as CSV
   */
  async exportBodyMetricsCsv(): Promise<string> {
    const metrics = await db.select()
      .from(bodyMetrics)
      .orderBy(desc(bodyMetrics.date));

    const rows: string[] = [];

    rows.push(toCsvRow([
      'Date', 'Type', 'Weight (kg)', 'Waist (cm)', 'R. Arm (cm)',
      'R. Thigh (cm)', 'Chest (cm)', 'Calf (cm)'
    ]));

    for (const m of metrics) {
      rows.push(toCsvRow([
        formatDateBR(m.date),
        m.type || '',
        m.weight || '',
        m.waist || '',
        m.armRight || '',
        m.thighRight || '',
        m.chest || '',
        m.calf || '',
      ]));
    }

    return rows.join('\n');
  },

  /**
   * Export exercise library as CSV
   */
  async exportExercisesCsv(): Promise<string> {
    const exs = await db.select().from(exercises).orderBy(asc(exercises.name));

    const rows: string[] = [];
    rows.push(toCsvRow(['ID', 'Name', 'Type', 'Default Rest (s)']));

    for (const ex of exs) {
      rows.push(toCsvRow([ex.id, ex.name, ex.type, ex.defaultRestSeconds || '']));
    }

    return rows.join('\n');
  },

  /**
   * Export all data and share as a single CSV file
   */
  async exportAllAndShare(): Promise<void> {
    try {
      const [sessionsCsv, metricsCsv] = await Promise.all([
        this.exportSessionsCsv(),
        this.exportBodyMetricsCsv(),
      ]);

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      // Write sessions CSV
      const sessionsPath = FileSystem.cacheDirectory + `ironlog_sessions_${timestamp}.csv`;
      await FileSystem.writeAsStringAsync(sessionsPath, sessionsCsv, { encoding: FileSystem.EncodingType.UTF8 });

      // Write metrics CSV
      const metricsPath = FileSystem.cacheDirectory + `ironlog_metrics_${timestamp}.csv`;
      await FileSystem.writeAsStringAsync(metricsPath, metricsCsv, { encoding: FileSystem.EncodingType.UTF8 });

      // Share the main file (sessions)
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(sessionsPath, {
          dialogTitle: 'Exportar Dados Iron Log',
          UTI: 'public.comma-separated-values-text',
          mimeType: 'text/csv',
        });
      }

      logger.info('CSV export completed');
    } catch (e) {
      logger.error('Failed to export CSV', e);
      throw e;
    }
  },

  /**
   * Export sessions CSV for a specific session (from summary screen)
   */
  async exportSessionCsv(sessionId: number): Promise<string> {
    const sessionData = await db.select()
      .from(sessions)
      .where(eq(sessions.id, sessionId));

    if (!sessionData.length) return '';

    const session = sessionData[0];
    const sessionSets = await db.select()
      .from(sets)
      .where(and(eq(sets.sessionId, sessionId), isNull(sets.deletedAt)))
      .orderBy(asc(sets.setNumber));

    const rows: string[] = [];
    rows.push(toCsvRow([
      'Exercise', 'Set #', 'Weight (kg)', 'Reps', 'Duration (s)', 'RIR', 'Warmup'
    ]));

    for (const set of sessionSets) {
      rows.push(toCsvRow([
        set.exerciseName || '',
        set.setNumber,
        set.weightKg,
        set.reps,
        set.durationSeconds || '',
        set.rir ?? '',
        set.isWarmup ? 'Yes' : 'No',
      ]));
    }

    // Prepend session metadata as comments
    const header = [
      `# Iron Log - ${session.routineName || 'Treino'}`,
      `# Data: ${formatDateBR(session.startTime)}`,
      `# Duration: ${session.durationMinutes || 0} min`,
      `# sRPE: ${session.sRpe || '-'}`,
      `# Peso: ${session.bodyWeight || '-'} kg`,
      '',
    ].join('\n');

    return header + rows.join('\n');
  },
};

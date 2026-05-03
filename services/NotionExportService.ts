import * as Clipboard from 'expo-clipboard';
import { db } from '@/src/db/client';
import { sessions, sets } from '@/src/db/schema';
import { asc, isNull, eq, and, gte, lte } from 'drizzle-orm';
import { formatEpochDate, computeVolume } from './AlexandriaExportService';
import { logger } from '@/services/logger';

export const NotionExportService = {

  /**
   * Generate Notion-friendly Markdown for a single session.
   * Includes YAML frontmatter, exercise table, and session metadata.
   */
  async exportSessionMarkdown(sessionId: number): Promise<string> {
    // 1. Fetch session
    const sessionData = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    if (!sessionData.length) return '';
    const session = sessionData[0];

    // 2. Fetch sets (non-deleted)
    const sessionSets = await db.select()
      .from(sets)
      .where(and(eq(sets.sessionId, sessionId), isNull(sets.deletedAt)))
      .orderBy(asc(sets.setNumber));

    // 3. Calculate totals
    const totalVolume = computeVolume(sessionSets);
    const totalSets = sessionSets.length;
    const dateStr = formatEpochDate(session.startTime) || '';

    // 4. Build frontmatter
    let md = `---\n`;
    md += `date: ${dateStr}\n`;
    md += `routine: "${session.routineName || 'Workout'}"\n`;
    md += `duration: ${session.durationMinutes || 0}\n`;
    md += `srpe: ${session.sRpe || '-'}\n`;
    md += `body_weight: ${session.bodyWeight || '-'}\n`;
    md += `total_sets: ${totalSets}\n`;
    md += `total_volume: ${totalVolume}\n`;
    md += `---\n\n`;

    // 5. Title
    md += `## ${session.routineName || 'Workout'}\n\n`;

    // 6. Group sets by exercise
    const byExercise = new Map<string, typeof sessionSets>();
    for (const s of sessionSets) {
      const name = s.exerciseName || 'Unknown';
      if (!byExercise.has(name)) byExercise.set(name, []);
      byExercise.get(name)!.push(s);
    }

    // 7. Build exercise tables
    for (const [name, exerciseSets] of byExercise) {
      md += `### ${name}\n\n`;
      md += `| Set | Weight (kg) | Reps | RIR | Warmup |\n`;
      md += `|-----|-------------|------|-----|--------|\n`;
      for (const s of exerciseSets) {
        md += `| ${s.setNumber} | ${s.weightKg} | ${s.reps} | ${s.rir ?? '-'} | ${s.isWarmup ? '✓' : '-'} |\n`;
      }
      md += `\n`;
    }

    // 8. Notes
    if (session.notes) {
      md += `> ${session.notes}\n`;
    }

    return md;
  },

  /**
   * Generate a weekly report aggregating all sessions from the current week (Mon-Sun).
   * Returns Markdown ready for Notion.
   */
  async exportWeeklyReport(referenceDate?: Date): Promise<{
    markdown: string;
    sessionCount: number;
    totalVolume: number;
    avgSRPE: number;
  }> {
    const now = referenceDate || new Date();

    // Calculate Monday and Sunday of current week
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() + mondayOffset);

    const sunday = new Date(monday);
    sunday.setDate(sunday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    const weekStart = monday.getTime();
    const weekEnd = sunday.getTime();

    // Format week range for title
    const formatDateShort = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    const weekLabel = `${formatDateShort(monday)} - ${formatDateShort(sunday)}`;

    // Get ISO week number
    const getWeekNumber = (d: Date) => {
      const target = new Date(d.valueOf());
      const dayNr = (d.getDay() + 6) % 7;
      target.setDate(target.getDate() - dayNr + 3);
      const firstThursday = target.valueOf();
      target.setMonth(0, 1);
      if (target.getDay() !== 4) {
        target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
      }
      return 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);
    };
    const weekNum = getWeekNumber(now);

    // Fetch sessions in range
    const weekSessions = await db.select()
      .from(sessions)
      .where(and(
        isNull(sessions.deletedAt),
        gte(sessions.startTime, weekStart),
        lte(sessions.startTime, weekEnd),
      ))
      .orderBy(asc(sessions.startTime));

    if (weekSessions.length === 0) {
      return {
        markdown: `# Semana ${weekNum} — ${weekLabel}\n\nNenhuma sessão registrada esta semana.`,
        sessionCount: 0,
        totalVolume: 0,
        avgSRPE: 0,
      };
    }

    // Fetch all sets for these sessions
    const sessionIds = weekSessions.map(s => s.id);
    let allSets: (typeof sets.$inferSelect)[] = [];
    if (sessionIds.length > 0) {
      // Query sets for all sessions in the week
      allSets = await db.select()
        .from(sets)
        .where(isNull(sets.deletedAt))
        .orderBy(asc(sets.sessionId), asc(sets.setNumber));
      // Filter in-memory since Drizzle doesn't have a nice IN clause for this
      allSets = allSets.filter(s => sessionIds.includes(s.sessionId));
    }

    const setsBySession = new Map<number, typeof allSets>();
    allSets.forEach(s => {
      const list = setsBySession.get(s.sessionId) || [];
      list.push(s);
      setsBySession.set(s.sessionId, list);
    });

    // Aggregate stats
    let totalVolume = 0;
    let totalSRPE = 0;
    let srpeCount = 0;

    for (const session of weekSessions) {
      const sessionSets = setsBySession.get(session.id) || [];
      totalVolume += computeVolume(sessionSets);
      if (session.sRpe) {
        totalSRPE += session.sRpe;
        srpeCount++;
      }
    }

    const avgSRPE = srpeCount > 0 ? Math.round((totalSRPE / srpeCount) * 10) / 10 : 0;

    // Build Markdown
    let md = `---\n`;
    md += `week: ${weekNum}\n`;
    md += `date_range: "${weekLabel}"\n`;
    md += `sessions: ${weekSessions.length}\n`;
    md += `total_volume: ${totalVolume}\n`;
    md += `avg_srpe: ${avgSRPE}\n`;
    md += `---\n\n`;

    md += `# Semana ${weekNum} — ${weekLabel}\n\n`;

    // Summary
    md += `## Resumo\n\n`;
    md += `- **Sessões:** ${weekSessions.length}\n`;
    md += `- **Volume total:** ${totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume} kg\n`;
    md += `- **sRPE médio:** ${avgSRPE || '-'}\n\n`;

    // Sessions
    md += `## Sessões\n\n`;
    for (const session of weekSessions) {
      const dateStr = formatEpochDate(session.startTime) || '';
      const dayName = new Date(session.startTime).toLocaleDateString('pt-BR', { weekday: 'short' });
      const capitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);

      md += `### ${capitalized} — ${session.routineName || 'Workout'} (${dateStr})\n\n`;

      // Session stats
      const sessionSets = setsBySession.get(session.id) || [];
      const sessionVolume = computeVolume(sessionSets);
      md += `**Duração:** ${session.durationMinutes || 0} min | **Volume:** ${sessionVolume >= 1000 ? `${(sessionVolume / 1000).toFixed(1)}k` : sessionVolume} kg | **sRPE:** ${session.sRpe || '-'}\n\n`;

      // Group sets by exercise
      const byExercise = new Map<string, typeof sessionSets>();
      for (const s of sessionSets) {
        const name = s.exerciseName || 'Unknown';
        if (!byExercise.has(name)) byExercise.set(name, []);
        byExercise.get(name)!.push(s);
      }

      for (const [name, exSets] of byExercise) {
        md += `**${name}:** `;
        md += exSets.map(s => {
          if (s.durationSeconds) {
            let str = `${s.durationSeconds}s`;
            if (s.weightKg > 0) str += `×${s.weightKg}kg`;
            return str;
          }
          return `${s.reps}×${s.weightKg}kg`;
        }).join(' | ');
        md += `\n`;
      }

      if (session.notes) {
        md += `\n> ${session.notes}\n`;
      }
      md += `\n`;
    }

    return {
      markdown: md,
      sessionCount: weekSessions.length,
      totalVolume,
      avgSRPE,
    };
  },

  /**
   * Copy markdown to clipboard
   */
  async copyToClipboard(markdown: string): Promise<void> {
    await Clipboard.setStringAsync(markdown);
    logger.info('Notion MD copied to clipboard');
  },
};

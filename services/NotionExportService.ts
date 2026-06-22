import * as Clipboard from 'expo-clipboard';
import { db } from '@/src/db/client';
import { sessions, sets, routineExercises } from '@/src/db/schema';
import { asc, isNull, eq, and, gte, lte, inArray } from 'drizzle-orm';
import { formatEpochDate, computeVolume } from './AlexandriaExportService';
import { generateSessionVerdicts } from '@/src/utils/session-verdicts';
import { buildSessionVerdictsMarkdown } from '@/src/utils/session-verdict-markdown';
import { logger } from '@/services/logger';

type TFunction = (key: string, vars?: Record<string, string | number>) => string;

export const NotionExportService = {

  /**
   * Generate Notion-friendly Markdown for a single session.
   * Includes YAML frontmatter, exercise table, and session metadata.
   */
  async exportSessionMarkdown(sessionId: number, t: TFunction): Promise<string> {
    // 1. Fetch session
    const sessionData = await db.select().from(sessions).where(eq(sessions.id, sessionId));
    if (!sessionData.length) return '';
    const session = sessionData[0];

    // 2. Fetch sets (non-deleted)
    const sessionSets = await db.select()
      .from(sets)
      .where(and(eq(sets.sessionId, sessionId), isNull(sets.deletedAt)))
      .orderBy(asc(sets.setNumber));

    const targetsMap = new Map<number, string>();
    if (session.routineId) {
      const reData = await db.select({
        exId: routineExercises.exerciseId,
        target: routineExercises.target,
      })
        .from(routineExercises)
        .where(eq(routineExercises.routineId, session.routineId));

      reData.forEach((r) => {
        if (r.exId && r.target) targetsMap.set(r.exId, r.target);
      });
    }

    const verdicts = generateSessionVerdicts(sessionSets, targetsMap, t);

    // 3. Calculate totals
    const totalVolume = computeVolume(sessionSets);
    const totalSets = sessionSets.filter(s => !s.isWarmup).length;
    const dateStr = formatEpochDate(session.startTime) || '';

    // 4. Build frontmatter
    let md = `---\n`;
    md += `date: ${dateStr}\n`;
    md += `routine: "${session.routineName || t('reports.md.workout')}"\n`;
    md += `duration: ${session.durationMinutes || 0}\n`;
    md += `srpe: ${session.sRpe || '-'}\n`;
    md += `body_weight: ${session.bodyWeight || '-'}\n`;
    md += `total_sets: ${totalSets}\n`;
    md += `total_volume: ${totalVolume}\n`;
    md += `---\n\n`;

    // 5. Title
    md += `## ${session.routineName || t('reports.md.workout')}\n\n`;

    // 6. Group sets by exercise
    const byExercise = new Map<string, typeof sessionSets>();
    for (const s of sessionSets) {
      const name = s.exerciseName || t('reports.md.unknown');
      if (!byExercise.has(name)) byExercise.set(name, []);
      byExercise.get(name)!.push(s);
    }

    // 7. Build exercise tables
    for (const [name, exerciseSets] of byExercise) {
      md += `### ${name}\n\n`;
      md += `| ${t('reports.md.set')} | ${t('reports.md.weightKg')} | ${t('reports.md.reps')} | RIR | ${t('reports.md.warmup')} |\n`;
      md += `|-----|-------------|------|-----|--------|\n`;
      for (const s of exerciseSets) {
        md += `| ${s.setNumber} | ${s.weightKg} | ${s.reps} | ${s.rir ?? '-'} | ${s.isWarmup ? '✓' : '-'} |\n`;
      }
      md += `\n`;
    }

    const verdictsMarkdown = buildSessionVerdictsMarkdown(verdicts, t);
    if (verdictsMarkdown) {
      md += verdictsMarkdown;
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
  async exportWeeklyReport(t: TFunction, referenceDate?: Date): Promise<{
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
        markdown: `# ${t('reports.md.week')} ${weekNum} — ${weekLabel}\n\n${t('reports.noSessions')}`,
        sessionCount: 0,
        totalVolume: 0,
        avgSRPE: 0,
      };
    }

    // Fetch all sets for these sessions
    const sessionIds = weekSessions.map(s => s.id);
    let allSets: (typeof sets.$inferSelect)[] = [];
    if (sessionIds.length > 0) {
      allSets = await db.select()
        .from(sets)
        .where(and(isNull(sets.deletedAt), inArray(sets.sessionId, sessionIds)))
        .orderBy(asc(sets.sessionId), asc(sets.setNumber));
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

    md += `# ${t('reports.md.week')} ${weekNum} — ${weekLabel}\n\n`;

    // Summary
    md += `## ${t('reports.md.summary')}\n\n`;
    md += `- **${t('reports.sessions')}:** ${weekSessions.length}\n`;
    md += `- **${t('reports.md.totalVolume')}:** ${totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume} kg\n`;
    md += `- **${t('reports.avgSrpe')}:** ${avgSRPE || '-'}\n\n`;

    // Sessions
    md += `## ${t('reports.md.sessions')}\n\n`;
    for (const session of weekSessions) {
      const dateStr = formatEpochDate(session.startTime) || '';
      const dayName = new Date(session.startTime).toLocaleDateString('pt-BR', { weekday: 'short' });
      const capitalized = dayName.charAt(0).toUpperCase() + dayName.slice(1);

      md += `### ${capitalized} — ${session.routineName || t('reports.md.workout')} (${dateStr})\n\n`;

      // Session stats
      const sessionSets = setsBySession.get(session.id) || [];
      const sessionVolume = computeVolume(sessionSets);
      md += `**${t('reports.md.duration')}:** ${session.durationMinutes || 0} ${t('reports.md.min')} | **${t('reports.md.volume')}:** ${sessionVolume >= 1000 ? `${(sessionVolume / 1000).toFixed(1)}k` : sessionVolume} kg | **sRPE:** ${session.sRpe || '-'}\n\n`;

      // Group sets by exercise
      const byExercise = new Map<string, typeof sessionSets>();
      for (const s of sessionSets) {
        const name = s.exerciseName || t('reports.md.unknown');
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

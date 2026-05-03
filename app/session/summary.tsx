import {
  View,
  Text,
  ScrollView,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState, useCallback } from 'react';
import { db } from '../../src/db/client';
import { sets, routineExercises, sessions as sessionsTable } from '../../src/db/schema';
import { eq } from 'drizzle-orm';
import * as Clipboard from 'expo-clipboard';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Toast } from '../../components/Toast';
import { logger } from '@/services/logger';
import { Session } from '@/src/types';
import { safeParseParams, summaryParamsSchema } from '@/src/validators/routes';
import { CsvExportService } from '../../services/CsvExportService';
import { useI18n } from '../../src/i18n/index';

interface ExerciseSummary {
  name: string;
  sets: { setNumber: number; weightKg: number; reps: number; durationSeconds: number | null; rir: number | null }[];
  exId: number;
  target?: string;
}

interface SessionStats {
  totalSets: number;
  totalVolume: number;
  bestSet: { weight: number; reps: number; exercise: string } | null;
  averageIntensity: number;
}

export default function SummaryScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const rawParams = useLocalSearchParams();
  const validated = safeParseParams(summaryParamsSchema, rawParams, 'SummaryScreen');
  const sessionId = validated?.sessionId ?? 0;
  const [report, setReport] = useState(t('summary.generatingReport'));
  const [sessionData, setSessionData] = useState<Session | null>(null);
  const [stats, setStats] = useState<SessionStats>({
    totalSets: 0,
    totalVolume: 0,
    bestSet: null,
    averageIntensity: 0,
  });
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const generateMarkdown = useCallback(async () => {
    try {
      // 1. Buscar Sessão
      const sessionDataResult = await db.select().from(sessionsTable).where(eq(sessionsTable.id, Number(sessionId)));
      if (!sessionDataResult.length) return;
      const session = sessionDataResult[0];
      setSessionData(session);

      // 2. Buscar Sets
      const setsData = await db.select().from(sets).where(eq(sets.sessionId, Number(sessionId)));

      // 3. Buscar Targets da Rotina (Se houver routineId)
      const targetsMap = new Map<number, string>();
      if (session.routineId) {
        const reData = await db.select({
          exId: routineExercises.exerciseId,
          target: routineExercises.target
        })
          .from(routineExercises)
          .where(eq(routineExercises.routineId, session.routineId));

        reData.forEach(r => {
          if (r.exId && r.target) targetsMap.set(r.exId, r.target);
        });
      }

      // 4. Agrupar por Exercício
      const exercisesMap = new Map<string, ExerciseSummary>();

      setsData.forEach(set => {
        const exName = set.exerciseName || `${t('common.exercise')} ${set.exerciseId}`;
        if (!exercisesMap.has(exName)) {
          exercisesMap.set(exName, { sets: [], exId: set.exerciseId, name: exName });
        }
        exercisesMap.get(exName)!.sets.push(set);
      });

      // Add targets to exercises
      exercisesMap.forEach((data, exName) => {
        const target = targetsMap.get(data.exId);
        if (target) data.target = target;
      });

      // 5. Calculate statistics
      let totalVolume = 0;
      let maxVolume = 0;
      let bestSet: { weight: number; reps: number; exercise: string } | null = null;

      setsData.forEach(set => {
        if (set.reps && set.weightKg) {
          const volume = set.reps * set.weightKg;
          totalVolume += volume;

          if (volume > maxVolume) {
            maxVolume = volume;
            bestSet = {
              weight: set.weightKg,
              reps: set.reps,
              exercise: set.exerciseName || 'Unknown',
            };
          }
        }
      });

      setStats({
        totalSets: setsData.length,
        totalVolume,
        bestSet,
        averageIntensity: setsData.length > 0 ? totalVolume / setsData.length : 0,
      });

      // 6. Formatar Data
      const dateObj = new Date(session.startTime);
      const dateStr = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;

      // 7. Montar String
      let md = `💪 TREINO ${session.routineName} - [${dateStr}]\n\n`;
      md += `⚖️ Peso: ${session.bodyWeight || 'N/A'} kg | ⏱️ Duração: ${session.durationMinutes} min | 🔥 sRPE: ${session.sRpe}\n\n`;

      exercisesMap.forEach((data) => {
        const { sets: setsList, target } = data;

        // Ordenar sets
        setsList.sort((a, b) => a.setNumber - b.setNumber);

        // Formatar cada set
        const setsStr = setsList.map(s => {
          let coreStr = "";
          if (s.durationSeconds) {
            coreStr = `${s.durationSeconds}s`;
            if (s.weightKg > 0) coreStr += `x${s.weightKg}kg`;
          } else {
            coreStr = `${s.reps}x${s.weightKg}kg`;
          }
          return `S${s.setNumber}: ${coreStr}${s.rir !== null ? `xRIR${s.rir}` : ''}`;
        }).join(" | ");

        // Header com Meta
        const header = target ? `[${data.name}] (Meta: ${target})` : `[${data.name}]`;

        md += `${header}: ${setsStr}\n`;
      });

      if (session.notes) {
        md += `\n📝 Observações: ${session.notes}`;
      }

      setReport(md);

    } catch (e) {
      logger.error('Erro inesperado', e);
      setReport(t('summary.reportError'));
    }
  }, [sessionId]);

  useEffect(() => {
    generateMarkdown();
  }, [generateMarkdown]);

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(report);
    setCopied(true);
    setShowToast(true);
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  };

  const nativeShare = async () => {
    try {
      await Share.share({
        message: report,
        title: `Treino ${sessionData?.routineName || 'Iron Log'}`,
      });
    } catch (error) {
      logger.error('Erro inesperado', error);
    }
  };

  const handleExportSessionCsv = async () => {
    try {
      const csv = await CsvExportService.exportSessionCsv(sessionId);
      const Sharing = await import('expo-sharing');
      if (csv && await Sharing.isAvailableAsync()) {
        const fs = await import('expo-file-system/legacy');
        const path = fs.cacheDirectory + `ironlog_session_${sessionId}.csv`;
        await fs.writeAsStringAsync(path, csv);
        await Sharing.shareAsync(path, {
          dialogTitle: t('summary.exportSessionCsv'),
          mimeType: 'text/csv',
        });
      }
    } catch (e) {
      logger.error('Failed to export session CSV', e);
    }
  };

  const handleExportNotionMd = async () => {
    try {
      const { NotionExportService } = await import('@/services/NotionExportService');
      const md = await NotionExportService.exportSessionMarkdown(sessionId);
      if (md) {
        await Clipboard.setStringAsync(md);
        setCopied(true);
        setShowToast(true);
      }
    } catch (e) {
      logger.error('Failed to export Notion MD', e);
    }
  };

  const goHome = () => {
    router.replace('/');
  };

  const getMotivationalMessage = useCallback(() => {
    const srpe = sessionData?.sRpe || 7;
    if (srpe <= 4) return t('summary.greatLightWorkout');
    if (srpe <= 6) return t('summary.consistentWorkout');
    if (srpe <= 8) return t('summary.hardWork');
    return t("summary.herculeanEffort");
  }, [sessionData]);

  return (
    <View className="flex-1 bg-background">
      <ScrollView contentContainerClassName="p-5">
        {/* Header */}
        <View className="items-center mb-6 pt-5">
          <Text className="text-6xl">🎉</Text>
          <Text className="text-text text-3xl font-bold mt-2">{t("summary.workoutComplete")}</Text>
          <Text className="text-primary text-base font-semibold mt-1">{getMotivationalMessage()}</Text>
        </View>

        {/* Stats Dashboard */}
        <View className="flex-row flex-wrap gap-3 mb-5">
          <Card className="flex-1 min-w-[45%] items-center py-5">
            <Text className="text-text text-4xl font-bold">{stats.totalSets}</Text>
            <Text className="text-subtext text-xs font-semibold mt-1 uppercase">{t("common.sets")}</Text>
          </Card>

          <Card className="flex-1 min-w-[45%] items-center py-5">
            <Text className="text-text text-4xl font-bold">
              {stats.totalVolume >= 1000
                ? `${(stats.totalVolume / 1000).toFixed(1)}k`
                : stats.totalVolume}
            </Text>
            <Text className="text-subtext text-xs font-semibold mt-1 uppercase">{t('summary.volume')}</Text>
          </Card>

          <Card className="flex-1 min-w-[45%] items-center py-5">
            <Text className="text-text text-4xl font-bold">{sessionData?.sRpe || '-'}</Text>
            <Text className="text-subtext text-xs font-semibold mt-1 uppercase">sRPE</Text>
          </Card>

          <Card className="flex-1 min-w-[45%] items-center py-5">
            <Text className="text-text text-4xl font-bold">{sessionData?.durationMinutes || 0}</Text>
            <Text className="text-subtext text-xs font-semibold mt-1 uppercase">{t('summary.minutes')}</Text>
          </Card>
        </View>

        {/* Best Performance */}
        {stats.bestSet && (
          <Card className="items-center p-4 mb-5 bg-accent/10 border-accent">
            <Text className="text-subtext text-xs font-bold uppercase mb-2">🏆 {t('summary.bestSet')}</Text>
            <Text className="text-text text-2xl font-bold">
              {stats.bestSet.weight}kg × {stats.bestSet.reps} reps
            </Text>
            <Text className="text-primary text-sm font-medium mt-1">{stats.bestSet.exercise}</Text>
          </Card>
        )}

        {/* Markdown Report */}
        <Card className="mb-5">
          <Text className="text-text text-sm font-semibold mb-3">📄 Relatório Completo</Text>
          <View className="bg-background rounded-xl p-3 border border-border">
            <Text className="text-text text-xs leading-5 font-mono select-text" numberOfLines={20}>
              {report}
            </Text>
          </View>
        </Card>

        {/* Action Buttons */}
        <View className="gap-3">
          <Button
            title={copied ? '✓ Copiado' : '📋 Copiar Texto'}
            onPress={copyToClipboard}
            variant="primary"
            size="lg"
            fullWidth
          />

          <Button
            title="📤 Compartilhar"
            onPress={nativeShare}
            variant="secondary"
            size="lg"
            fullWidth
          />

          <Button
            title="📊 Exportar CSV"
            onPress={handleExportSessionCsv}
            variant="ghost"
            size="lg"
            fullWidth
          />

          <Button
            title={t('reports.copyNotionSession')}
            onPress={handleExportNotionMd}
            variant="ghost"
            size="lg"
            fullWidth
          />

          {/* Post-Workout Actions */}
          <Card className="bg-card/50 border-dashed border-2 mt-4">
            <Text className="text-subtext text-xs font-bold uppercase mb-3 text-center">{t("summary.nextSteps")}</Text>
            <View className="flex-row gap-2">
              <Button
                title={t('summary.newWorkout')}
                onPress={() => router.push('/routines')}
                variant="success"
                size="md"
                style={{ flex: 1 }}
              />
              <Button
                title={t('common.back')}
                onPress={goHome}
                variant="ghost"
                size="md"
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </View>
      </ScrollView>

      <Toast
        visible={showToast}
        message={t("summary.reportCopied")}
        type="success"
        onHide={() => setShowToast(false)}
      />
    </View>
  );
}

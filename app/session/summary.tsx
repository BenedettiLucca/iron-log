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
import { and, eq, isNull } from 'drizzle-orm';
import * as Clipboard from 'expo-clipboard';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Toast } from '../../components/Toast';
import { LoadingState, ErrorState } from '../../components/ScreenState';
import { logger } from '@/services/logger';
import { Session } from '@/src/types';
import { safeParseParams, summaryParamsSchema } from '@/src/validators/routes';
import { CsvExportService } from '../../services/CsvExportService';
import { useI18n, getLocaleForLanguage } from '../../src/i18n/index';
import { buildSessionSummary, type SessionStats } from '@/src/utils/session-summary';
import { resolveScreenState } from '@/src/utils/screen-state';

export default function SummaryScreen() {
  const { t, language } = useI18n();
  const router = useRouter();
  const rawParams = useLocalSearchParams();
  const validated = safeParseParams(summaryParamsSchema, rawParams, 'SummaryScreen');
  const sessionId = validated?.sessionId ?? 0;
  const [report, setReport] = useState('');
  const [sessionData, setSessionData] = useState<Session | null>(null);
  const [stats, setStats] = useState<SessionStats>({
    totalSets: 0,
    totalVolume: 0,
    bestSet: null,
    averageIntensity: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const generateMarkdown = useCallback(async () => {
    try {
      setIsLoading(true);
      setHasError(false);
      // 1. Buscar Sessão
      const sessionDataResult = await db.select().from(sessionsTable).where(eq(sessionsTable.id, Number(sessionId)));
      if (!sessionDataResult.length) {
        setHasError(true);
        setErrorMessage(t('states.noData'));
        return;
      }
      const session = sessionDataResult[0];
      setSessionData(session);

      // 2. Buscar Sets ativos (soft-deleted sets ficam fora do summary e export)
      const setsData = await db.select()
        .from(sets)
        .where(and(eq(sets.sessionId, Number(sessionId)), isNull(sets.deletedAt)));

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

      const summary = buildSessionSummary({
        session,
        setsData,
        targetsMap,
        t,
        locale: getLocaleForLanguage(language),
      });

      setStats(summary.stats);
      setReport(summary.report);

    } catch (e) {
      logger.error('Erro ao gerar relatório', e);
      setHasError(true);
      setErrorMessage(t('states.errorBody'));
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, t, language]);

  useEffect(() => {
    generateMarkdown();
  }, [generateMarkdown]);

  const copyToClipboard = async () => {
    await Clipboard.setStringAsync(report);
    setCopied(true);
    setToastMessage(t('summary.reportCopied'));
    setShowToast(true);
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  };

  const nativeShare = async () => {
    try {
      await Share.share({
        message: report,
        title: t('summary.workoutShareTitle', { name: sessionData?.routineName || 'Iron Log' }),
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
      const md = await NotionExportService.exportSessionMarkdown(sessionId, t);
      if (md) {
        await Clipboard.setStringAsync(md);
        setToastMessage(t('reports.copied'));
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
  }, [sessionData, t]);

  const { status } = resolveScreenState({
    isLoading,
    hasError,
    hasContent: !!sessionData,
    errorMessage
  });

  if (status === 'loading') {
    return <LoadingState title={t('summary.generatingReport')} />;
  }

  if (status === 'error') {
    return <ErrorState message={errorMessage} onRetry={generateMarkdown} />;
  }

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
          <Text className="text-text text-sm font-semibold mb-3">📄 {t('summary.fullReport')}</Text>
          <View className="bg-background rounded-xl p-3 border border-border">
            <Text className="text-text text-xs leading-5 font-mono select-text" numberOfLines={20}>
              {report}
            </Text>
          </View>
        </Card>

        {/* Action Buttons */}
        <View className="gap-3">
          <Button
            title={copied ? t('summary.copied') : t('summary.copyText')}
            onPress={copyToClipboard}
            variant="primary"
            size="lg"
            fullWidth
          />

          <Button
            title={t('summary.share')}
            onPress={nativeShare}
            variant="secondary"
            size="lg"
            fullWidth
          />

          <Button
            title={t('summary.exportCsv')}
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
        message={toastMessage || t("summary.reportCopied")}
        type="success"
        onHide={() => setShowToast(false)}
      />
    </View>
  );
}

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
import { SectionHeader } from '../../components/SectionHeader';
import { StatTile } from '../../components/StatTile';
import { Toast } from '../../components/Toast';
import { LoadingState, ErrorState } from '../../components/ScreenState';
import { logger } from '@/services/logger';
import { Session } from '@/src/types';
import { safeParseParams, summaryParamsSchema } from '@/src/validators/routes';
import { CsvExportService } from '../../services/CsvExportService';
import { useI18n, getLocaleForLanguage } from '../../src/i18n/index';
import { buildSessionSummary, type SessionStats } from '@/src/utils/session-summary';
import { resolveScreenState } from '@/src/utils/screen-state';
import { generateSessionVerdicts, type ExerciseVerdict } from '@/src/utils/session-verdicts';

export default function SummaryScreen() {
  const { t, language } = useI18n();
  const router = useRouter();
  const rawParams = useLocalSearchParams();
  const validated = safeParseParams(summaryParamsSchema, rawParams, 'SummaryScreen');
  const sessionId = validated?.sessionId ?? 0;
  const [report, setReport] = useState('');
  const [sessionData, setSessionData] = useState<Session | null>(null);
  const [verdicts, setVerdicts] = useState<ExerciseVerdict[]>([]);
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

      // Compute and set verdicts
      const computedVerdicts = generateSessionVerdicts(setsData, targetsMap, t);
      setVerdicts(computedVerdicts);

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
        {/* Summary Header Card */}
        <Card className="mb-5 items-center">
          <Text className="text-6xl mb-2">🎉</Text>
          <Text className="text-text text-3xl font-bold">{t("summary.workoutComplete")}</Text>
          <Text className="text-primary text-base font-semibold mt-1 mb-4">{getMotivationalMessage()}</Text>
          
          <View className="border-t border-border/50 pt-4 w-full items-center">
            <Text className="text-text text-xl font-extrabold text-center mb-1">
              {sessionData?.routineName}
            </Text>
            <Text className="text-subtext text-xs text-center font-medium">
              {sessionData?.startTime ? new Date(sessionData.startTime).toLocaleDateString(getLocaleForLanguage(language)) : ''}
              {sessionData?.durationMinutes ? ` • ${sessionData.durationMinutes} min` : ''}
            </Text>
          </View>
        </Card>

        {/* Stats Grid */}
        <View className="flex-row flex-wrap gap-3 mb-5">
          <StatTile
            value={stats.totalSets}
            label={t("common.sets")}
            accentColor="primary"
            className="flex-1 min-w-[45%]"
          />
          <StatTile
            value={
              stats.totalVolume >= 1000
                ? `${(stats.totalVolume / 1000).toFixed(1)}k`
                : stats.totalVolume
            }
            label={t('summary.volume')}
            accentColor="secondary"
            className="flex-1 min-w-[45%]"
          />
          <StatTile
            value={stats.averageIntensity > 0 ? `${stats.averageIntensity.toFixed(1)} kg` : '-'}
            label={t('analytics.intensity')}
            accentColor="success"
            className="flex-1 min-w-[45%]"
          />
          <StatTile
            value={stats.bestSet ? `${stats.bestSet.weight}kg × ${stats.bestSet.reps}` : '-'}
            label={t('summary.bestSet')}
            accentColor="warning"
            delta={stats.bestSet?.exercise || undefined}
            className="flex-1 min-w-[45%]"
          />
        </View>

        {/* Coaching Verdicts */}
        {verdicts.length > 0 && (
          <View className="mb-5">
            <SectionHeader label="Análise por Exercício" className="mb-3 pl-0" />
            {verdicts.map((v) => {
              const targetStr = v.targetRange
                ? `${v.targetRange.sets}x${v.targetRange.minReps === v.targetRange.maxReps ? v.targetRange.minReps : `${v.targetRange.minReps}-${v.targetRange.maxReps}`}`
                : '-';
              const actualStr = v.workingSets.map(s => `${s.weightKg}kg x ${s.reps}`).join(', ');

              const getBadgeStyles = (verdict: typeof v) => {
                if (verdict.verdict === 'increase') {
                  return {
                    bgClass: 'bg-primary/10',
                    textClass: 'text-primary',
                    label: t('summary.verdicts.verdictIncrease')
                  };
                } else if (verdict.verdict === 'review_fatigue' || verdict.result === 'below') {
                  return {
                    bgClass: 'bg-warning/10',
                    textClass: 'text-warning',
                    label: verdict.verdict === 'review_fatigue' ? t('summary.verdicts.verdictReviewFatigue') : t('summary.verdicts.resultBelow')
                  };
                } else {
                  return {
                    bgClass: 'bg-success/10',
                    textClass: 'text-success',
                    label: verdict.result === 'no_target' ? t('summary.verdicts.resultNoTarget') : t('summary.verdicts.verdictHold')
                  };
                }
              };

              const { bgClass, textClass, label: badgeLabel } = getBadgeStyles(v);

              return (
                <Card key={v.exerciseId} className="mb-3">
                  <View className="flex-row justify-between items-center mb-1">
                    <Text className="text-text font-bold text-base flex-1 mr-2">{v.exerciseName}</Text>
                    <View className={`px-2.5 py-1 rounded-full ${bgClass}`}>
                      <Text className={`text-xs font-bold ${textClass}`}>{badgeLabel}</Text>
                    </View>
                  </View>

                  <Text className="text-xs text-subtext mt-1">
                    Meta: {targetStr} • Feito: {actualStr}
                  </Text>

                  {v.nextLoadSuggestion && (
                    <Text className="text-subtext text-xs mt-1.5 font-medium">
                      🎯 {t('summary.verdicts.nextLoad')}: <Text className="text-text font-semibold">{v.nextLoadSuggestion}</Text>
                    </Text>
                  )}

                  {v.flags.length > 0 && (
                    <View className="flex-row flex-wrap gap-1 mt-2">
                      {v.flags.map((flag) => {
                        let flagText = flag;
                        if (flag === 'rir_inversion') flagText = t('summary.verdicts.flagRirInversion');
                        else if (flag === 'abrupt_rep_drop') flagText = t('summary.verdicts.flagAbruptRepDrop');
                        else if (flag === 'extra_sets') flagText = t('summary.verdicts.flagExtraSets');
                        else if (flag === 'repeated_below_range') flagText = t('summary.verdicts.flagRepeatedBelowRange');
                        return (
                          <View key={flag} className="bg-danger/10 border border-danger/20 rounded px-1.5 py-0.5">
                            <Text className="text-[10px] text-danger font-semibold">⚠️ {flagText}</Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </Card>
              );
            })}
          </View>
        )}

        {/* Report Preview */}
        <Card className="mb-5">
          <SectionHeader label={t('summary.fullReport')} className="mb-3 pl-0" />
          <View className="bg-primary/3 rounded-xl p-3 border border-border">
            <Text className="text-text text-xs font-mono select-text leading-5" numberOfLines={20}>
              {report}
            </Text>
          </View>
        </Card>

        {/* Action Buttons */}
        <View className="gap-3">
          <Button
            title={copied ? t('summary.copied') : t('summary.copyText')}
            onPress={copyToClipboard}
            variant="secondary"
            size="lg"
            fullWidth
          />

          <Button
            title={t('summary.share')}
            onPress={nativeShare}
            variant="primary"
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

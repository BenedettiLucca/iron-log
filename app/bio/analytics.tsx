import { View, Text, ScrollView, RefreshControl, useWindowDimensions, useColorScheme } from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnalyticsService } from '../../services/AnalyticsService';
import type { DashboardAnalytics } from '../../services/AnalyticsService';
import { Card } from '../../components/Card';
import { SkeletonList, SkeletonCard } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ScreenState';
import { logger } from '@/services/logger';
import { getThemeColors } from '@/constants/colors';
import { getLocaleForLanguage, useI18n } from '../../src/i18n/index';
import { db } from '../../src/db/client';
import { sessions, sets, personalRecords, bodyMetrics } from '../../src/db/schema';
import { asc, isNull } from 'drizzle-orm';
import { SectionHeader } from '../../components/SectionHeader';
import { LineChart } from 'react-native-gifted-charts';
import { ProgressBar } from '../../components/ProgressBar';
import { ChartXAxisLabels } from '../../components/ChartXAxisLabels';
import {
  getMetricTrend,
  getPercentageTrend,
  isDisplayableBodyMetricValue,
} from '../../src/utils/body-metrics';
import type { MetricTrend } from '../../src/utils/body-metrics';
import {
  getChartViewportWidth,
} from '../../src/utils/chart-layout';
import {
  bucketChartSeries,
  buildPositionedChartSeries,
  getChartYAxisScale,
} from '../../src/utils/chart-periods';
import type { ChartPeriod } from '../../src/utils/chart-periods';
import { formatCompactKilograms } from '../../src/utils/formatters';
import { SegmentedControl } from '../../components/SegmentedControl';

const getMuscleGroup = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('supino') || n.includes('press') || n.includes('peito') || n.includes('chest')) return 'chest';
  if (n.includes('puxada') || n.includes('terra') || n.includes('remada') || n.includes('back') || n.includes('row') || n.includes('deadlift') || n.includes('pull')) return 'back';
  if (n.includes('agachamento') || n.includes('leg') || n.includes('squat') || n.includes('thigh') || n.includes('calf') || n.includes('panturrilha') || n.includes('perna')) return 'legs';
  if (n.includes('desenvolvimento') || n.includes('militar') || n.includes('shoulder') || n.includes('ombro') || n.includes('elevação lateral')) return 'shoulders';
  if (n.includes('rosca') || n.includes('tríceps') || n.includes('bíceps') || n.includes('arm') || n.includes('braço')) return 'arms';
  return 'other';
};

interface KeyStats {
  recentVolume: number;
  recentSessionsCount: number;
  recentAvgRpe: number | null;
  recentAvgDur: number | null;
  recentPRsCount: number;
  prevVolume: number;
  prevAvgRpe: number | null;
  prevAvgDur: number | null;
  prevPRsCount: number;
}

export default function AnalyticsScreen() {
  const { t, language } = useI18n();
  const { width: screenWidth } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const theme = getThemeColors(colorScheme);
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [keyStats, setKeyStats] = useState<KeyStats>({
    recentVolume: 0,
    recentSessionsCount: 0,
    recentAvgRpe: null,
    recentAvgDur: null,
    recentPRsCount: 0,
    prevVolume: 0,
    prevAvgRpe: null,
    prevAvgDur: null,
    prevPRsCount: 0
  });

  const [volDist, setVolDist] = useState<Record<string, number>>({
    chest: 0,
    back: 0,
    legs: 0,
    shoulders: 0,
    arms: 0,
    other: 0,
  });

  const [weightData, setWeightData] = useState<{ timestamp: number; value: number }[]>([]);
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('month');

  const getMuscleGroupLabel = (group: string) => {
    return t(`muscleGroup.${group}`);
  };

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const analytics = await AnalyticsService.getFullAnalytics();

      // Fetch key stats and volume distribution and weight metrics
      const nowMs = Date.now();
      const thirtyDaysAgoMs = nowMs - 30 * 24 * 60 * 60 * 1000;
      const sixtyDaysAgoMs = nowMs - 60 * 24 * 60 * 60 * 1000;

      const [allSessions, allSets, allPRsList, weights] = await Promise.all([
        db.select().from(sessions).where(isNull(sessions.deletedAt)),
        db.select().from(sets).where(isNull(sets.deletedAt)),
        db.select().from(personalRecords),
        db.select().from(bodyMetrics).orderBy(asc(bodyMetrics.date))
      ]);

      const recentSessions = allSessions.filter(s => s.startTime >= thirtyDaysAgoMs);
      const prevSessions = allSessions.filter(s => s.startTime >= sixtyDaysAgoMs && s.startTime < thirtyDaysAgoMs);

      // Volume
      const recentSessionIds = new Set(recentSessions.map(s => s.id));
      const prevSessionIds = new Set(prevSessions.map(s => s.id));

      const recentVolume = allSets
        .filter(set => recentSessionIds.has(set.sessionId) && !set.isWarmup)
        .reduce((sum, set) => sum + (set.weightKg * set.reps), 0);

      const prevVolume = allSets
        .filter(set => prevSessionIds.has(set.sessionId) && !set.isWarmup)
        .reduce((sum, set) => sum + (set.weightKg * set.reps), 0);

      // sRPE
      const recentRpeSessions = recentSessions.filter(s => s.sRpe && s.sRpe > 0);
      const prevRpeSessions = prevSessions.filter(s => s.sRpe && s.sRpe > 0);

      const recentAvgRpe = recentRpeSessions.length > 0
        ? recentRpeSessions.reduce((sum, s) => sum + s.sRpe!, 0) / recentRpeSessions.length
        : null;
      const prevAvgRpe = prevRpeSessions.length > 0
        ? prevRpeSessions.reduce((sum, s) => sum + s.sRpe!, 0) / prevRpeSessions.length
        : null;

      // Duration
      const recentDurSessions = recentSessions.filter(s => s.durationMinutes && s.durationMinutes > 0);
      const prevDurSessions = prevSessions.filter(s => s.durationMinutes && s.durationMinutes > 0);

      const recentAvgDur = recentDurSessions.length > 0
        ? recentDurSessions.reduce((sum, s) => sum + s.durationMinutes!, 0) / recentDurSessions.length
        : null;
      const prevAvgDur = prevDurSessions.length > 0
        ? prevDurSessions.reduce((sum, s) => sum + s.durationMinutes!, 0) / prevDurSessions.length
        : null;

      // PRs
      const recentPRsCount = allPRsList.filter(pr => pr.date >= thirtyDaysAgoMs).length;
      const prevPRsCount = allPRsList.filter(pr => pr.date >= sixtyDaysAgoMs && pr.date < thirtyDaysAgoMs).length;

      // Volume distribution
      const muscleGroupVolume: Record<string, number> = {
        chest: 0,
        back: 0,
        legs: 0,
        shoulders: 0,
        arms: 0,
        other: 0,
      };

      allSets
        .filter(set => recentSessionIds.has(set.sessionId) && !set.isWarmup)
        .forEach(set => {
          const group = getMuscleGroup(set.exerciseName || '');
          if (group in muscleGroupVolume) {
            muscleGroupVolume[group] += set.weightKg * set.reps;
          }
        });

      // Keep the complete valid history; the selected calendar period is applied at render time.
      const chartWeights = weights
        .filter(metric => isDisplayableBodyMetricValue(metric.weight) && metric.weight > 0)
        .map(point => ({
          timestamp: point.date,
          value: point.weight!,
        }));

      setKeyStats({
        recentVolume,
        recentSessionsCount: recentSessions.length,
        recentAvgRpe,
        recentAvgDur,
        recentPRsCount,
        prevVolume,
        prevAvgRpe,
        prevAvgDur,
        prevPRsCount,
      });

      setVolDist(muscleGroupVolume);
      setWeightData(chartWeights);
      setData(analytics);
      setHasError(false);

    } catch (e) {
      logger.error('Failed to load analytics', e);
      setHasError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  }, [loadAnalytics]);

  const weightViewportWidth = getChartViewportWidth(screenWidth);
  const weightChart = useMemo(() => {
    const locale = getLocaleForLanguage(language);
    const buckets = bucketChartSeries(
      weightData,
      chartPeriod,
      Date.now(),
      weightViewportWidth,
      'latest',
    );
    const positioned = buildPositionedChartSeries(buckets, chartPeriod, locale, weightViewportWidth);
    const values = positioned.data.map(point => point.value);

    return {
      data: positioned.data,
      axisLabels: positioned.axisLabels,
      slotSpacing: positioned.slotSpacing,
      populatedCount: positioned.data.length,
      scale: getChartYAxisScale(values),
      initialSpacing: positioned.initialSpacing,
      endSpacing: positioned.endSpacing,
    };
  }, [chartPeriod, language, weightData, weightViewportWidth]);

  const chartPeriodSegments = [
    { key: 'week', label: t('chartPeriods.week') },
    { key: 'month', label: t('chartPeriods.month') },
    { key: 'year', label: t('chartPeriods.year') },
  ];

  if (loading && !data) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, gap: 16 }}>
        <SkeletonCard>
          <View className="items-center py-4" />
        </SkeletonCard>
        <View className="flex-row gap-3">
          <SkeletonCard className="flex-1 py-4" />
          <SkeletonCard className="flex-1 py-4" />
          <SkeletonCard className="flex-1 py-4" />
        </View>
        <SkeletonList count={3} />
      </ScrollView>
    );
  }

  if (!loading && hasError && !data) {
    return (
      <View className="flex-1 bg-background">
        <ErrorState
          onRetry={loadAnalytics}
        />
      </View>
    );
  }

  if (!data) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState
          icon="📊"
          title={t("bioAnalytics.insufficientData")}
          description={t("bioAnalytics.emptyDesc")}
        />
      </View>
    );
  }

  if (data.strengthScore.labelKey === 'error') {
    return (
      <View className="flex-1 bg-background">
        <ErrorState onRetry={loadAnalytics} />
      </View>
    );
  }

  const { strengthScore, consistency, volumeTrends, topExercises, estimated1RM } = data;

  if (consistency.totalSessions === 0 && weightData.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <EmptyState
          icon="📊"
          title={t('bioAnalytics.insufficientData')}
          description={t('bioAnalytics.emptyDesc')}
        />
      </View>
    );
  }

  const volTrend = getPercentageTrend(keyStats.recentVolume, keyStats.prevVolume, 0.05);
  const rpeTrend = getMetricTrend(keyStats.recentAvgRpe, keyStats.prevAvgRpe, 0.05);
  const durTrend = getMetricTrend(keyStats.recentAvgDur, keyStats.prevAvgDur, 0.5);
  const prsTrend = getMetricTrend(keyStats.recentPRsCount, keyStats.prevPRsCount, 0.5);

  const formatTrendText = (trend: MetricTrend, unit = '', decimals = 1) => {
    if (trend.direction === 'unavailable') {
      return t('bioAnalytics.noComparison');
    }
    if (trend.direction === 'stable') {
      return `• ${t('bioAnalytics.stable')}`;
    }
    const sign = trend.direction === 'up' ? '↑' : '↓';
    const deltaValue = Math.abs(trend.delta ?? 0).toFixed(decimals);
    return `${sign} ${deltaValue}${unit}`;
  };

  const getTrendColorClass = (trend: MetricTrend, hasPositiveDirection: boolean) => {
    if (!hasPositiveDirection || trend.direction === 'unavailable' || trend.direction === 'stable') {
      return 'text-subtext';
    }
    return trend.direction === 'up' ? 'text-successText' : 'text-dangerText';
  };

  const insights = [];
  if (volTrend.direction === 'up') {
    insights.push({
      type: 'success',
      title: t('bioAnalytics.insightVolumeUpTitle'),
      description: t('bioAnalytics.insightVolumeUpDesc', { value: Math.abs(volTrend.delta ?? 0).toFixed(0) }),
      icon: '📈'
    });
  } else if (volTrend.direction === 'down') {
    insights.push({
      type: 'info',
      title: t('bioAnalytics.insightVolumeDownTitle'),
      description: t('bioAnalytics.insightVolumeDownDesc', { value: Math.abs(volTrend.delta ?? 0).toFixed(0) }),
      icon: '🔄'
    });
  } else if (volTrend.direction === 'stable') {
    insights.push({
      type: 'info',
      title: t('bioAnalytics.insightVolumeStableTitle'),
      description: t('bioAnalytics.insightVolumeStableDesc'),
      icon: '➡️'
    });
  } else {
    insights.push({
      type: 'info',
      title: t('bioAnalytics.noComparison'),
      description: t('bioAnalytics.insightVolumeUnavailableDesc'),
      icon: 'ℹ️'
    });
  }

  insights.push({
    type: 'info',
    title: t('bioAnalytics.insightFrequencyTitle'),
    description: t('bioAnalytics.insightFrequencyDesc', { value: consistency.weeklyFrequency }),
    icon: '⏱️'
  });

  const chartScale = weightChart.scale;
  const weightChartValues = weightChart.data.map(point => point.value);
  const weightChartInitial = weightChartValues[0] ?? 0;
  const weightChartCurrent = weightChartValues[weightChartValues.length - 1] ?? 0;
  const weightChartDelta = weightChartCurrent - weightChartInitial;
  const weightChartPeriodLabel = chartPeriodSegments.find(segment => segment.key === chartPeriod)?.label ?? '';
  const weightChartAccessibilityLabel = [
    t('bioAnalytics.bodyWeight'),
    weightChartPeriodLabel,
    `${t('bioEvolution.current')}: ${weightChartCurrent.toFixed(1)} kg`,
    `${t('bioEvolution.delta')}: ${weightChartDelta >= 0 ? '+' : ''}${weightChartDelta.toFixed(1)} kg`,
  ].join('. ');
  const hasWeeklyVolume = volumeTrends.some(week => week.totalVolume > 0);
  const hasVolumeDistribution = Object.values(volDist).some(value => value > 0);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primaryText} />
      }
    >
      {hasError && data && (
        <View
          className="bg-dangerSurface border border-dangerText/30 rounded-xl px-4 py-3"
          accessibilityLiveRegion="polite"
        >
          <Text className="text-dangerText text-sm">{t('states.errorBody')}</Text>
        </View>
      )}

      {/* Sessions Count Card */}
      <Card className="items-center py-6">
        <Text className="text-4xl font-extrabold text-primaryText">{keyStats.recentSessionsCount}</Text>
        <Text className="text-xs font-bold text-subtext mt-1">
          {t('bioAnalytics.sessionCount30d')}
        </Text>

        <View className="w-full mt-4 border-t border-border/50">
          {[
            {
              key: 'volume',
              label: `${t('bioAnalytics.volume')} · ${t('bioAnalytics.period30d')}`,
              value: formatCompactKilograms(keyStats.recentVolume),
              trend: volTrend,
              unit: '%',
              decimals: 1,
              hasPositiveDirection: true,
            },
            {
              key: 'srpe',
              label: `${t('bioAnalytics.avgSrpe')} · ${t('bioAnalytics.period30d')}`,
              value: keyStats.recentAvgRpe !== null ? keyStats.recentAvgRpe.toFixed(1) : '—',
              trend: rpeTrend,
              unit: '',
              decimals: 1,
              hasPositiveDirection: false,
            },
            {
              key: 'duration',
              label: `${t('bioAnalytics.avgDuration')} · ${t('bioAnalytics.period30d')}`,
              value: keyStats.recentAvgDur !== null ? `${keyStats.recentAvgDur.toFixed(0)} min` : '—',
              trend: durTrend,
              unit: ' min',
              decimals: 0,
              hasPositiveDirection: false,
            },
            {
              key: 'prs',
              label: `${t('bioAnalytics.personalRecords')} · ${t('bioAnalytics.period30d')}`,
              value: `${keyStats.recentPRsCount}`,
              trend: prsTrend,
              unit: '',
              decimals: 0,
              hasPositiveDirection: true,
            },
          ].map((item, index) => (
            <View
              key={item.key}
              className={`py-3 px-4 gap-1 ${index > 0 ? 'border-t border-border/50' : ''}`}
            >
              <View className="flex-row justify-between items-start gap-3">
                <Text className="text-sm text-subtext flex-1 min-w-0">{item.label}</Text>
                <Text className="text-sm font-bold text-text flex-shrink-0">{item.value}</Text>
              </View>
              <Text className={`text-xs text-right self-end ${getTrendColorClass(item.trend, item.hasPositiveDirection)}`}>
                {formatTrendText(item.trend, item.unit, item.decimals)}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Volume weekly bar chart card */}
      <Card>
        <View className="mb-3">
          <SectionHeader label={t('bioAnalytics.weeklyVolumeTitleLabel')} />
          <Text className="text-xs text-subtext pl-1 mt-1">
            {t('bioAnalytics.period12Weeks')}
          </Text>
        </View>
        {!hasWeeklyVolume ? (
          <View className="items-center py-6">
            <Text className="text-subtext text-xs">{t('bioAnalytics.noWeeklyVolume')}</Text>
          </View>
        ) : (
          <View className="gap-1">
            {(() => {
              const visibleVolumeTrends = volumeTrends.slice(-12);
              const maxVolume = Math.max(...visibleVolumeTrends.map(week => week.totalVolume), 1);
              return visibleVolumeTrends.map((week) => {
                const barWidth = (week.totalVolume / maxVolume) * 100;
                const visibleBarWidth = week.totalVolume > 0 ? Math.max(barWidth, 2) : 0;
                return (
                  <View key={week.week} className="flex-row items-center gap-2">
                    <Text className="text-subtext text-2xs font-mono w-12">{week.week.slice(-3)}</Text>
                    <View className="flex-1 h-4 bg-border/30 rounded overflow-hidden">
                      <View
                        className="h-full bg-primary/70 rounded"
                        style={{ width: `${visibleBarWidth}%` }}
                      />
                    </View>
                    <Text className="text-subtext text-2xs font-mono w-14 text-right">
                      {formatCompactKilograms(week.totalVolume)}
                    </Text>
                  </View>
                );
              });
            })()}
          </View>
        )}
      </Card>

      {/* Body Weight Chart */}
      <Card>
        <View className="mb-4 gap-3">
          <SectionHeader label={t('bioAnalytics.bodyWeight')} />
          <SegmentedControl
            segments={chartPeriodSegments}
            activeKey={chartPeriod}
            onSelect={key => setChartPeriod(key as ChartPeriod)}
            accessibilityLabel={t('chartPeriods.accessibilityLabel')}
          />
        </View>
        {weightChart.populatedCount < 2 ? (
          <View className="items-center py-6">
            <Text className="text-subtext text-xs">{t('bioAnalytics.weightChartHint')}</Text>
          </View>
        ) : (
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={weightChartAccessibilityLabel}
          >
            <LineChart
              data={weightChart.data}
              color={theme.primaryText}
              thickness={3}
              dataPointsColor={theme.primaryText}
              hideRules={false}
              rulesColor={theme.border}
              rulesThickness={1}
              yAxisColor="transparent"
              yAxisThickness={0}
              xAxisColor={theme.border}
              height={150}
              width={weightViewportWidth}
              disableScroll
              initialSpacing={weightChart.initialSpacing}
              endSpacing={weightChart.endSpacing}
              yAxisOffset={chartScale.yAxisOffset}
              maxValue={chartScale.maxValue}
              noOfSections={4}
              showFractionalValues
              roundToDigits={1}
              yAxisTextStyle={{ color: theme.subtext, fontSize: 10 }}
              xAxisLabelsHeight={0}
              yAxisLabelSuffix=" kg"
              yAxisLabelWidth={48}
            />
            <ChartXAxisLabels
              axisLabels={weightChart.axisLabels}
              slotSpacing={weightChart.slotSpacing}
              viewportWidth={weightViewportWidth}
              yAxisLabelWidth={48}
            />
          </View>
        )}
      </Card>

      {/* Volume Distribution Card */}
      <Card>
        <View className="mb-3">
          <SectionHeader label={t('bioAnalytics.volumeDistribution')} />
          <Text className="text-xs text-subtext pl-1 mt-1">
            {t('bioAnalytics.byMuscleGroup')}
          </Text>
        </View>
        {!hasVolumeDistribution ? (
          <View className="items-center py-6">
            <Text className="text-subtext text-xs">{t('bioAnalytics.noVolumeDistribution')}</Text>
          </View>
        ) : (
          <View className="gap-3 mt-2">
            {Object.keys(volDist).map((group) => {
              const vol = volDist[group];
              const maxVol = Math.max(...Object.values(volDist), 1);
              const barWidth = (vol / maxVol) * 100;
              return (
                <View key={group} className="flex-row items-center gap-3">
                  <Text className="text-xs font-bold text-text w-16">{getMuscleGroupLabel(group)}</Text>
                  <View className="flex-1 bg-border/30 rounded-full h-2.5 overflow-hidden">
                    <View className="bg-primary h-full rounded-full" style={{ width: `${barWidth}%` }} />
                  </View>
                  <Text className="text-xs font-mono text-subtext w-14 text-right">
                    {formatCompactKilograms(vol)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      {/* Insights Card */}
      <Card>
        <SectionHeader label={t('bioAnalytics.insights')} className="mb-3" />
        <View className="mt-2">
          {insights.map((insight, idx, arr) => {
            return (
              <View
                key={idx}
                className={`flex-row gap-3 py-3 items-start ${
                  idx < arr.length - 1 ? 'border-b border-border/50' : ''
                }`}
              >
                <Text className="text-lg mt-0.5">{insight.icon}</Text>
                <View className="flex-1">
                  <Text className="font-bold text-sm mb-1 text-text">{insight.title}</Text>
                  <Text className="text-subtext text-xs leading-5">{insight.description}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Strength Score */}
      <Card>
        <View className="mb-3">
          <SectionHeader label={t("bioAnalytics.strengthScore")} />
        </View>

        {strengthScore.labelKey === 'noData' ? (
          <View className="items-center py-4">
            <Text className="text-subtext text-sm text-center">
              {t("bioAnalytics.insufficientData")}
            </Text>
            <Text className="text-subtext text-xs text-center mt-1">
              {t("bioAnalytics.emptyDesc")}
            </Text>
          </View>
        ) : (
          <View>
            <View className="items-center mb-4">
              <Text className="text-text text-4xl font-black">{strengthScore.totalScore}</Text>
              <Text className="text-primaryText text-lg font-bold mt-1">
                {t('analytics.strengthLevel.' + strengthScore.labelKey)}
              </Text>
            </View>
            <View className="gap-4">
              <View className="gap-1">
                <View className="flex-row justify-between items-center" accessibilityLabel={`${t("bioAnalytics.volume")}: ${strengthScore.volumeScore}/40`}>
                  <Text className="text-subtext text-xs font-bold" aria-hidden>{t("bioAnalytics.volume")}</Text>
                  <Text className="text-text text-xs font-bold" aria-hidden>{strengthScore.volumeScore}/40</Text>
                </View>
                <ProgressBar
                  current={strengthScore.volumeScore}
                  total={40}
                  showLabel={false}
                />
              </View>
              <View className="gap-1">
                <View className="flex-row justify-between items-center" accessibilityLabel={`${t("bioAnalytics.intensity")}: ${strengthScore.intensityScore}/30`}>
                  <Text className="text-subtext text-xs font-bold" aria-hidden>{t("bioAnalytics.intensity")}</Text>
                  <Text className="text-text text-xs font-bold" aria-hidden>{strengthScore.intensityScore}/30</Text>
                </View>
                <ProgressBar
                  current={strengthScore.intensityScore}
                  total={30}
                  showLabel={false}
                />
              </View>
              <View className="gap-1">
                <View className="flex-row justify-between items-center" accessibilityLabel={`${t("bioAnalytics.consistency")}: ${strengthScore.consistencyScore}/30`}>
                  <Text className="text-subtext text-xs font-bold" aria-hidden>{t("bioAnalytics.consistency")}</Text>
                  <Text className="text-text text-xs font-bold" aria-hidden>{strengthScore.consistencyScore}/30</Text>
                </View>
                <ProgressBar
                  current={strengthScore.consistencyScore}
                  total={30}
                  showLabel={false}
                />
              </View>
            </View>
          </View>
        )}
      </Card>

      {/* Top Exercise Progressions */}
      {topExercises.length > 0 && (
        <Card>
          <View className="mb-3">
            <SectionHeader label={t('bioAnalytics.topExercisesLabel')} />
          </View>
          <View className="gap-3">
            {topExercises.map(ex => {
              const isNew = ex.progress === null;
              return (
                <View key={ex.exerciseId} className="flex-row justify-between items-start gap-3">
                  <View className="flex-1 min-w-0">
                    <Text className="text-text text-sm font-bold">{ex.exerciseName}</Text>
                    <Text className="text-subtext text-xs">
                      {isNew
                        ? `${ex.currentMaxWeight}kg · ${t('bioAnalytics.newExercise')}`
                        : `${ex.currentMaxWeight}kg (${t('bioAnalytics.previousValue', { value: `${ex.previousMaxWeight}kg` })})`}
                    </Text>
                  </View>
                  <View className={`max-w-[55%] px-2 py-1 rounded ${isNew ? 'bg-background border border-border' : ex.progress! > 0 ? 'bg-successSurface' : ex.progress! < 0 ? 'bg-dangerSurface' : 'bg-background border border-border'}`}>
                    <Text className={`text-xs font-bold text-right ${isNew ? 'text-subtext' : ex.progress! > 0 ? 'text-successText' : ex.progress! < 0 ? 'text-dangerText' : 'text-subtext'}`}>
                      {isNew ? t('bioAnalytics.noComparison') : `${ex.progress! > 0 ? '+' : ''}${ex.progress!}%`}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      )}

      {/* Estimated 1RM */}
      {estimated1RM.length > 0 && (
        <Card>
          <View className="mb-3">
            <SectionHeader label={t('bioAnalytics.estimated1RMLabel')} />
          </View>
          <View className="gap-2">
            {estimated1RM.slice(0, 8).map(item => (
              <View key={item.exercise} className="flex-row justify-between items-start gap-3">
                <Text className="text-text text-sm flex-1 min-w-0">{item.exercise}</Text>
                <Text className="text-text text-sm font-bold flex-shrink-0">{item.estimated1RM}kg</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      <View className="h-8" />
    </ScrollView>
  );
}

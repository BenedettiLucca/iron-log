import { View, Text, ScrollView, RefreshControl, useWindowDimensions, useColorScheme } from 'react-native';
import { Stack } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { AnalyticsService } from '../../services/AnalyticsService';
import type { DashboardAnalytics } from '../../services/AnalyticsService';
import { Card } from '../../components/Card';
import { SkeletonList, SkeletonCard } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ScreenState';
import { logger } from '@/services/logger';
import { Colors, getThemeColors } from '@/constants/colors';
import { useI18n } from '../../src/i18n/index';
import { db } from '../../src/db/client';
import { sessions, sets, personalRecords, bodyMetrics } from '../../src/db/schema';
import { asc, isNull } from 'drizzle-orm';
import { StatTile } from '../../components/StatTile';
import { SectionHeader } from '../../components/SectionHeader';
import { LineChart } from 'react-native-gifted-charts';
import {
  CHART_END_SPACING,
  CHART_INITIAL_SPACING,
  MIN_CHART_POINT_SPACING,
  getChartViewportWidth,
  getScrollableChartWidth,
} from '../../src/utils/chart-layout';

const getMuscleGroup = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes('supino') || n.includes('press') || n.includes('peito') || n.includes('chest')) return 'chest';
  if (n.includes('puxada') || n.includes('terra') || n.includes('remada') || n.includes('back') || n.includes('row') || n.includes('deadlift') || n.includes('pull')) return 'back';
  if (n.includes('agachamento') || n.includes('leg') || n.includes('squat') || n.includes('thigh') || n.includes('calf') || n.includes('panturrilha') || n.includes('perna')) return 'legs';
  if (n.includes('desenvolvimento') || n.includes('militar') || n.includes('shoulder') || n.includes('ombro') || n.includes('elevação lateral')) return 'shoulders';
  if (n.includes('rosca') || n.includes('tríceps') || n.includes('bíceps') || n.includes('arm') || n.includes('braço')) return 'arms';
  return 'other';
};

export default function AnalyticsScreen() {
  const { t, language } = useI18n();
  const { width: screenWidth } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const theme = getThemeColors(colorScheme);
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [keyStats, setKeyStats] = useState({
    recentVolume: 0,
    volDeltaPct: 0,
    recentAvgRpe: 0,
    rpeDelta: 0,
    recentAvgDur: 0,
    durDelta: 0,
    recentPRsCount: 0,
    prsDelta: 0
  });

  const [volDist, setVolDist] = useState<Record<string, number>>({
    chest: 0,
    back: 0,
    legs: 0,
    shoulders: 0,
    arms: 0
  });

  const [weightData, setWeightData] = useState<{ value: number; label: string }[]>([]);

  const getMuscleGroupLabel = (group: string) => {
    if (language === 'pt') {
      switch (group) {
        case 'chest': return 'Peito';
        case 'back': return 'Costas';
        case 'legs': return 'Pernas';
        case 'shoulders': return 'Ombros';
        case 'arms': return 'Braços';
        default: return 'Outros';
      }
    } else {
      switch (group) {
        case 'chest': return 'Chest';
        case 'back': return 'Back';
        case 'legs': return 'Legs';
        case 'shoulders': return 'Shoulders';
        case 'arms': return 'Arms';
        default: return 'Other';
      }
    }
  };

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const analytics = await AnalyticsService.getFullAnalytics();
      setData(analytics);

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

      const volDeltaPct = prevVolume > 0 ? ((recentVolume - prevVolume) / prevVolume) * 100 : 0;

      // sRPE
      const recentRpeSessions = recentSessions.filter(s => s.sRpe && s.sRpe > 0);
      const prevRpeSessions = prevSessions.filter(s => s.sRpe && s.sRpe > 0);

      const recentAvgRpe = recentRpeSessions.length > 0
        ? recentRpeSessions.reduce((sum, s) => sum + s.sRpe!, 0) / recentRpeSessions.length
        : 0;
      const prevAvgRpe = prevRpeSessions.length > 0
        ? prevRpeSessions.reduce((sum, s) => sum + s.sRpe!, 0) / prevRpeSessions.length
        : 0;
      const rpeDelta = recentAvgRpe - prevAvgRpe;

      // Duration
      const recentDurSessions = recentSessions.filter(s => s.durationMinutes && s.durationMinutes > 0);
      const prevDurSessions = prevSessions.filter(s => s.durationMinutes && s.durationMinutes > 0);

      const recentAvgDur = recentDurSessions.length > 0
        ? recentDurSessions.reduce((sum, s) => sum + s.durationMinutes!, 0) / recentDurSessions.length
        : 0;
      const prevAvgDur = prevDurSessions.length > 0
        ? prevDurSessions.reduce((sum, s) => sum + s.durationMinutes!, 0) / prevDurSessions.length
        : 0;
      const durDelta = recentAvgDur - prevAvgDur;

      // PRs
      const recentPRs = allPRsList.filter(pr => pr.date >= thirtyDaysAgoMs);
      const prevPRs = allPRsList.filter(pr => pr.date >= sixtyDaysAgoMs && pr.date < thirtyDaysAgoMs);
      const prsDelta = recentPRs.length - prevPRs.length;

      // Volume distribution
      const muscleGroupVolume: Record<string, number> = {
        chest: 0,
        back: 0,
        legs: 0,
        shoulders: 0,
        arms: 0
      };

      allSets
        .filter(set => recentSessionIds.has(set.sessionId) && !set.isWarmup)
        .forEach(set => {
          const group = getMuscleGroup(set.exerciseName || '');
          if (group in muscleGroupVolume) {
            muscleGroupVolume[group] += set.weightKg * set.reps;
          }
        });

      // Weight chart data
      const recentWeights = weights.filter(m => m.weight && m.weight > 0);
      const chartWeights = recentWeights.map(point => ({
        value: point.weight!,
        label: new Date(point.date).getDate().toString()
      })).slice(-30);

      setKeyStats({
        recentVolume,
        volDeltaPct,
        recentAvgRpe,
        rpeDelta,
        recentAvgDur,
        durDelta,
        recentPRsCount: recentPRs.length,
        prsDelta
      });

      setVolDist(muscleGroupVolume);
      setWeightData(chartWeights);
      // Clear any previous error on success
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

  if (loading && !data) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Stack.Screen options={{ title: t('bioNav.data') }} />
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
        <Stack.Screen options={{ title: t('bioNav.data') }} />
        <ErrorState
          onRetry={loadAnalytics}
        />
      </View>
    );
  }

  if (!data) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ title: t('bioNav.data') }} />
        <EmptyState
          icon="📊"
          title={t("bioAnalytics.insufficientData")}
          description={t("bioAnalytics.emptyDesc")}
        />
      </View>
    );
  }

  const { strengthScore, consistency, volumeTrends, topExercises, estimated1RM } = data;

  const volDeltaText = keyStats.volDeltaPct === 0
    ? (language === 'pt' ? '— estável' : '— stable')
    : `${keyStats.volDeltaPct > 0 ? '↑' : '↓'} ${Math.abs(keyStats.volDeltaPct).toFixed(1)}%`;
  const volDeltaType = keyStats.volDeltaPct > 0 ? 'positive' : keyStats.volDeltaPct < 0 ? 'negative' : 'neutral';

  const rpeDeltaText = keyStats.rpeDelta === 0
    ? (language === 'pt' ? '— estável' : '— stable')
    : `${keyStats.rpeDelta > 0 ? '↑' : '↓'} ${Math.abs(keyStats.rpeDelta).toFixed(1)}`;
  const rpeDeltaType = keyStats.rpeDelta > 0 ? 'positive' : keyStats.rpeDelta < 0 ? 'negative' : 'neutral';

  const durDeltaText = keyStats.durDelta === 0
    ? (language === 'pt' ? '— estável' : '— stable')
    : `${keyStats.durDelta > 0 ? '↑' : '↓'} ${Math.abs(keyStats.durDelta).toFixed(0)}m`;
  const durDeltaType = keyStats.durDelta > 0 ? 'positive' : keyStats.durDelta < 0 ? 'negative' : 'neutral';

  const prsDeltaText = keyStats.prsDelta === 0
    ? (language === 'pt' ? '— sem recorde' : '— no record')
    : `${language === 'pt' ? '★ Novo recorde' : '★ New record'}`;
  const prsDeltaType = keyStats.prsDelta > 0 ? 'positive' : 'neutral';

  const insights = [];
  if (keyStats.volDeltaPct > 0) {
    insights.push({
      type: 'success',
      title: language === 'pt' ? 'Volume em alta' : 'Volume on the rise',
      description: language === 'pt' ? `Seu volume total aumentou ${keyStats.volDeltaPct.toFixed(0)}% nos últimos 30 dias. Continue progredindo!` : `Your total volume increased by ${keyStats.volDeltaPct.toFixed(0)}% in the last 30 days. Keep progressing!`,
      icon: '📈'
    });
  } else if (keyStats.volDeltaPct < 0) {
    insights.push({
      type: 'info',
      title: language === 'pt' ? 'Recuperação ativa' : 'Active recovery',
      description: language === 'pt' ? `Seu volume total diminuiu ${Math.abs(keyStats.volDeltaPct).toFixed(0)}% nos últimos 30 dias. Foco na recuperação.` : `Your total volume decreased by ${Math.abs(keyStats.volDeltaPct).toFixed(0)}% in the last 30 days. Focus on recovery.`,
      icon: '🔄'
    });
  } else {
    insights.push({
      type: 'info',
      title: language === 'pt' ? 'Volume constante' : 'Constant volume',
      description: language === 'pt' ? 'Seu volume de treino permaneceu estável nos últimos 30 dias.' : 'Your workout volume remained stable in the last 30 days.',
      icon: '➡️'
    });
  }

  insights.push({
    type: 'info',
    title: language === 'pt' ? 'Frequência de treinos' : 'Workout frequency',
    description: language === 'pt' ? `${consistency.weeklyFrequency} treinos/semana na média das últimas 12 semanas.` : `${consistency.weeklyFrequency} workouts/week average in the last 12 weeks.`,
    icon: '⏱️'
  });

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
    >
      <Stack.Screen options={{ title: t('bioNav.data') }} />

      {/* Sessions Count Card */}
      <Card className="items-center py-6">
        <Text className="text-4xl font-extrabold text-primary font-display">{consistency.sessionsThisMonth}</Text>
        <Text className="text-xs font-bold uppercase text-subtext mt-1">
          {language === 'pt' ? 'Sessões (30d)' : 'Sessions (30d)'}
        </Text>
        <Text className="text-xs text-subtext mt-2">
          {`${consistency.weeklyFrequency} ${language === 'pt' ? 'treinos/semana' : 'workouts/week'} · ${language === 'pt' ? 'Volume total' : 'Total volume'}: ${keyStats.recentVolume >= 1000 ? `${(keyStats.recentVolume / 1000).toFixed(1)}k` : keyStats.recentVolume.toFixed(0)}kg`}
        </Text>
      </Card>

      {/* Key Stats Grid */}
      <View className="gap-3">
        <View className="flex-row gap-3">
          <StatTile
            value={keyStats.recentVolume >= 1000 ? `${(keyStats.recentVolume / 1000).toFixed(1)}k` : keyStats.recentVolume.toFixed(0)}
            label={language === 'pt' ? 'Volume (kg)' : 'Volume (kg)'}
            accentColor="primary"
            delta={volDeltaText}
            deltaType={volDeltaType}
            className="flex-1"
          />
          <StatTile
            value={keyStats.recentAvgRpe.toFixed(1)}
            label={language === 'pt' ? 'sRPE Médio' : 'Avg sRPE'}
            accentColor="secondary"
            delta={rpeDeltaText}
            deltaType={rpeDeltaType}
            className="flex-1"
          />
        </View>
        <View className="flex-row gap-3">
          <StatTile
            value={`${keyStats.recentAvgDur.toFixed(0)}m`}
            label={language === 'pt' ? 'Duração Média' : 'Avg Duration'}
            delta={durDeltaText}
            deltaType={durDeltaType}
            className="flex-1"
          />
          <StatTile
            value={keyStats.recentPRsCount}
            label={language === 'pt' ? 'PRs (30d)' : 'PRs (30d)'}
            accentColor="warning"
            delta={prsDeltaText}
            deltaType={prsDeltaType}
            className="flex-1"
          />
        </View>
      </View>

      {/* Volume weekly bar chart card */}
      {volumeTrends.length > 0 && (
        <Card>
          <View className="mb-3">
            <SectionHeader label={t('bioAnalytics.weeklyVolumeTitleLabel')} />
            <Text className="text-xs text-subtext pl-1 mt-1">
              {language === 'pt' ? 'Últimas 12 semanas' : 'Last 12 weeks'}
            </Text>
          </View>
          <View className="gap-1">
            {(() => {
              const maxVolume = Math.max(...volumeTrends.map(w => w.totalVolume), 1);
              return volumeTrends.slice(-12).map((week) => {
                const barWidth = (week.totalVolume / maxVolume) * 100;
                return (
                  <View key={week.week} className="flex-row items-center gap-2">
                    <Text className="text-subtext text-2xs font-mono w-12">{week.week.slice(-2)}w</Text>
                    <View className="flex-1 h-4 bg-border/30 rounded overflow-hidden">
                      <View
                        className="h-full bg-primary/70 rounded"
                        style={{ width: `${Math.max(barWidth, 2)}%` }}
                      />
                    </View>
                    <Text className="text-subtext text-2xs font-mono w-14 text-right">
                      {week.totalVolume >= 1000 ? `${(week.totalVolume / 1000).toFixed(1)}k` : week.totalVolume}kg
                    </Text>
                  </View>
                );
              });
            })()}
          </View>
        </Card>
      )}

      {/* Body Weight Chart */}
      {weightData.length >= 2 && (
        <Card>
          <View className="mb-4">
            <SectionHeader label={language === 'pt' ? 'Peso Corporal' : 'Body Weight'} />
            <Text className="text-xs text-subtext pl-1 mt-1 font-display">
              {language === 'pt' ? 'Últimos 30 dias' : 'Last 30 days'} · {weightData[weightData.length - 1]?.value.toFixed(1)}kg {language === 'pt' ? 'atual' : 'current'}
            </Text>
          </View>
          <ScrollView
            horizontal
            nestedScrollEnabled
            bounces={false}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ minWidth: getChartViewportWidth(screenWidth) }}
          >
            <LineChart
              data={weightData}
              color={Colors.primary}
              thickness={3}
              dataPointsColor={Colors.primary}
              textColor={theme.subtext}
              hideRules
              yAxisColor="transparent"
              xAxisColor="transparent"
              height={120}
              width={getScrollableChartWidth(weightData.length, getChartViewportWidth(screenWidth))}
              disableScroll
              initialSpacing={CHART_INITIAL_SPACING}
              endSpacing={CHART_END_SPACING}
              spacing={MIN_CHART_POINT_SPACING}
              textFontSize={10}
            />
          </ScrollView>
        </Card>
      )}

      {/* Volume Distribution Card */}
      <Card>
        <View className="mb-3">
          <SectionHeader label={language === 'pt' ? 'Distribuição de Volume' : 'Volume Distribution'} />
          <Text className="text-xs text-subtext pl-1 mt-1">
            {language === 'pt' ? 'Por grupo muscular (30d)' : 'By muscle group (30d)'}
          </Text>
        </View>
        <View className="gap-3 mt-2">
          {Object.keys(volDist).map((group) => {
            const vol = volDist[group];
            const maxVol = Math.max(...Object.values(volDist), 1);
            const barWidth = (vol / maxVol) * 100;
            return (
              <View key={group} className="flex-row items-center gap-3">
                <Text className="text-xs font-bold text-text w-16">{getMuscleGroupLabel(group)}</Text>
                <View className="flex-1 bg-primary/5 rounded-full h-2.5 overflow-hidden">
                  <View className="bg-primary h-full rounded-full" style={{ width: `${barWidth}%` }} />
                </View>
                <Text className="text-xs font-mono text-subtext w-14 text-right font-display">
                  {vol >= 1000 ? `${(vol / 1000).toFixed(1)}k` : vol.toFixed(0)}kg
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Insights Card */}
      <Card>
        <SectionHeader label="Insights" className="mb-3" />
        <View className="gap-3 mt-2">
          {insights.map((insight, idx) => {
            const isSuccess = insight.type === 'success';
            const bgClass = isSuccess ? 'bg-success/10' : 'bg-primary/5';
            const textAccentClass = isSuccess ? 'text-success' : 'text-primary';
            return (
              <View key={idx} className={`flex-row gap-3 rounded-xl p-3 items-start ${bgClass}`}>
                <Text className="text-lg mt-0.5">{insight.icon}</Text>
                <View className="flex-1">
                  <Text className={`font-bold text-sm mb-1 ${textAccentClass}`}>{insight.title}</Text>
                  <Text className="text-text text-xs leading-5">{insight.description}</Text>
                </View>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Strength Score (preserved behavior) */}
      <Card>
        <View className="mb-3">
          <SectionHeader label={t("bioAnalytics.strengthScore")} />
        </View>
        <View className="items-center mb-4">
          <Text className="text-text text-5xl font-black font-display">{strengthScore.totalScore}</Text>
          <Text className="text-primary text-lg font-bold mt-1">{t('analytics.strengthLevel.' + strengthScore.labelKey)}</Text>
        </View>
        <View className="gap-2">
          <View className="flex-row justify-between items-center">
            <Text className="text-subtext text-sm">{t("bioAnalytics.volume")}</Text>
            <View className="flex-row items-center gap-2 flex-1 ml-4">
              <View className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                <View className="h-full bg-primary rounded-full" style={{ width: `${(strengthScore.volumeScore / 40) * 100}%` }} />
              </View>
              <Text className="text-text text-xs font-bold min-w-[42px] text-right flex-shrink-0 font-display">{strengthScore.volumeScore}/40</Text>
            </View>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-subtext text-sm">{t("bioAnalytics.intensity")}</Text>
            <View className="flex-row items-center gap-2 flex-1 ml-4">
              <View className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                <View className="h-full bg-secondary rounded-full" style={{ width: `${(strengthScore.intensityScore / 30) * 100}%` }} />
              </View>
              <Text className="text-text text-xs font-bold min-w-[42px] text-right flex-shrink-0 font-display">{strengthScore.intensityScore}/30</Text>
            </View>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-subtext text-sm">{t("bioAnalytics.consistency")}</Text>
            <View className="flex-row items-center gap-2 flex-1 ml-4">
              <View className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                <View className="h-full bg-success rounded-full" style={{ width: `${(strengthScore.consistencyScore / 30) * 100}%` }} />
              </View>
              <Text className="text-text text-xs font-bold min-w-[42px] text-right flex-shrink-0 font-display">{strengthScore.consistencyScore}/30</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Top Exercise Progressions (preserved behavior) */}
      {topExercises.length > 0 && (
        <Card>
          <View className="mb-3">
            <SectionHeader label={t('bioAnalytics.topExercisesLabel')} />
          </View>
          <View className="gap-3">
            {topExercises.map(ex => (
              <View key={ex.exerciseId} className="flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="text-text text-sm font-bold">{ex.exerciseName}</Text>
                  <Text className="text-subtext text-xs">{ex.currentMaxWeight}kg (era {ex.previousMaxWeight || '?'}kg)</Text>
                </View>
                <View className={`px-2 py-1 rounded ${ex.progress > 0 ? 'bg-success/10' : 'bg-danger/10'}`}>
                  <Text className={`text-xs font-bold ${ex.progress > 0 ? 'text-success' : 'text-danger'}`}>
                    {ex.progress > 0 ? '+' : ''}{ex.progress}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Estimated 1RM (preserved behavior) */}
      {estimated1RM.length > 0 && (
        <Card>
          <View className="mb-3">
            <SectionHeader label={t('bioAnalytics.estimated1RMLabel')} />
          </View>
          <View className="gap-2">
            {estimated1RM.slice(0, 8).map(item => (
              <View key={item.exercise} className="flex-row justify-between items-center">
                <Text className="text-text text-sm flex-1" numberOfLines={1}>{item.exercise}</Text>
                <Text className="text-text text-sm font-bold font-display">{item.estimated1RM}kg</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      <View className="h-8" />
    </ScrollView>
  );
}

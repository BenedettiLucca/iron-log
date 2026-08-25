import { View, Text, ScrollView, Image, useWindowDimensions, useColorScheme } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { db } from '../../src/db/client';
import { bodyMetrics } from '../../src/db/schema';
import { asc } from 'drizzle-orm';
import { LineChart } from 'react-native-gifted-charts';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { EmptyState } from '../../components/EmptyState';
import { PhotoComparison } from '../../components/PhotoComparison';
import { LoadingState, ErrorState } from '../../components/ScreenState';
import { logger } from '@/services/logger';
import { BodyMetric } from '@/src/types';
import { getThemeColors } from '@/constants/colors';
import { getLocaleForLanguage, useI18n } from '../../src/i18n/index';
import { resolveScreenState } from '../../src/utils/screen-state';
import { SegmentedControl } from '../../components/SegmentedControl';
import { SectionHeader } from '../../components/SectionHeader';
import { ChartXAxisLabels } from '../../components/ChartXAxisLabels';
import {
  getChartViewportWidth,
} from '../../src/utils/chart-layout';
import {
  bucketChartSeries,
  buildPositionedChartSeries,
  getChartYAxisScale,
} from '../../src/utils/chart-periods';
import type {
  ChartBucketAggregation,
  ChartPeriod,
  TimestampedChartValue,
} from '../../src/utils/chart-periods';

// Helper to find the best matching photo pair (same pose preferred)
const getBestPhotoPair = (latest: BodyMetric, previous: BodyMetric) => {
  if (latest.photoFront && previous.photoFront) {
    return { before: previous.photoFront, after: latest.photoFront };
  }
  if (latest.photoBack && previous.photoBack) {
    return { before: previous.photoBack, after: latest.photoBack };
  }
  if (latest.photoSide && previous.photoSide) {
    return { before: previous.photoSide, after: latest.photoSide };
  }
  return null;
};

export default function EvolutionScreen() {
  const { t, language } = useI18n();
  const { width: screenWidth } = useWindowDimensions();
  const colorScheme = useColorScheme();
  const theme = getThemeColors(colorScheme);
  const [weightData, setWeightData] = useState<TimestampedChartValue[]>([]);
  const [measuresData, setMeasuresData] = useState<Record<string, TimestampedChartValue[]>>({});
  const [photos, setPhotos] = useState<BodyMetric[]>([]);
  const [activeTab, setActiveTab] = useState<'weight' | 'measures' | 'photos' | 'analytics'>('weight');
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('month');
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [comparison, setComparison] = useState({
    visible: false,
    beforeUri: null as string | null,
    afterUri: null as string | null,
    label: '',
  });
  const [analytics, setAnalytics] = useState({
    weightChangeRate: 0,
    averageWeight: 0,
    totalEntries: 0,
    firstEntryDate: null as Date | null,
    lastEntryDate: null as Date | null,
  });

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setHasError(false);
      // Keep ascending order so each period can select its latest real measurement.
      const data = await db.select().from(bodyMetrics).orderBy(asc(bodyMetrics.date));

      // 1. Preserve real weight measurements; chart bucketing selects the latest one.
      const weights = data.filter(m => m.weight && m.weight > 0);
      setWeightData(weights.map(point => ({
        timestamp: point.date,
        value: point.weight!,
      })));

      // 2. Processar Medidas
      const measures = data.filter(m => m.type === 'monthly');
      const processMeasure = (key: 'waist' | 'armRight' | 'chest' | 'calf') => measures
        .filter(m => m[key] != null)
        .map(m => ({
          timestamp: m.date,
          value: m[key]!,
        }));

      setMeasuresData({
          waist: processMeasure('waist'),
          arm: processMeasure('armRight'),
          chest: processMeasure('chest')
      });

      // 3. Processar Fotos (Do mais novo para o mais velho)
      const photoEntries = data
        .filter(m => m.type === 'monthly' && (m.photoFront || m.photoBack || m.photoSide))
        .reverse(); // Descendente
      setPhotos(photoEntries as BodyMetric[]);

      // 4. Calculate Analytics
      if (weights.length > 0) {
        const totalWeight = weights.reduce((sum, m) => sum + (m.weight || 0), 0);
        const averageWeight = totalWeight / weights.length;

        const firstWeight = weights[0].weight;
        const lastWeight = weights[weights.length - 1].weight;
        const firstDate = new Date(weights[0].date);
        const lastDate = new Date(weights[weights.length - 1].date);
        const weeksDiff = Math.max((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7), 1);
        const weightChangeRate = firstWeight !== null && lastWeight !== null
          ? ((lastWeight - firstWeight) / weeksDiff)
          : 0;

        setAnalytics({
          weightChangeRate,
          averageWeight,
          totalEntries: data.length,
          firstEntryDate: firstDate,
          lastEntryDate: lastDate,
        });
      }

    } catch (e) {
      logger.error('Erro ao carregar dados de evolução', e);
      setHasError(true);
      setErrorMessage(t('states.errorBody'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const renderChart = (
    data: TimestampedChartValue[],
    title: string,
    color: string,
    unit: string = '',
    aggregation: ChartBucketAggregation = 'average',
  ) => {
      const viewportWidth = getChartViewportWidth(screenWidth);
      const locale = getLocaleForLanguage(language);
      const buckets = bucketChartSeries(
        data,
        chartPeriod,
        Date.now(),
        viewportWidth,
        aggregation,
      );
      const positioned = buildPositionedChartSeries(buckets, chartPeriod, locale, viewportWidth);
      const values = positioned.data.map(point => point.value);

      if (positioned.data.length < 2) return (
          <Card className="mb-6" style={{ height: 160, justifyContent: 'center', alignItems: 'center' }}>
              <Text className="text-subtext italic">{t("bioEvolution.insufficientData")} {title}</Text>
          </Card>
      );

      const chartScale = getChartYAxisScale(values);
      const initialVal = values[0] ?? 0;
      const currentVal = values[values.length - 1] ?? 0;
      const deltaVal = currentVal - initialVal;
      const avgVal = values.reduce((sum, value) => sum + value, 0) / values.length;
      const formattedDelta = `${deltaVal >= 0 ? '+' : ''}${deltaVal.toFixed(1)}`;

      const initialLabel = t('bioEvolution.initial');
      const currentLabel = t('bioEvolution.current');
      const deltaLabel = t('bioEvolution.delta');
      const averageLabel = t('bioEvolution.average');
      const chartPeriodLabel = chartPeriod === 'week'
        ? t('chartPeriods.week')
        : chartPeriod === 'month'
          ? t('chartPeriods.month')
          : t('chartPeriods.year');
      const chartAccessibilityLabel = [
        title,
        chartPeriodLabel,
        `${currentLabel}: ${currentVal.toFixed(1)}${unit}`,
        `${deltaLabel}: ${formattedDelta}${unit}`,
      ].join('. ');

      return (
        <Card className="mb-6">
            <View className="mb-4">
              <SectionHeader label={title} />
              <Text className="text-sm text-subtext pl-1 mt-1">
                {currentLabel}: {currentVal.toFixed(1)}{unit} ({formattedDelta}{unit})
              </Text>
            </View>
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={chartAccessibilityLabel}
            >
              <LineChart
                data={positioned.data}
                color={color}
                thickness={3}
                dataPointsColor={color}
                hideRules={false}
                rulesColor={theme.border}
                rulesThickness={1}
                yAxisColor="transparent"
                yAxisThickness={0}
                xAxisColor={theme.border}
                height={180}
                width={viewportWidth}
                disableScroll
                initialSpacing={positioned.initialSpacing}
                endSpacing={positioned.endSpacing}
                yAxisOffset={chartScale.yAxisOffset}
                maxValue={chartScale.maxValue}
                noOfSections={4}
                showFractionalValues
                roundToDigits={1}
                yAxisTextStyle={{ color: theme.subtext, fontSize: 10 }}
                xAxisLabelsHeight={0}
                yAxisLabelSuffix={unit ? ` ${unit}` : ''}
                yAxisLabelWidth={48}
            />
              <ChartXAxisLabels
                axisLabels={positioned.axisLabels}
                slotSpacing={positioned.slotSpacing}
                viewportWidth={viewportWidth}
                yAxisLabelWidth={48}
              />
            </View>
            <View className="flex-row gap-2 mt-4">
              <View className="flex-1 bg-card/50 rounded-xl p-2 items-center">
                 <Text className="text-2xs font-bold text-subtext">{initialLabel}</Text>
                <Text className="text-sm font-extrabold text-text mt-0.5">{initialVal.toFixed(1)}{unit}</Text>
              </View>
              <View className="flex-1 bg-card/50 rounded-xl p-2 items-center">
                 <Text className="text-2xs font-bold text-subtext">{currentLabel}</Text>
                <Text className="text-sm font-extrabold text-text mt-0.5">{currentVal.toFixed(1)}{unit}</Text>
              </View>
              <View className="flex-1 bg-card/50 rounded-xl p-2 items-center">
                 <Text className="text-2xs font-bold text-subtext">{deltaLabel}</Text>
                <Text className="text-sm font-extrabold mt-0.5 text-text">
                  {formattedDelta}{unit}
                </Text>
              </View>
              <View className="flex-1 bg-card/50 rounded-xl p-2 items-center">
                 <Text className="text-2xs font-bold text-subtext">{averageLabel}</Text>
                <Text className="text-sm font-extrabold text-text mt-0.5">{avgVal.toFixed(1)}{unit}</Text>
              </View>
            </View>
        </Card>
      );
  };

  const { status } = resolveScreenState({
    isLoading,
    hasError,
    hasContent: true, // Layout provides its own empty states per tab
    errorMessage
  });

  if (status === 'loading') {
    return <LoadingState />;
  }

  if (status === 'error') {
    return <ErrorState message={errorMessage} onRetry={loadData} />;
  }

  const getDelta = (dataList: { value: number }[]) => {
    if (!dataList || dataList.length < 2) return null;
    return (dataList[dataList.length - 1]?.value || 0) - (dataList[0]?.value || 0);
  };

  const weightDelta = weightData.length >= 2 ? (weightData[weightData.length - 1]?.value || 0) - (weightData[0]?.value || 0) : null;
  const waistDelta = getDelta(measuresData.waist);
  const armDelta = getDelta(measuresData.arm);
  const chestDelta = getDelta(measuresData.chest);

  const renderSummaryRow = (label: string, delta: number | null, unit: string, showDivider = true) => {
    const isUnavailable = delta === null;
    const isZero = !isUnavailable && Math.abs(delta) < 0.01;
    const isPositive = !isUnavailable && delta > 0;
    const colorClass = isUnavailable || isZero ? 'text-subtext' : isPositive ? 'text-successText' : 'text-dangerText';
    const sign = isUnavailable ? '—' : isZero ? '•' : isPositive ? '↑' : '↓';
    return (
      <View key={label} className={`flex-row justify-between py-2 ${showDivider ? 'border-b border-border/50' : ''}`}>
        <Text className="text-sm text-subtext">{label}</Text>
        <Text className={`text-sm font-bold ${colorClass}`}>
          {sign} {isUnavailable ? '' : `${Math.abs(delta).toFixed(1)} ${unit}`}
        </Text>
      </View>
    );
  };

  const segments = [
    { key: 'weight', label: t('bioEvolution.weightTab') },
    { key: 'measures', label: t('bioEvolution.measuresTab') },
    { key: 'photos', label: t('bioEvolution.photosTab') },
    { key: 'analytics', label: t('bioEvolution.analysisTab') },
  ];
  const chartPeriodSegments = [
    { key: 'week', label: t('chartPeriods.week') },
    { key: 'month', label: t('chartPeriods.month') },
    { key: 'year', label: t('chartPeriods.year') },
  ];

  return (
    <View className="flex-1 bg-background">

      {/* Tabs */}
      <View className="px-4 pt-4 mb-2">
        <SegmentedControl
          segments={segments}
          activeKey={activeTab}
          onSelect={(key) => setActiveTab(key as any)}
        />
      </View>

      {(activeTab === 'weight' || activeTab === 'measures') && (
        <View className="px-4 mb-4">
          <SegmentedControl
            segments={chartPeriodSegments}
            activeKey={chartPeriod}
            onSelect={key => setChartPeriod(key as ChartPeriod)}
            accessibilityLabel={t('chartPeriods.accessibilityLabel')}
          />
        </View>
      )}

      <ScrollView className="flex-1 px-4" nestedScrollEnabled contentContainerStyle={{ paddingBottom: 40 }}>
          {activeTab === 'weight' && (
              renderChart(weightData, t('bio.weightEvolution'), theme.primaryText, 'kg', 'latest')
          )}

          {activeTab === 'measures' && (
              <>
                {renderChart(measuresData.waist, t('bioEvolution.waist'), theme.successText, 'cm')}
                {renderChart(measuresData.arm, t("bioEvolution.arm"), theme.secondaryText, 'cm')}
                {renderChart(measuresData.chest, t("bioEvolution.chest"), theme.accentText, 'cm')}
              </>
          )}

          {activeTab === 'photos' && (
               <View className="gap-4">
                   <View className="flex-row justify-between items-center mb-4">
                       <SectionHeader label={t("bio.recentPhotos")} />
                       {photos.length >= 2 && (
                           <Button
                               title={t("common.compare")}
                               onPress={() => {
                                   const latest = photos[0];
                                   const previous = photos[1];
                                   if (latest && previous) {
                                       const pair = getBestPhotoPair(latest, previous);
                                       if (pair) {
                                           setComparison({
                                               visible: true,
                                               beforeUri: pair.before,
                                               afterUri: pair.after,
                                               label: t('bio.latestCheckins'),
                                           });
                                       }
                                   }
                               }}
                               variant="secondary"
                               size="sm"
                           />
                       )}
                   </View>
                   {photos.length === 0 && (
                     <View className="items-center mt-10">
                         <Text className="text-4xl mb-4">📷</Text>
                         <Text className="text-subtext text-center">{t("bioEvolution.noPhotos")}</Text>
                         <Text className="text-subtext/60 text-xs text-center mt-2">{t("bioEvolution.noPhotosDesc")}</Text>
                     </View>
                   )}
                   {photos.map((entry) => (
                      <View key={entry.id} className="mb-8">
                          <View className="flex-row items-center gap-2 mb-4">
                            <View className="h-[1px] flex-1 bg-border" />
                            <Text className="text-primaryText font-bold text-sm tracking-widest">
                                {new Date(entry.date).toLocaleDateString(getLocaleForLanguage(language))}
                            </Text>
                            <View className="h-[1px] flex-1 bg-border" />
                          </View>

                          <ScrollView horizontal showsHorizontalScrollIndicator={true} className="gap-4 pl-2">
                              {entry.photoFront && (
                                  <View>
                                      <Image source={{ uri: entry.photoFront }} className="w-48 h-64 rounded-2xl bg-black" resizeMode="cover" />
                                      <Text className="text-center text-subtext text-xs mt-2 font-bold">{t("bioEvolution.front")}</Text>
                                  </View>
                              )}
                              {entry.photoBack && (
                                  <View>
                                      <Image source={{ uri: entry.photoBack }} className="w-48 h-64 rounded-2xl bg-black" resizeMode="cover" />
                                      <Text className="text-center text-subtext text-xs mt-2 font-bold">{t("bioEvolution.back")}</Text>
                                  </View>
                              )}
                              {entry.photoSide && (
                                  <View>
                                      <Image source={{ uri: entry.photoSide }} className="w-48 h-64 rounded-2xl bg-black" resizeMode="cover" />
                                      <Text className="text-center text-subtext text-xs mt-2 font-bold">{t("bioEvolution.side")}</Text>
                                  </View>
                              )}
                          </ScrollView>
                      </View>
                  ))}
               </View>
          )}

          {activeTab === 'analytics' && (
              <View className="gap-4">
                  {weightData.length === 0 ? (
                    <EmptyState
                      icon="📊"
                      title={t("bioAnalytics.insufficientData")}
                      description={t("bioEvolution.emptyAnalysis")}
                    />
                  ) : (
                    <>
                      {/* Weight Change Rate */}
                      <Card>
                        <Text className="text-subtext text-xs font-bold mb-2">{t("bioEvolution.weightChange")}</Text>
                        <View className="flex-row items-end gap-2">
                          <Text className="text-4xl font-black text-text">
                            {analytics.weightChangeRate >= 0 ? '+' : ''}
                            {analytics.weightChangeRate.toFixed(2)}
                          </Text>
                          <Text className="text-subtext text-sm mb-1">{t("bioEvolution.kgPerWeek")}</Text>
                        </View>
                      </Card>

                      {/* Average Weight */}
                      <Card>
                        <Text className="text-subtext text-xs font-bold mb-2">{t("bioEvolution.avgWeight")}</Text>
                        <View className="flex-row items-end gap-2">
                          <Text className="text-4xl font-black text-text">
                            {analytics.averageWeight.toFixed(1)}
                          </Text>
                          <Text className="text-subtext text-sm mb-1">{t("bioEvolution.kg")}</Text>
                        </View>
                      </Card>

                      {/* Statistics Grid */}
                      <View className="flex-row gap-3">
                        <Card className="flex-1">
                          <Text className="text-subtext text-xs font-bold mb-1">{t("bioEvolution.totalEntries")}</Text>
                          <Text className="text-2xl font-black text-text">{analytics.totalEntries}</Text>
                        </Card>

                        <Card className="flex-1">
                          <Text className="text-subtext text-xs font-bold mb-1">{t("bioEvolution.period")}</Text>
                          <Text className="text-2xl font-black text-text">
                            {analytics.firstEntryDate && analytics.lastEntryDate
                              ? Math.ceil(
                                  (analytics.lastEntryDate.getTime() - analytics.firstEntryDate.getTime()) /
                                    (1000 * 60 * 60 * 24 * 30)
                                )
                              : 0}
                          </Text>
                          <Text className="text-subtext text-xs">{t("bioEvolution.months")}</Text>
                        </Card>
                      </View>

                      {/* Trend Analysis */}
                      <Card>
                        <Text className="text-subtext text-xs font-bold mb-3">{t("bioEvolution.trend")}</Text>
                        <View className="flex-row items-center gap-3">
                          <View
                            className="w-16 h-16 rounded-full items-center justify-center bg-card"
                          >
                            <Text className="text-3xl">
                              {analytics.weightChangeRate > 0.1 ? '📈' : analytics.weightChangeRate < -0.1 ? '📉' : '➡️'}
                            </Text>
                          </View>
                          <View className="flex-1">
                            <Text className="text-text font-bold text-sm mb-1">
                              {analytics.weightChangeRate > 0.1
                                ? t('bioEvolution.gainingWeightTitle')
                                : analytics.weightChangeRate < -0.1
                                ? t('bioEvolution.losingWeightTitle')
                                : t("bioEvolution.stable")}
                            </Text>
                            <Text className="text-subtext text-xs">
                              {analytics.weightChangeRate > 0.1
                                ? t("bioEvolution.gainingWeight")
                                : analytics.weightChangeRate < -0.1
                                ? t("bioEvolution.losingWeight")
                                : t("bioEvolution.weightStable")}
                            </Text>
                          </View>
                        </View>
                      </Card>

                      {/* Evolution Summary Card */}
                      <Card>
                        <SectionHeader label={t('bioEvolution.summary')} className="mb-2" />
                        <View className="mt-2">
                          {renderSummaryRow(t('bioEvolution.weightLabel'), weightDelta, 'kg')}
                          {renderSummaryRow(t('bio.waist'), waistDelta, 'cm')}
                          {renderSummaryRow(t('bio.chest'), chestDelta, 'cm')}
                          {renderSummaryRow(t('bio.armRightAbbr'), armDelta, 'cm', false)}
                        </View>
                      </Card>

                      {/* Info Card */}
                      <Card className="bg-secondarySurface border-secondary/20">
                        <Text className="text-secondaryText text-xs font-bold mb-2">💡 {t('bioEvolution.tip')}</Text>
                        <Text className="text-subtext text-xs leading-5">
                          {t('bioEvolution.tipText')}
                        </Text>
                      </Card>
                    </>
                  )}
              </View>
          )}
       </ScrollView>

       {/* Photo Comparison Modal */}
       <PhotoComparison
           visible={comparison.visible}
           beforeUri={comparison.beforeUri}
           afterUri={comparison.afterUri}
           label={comparison.label}
           onClose={() => setComparison({ visible: false, beforeUri: null, afterUri: null, label: '' })}
       />
     </View>
  );
}

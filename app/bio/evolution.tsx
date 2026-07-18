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
import {
  CHART_END_SPACING,
  CHART_INITIAL_SPACING,
  MIN_CHART_POINT_SPACING,
  getChartViewportWidth,
  getScrollableChartWidth,
} from '../../src/utils/chart-layout';

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
  const [weightData, setWeightData] = useState<{ value: number; label?: string; dataPointText?: string }[]>([]);
  const [measuresData, setMeasuresData] = useState<Record<string, { value: number; label: string }[]>>({});
  const [photos, setPhotos] = useState<BodyMetric[]>([]);
  const [activeTab, setActiveTab] = useState<'weight' | 'measures' | 'photos' | 'analytics'>('weight');
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
      // Carregar em ordem ASCENDENTE para calcular média móvel corretamente
      const data = await db.select().from(bodyMetrics).orderBy(asc(bodyMetrics.date));

      // 1. Processar Peso (Média Móvel 7 Dias)
      const weights = data.filter(m => m.weight && m.weight > 0);
      const maData = weights.map((point, index, arr) => {
          // Pegar janela de até 7 dias anteriores
          const windowStart = Math.max(0, index - 6);
          const window = arr.slice(windowStart, index + 1);
          const avg = window.reduce((sum, item) => sum + item.weight!, 0) / window.length;

          return {
              value: parseFloat(avg.toFixed(1)),
              label: new Date(point.date).getDate().toString(),
              dataPointText: parseFloat(avg.toFixed(1)).toString()
          };
      });

      // Pegar até 30 pontos para o gráfico não ficar poluído (aprox 30 dias)
      setWeightData(maData.slice(-30));

      // 2. Processar Medidas
      const measures = data.filter(m => m.type === 'monthly');
      const processMeasure = (key: 'waist' | 'armRight' | 'chest' | 'calf') => measures
        .filter(m => m[key] != null)
        .map(m => ({
          value: m[key] || 0,
          label: new Date(m.date).toLocaleDateString(getLocaleForLanguage(language), { month: 'short' })
        })).slice(-12); // Últimos 12 meses

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

  const renderChart = (data: { value: number; label?: string; dataPointText?: string }[], title: string, color: string, unit: string = '') => {
      if (!data || data.length < 2) return (
          <Card className="mb-6" style={{ height: 160, justifyContent: 'center', alignItems: 'center' }}>
              <Text className="text-subtext italic">{t("bioEvolution.insufficientData")} {title}</Text>
          </Card>
      );

      const viewportWidth = getChartViewportWidth(screenWidth);
      const chartWidth = getScrollableChartWidth(data.length, viewportWidth);
      const hasOverflow = chartWidth > viewportWidth;

      const initialVal = data[0]?.value || 0;
      const currentVal = data[data.length - 1]?.value || 0;
      const deltaVal = currentVal - initialVal;
      const avgVal = data.reduce((sum, item) => sum + item.value, 0) / data.length;
      const formattedDelta = `${deltaVal >= 0 ? '+' : ''}${deltaVal.toFixed(1)}`;

      const initialLabel = t('bioEvolution.initial');
      const currentLabel = t('bioEvolution.current');
      const deltaLabel = t('bioEvolution.delta');
      const averageLabel = t('bioEvolution.average');

      return (
        <Card className="mb-6">
            <View className="mb-4">
              <SectionHeader label={title} />
              <Text className="text-sm text-subtext pl-1 mt-1">
                {currentLabel}: {currentVal.toFixed(1)}{unit} ({formattedDelta}{unit})
              </Text>
            </View>
            <ScrollView
              horizontal
              nestedScrollEnabled
              bounces={false}
              showsHorizontalScrollIndicator={hasOverflow}
              contentContainerStyle={{ minWidth: viewportWidth }}
            >
              <LineChart
                  data={data}
                  color={color}
                  thickness={3}
                  dataPointsColor={color}
                  textColor={theme.subtext}
                  hideRules
                  yAxisColor="transparent"
                  xAxisColor="transparent"
                  height={180}
                  width={chartWidth}
                  disableScroll
                  initialSpacing={CHART_INITIAL_SPACING}
                  endSpacing={CHART_END_SPACING}
                  spacing={MIN_CHART_POINT_SPACING}
                  textFontSize={10}
              />
            </ScrollView>
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

      <ScrollView className="flex-1 px-4" nestedScrollEnabled contentContainerStyle={{ paddingBottom: 40 }}>
          {activeTab === 'weight' && (
              <>
                <Text className="text-subtext text-xs mb-4 text-center font-medium">{t("bioEvolution.movingAverageLabel")}</Text>
                {renderChart(weightData, t('bio.weightEvolution'), theme.primaryText, 'kg')}
              </>
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

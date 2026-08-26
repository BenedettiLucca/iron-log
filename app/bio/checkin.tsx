import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Path } from 'react-native-svg';
import { db } from '../../src/db/client';
import { bodyMetrics } from '../../src/db/schema';
import { eq, desc } from 'drizzle-orm';
import { BodyMetric } from '@/src/types';
import { CheckinGallery } from '../../components/CheckinGallery';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { LoadingState, ErrorState } from '../../components/ScreenState';
import { logger } from '@/services/logger';
import { useI18n, getLocaleForLanguage } from '../../src/i18n/index';
import { resolveScreenState } from '../../src/utils/screen-state';
import { processCheckinData } from '@/src/utils/checkin-screen';
import { Card } from '../../components/Card';
import { SectionHeader } from '../../components/SectionHeader';
import { SegmentedControl } from '../../components/SegmentedControl';
import { formatMonthYear } from '../../src/utils/checkin';
import { Colors } from '../../constants/colors';

function PlusIcon({ color = Colors.onPrimary, size = 16 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}

export default function CheckinScreen() {
  const router = useRouter();
  const { t, language } = useI18n();
  const [monthlyMetrics, setMonthlyMetrics] = useState<BodyMetric[]>([]);
  const [selectedMetricId, setSelectedMetricId] = useState<number | null>(null);
  const [showGallery, setShowGallery] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'measures' | 'photos'>('measures');

  const loadMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setHasError(false);
      const data = await db.select().from(bodyMetrics)
        .where(eq(bodyMetrics.type, 'monthly'))
        .orderBy(desc(bodyMetrics.date));
      setMonthlyMetrics((data || []) as BodyMetric[]);
    } catch (e) {
      logger.error('Failed to load monthly metrics', e);
      setHasError(true);
      setErrorMessage(t('states.errorBody'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  const { status } = resolveScreenState({
    isLoading: loading,
    hasError,
    hasContent: monthlyMetrics.length > 0,
    errorMessage
  });

  if (status === 'loading') {
    return <LoadingState />;
  }

  if (status === 'error') {
    return <ErrorState message={errorMessage} onRetry={loadMetrics} />;
  }

  const { allMonthly, hasData } = processCheckinData(monthlyMetrics);
  const selectedIndex = selectedMetricId !== null
    ? allMonthly.findIndex(metric => metric.id === selectedMetricId)
    : 0;
  const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const current = allMonthly[currentIndex] ?? null;
  const previous = allMonthly[currentIndex + 1] ?? null;

  if (!hasData || !current) {
    return (
      <View className="flex-1 bg-background px-4">
        <View className="flex-1 justify-center">
          <EmptyState
            icon="📸"
            title={t('checkin.emptyTitle')}
            description={t('checkin.emptyDesc')}
          />
          <Button
            title={t('checkin.takePhotos')}
            onPress={() => router.push('/bio?checkin=open')}
            variant="primary"
            fullWidth
          />
        </View>
      </View>
    );
  }

  const POSES = [
    { key: 'photoFront' as const, label: t('bio.front') },
    { key: 'photoBack' as const, label: t('bio.back') },
    { key: 'photoSide' as const, label: t('bio.side') },
  ];

  const MEASUREMENTS = [
    { key: 'weight' as const, label: t('checkin.weight'), unit: 'kg', isDecreaseGood: true },
    { key: 'waist' as const, label: t('checkin.waist'), unit: 'cm', isDecreaseGood: true },
    { key: 'chest' as const, label: t('checkin.chest'), unit: 'cm', isDecreaseGood: false },
    { key: 'armRight' as const, label: t('checkin.armRight'), unit: 'cm', isDecreaseGood: false },
    { key: 'thighRight' as const, label: t('checkin.thighRight'), unit: 'cm', isDecreaseGood: false },
    { key: 'calf' as const, label: t('checkin.calf'), unit: 'cm', isDecreaseGood: false },
  ];

  const segments = [
    { key: 'measures', label: t('checkin.measurementsTab') },
    { key: 'photos', label: t('checkin.photosTab') },
  ];

  const renderMeasurementTile = (
    label: string,
    unit: string,
    key: string,
    isDecreaseGood: boolean
  ) => {
    const currentVal = current ? (current[key as keyof BodyMetric] as number | null) : null;
    const prevVal = previous ? (previous[key as keyof BodyMetric] as number | null) : null;

    let deltaText = '—';
    let deltaColor = 'text-subtext';

    if (currentVal !== null && prevVal !== null) {
      const diff = currentVal - prevVal;
      if (diff !== 0) {
        const sign = diff > 0 ? '↑' : '↓';
        deltaText = `${sign} ${Math.abs(diff).toFixed(1)} ${unit}`;
        const isGood = isDecreaseGood ? (diff < 0) : (diff > 0);
        deltaColor = isGood ? 'text-successText' : 'text-dangerText';
      } else {
        deltaText = `— 0.0 ${unit}`;
      }
    }

    return (
      <View
        key={key}
        className="flex-1 rounded-xl p-3 border border-border/50 bg-secondarySurface/30"
      >
        <Text className="text-2xs font-bold text-subtext">
          {label}
        </Text>
        <Text className="text-xl font-extrabold text-text mt-1">
          {currentVal !== null ? currentVal.toFixed(1) : '—'}
          <Text className="text-xs text-subtext font-medium"> {unit}</Text>
        </Text>
        <Text className={`text-xs font-bold mt-1 ${deltaColor}`}>
          {deltaText}
        </Text>
      </View>
    );
  };

  return (
    <View className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header Card */}
        <Card className="flex-row items-center justify-between mx-4 mt-4">
          <View className="flex-1 mr-4">
            <Text className="text-lg font-extrabold text-text">
              {formatMonthYear(current.date, getLocaleForLanguage(language))}
            </Text>
            <Text className="text-xs text-subtext">
              {previous
                ? `${t('checkin.lastCheckin')}: ${new Date(previous.date).toLocaleDateString()}`
                : `${t('checkin.lastCheckin')}: —`}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push('/bio?checkin=open')}
            className="bg-primary py-2.5 px-4 rounded-xl flex-row items-center gap-1.5 min-h-[44px]"
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('checkin.newCheckin')}
          >
            <PlusIcon size={16} />
            <Text className="text-onPrimary font-bold text-sm">
              {t('checkin.newCheckin')}
            </Text>
          </TouchableOpacity>
        </Card>

        {/* Gallery Toggle Button */}
        <View className="px-4 mt-3 flex-row justify-between items-center">
          <TouchableOpacity
            onPress={() => setShowGallery(s => !s)}
            className="bg-card border border-border py-1.5 px-3 rounded-lg min-h-[44px]"
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={showGallery ? t('checkin.hideGallery') : t('checkin.showGallery')}
          >
            <Text className="text-text font-bold text-xs">
              {showGallery ? t('checkin.hideGallery') : t('checkin.showGallery')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Gallery */}
        {showGallery && (
          <View className="px-4 mt-2">
            <CheckinGallery
              metrics={allMonthly}
              selectedMetricId={current.id}
              onSelectMonth={metric => setSelectedMetricId(metric.id)}
            />
          </View>
        )}

        {/* Photo Gallery Section */}
        <Card className="mx-4 mt-4">
          <SectionHeader label={t('checkin.progressPhotos')} className="mb-3" />
          <View className="flex-row gap-3">
            {POSES.map((pose) => {
              const uri = current[pose.key] as string | null;
              return (
                <View key={pose.key} className="flex-1 aspect-[3/4] rounded-xl border border-border overflow-hidden bg-text/5 relative">
                  {uri ? (
                    <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
                  ) : (
                    <View className="flex-1 items-center justify-center">
                      <Text className="text-xl">📷</Text>
                    </View>
                  )}
                  <View className="absolute bottom-0 left-0 right-0 bg-black/60 py-1.5 items-center">
                    <Text className="text-white text-2xs font-bold tracking-wider">
                      {pose.label}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>

        {/* Measurements Grid */}
        <Card className="mx-4 mt-4">
          <SectionHeader label={t('checkin.bodyMeasurements')} className="mb-3" />
          <View className="flex-row gap-3">
            {renderMeasurementTile(MEASUREMENTS[0].label, MEASUREMENTS[0].unit, MEASUREMENTS[0].key, MEASUREMENTS[0].isDecreaseGood)}
            {renderMeasurementTile(MEASUREMENTS[1].label, MEASUREMENTS[1].unit, MEASUREMENTS[1].key, MEASUREMENTS[1].isDecreaseGood)}
          </View>
          <View className="flex-row gap-3 mt-3">
            {renderMeasurementTile(MEASUREMENTS[2].label, MEASUREMENTS[2].unit, MEASUREMENTS[2].key, MEASUREMENTS[2].isDecreaseGood)}
            {renderMeasurementTile(MEASUREMENTS[3].label, MEASUREMENTS[3].unit, MEASUREMENTS[3].key, MEASUREMENTS[3].isDecreaseGood)}
          </View>
          <View className="flex-row gap-3 mt-3">
            {renderMeasurementTile(MEASUREMENTS[4].label, MEASUREMENTS[4].unit, MEASUREMENTS[4].key, MEASUREMENTS[4].isDecreaseGood)}
            {renderMeasurementTile(MEASUREMENTS[5].label, MEASUREMENTS[5].unit, MEASUREMENTS[5].key, MEASUREMENTS[5].isDecreaseGood)}
          </View>
        </Card>

        {/* Comparison Section */}
        <Card className="mx-4 mt-4">
          <SectionHeader label={t('bio.monthlyCheckin')} />
          <SegmentedControl
            segments={segments}
            activeKey={activeTab}
            onSelect={(key) => setActiveTab(key as 'measures' | 'photos')}
            className="mt-3 mb-2"
          />

          {activeTab === 'measures' ? (
            <View className="mt-2">
              {allMonthly.map((metric, idx) => {
                const isFirst = idx === 0;
                const dateStr = new Date(metric.date).toLocaleDateString(getLocaleForLanguage(language));
                const infoSummary = `${metric.weight ?? '—'} kg · ${t('bio.waist')} ${metric.waist ?? '—'}cm · ${t('bio.chest')} ${metric.chest ?? '—'}cm`;

                return (
                  <View
                    key={metric.id}
                    className={`flex-row gap-4 py-3 items-center ${idx === allMonthly.length - 1 ? '' : 'border-b border-border/40'}`}
                  >
                    {/* Dot indicator */}
                    <View className="items-center justify-center">
                      {isFirst ? (
                        <View className="w-4 h-4 rounded-full border-4 border-primary/20 bg-primary" />
                      ) : (
                        <View className="w-4 h-4 rounded-full border-4 border-border bg-subtext" />
                      )}
                    </View>
                    {/* Content */}
                    <View className="flex-1">
                      <Text className="text-2xs font-bold text-subtext">
                        {dateStr}
                      </Text>
                      <Text className="text-sm text-text font-medium mt-0.5">
                        {infoSummary}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="mt-2">
              {allMonthly.map((metric, idx) => {
                const isFirst = idx === 0;
                const dateStr = new Date(metric.date).toLocaleDateString(getLocaleForLanguage(language));

                return (
                  <View
                    key={metric.id}
                    className={`flex-row gap-4 py-3 ${idx === allMonthly.length - 1 ? '' : 'border-b border-border/40'}`}
                  >
                    {/* Dot indicator */}
                    <View className="items-center justify-start pt-1.5">
                      {isFirst ? (
                        <View className="w-4 h-4 rounded-full border-4 border-primary/20 bg-primary" />
                      ) : (
                        <View className="w-4 h-4 rounded-full border-4 border-border bg-subtext" />
                      )}
                    </View>
                    {/* Content */}
                    <View className="flex-1">
                      <Text className="text-2xs font-bold text-subtext mb-2">
                        {dateStr}
                      </Text>
                      <View className="flex-row gap-2">
                        {POSES.map((pose) => {
                          const uri = metric[pose.key] as string | null;
                          return (
                            <View key={pose.key} className="w-[50px] h-[66px] rounded-lg border border-border overflow-hidden bg-text/5">
                              {uri ? (
                                <Image source={{ uri }} className="w-full h-full" resizeMode="cover" />
                              ) : (
                                <View className="flex-1 items-center justify-center">
                                  <Text className="text-2xs">📷</Text>
                                </View>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

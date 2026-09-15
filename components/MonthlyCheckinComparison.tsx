import { useState } from 'react';
import { View, Text, Image, ScrollView, TouchableOpacity } from 'react-native';
import { BodyMetric } from '@/src/types';
import { formatMonthYear, calculateChange, getPhotoOverlayData } from '@/src/utils/checkin';
import { PhotoOverlay } from './PhotoOverlay';
import { PhotoComparison } from './PhotoComparison';
import { CheckinGallery } from './CheckinGallery';
import { useI18n } from '@/src/i18n/index';

export type ComparisonPoseKey = 'photoFront' | 'photoBack' | 'photoSide';

export interface MonthlyCheckinComparisonProps {
  current: BodyMetric;
  previous: BodyMetric | null;
  allMetrics?: BodyMetric[];
  selectedPose?: ComparisonPoseKey | 'all';
  onSelectPose?: (pose: ComparisonPoseKey | 'all') => void;
  onSelectMonth?: (metric: BodyMetric) => void;
  onOpenSlider?: (beforeUri: string, afterUri: string, poseLabel: string) => void;
}

export function MonthlyCheckinComparison({
  current,
  previous,
  allMetrics,
  selectedPose: externalSelectedPose,
  onSelectPose,
  onSelectMonth,
  onOpenSlider,
}: MonthlyCheckinComparisonProps) {
  const { t } = useI18n();

  const [internalPose, setInternalPose] = useState<ComparisonPoseKey | 'all'>('all');
  const activePose = externalSelectedPose ?? internalPose;

  const [sliderModal, setSliderModal] = useState<{
    visible: boolean;
    beforeUri: string | null;
    afterUri: string | null;
    label: string;
  }>({
    visible: false,
    beforeUri: null,
    afterUri: null,
    label: '',
  });

  const handlePoseChange = (pose: ComparisonPoseKey | 'all') => {
    if (onSelectPose) {
      onSelectPose(pose);
    } else {
      setInternalPose(pose);
    }
  };

  const POSES: { key: ComparisonPoseKey; label: string }[] = [
    { key: 'photoFront', label: t('bioEvolution.front') },
    { key: 'photoBack', label: t('bioEvolution.back') },
    { key: 'photoSide', label: t('bioEvolution.side') },
  ];

  const visiblePoses = activePose === 'all'
    ? POSES
    : POSES.filter((p) => p.key === activePose);

  const currentOverlay = getPhotoOverlayData(current);
  const previousOverlay = previous ? getPhotoOverlayData(previous) : { weight: null, waist: null };

  const formatWeight = (val: number | null | undefined) => (val != null ? `${val.toFixed(1)} kg` : '—');
  const formatWaist = (val: number | null | undefined) => (val != null ? `${val.toFixed(1)} cm` : '—');

  const handleLaunchSlider = (beforeUri: string, afterUri: string, label: string) => {
    if (onOpenSlider) {
      onOpenSlider(beforeUri, afterUri, label);
    } else {
      setSliderModal({
        visible: true,
        beforeUri,
        afterUri,
        label,
      });
    }
  };

  return (
    <ScrollView className="flex-1 px-4" contentContainerStyle={{ gap: 20, paddingBottom: 40 }}>
      {/* Optional month gallery selector */}
      {allMetrics && allMetrics.length > 1 && onSelectMonth && (
        <View className="mb-2">
          <CheckinGallery
            metrics={allMetrics}
            selectedMetricId={current.id}
            onSelectMonth={onSelectMonth}
          />
        </View>
      )}

      {/* Pose filter selector */}
      <View className="flex-row justify-center gap-2 mb-1">
        <TouchableOpacity
          onPress={() => handlePoseChange('all')}
          className={`px-3 py-2 rounded-lg min-h-[44px] justify-center items-center ${activePose === 'all' ? 'bg-primary' : 'bg-card border border-border'}`}
          accessibilityRole="button"
          accessibilityState={{ selected: activePose === 'all' }}
          accessibilityLabel={t('equipment.all')}
        >
          <Text className={`text-xs font-bold ${activePose === 'all' ? 'text-onPrimary' : 'text-text'}`}>
            {t('equipment.all')}
          </Text>
        </TouchableOpacity>
        {POSES.map((pose) => (
          <TouchableOpacity
            key={pose.key}
            onPress={() => handlePoseChange(pose.key)}
            className={`px-3 py-2 rounded-lg min-h-[44px] justify-center items-center ${activePose === pose.key ? 'bg-primary' : 'bg-card border border-border'}`}
            accessibilityRole="button"
            accessibilityState={{ selected: activePose === pose.key }}
            accessibilityLabel={pose.label}
          >
            <Text className={`text-xs font-bold ${activePose === pose.key ? 'text-onPrimary' : 'text-text'}`}>
              {pose.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {visiblePoses.map((pose) => {
        const currentUri = current[pose.key] as string | null;
        const previousUri = previous ? (previous[pose.key] as string | null) : null;
        const canCompareInSlider = Boolean(previousUri && currentUri);

        return (
          <View
            key={pose.key}
            testID={`pose-card-${pose.key}`}
            className="gap-3 bg-card p-4 rounded-2xl border border-border"
          >
            <View className="flex-row justify-between items-center">
              <Text className="text-primaryText font-bold text-xs uppercase tracking-widest">
                {pose.label}
              </Text>
              {canCompareInSlider && (
                <TouchableOpacity
                  onPress={() => handleLaunchSlider(previousUri!, currentUri!, pose.label)}
                  className="bg-secondarySurface border border-border px-3 py-1.5 rounded-lg min-h-[44px] justify-center items-center"
                  accessibilityRole="button"
                  accessibilityLabel={`${t('photoComparison.compare')} ${pose.label}`}
                >
                  <Text className="text-secondaryText font-bold text-xs">
                    {t('photoComparison.compare')} Slider
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            <View className="flex-row gap-3">
              {/* Previous Month */}
              <View className="flex-1">
                <Text className="text-subtext text-xs text-center mb-1.5 font-medium">
                  {previous ? formatMonthYear(previous.date) : '—'}
                </Text>
                <View className="aspect-[3/4] bg-background rounded-xl border border-border overflow-hidden relative">
                  {previousUri ? (
                    <>
                      <Image source={{ uri: previousUri }} className="w-full h-full" resizeMode="cover" />
                      <PhotoOverlay weight={previousOverlay.weight} waist={previousOverlay.waist} />
                    </>
                  ) : (
                    <View className="flex-1 justify-center items-center p-2">
                      <Text className="text-3xl">📷</Text>
                      <Text className="text-subtext text-xs mt-2 text-center">
                        {t('bioEvolution.noPhoto') || t('bioEvolution.noPhotos')}
                      </Text>
                    </View>
                  )}
                </View>
                <View className="flex-row justify-between mt-2 px-1">
                  <Text className="text-subtext text-xs">{formatWeight(previous?.weight)}</Text>
                  <Text className="text-subtext text-xs">{formatWaist(previous?.waist)}</Text>
                </View>
              </View>

              {/* Current Month */}
              <View className="flex-1">
                <Text className="text-text text-xs text-center mb-1.5 font-bold">
                  {formatMonthYear(current.date)}
                </Text>
                <View className="aspect-[3/4] bg-background rounded-xl border border-border overflow-hidden relative">
                  {currentUri ? (
                    <>
                      <Image source={{ uri: currentUri }} className="w-full h-full" resizeMode="cover" />
                      <PhotoOverlay weight={currentOverlay.weight} waist={currentOverlay.waist} />
                    </>
                  ) : (
                    <View className="flex-1 justify-center items-center p-2">
                      <Text className="text-3xl">📷</Text>
                      <Text className="text-subtext text-xs mt-2 text-center">
                        {t('bioEvolution.noPhoto') || t('bioEvolution.noPhotos')}
                      </Text>
                    </View>
                  )}
                </View>
                <View className="flex-row justify-between mt-2 px-1">
                  <Text className="text-text text-xs font-bold">{formatWeight(current.weight)}</Text>
                  <Text className="text-text text-xs font-bold">{formatWaist(current.waist)}</Text>
                </View>
              </View>
            </View>

            {/* Change indicators */}
            {previous && (
              <View className="flex-row justify-center gap-6 pt-1">
                <View className="flex-row items-center gap-1">
                  {current.weight != null && previous.weight != null ? (
                    <Text
                      className={`text-sm font-bold ${current.weight < previous.weight ? 'text-successText' : 'text-dangerText'}`}
                    >
                      {calculateChange(current.weight, previous.weight)} kg
                    </Text>
                  ) : (
                    <Text className="text-sm font-bold text-subtext">—</Text>
                  )}
                </View>
                <View className="flex-row items-center gap-1">
                  {current.waist != null && previous.waist != null ? (
                    <Text
                      className={`text-sm font-bold ${current.waist < previous.waist ? 'text-successText' : 'text-dangerText'}`}
                    >
                      {calculateChange(current.waist, previous.waist)} cm
                    </Text>
                  ) : (
                    <Text className="text-sm font-bold text-subtext">—</Text>
                  )}
                </View>
              </View>
            )}
          </View>
        );
      })}

      {/* Internal PhotoComparison Modal fallback if onOpenSlider not passed */}
      <PhotoComparison
        visible={sliderModal.visible}
        beforeUri={sliderModal.beforeUri}
        afterUri={sliderModal.afterUri}
        label={sliderModal.label}
        beforeOverlay={previousOverlay}
        afterOverlay={currentOverlay}
        onClose={() =>
          setSliderModal({ visible: false, beforeUri: null, afterUri: null, label: '' })
        }
      />
    </ScrollView>
  );
}

import { View, Text, Image, ScrollView } from 'react-native';
import { BodyMetric } from '@/src/types';
import { formatMonthYear, calculateChange, getPhotoOverlayData } from '@/src/utils/checkin';
import { PhotoOverlay } from './PhotoOverlay';

interface MonthlyCheckinComparisonProps {
  current: BodyMetric;
  previous: BodyMetric | null;
}

const POSES: { key: keyof BodyMetric; label: string }[] = [
  { key: 'photoFront', label: 'FRENTE' },
  { key: 'photoBack', label: 'COSTAS' },
  { key: 'photoSide', label: 'LATERAL' },
];

export function MonthlyCheckinComparison({ current, previous }: MonthlyCheckinComparisonProps) {
  const currentOverlay = getPhotoOverlayData(current);
  const previousOverlay = previous ? getPhotoOverlayData(previous) : { weight: null, waist: null };

  return (
    <ScrollView className="flex-1 px-4" contentContainerStyle={{ gap: 20, paddingBottom: 40 }}>
      {POSES.map((pose) => {
        const currentUri = current[pose.key] as string | null;
        const previousUri = previous ? (previous[pose.key] as string | null) : null;

        return (
          <View key={pose.key} className="gap-3">
            <Text className="text-primary font-bold text-xs uppercase tracking-widest text-center">{pose.label}</Text>

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
                    <View className="flex-1 justify-center items-center">
                      <Text className="text-3xl">📷</Text>
                      <Text className="text-subtext text-xs mt-2">Sem foto</Text>
                    </View>
                  )}
                </View>
                <View className="flex-row justify-between mt-2 px-1">
                  <Text className="text-subtext text-xs">{previous?.weight ?? '—'} kg</Text>
                  <Text className="text-subtext text-xs">{previous?.waist ?? '—'} cm</Text>
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
                    <View className="flex-1 justify-center items-center">
                      <Text className="text-3xl">📷</Text>
                      <Text className="text-subtext text-xs mt-2">Sem foto</Text>
                    </View>
                  )}
                </View>
                <View className="flex-row justify-between mt-2 px-1">
                  <Text className="text-text text-xs font-bold">{current.weight ?? '—'} kg</Text>
                  <Text className="text-text text-xs font-bold">{current.waist ?? '—'} cm</Text>
                </View>
              </View>
            </View>

            {/* Change indicators */}
            {previous && (
              <View className="flex-row justify-center gap-6">
                <View className="flex-row items-center gap-1">
                  <Text className={`text-sm font-bold ${(current.weight ?? 0) < (previous.weight ?? 0) ? 'text-success' : 'text-danger'}`}>
                    {calculateChange(current.weight, previous.weight)} kg
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Text className={`text-sm font-bold ${(current.waist ?? 0) < (previous.waist ?? 0) ? 'text-success' : 'text-danger'}`}>
                    {calculateChange(current.waist, previous.waist)} cm
                  </Text>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
}

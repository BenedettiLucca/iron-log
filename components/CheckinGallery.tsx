import { useCallback } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, type ListRenderItemInfo } from 'react-native';
import { BodyMetric } from '@/src/types';
import { formatMonthYear } from '@/src/utils/checkin';
import { useI18n } from '@/src/i18n/index';

interface CheckinGalleryProps {
  metrics: BodyMetric[];
  selectedMetricId?: number | null;
  onSelectMonth: (metric: BodyMetric) => void;
}

const ITEM_WIDTH = 96; // 80px (w-20) + 16px (mx-2)

export function CheckinGallery({ metrics, selectedMetricId, onSelectMonth }: CheckinGalleryProps) {
  const { t } = useI18n();

  const renderItem = useCallback(
    ({ item: metric }: ListRenderItemInfo<BodyMetric>) => {
      const isSelected = selectedMetricId === metric.id;
      const monthLabel = formatMonthYear(metric.date);

      return (
        <TouchableOpacity
          onPress={() => onSelectMonth(metric)}
          className="items-center mx-2"
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          accessibilityLabel={t('checkin.galleryItemLabel', { month: monthLabel })}
          accessibilityHint={isSelected ? t('checkin.galleryItemSelectedHint') : t('checkin.galleryItemHint')}
        >
          <View className={`w-20 h-20 rounded-xl bg-background border-2 overflow-hidden ${isSelected ? 'border-primary' : 'border-border'}`}>
            {metric.photoFront ? (
              <Image source={{ uri: metric.photoFront }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="flex-1 justify-center items-center">
                <Text className="text-subtext text-lg">📷</Text>
              </View>
            )}
          </View>
          <Text className={`text-xs mt-1.5 font-medium ${isSelected ? 'text-primaryText font-bold' : 'text-subtext'}`}>
            {monthLabel}
          </Text>
        </TouchableOpacity>
      );
    },
    [onSelectMonth, selectedMetricId, t]
  );

  return (
    <FlatList
      horizontal
      showsHorizontalScrollIndicator={false}
      data={metrics}
      keyExtractor={(metric) => String(metric.id)}
      renderItem={renderItem}
      className="py-2"
      initialNumToRender={5}
      maxToRenderPerBatch={5}
      windowSize={3}
      getItemLayout={(_data, index) => ({
        length: ITEM_WIDTH,
        offset: ITEM_WIDTH * index,
        index,
      })}
    />
  );
}

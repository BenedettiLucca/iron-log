import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native';
import { BodyMetric } from '@/src/types';
import { formatMonthYear } from '@/src/utils/checkin';
import { useI18n } from '@/src/i18n/index';

interface CheckinGalleryProps {
  metrics: BodyMetric[];
  selectedMetricId?: number | null;
  onSelectMonth: (metric: BodyMetric) => void;
}

export function CheckinGallery({ metrics, selectedMetricId, onSelectMonth }: CheckinGalleryProps) {
  const { t } = useI18n();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-2">
      {metrics.map((metric) => {
        const isSelected = selectedMetricId === metric.id;
        const monthLabel = formatMonthYear(metric.date);

        return (
          <TouchableOpacity
            key={metric.id}
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
            <Text className={`text-xs mt-1.5 font-medium ${isSelected ? 'text-primary font-bold' : 'text-subtext'}`}>
              {monthLabel}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

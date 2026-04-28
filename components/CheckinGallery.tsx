import { View, Text, ScrollView, Image, TouchableOpacity } from 'react-native';
import { BodyMetric } from '@/src/types';
import { formatMonthYear } from '@/src/utils/checkin';

interface CheckinGalleryProps {
  metrics: BodyMetric[];
  onSelectMonth: (metric: BodyMetric) => void;
}

export function CheckinGallery({ metrics, onSelectMonth }: CheckinGalleryProps) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-2">
      {metrics.map((metric) => (
        <TouchableOpacity
          key={metric.id}
          onPress={() => onSelectMonth(metric)}
          className="items-center mx-2"
          accessibilityRole="button"
          accessibilityLabel={`Check-in de ${formatMonthYear(metric.date)}`}
        >
          <View className="w-20 h-20 rounded-xl bg-background border border-border overflow-hidden">
            {metric.photoFront ? (
              <Image source={{ uri: metric.photoFront }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="flex-1 justify-center items-center">
                <Text className="text-subtext text-lg">📷</Text>
              </View>
            )}
          </View>
          <Text className="text-subtext text-xs mt-1.5 font-medium">{formatMonthYear(metric.date)}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

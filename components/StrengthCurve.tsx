import { Text, View } from 'react-native';
import { Card } from './Card';
import { useI18n, getLocaleForLanguage } from '@/src/i18n';

interface StrengthCurveProps {
  currentWeight: number;
  previousWeights: number[];
  bestSet: { weight: number; reps: number; date: Date | null };
}

export function StrengthCurve({ currentWeight, previousWeights, bestSet }: StrengthCurveProps) {
  const { t, language } = useI18n();
  const locale = getLocaleForLanguage(language);
  // Calculate strength curve metrics
  const avgWeight = previousWeights.length > 0 ? previousWeights.reduce((sum, w) => sum + w, 0) / previousWeights.length : currentWeight;
  const minWeight = Math.min(...previousWeights, currentWeight);

  const trend = currentWeight >= avgWeight ? t('strengthCurve.trendUp') : t('strengthCurve.trendDown');
  const trendColor = currentWeight >= avgWeight ? 'text-success' : 'text-danger';

  return (
    <Card className="border-l border-accent/20 mt-4">
      <Text className="text-accent text-xs font-bold uppercase mb-3 tracking-widest">{t('strengthCurve.title')}</Text>

      {/* Current Stats */}
      <View className="mb-6">
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-1">
            <Text className="text-subtext text-xs font-bold uppercase">{t('strengthCurve.currentWeight')}</Text>
            <Text className="text-2xl font-black text-text">{currentWeight}kg</Text>
          </View>
          <View className="flex-1">
            <Text className="text-subtext text-xs font-bold uppercase">{t('strengthCurve.avg7Days')}</Text>
            <Text className="text-2xl font-bold text-text">{avgWeight.toFixed(1)}kg</Text>
          </View>
        </View>

        {/* Trend */}
        <View className="flex-row justify-between items-center mb-4">
          <View className="flex-1">
            <Text className="text-subtext text-xs font-bold uppercase">{t('strengthCurve.trend')}</Text>
            <Text className={`text-2xl font-bold ${trendColor}`}>
              {trend}
            </Text>
          </View>
          <View className="flex-1">
            <Text className="text-subtext text-xs font-bold uppercase">{t('strengthCurve.minMax')}</Text>
            <Text className="text-2xl font-black text-text">{minWeight}kg</Text>
          </View>
        </View>
      </View>

      {/* Best Performance */}
      {bestSet && (
        <Card className="border-l border-success/20 mt-4">
          <Text className="text-success text-xs font-bold uppercase mb-3 tracking-widest">{t('strengthCurve.bestSet')}</Text>

          <View className="mb-6">
            <View className="flex-row justify-between items-center mb-4">
              <View className="flex-1">
                <Text className="text-subtext text-xs font-bold uppercase">{t('strengthCurve.weight')}</Text>
                <Text className="text-2xl font-black text-text">{bestSet.weight}kg</Text>
                <Text className="text-subtext text-xs font-bold uppercase">{t('strengthCurve.reps', { count: bestSet.reps })}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-subtext text-xs font-bold uppercase">{t('strengthCurve.date')}</Text>
                <Text className="text-2xl font-black text-text">{bestSet.date ? new Date(bestSet.date).toLocaleDateString(locale) : '-'}</Text>
              </View>
            </View>

            <View className="flex-row justify-between items-center">
              <View className="flex-1">
                <Text className="text-subtext text-xs font-bold uppercase">{t('strengthCurve.volume')}</Text>
                <Text className="text-2xl font-black text-text">{(bestSet.weight * bestSet.reps).toFixed(0)}kg</Text>
              </View>
            </View>
          </View>
        </Card>
      )}


    </Card>
  );
}

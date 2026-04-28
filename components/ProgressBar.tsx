import { View, Text, Animated } from 'react-native';
import { useEffect, useRef } from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  variant?: 'header' | 'modal' | 'compact';
  showLabel?: boolean;
  animated?: boolean;
}

export function ProgressBar({
  current,
  total,
  variant = 'header',
  showLabel = true,
  animated = true,
}: ProgressBarProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;

  useEffect(() => {
    if (animated) {
      Animated.timing(progressAnim, {
        toValue: percentage,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(percentage);
    }
  }, [percentage, animated, progressAnim]);

  const getVariantClasses = () => {
    switch (variant) {
      case 'modal':
        return 'h-2';
      case 'compact':
        return 'h-1';
      case 'header':
      default:
        return 'h-1.5';
    }
  };

  return (
    <View className="w-full">
      {showLabel && variant !== 'compact' && (
        <Text className="text-text text-xs font-bold uppercase tracking-widest mb-2">
          {current} de {total} {total === 1 ? t('common.exerciseSingular') : t('common.exercisePlural')}
        </Text>
      )}
      <View className={`bg-border overflow-hidden ${getVariantClasses()}`}>
        <Animated.View
          className={`bg-primary ${getVariantClasses()}`}
          style={{
            width: progressAnim.interpolate({
              inputRange: [0, 100],
              outputRange: ['0%', '100%'],
            }),
          }}
        />
      </View>
    </View>
  );
}

import { View, Text } from 'react-native';
import { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { useI18n } from '../src/i18n/index';
import { useThemeColors } from '@/hooks/use-theme-colors';

interface ProgressBarProps {
  current: number;
  total: number;
  variant?: 'header' | 'modal' | 'compact';
  showLabel?: boolean;
  label?: string;
  accessibilityLabel?: string;
  isAccessible?: boolean;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function ProgressBar({
  current,
  total,
  variant = 'header',
  showLabel = true,
  label,
  accessibilityLabel,
  isAccessible = true,
}: ProgressBarProps) {
  const { t } = useI18n();
  const theme = useThemeColors();
  const progressValue = useSharedValue(0);
  const isReducedMotion = useReducedMotion();

  const safeTotal = (Number.isFinite(total) && total > 0) ? total : 0;
  const safeCurrent = (Number.isFinite(current) && safeTotal > 0) ? Math.max(0, Math.min(current, safeTotal)) : 0;
  const roundedPercentage = safeTotal > 0 ? Math.round((safeCurrent / safeTotal) * 100) : 0;
  const progress = safeTotal > 0 ? (safeCurrent / safeTotal) : 0;

  useEffect(() => {
    if (isReducedMotion) {
      progressValue.value = progress;
    } else {
      progressValue.value = withTiming(progress, { duration: 300 });
    }
  }, [progress, isReducedMotion, progressValue]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transformOrigin: 'left center',
      transform: [{ scaleX: progressValue.value }],
    };
  });

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

  const progressText = label ?? t('common.progressCount', { current: safeCurrent, total: safeTotal });
  const fillHeight = variant === 'modal' ? 8 : variant === 'compact' ? 4 : 6;

  return (
    <View
      className="w-full"
      accessible={isAccessible}
      accessibilityElementsHidden={!isAccessible}
      importantForAccessibility={isAccessible ? 'yes' : 'no-hide-descendants'}
      accessibilityRole={isAccessible ? 'progressbar' : undefined}
      accessibilityLabel={isAccessible ? accessibilityLabel ?? t('common.progress') : undefined}
      accessibilityValue={
        isAccessible
          ? { min: 0, max: 100, now: roundedPercentage, text: progressText }
          : undefined
      }
    >
      {showLabel && (
        <Text className="text-text text-xs font-bold mb-2">
          {progressText}
        </Text>
      )}
      <View className={`bg-border overflow-hidden ${getVariantClasses()}`}>
        <AnimatedView
          testID="progress-fill"
          style={[
            { backgroundColor: theme.primary, width: '100%', height: fillHeight },
            animatedStyle,
          ]}
        />
      </View>
    </View>
  );
}

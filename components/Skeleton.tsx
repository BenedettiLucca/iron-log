import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
  cancelAnimation,
} from 'react-native-reanimated';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useReactiveReducedMotion } from '@/hooks/use-reactive-reduced-motion';

interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  className?: string;
}

export function Skeleton({ width = '100%', height = 40, className = '' }: SkeletonProps) {
  const theme = useThemeColors();
  const isReducedMotion = useReactiveReducedMotion();
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    if (isReducedMotion) {
      opacity.value = 0.5;
      return;
    }
    opacity.value = withRepeat(
      withTiming(0.3, { duration: 800 }),
      -1,
      true
    );
    return () => {
      cancelAnimation(opacity);
    };
  }, [isReducedMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
    };
  });

  return (
    <View
      style={{ width, height }}
      className={className}
      accessible={false}
      accessibilityElementsHidden={true}
      importantForAccessibility="no-hide-descendants"
    >
      <Animated.View
        style={[
          {
            width: '100%',
            height: '100%',
            backgroundColor: theme.border,
            borderRadius: 8,
          },
          animatedStyle,
        ]}
      />
    </View>
  );
}

interface SkeletonCardProps {
  children?: React.ReactNode;
  className?: string;
}

export function SkeletonCard({ children, className = '' }: SkeletonCardProps) {
  return (
    <View className={`bg-card p-4 rounded-2xl border border-border ${className}`}>
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-1 mr-4">
          <Skeleton width="60%" height={20} className="mb-2" />
          <Skeleton width="80%" height={14} />
        </View>
        <View className="w-10 h-10 rounded-lg bg-subtext/30" />
      </View>
      {children}
    </View>
  );
}

interface SkeletonListProps {
  count?: number;
  className?: string;
}

export function SkeletonList({ count = 3, className = '' }: SkeletonListProps) {
  return (
    <View className={`gap-3 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i}>
          <Skeleton width="100%" height={16} className="mb-2" />
          <Skeleton width="40%" height={16} />
        </SkeletonCard>
      ))}
    </View>
  );
}

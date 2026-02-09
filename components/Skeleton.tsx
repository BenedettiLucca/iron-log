import React, { View } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  variant?: 'rect' | 'circle';
  className?: string;
}

/**
 * Animated skeleton loader component
 */
export function Skeleton({ width = '100%', height = 20, variant = 'rect', className = '' }: SkeletonProps) {
  const opacity = useSharedValue(0.5);

  // Animation loop
  opacity.value = withRepeat(
    withSequence(
      withTiming(1, { duration: 800 }),
      withTiming(0.5, { duration: 800 })
    ),
    -1,
    true
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const baseClasses = 'bg-subtext/20';

  if (variant === 'circle') {
    return (
      <Animated.View
        style={[animatedStyle, { width, height, borderRadius: height / 2 }]}
        className={`${baseClasses} ${className}`}
      />
    );
  }

  return (
    <Animated.View
      style={[animatedStyle, { width, height }]}
      className={`${baseClasses} rounded-lg ${className}`}
    />
  );
}

/**
 * Card skeleton loader
 */
export function CardSkeleton() {
  return (
    <View className="bg-card rounded-2xl p-4 border border-border shadow-sm">
      <View className="flex-row gap-4">
        <Skeleton width={60} height={60} variant="circle" />
        <View className="flex-1 gap-2">
          <Skeleton width="80%" height={20} />
          <Skeleton width="60%" height={16} />
        </View>
      </View>
    </View>
  );
}

/**
 * Text skeleton loader
 */
export function TextSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <View className="gap-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '70%' : '100%'} height={16} />
      ))}
    </View>
  );
}

/**
 * List skeleton loader
 */
export function ListSkeleton({ items = 3 }: { items?: number }) {
  return (
    <View className="gap-3">
      {Array.from({ length: items }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}

/**
 * Chart skeleton loader
 */
export function ChartSkeleton({ height = 200 }: { height?: number }) {
  return (
    <View className="bg-card rounded-2xl p-4 border border-border shadow-sm">
      <Skeleton width={120} height={16} className="mb-4" />
      <View className="flex-row justify-between items-end" style={{ height }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <View key={i} className="items-center gap-2">
            <Skeleton width={24} height={Math.random() * 100 + 50} />
            <Skeleton width={24} height={12} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Stats grid skeleton loader
 */
export function StatsSkeleton() {
  return (
    <View className="flex-row justify-between gap-3">
      {Array.from({ length: 2 }).map((_, i) => (
        <View key={i} className="flex-1 bg-card rounded-2xl p-4 border border-border shadow-sm">
          <Skeleton width={80} height={14} className="mb-2" />
          <Skeleton width={60} height={28} />
        </View>
      ))}
    </View>
  );
}

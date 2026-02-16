import { View, StyleSheet } from 'react-native';
import Animated, { useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

interface SkeletonProps {
  width?: string | number;
  height?: number;
  className?: string;
}

export function Skeleton({ width = '100%', height = 40, className = '' }: SkeletonProps) {
  const opacity = useSharedValue(0.5);

  // Animate opacity for skeleton effect
  opacity.value = withRepeat(
    withSequence(
      withTiming(0.3, { duration: 800 }),
      withTiming(0.6, { duration: 800 })
    ),
    -1 // Infinite loop
  );

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { height, opacity },
        typeof width === 'number' ? { width } : {},
      ]}
      className={`rounded-lg ${className}`}
    />
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

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#D1D5DB',
  },
});

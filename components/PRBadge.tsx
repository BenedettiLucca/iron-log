import React from 'react';
import { View, Text } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

interface PRBadgeProps {
  type?: 'weight' | 'reps' | 'volume' | 'new';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

const LABELS = {
  weight: 'PR',
  reps: 'REP PR',
  volume: 'VOL PR',
  new: 'NOVO',
};

const COLORS = {
  weight: 'bg-accent',
  reps: 'bg-success',
  volume: 'bg-secondary',
  new: 'bg-primary',
};

/**
 * Badge component for displaying Personal Records
 */
export function PRBadge({ type = 'weight', size = 'sm', animated = true }: PRBadgeProps) {
  const sizeClasses = {
    sm: 'px-2 py-0.5',
    md: 'px-2.5 py-1',
    lg: 'px-3 py-1.5',
  };

  const textSizes = {
    sm: 'text-[8px]',
    md: 'text-[10px]',
    lg: 'text-xs',
  };

  const badgeContent = (
    <View
      className={`${COLORS[type]} rounded-lg`}
      style={{ shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 }}
    >
      <Text
        className={`${textSizes[size]} font-black uppercase text-white tracking-wider`}
      >
        {LABELS[type]}
      </Text>
    </View>
  );

  if (animated) {
    return (
      <Animated.View
        entering={ZoomIn.duration(300)}
        className={sizeClasses[size]}
      >
        {badgeContent}
      </Animated.View>
    );
  }

  return <View className={sizeClasses[size]}>{badgeContent}</View>;
}

/**
 * Compact PR indicator for inline display
 */
export function PRIndicator({ size = 16 }: { size?: number }) {
  return (
    <View
      style={{ width: size, height: size }}
      className="bg-accent rounded-full items-center justify-center"
    >
      <Text className="text-white text-[8px] font-black">PR</Text>
    </View>
  );
}

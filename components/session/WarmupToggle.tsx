import React, { useEffect, useRef } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReactiveReducedMotion } from '@/hooks/use-reactive-reduced-motion';

interface WarmupToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  label: string;
  accessibilityLabel: string;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function WarmupToggle({
  value,
  onValueChange,
  label,
  accessibilityLabel,
}: WarmupToggleProps) {
  const reducedMotion = useReactiveReducedMotion();
  const progress = useSharedValue(value ? 1 : 0);
  const previousValue = useRef(value);

  useEffect(() => {
    const target = value ? 1 : 0;
    const valueChanged = previousValue.current !== value;
    previousValue.current = value;

    if (!valueChanged || reducedMotion) {
      progress.value = target;
      return;
    }
    progress.value = withTiming(target, { duration: 160 });
  }, [progress, reducedMotion, value]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 20 }],
  }));

  return (
    <View className="flex-row items-center justify-between mb-3 py-1.5 bg-background rounded-lg px-3">
      <View className="flex-row items-center gap-2">
        <Text accessible={false} className="text-lg">🔥</Text>
        <Text className="text-text font-bold text-xs">{label}</Text>
      </View>
      <TouchableOpacity
        onPress={() => onValueChange(!value)}
        activeOpacity={0.8}
        className="w-12 h-11 justify-center"
        accessibilityRole="switch"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ checked: value }}
      >
        <View className={`w-12 h-7 rounded-full p-0.5 ${value ? 'bg-warning' : 'bg-border'}`}>
          <AnimatedView
            className="w-5 h-5 rounded-full bg-white shadow-sm"
            style={thumbStyle}
          />
        </View>
      </TouchableOpacity>
    </View>
  );
}

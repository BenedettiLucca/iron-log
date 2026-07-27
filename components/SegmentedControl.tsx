import { useRef, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReactiveReducedMotion } from '@/hooks/use-reactive-reduced-motion';

interface Segment {
  key: string;
  label: string;
}

interface SegmentedControlProps {
  segments: Segment[];
  activeKey: string;
  onSelect: (key: string) => void;
  className?: string;
  accessibilityLabel?: string;
}

const AnimatedView = Animated.createAnimatedComponent(View);

function addSoftBreakOpportunities(label: string) {
  return label
    .split(/(\s+)/)
    .map((part) => {
      const characters = Array.from(part);
      if (/^\s+$/.test(part) || characters.length <= 7) return part;
      return characters.join('\u200B');
    })
    .join('');
}

interface SegmentOptionProps {
  segment: Segment;
  isActive: boolean;
  isReducedMotion: boolean;
  onSelect: () => void;
}

function SegmentOption({ segment, isActive, isReducedMotion, onSelect }: SegmentOptionProps) {
  const progress = useSharedValue(isActive ? 1 : 0);
  const isFirstRender = useRef(true);
  const displayLabel = addSoftBreakOpportunities(segment.label);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const target = isActive ? 1 : 0;
    if (isReducedMotion) {
      progress.value = target;
    } else {
      progress.value = withTiming(target, { duration: 160 });
    }
  }, [isActive, isReducedMotion, progress]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: progress.value,
      transform: [{ scale: 0.96 + progress.value * 0.04 }],
    };
  });

  return (
    <Pressable
      onPress={() => {
        if (!isActive) {
          onSelect();
        }
      }}
      accessibilityRole="tab"
      accessibilityLabel={segment.label}
      accessibilityState={{ selected: isActive }}
      className="flex-1 min-w-0 min-h-[44px] items-center justify-center px-2 rounded-full active:opacity-[0.85]"
    >
      <AnimatedView
        testID={`segment-indicator-${segment.key}`}
        pointerEvents="none"
        accessible={false}
        style={animatedStyle}
        className="absolute inset-0 rounded-full bg-card shadow-sm"
      />
      <Text
        className={`w-full min-w-0 shrink text-xs font-bold leading-4 text-center z-10 ${
          isActive ? 'text-text' : 'text-subtext'
        }`}
      >
        {displayLabel}
      </Text>
    </Pressable>
  );
}

export function SegmentedControl({
  segments,
  activeKey,
  onSelect,
  className = '',
  accessibilityLabel,
}: SegmentedControlProps) {
  const isReducedMotion = useReactiveReducedMotion();

  return (
    <View style={{ flexShrink: 0 }} className={className}>
      <View
        className="flex-row items-stretch bg-primary/5 rounded-full p-0.5"
        accessibilityRole="tablist"
        accessibilityLabel={accessibilityLabel}
      >
        {segments.map((segment) => (
          <SegmentOption
            key={segment.key}
            segment={segment}
            isActive={segment.key === activeKey}
            isReducedMotion={isReducedMotion}
            onSelect={() => onSelect(segment.key)}
          />
        ))}
      </View>
    </View>
  );
}

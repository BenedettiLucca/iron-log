import { View, Text, TouchableOpacity } from 'react-native';

interface Segment {
  key: string;
  label: string;
}

interface SegmentedControlProps {
  segments: Segment[];
  activeKey: string;
  onSelect: (key: string) => void;
  className?: string;
}

export function SegmentedControl({
  segments,
  activeKey,
  onSelect,
  className = '',
}: SegmentedControlProps) {
  return (
    <View style={{ flexShrink: 0 }} className={className}>
      <View className="flex-row bg-primary/5 rounded-full p-0.5">
        {segments.map((segment) => {
          const isActive = segment.key === activeKey;
          return (
            <TouchableOpacity
              key={segment.key}
              onPress={() => onSelect(segment.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={segment.label}
              className={`flex-1 items-center justify-center py-2 px-3 rounded-full ${
                isActive ? 'bg-card shadow-sm' : ''
              }`}
              activeOpacity={0.7}
            >
              <Text
                className={`text-xs font-bold ${
                  isActive ? 'text-text' : 'text-subtext'
                }`}
              >
                {segment.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

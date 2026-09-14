import { View, Text } from 'react-native';

interface PhotoOverlayProps {
  weight: string | null;
  waist: string | null;
}

export function PhotoOverlay({ weight, waist }: PhotoOverlayProps) {
  const hasWeight = Boolean(weight && weight.trim());
  const hasWaist = Boolean(waist && waist.trim());

  if (!hasWeight && !hasWaist) return null;

  const label = [hasWeight ? weight : null, hasWaist ? waist : null].filter(Boolean).join(', ');

  return (
    <View
      testID="photo-overlay"
      accessible
      accessibilityLabel={label}
      className="absolute bottom-0 left-0 right-0 flex-row justify-between px-3 py-2"
    >
      {hasWeight && (
        <View className="bg-black/60 px-2.5 py-1 rounded-lg">
          <Text className="text-white text-xs font-bold">{weight}</Text>
        </View>
      )}
      {hasWaist && (
        <View className="bg-black/60 px-2.5 py-1 rounded-lg">
          <Text className="text-white text-xs font-bold">{waist}</Text>
        </View>
      )}
    </View>
  );
}

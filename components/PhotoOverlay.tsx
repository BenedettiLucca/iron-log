import { View, Text } from 'react-native';

interface PhotoOverlayProps {
  weight: string | null;
  waist: string | null;
}

export function PhotoOverlay({ weight, waist }: PhotoOverlayProps) {
  if (!weight && !waist) return null;

  return (
    <View testID="photo-overlay" className="absolute bottom-0 left-0 right-0 flex-row justify-between px-3 py-2">
      {weight && (
        <View className="bg-black/60 px-2.5 py-1 rounded-lg">
          <Text className="text-white text-xs font-bold">{weight}</Text>
        </View>
      )}
      {waist && (
        <View className="bg-black/60 px-2.5 py-1 rounded-lg">
          <Text className="text-white text-xs font-bold">{waist}</Text>
        </View>
      )}
    </View>
  );
}

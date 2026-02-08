import React, { View, Text, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';

interface SetCardProps {
  setNumber: number;
  weight: number;
  reps?: number;
  duration?: number;
  rir?: number | null;
  isPR?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onPress?: () => void;
}

export function SetCard({
  setNumber,
  weight,
  reps,
  duration,
  rir,
  isPR = false,
  onEdit,
  onDelete,
  onPress,
}: SetCardProps) {
  let swipeableRef: Swipeable | null = null;

  const renderRightActions = () => {
    if (!onEdit && !onDelete) return null;

    return (
      <View className="flex-row items-center ml-[-1px]">
        {onEdit && (
          <TouchableOpacity
            className="w-20 h-full justify-center items-center bg-secondary"
            onPress={() => {
              swipeableRef?.close();
              onEdit();
            }}
          >
            <Text className="text-white text-sm font-semibold">Editar</Text>
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            className="w-20 h-full justify-center items-center bg-danger"
            onPress={() => {
              swipeableRef?.close();
              onDelete();
            }}
          >
            <Text className="text-white text-sm font-semibold">Excluir</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const getRirColorClass = (rir: number) => {
    if (rir <= 1) return 'text-danger'; // Red - near failure
    if (rir <= 3) return 'text-success'; // Green - good range
    return 'text-secondary'; // Blue - light
  };

  const content = (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className={`p-3 rounded-xl border flex-row items-center min-h-[56px] ${
        isPR ? 'bg-accent/10 border-accent' : 'bg-card border-border'
      }`}
    >
      <View className="mr-3 items-center">
        <Text className="text-subtext font-bold text-sm">#{setNumber}</Text>
        {isPR && (
          <View className="bg-accent px-1.5 py-0.5 rounded mt-1">
            <Text className="text-text text-[10px] font-bold">PR</Text>
          </View>
        )}
      </View>

      <View className="flex-1">
        <Text className="text-text text-base font-semibold">
          {weight > 0 ? `${weight}kg × ` : ''}
          {duration !== undefined ? `${duration}s` : `${reps || 0} reps`}
        </Text>
      </View>

      <View className="ml-3">
        {rir !== null && rir !== undefined && (
          <Text className={`text-xs font-semibold ${getRirColorClass(rir)}`}>RIR {rir}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  if (onEdit || onDelete) {
    return (
      <Swipeable
        ref={(ref) => { swipeableRef = ref; }}
        renderRightActions={renderRightActions}
        rightThreshold={40}
      >
        {content}
      </Swipeable>
    );
  }

  return content;
}

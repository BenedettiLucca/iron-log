import { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useHaptics } from '@/hooks/use-haptics';

interface SetCardProps {
  setNumber: number;
  weight: number;
  reps?: number;
  duration?: number;
  rir?: number | null;
  isPR?: boolean;
  index?: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onPress?: () => void;
}

function SetCard({
  setNumber,
  weight,
  reps,
  duration,
  rir,
  isPR = false,
  index = 0,
  onEdit,
  onDelete,
  onPress,
}: SetCardProps) {
  let swipeableRef: Swipeable | null = null;
  const { trigger } = useHaptics();

  const renderRightActions = () => {
    if (!onEdit && !onDelete) return null;

    return (
      <View className="flex-row items-center ml-2 h-full">
        {onEdit && (
          <TouchableOpacity
            className="w-16 h-full justify-center items-center bg-secondary rounded-l-2xl"
            onPress={() => {
              trigger('medium');
              swipeableRef?.close();
              onEdit();
            }}
          >
            <Text className="text-white text-xs font-bold uppercase">Editar</Text>
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            className={`w-16 h-full justify-center items-center bg-danger ${!onEdit ? 'rounded-l-2xl' : ''} rounded-r-2xl`}
            onPress={() => {
              trigger('warning');
              swipeableRef?.close();
              onDelete();
            }}
          >
            <Text className="text-white text-xs font-bold uppercase">Excluir</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const getRirColorClass = (rir: number) => {
    if (rir <= 1) return 'text-danger bg-danger/10 border-danger/20';
    if (rir <= 3) return 'text-success bg-success/10 border-success/20';
    return 'text-secondary bg-secondary/10 border-secondary/20';
  };

  const content = (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      className="mb-3"
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        className={`p-4 rounded-2xl border flex-row items-center min-h-[64px] shadow-sm ${
          isPR ? 'bg-accent/10 border-accent' : 'bg-card border-border'
        }`}
      >
        <View className="mr-4 items-center justify-center w-8">
          <Text className="text-subtext/50 font-black text-xs uppercase tracking-widest">SET</Text>
          <Text className="text-text font-black text-xl leading-5">{setNumber}</Text>
          {isPR && (
            <View className="bg-accent px-1.5 py-0.5 rounded mt-1 absolute -top-2 -right-2 transform rotate-12 shadow-sm">
              <Text className="text-text text-[8px] font-bold">PR</Text>
            </View>
          )}
        </View>

        <View className="h-8 w-[1px] bg-border mr-4" />

        <View className="flex-1 flex-row items-baseline gap-1">
          <Text className="text-text text-2xl font-black tracking-tight">
            {weight > 0 ? weight : '-'}
          </Text>
          <Text className="text-subtext text-xs font-bold uppercase mr-2">kg</Text>

          <Text className="text-subtext/50 text-lg font-light">×</Text>

          <Text className="text-text text-2xl font-black tracking-tight ml-2">
             {duration !== undefined ? duration : (reps || 0)}
          </Text>
          <Text className="text-subtext text-xs font-bold uppercase">
            {duration !== undefined ? 's' : 'reps'}
          </Text>
        </View>

        <View className="ml-3">
          {rir !== null && rir !== undefined && (
            <View className={`px-2.5 py-1 rounded-lg border ${getRirColorClass(rir)}`}>
              <Text className={`text-[10px] font-bold uppercase ${getRirColorClass(rir).split(' ')[0]}`}>
                RIR {rir}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  if (onEdit || onDelete) {
    return (
      <Swipeable
        ref={(ref) => { swipeableRef = ref; }}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        containerStyle={{ overflow: 'visible' }}
      >
        {content}
      </Swipeable>
    );
  }

  return content;
}

export default memo(SetCard);

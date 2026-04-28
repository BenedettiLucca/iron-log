import { memo, useRef } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '../src/i18n/index';

interface SetCardProps {
  setNumber: number;
  weight: number;
  reps?: number;
  duration?: number;
  rir?: number | null;
  isPR?: boolean;
  isWarmup?: boolean;
  isEdited?: boolean;
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
  isWarmup = false,
  isEdited = false,
  index = 0,
  onEdit,
  onDelete,
  onPress,
}: SetCardProps) {
  const { t } = useI18n();
  const swipeableRef = useRef<Swipeable | null>(null);
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
              swipeableRef.current?.close();
              onEdit();
            }}
            accessibilityLabel={t("session.editSet")}
            accessibilityRole="button"
          >
            <Text className="text-white text-xs font-bold uppercase">Editar</Text>
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            className={`w-16 h-full justify-center items-center bg-danger ${!onEdit ? 'rounded-l-2xl' : ''} rounded-r-2xl`}
            onPress={() => {
              trigger('warning');
              swipeableRef.current?.close();
              onDelete();
            }}
            accessibilityLabel={t("session.deleteSet")}
            accessibilityRole="button"
          >
            <Text className="text-white text-xs font-bold uppercase">Excluir</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const getRirColorClass = (rir: number) => {
    if (rir <= 1) return 'text-danger bg-danger/20 border-danger/30';
    if (rir <= 3) return 'text-success bg-success/20 border-success/30';
    return 'text-secondary bg-secondary/20 border-secondary/30';
  };

  const content = (
    <Animated.View
      entering={FadeInDown.delay(index * 50).springify()}
      className="mb-2"
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityLabel={`Série ${setNumber}, ${weight > 0 ? weight + 'kg' : 'sem carga'} ${duration !== undefined ? duration + 's' : (reps || 0) + ' reps'} ${rir !== null && rir !== undefined ? 'RIR ' + rir : ''} ${isPR ? 'Recorde pessoal' : ''} ${isWarmup ? 'Aquecimento' : ''}`}
        accessibilityRole="button"
        className={`p-3 rounded-2xl border flex-row items-center min-h-[52px] shadow-sm ${
          isPR ? 'bg-accent/10 border-accent' : isWarmup ? 'bg-warning/5 border-warning/30 border-dashed' : 'bg-card border-border'
        }`}
      >
        <View className="mr-4 items-center justify-center w-8">
          <Text className="text-subtext/50 font-black text-xs uppercase tracking-widest">SET</Text>
          <Text className="text-text font-black text-xl leading-5">{setNumber}</Text>
          {isPR && (
            <View className="bg-accent px-1.5 py-0.5 rounded mt-1 absolute -top-2 -right-2 transform rotate-12 shadow-sm">
              <Text className="text-text text-2xs font-bold">PR</Text>
            </View>
          )}
          {isWarmup && (
            <View className="bg-warning/80 px-1.5 py-0.5 rounded mt-1 absolute -top-2 -right-2 shadow-sm">
              <Text className="text-white text-2xs font-bold uppercase">🔥</Text>
            </View>
          )}
          {isEdited && (
            <View className="bg-secondary px-1 py-0.5 rounded mt-1">
              <Text className="text-white text-2xs font-bold">EDIT</Text>
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
              <Text className={`text-xs font-bold uppercase ${getRirColorClass(rir).split(' ')[0]}`}>
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
        ref={(ref) => { swipeableRef.current = ref; }}
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

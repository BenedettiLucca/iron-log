import { memo, useRef, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useHaptics } from '@/hooks/use-haptics';
import { useI18n } from '../src/i18n/index';
import { getRirColor } from '@/src/utils/exercise';
import { Colors } from '@/constants/colors';
import { SetActionsDialog } from './SetActionsDialog';

interface SetCardProps {
  setNumber: number;
  weight: number;
  reps?: number;
  duration?: number;
  rir?: number | null;
  isWarmup?: boolean;
  isEdited?: boolean;
  animateEntry?: boolean;
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
  isWarmup = false,
  isEdited = false,
  animateEntry = false,
  onEdit,
  onDelete,
  onPress,
}: SetCardProps) {
  const { t } = useI18n();
  const swipeableRef = useRef<Swipeable | null>(null);
  const { trigger } = useHaptics();
  const [actionsVisible, setActionsVisible] = useState(false);

  const handleEdit = () => {
    trigger('medium');
    setActionsVisible(false);
    swipeableRef.current?.close();
    onEdit?.();
  };

  const handleDelete = () => {
    trigger('warning');
    setActionsVisible(false);
    swipeableRef.current?.close();
    onDelete?.();
  };

  const handleOpenActions = () => {
    trigger('selection');
    setActionsVisible(true);
  };

  const weightLabel = weight > 0 ? `${weight}kg` : t('setCard.noWeight');
  const performanceLabel = duration !== undefined
    ? t('setCard.durationSeconds', { duration })
    : t('setCard.repsCount', { reps: reps || 0 });
  const accessibilityDetails = [
    weightLabel,
    performanceLabel,
    rir !== null && rir !== undefined ? t('setCard.rir', { rir }) : undefined,
    isWarmup ? t('setCard.warmup') : undefined,
  ].filter(Boolean).join(', ');

  const statusLabels = [
    isWarmup ? t('setCard.warmup') : undefined,
    isEdited ? t('setCard.edited') : undefined,
  ].filter((label): label is string => Boolean(label));

  const renderRightActions = () => {
    if (!onEdit && !onDelete) return null;

    return (
      <View className="flex-row items-center ml-2 h-full">
        {onEdit && (
          <TouchableOpacity
            className="w-16 h-full justify-center items-center bg-secondary rounded-l-2xl"
            onPress={handleEdit}
            accessibilityLabel={t("session.editSet")}
            accessibilityRole="button"
          >
            <Text className="text-onSecondary text-xs font-bold uppercase">{t('common.edit')}</Text>
          </TouchableOpacity>
        )}
        {onDelete && (
          <TouchableOpacity
            className={`w-16 h-full justify-center items-center bg-danger ${!onEdit ? 'rounded-l-2xl' : ''} rounded-r-2xl`}
            onPress={handleDelete}
            accessibilityLabel={t("session.deleteSet")}
            accessibilityRole="button"
          >
            <Text className="text-onDanger text-xs font-bold uppercase">{t('common.delete')}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const getRirColorClass = (rirValue: number) => {
    const color = getRirColor(rirValue);
    if (color === Colors.red400) return 'text-dangerText bg-dangerSurface border-dangerText/30';
    if (color === Colors.success) return 'text-successText bg-successSurface border-successText/30';
    return 'text-secondaryText bg-secondarySurface border-secondaryText/30';
  };

  const content = (
    <Animated.View
      entering={animateEntry ? FadeInDown.springify() : undefined}
      className="mb-2"
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityLabel={t('setCard.accessibilityLabel', { setNumber, details: accessibilityDetails })}
        accessibilityHint={onEdit || onDelete ? t('setCard.actionsHint') : undefined}
        accessibilityRole="button"
        accessibilityActions={[
          ...(onEdit ? [{ name: 'edit', label: t('setCard.editAction') }] : []),
          ...(onDelete ? [{ name: 'delete', label: t('setCard.deleteAction') }] : []),
        ]}
        onAccessibilityAction={(event) => {
          switch (event.nativeEvent.actionName) {
            case 'edit':
              if (onEdit) handleEdit();
              break;
            case 'delete':
              if (onDelete) handleDelete();
              break;
          }
        }}
        className={`p-3 rounded-2xl border flex-row items-center min-h-[52px] shadow-sm ${
          isWarmup ? 'bg-warningSurface border-warningText/30 border-dashed' : 'bg-card border-border'
        }`}
      >
        <View className="mr-4 items-center justify-center">
          <View className="w-8 h-8 rounded-full bg-primary items-center justify-center">
            <Text className="text-onPrimary font-bold text-sm">{setNumber}</Text>
          </View>
        </View>

        <View className="flex-1">
          <View className="flex-row items-baseline gap-1">
            <Text className="text-text text-2xl font-black tracking-tight">
              {weight > 0 ? weight : '-'}
            </Text>
            <Text className="text-subtext text-xs font-bold uppercase mr-2">kg</Text>

            <Text className="text-subtext/50 text-lg font-light">×</Text>

            <Text className="text-text text-2xl font-black tracking-tight ml-2">
              {duration !== undefined ? duration : (reps || 0)}
            </Text>
            <Text className="text-subtext text-xs font-bold uppercase">
              {duration !== undefined ? 's' : t('exercise.reps')}
            </Text>
          </View>
          {statusLabels.length > 0 && (
            <Text className="text-subtext text-xs font-medium mt-0.5">
              {statusLabels.join(' · ')}
            </Text>
          )}
        </View>

        <View className="ml-3 flex-row items-center gap-2">
          {rir !== null && rir !== undefined && (
            <View className={`px-2.5 py-1 rounded-lg border ${getRirColorClass(rir)}`}>
              <Text className={`text-xs font-bold uppercase ${getRirColorClass(rir).split(' ')[0]}`}>
                RIR {rir}
              </Text>
            </View>
          )}
          {(onEdit || onDelete) && (
            <TouchableOpacity
              onPress={handleOpenActions}
              accessibilityRole="button"
              accessibilityLabel={t('setCard.openActions')}
              className="w-11 h-11 items-center justify-center rounded-xl bg-background border border-border"
            >
              <Text className="text-subtext font-bold text-base tracking-widest">•••</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  if (onEdit || onDelete) {
    return (
      <>
        <SetActionsDialog
          visible={actionsVisible}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCancel={() => setActionsVisible(false)}
        />
        <Swipeable
          ref={(ref) => { swipeableRef.current = ref; }}
          renderRightActions={renderRightActions}
          rightThreshold={40}
          containerStyle={{ overflow: 'visible' }}
        >
          {content}
        </Swipeable>
      </>
    );
  }

  return content;
}

export default memo(SetCard);

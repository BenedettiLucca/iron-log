import { View, Text, TouchableOpacity, Animated, PanResponder } from 'react-native';
import { useEffect, useRef } from 'react';
import { formatTimer } from '@/src/utils/timer';
import { useI18n } from '../src/i18n/index';

interface RestTimerProps {
  visible: boolean;
  seconds: number;
  status: 'idle' | 'running' | 'finished';
  onClose: () => void;
  onSkip: () => void;
  onAddTime: (sec: number) => void;
  nextExerciseName?: string;
}

export function RestTimer({
  visible,
  seconds,
  status,
  onClose,
  onSkip,
  onAddTime,
  nextExerciseName,
}: RestTimerProps) {
  const { t } = useI18n();
  const slideAnim = useRef(new Animated.Value(1)).current;
  const panOffset = useRef(0);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dy) > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
      },
      onPanResponderGrant: () => {
        panOffset.current = 0;
      },
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          panOffset.current = gestureState.dy;
          slideAnim.setValue(gestureState.dy / 500);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (gestureState.dy > 100) {
          Animated.timing(slideAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }).start(() => onCloseRef.current());
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 65,
            friction: 11,
          }).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(1);
    }
  }, [visible, slideAnim]);

  if (!visible) return null;

  const slideOffset = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 500]
  });

  return (
    <>
      {/* Backdrop - tap to close */}
      <TouchableOpacity
        activeOpacity={1}
        className="absolute top-0 left-0 right-0 bottom-0 bg-black/40"
        onPress={onClose}
      />

      {/* Bottom Sheet with swipe-to-dismiss */}
      <Animated.View
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl pt-3 pb-8 px-6 shadow-xl"
        style={{
          transform: [{ translateY: slideOffset }],
          zIndex: 999,
          elevation: 999,
        }}
        {...panResponder.panHandlers}
      >
        <View className="w-10 h-1 bg-border rounded-full self-center mb-5" />

        <View className="items-center">
          <Text className="text-subtext text-sm font-bold uppercase tracking-widest mb-2">{t('restTimer.rest')}</Text>

          <Text className={`text-7xl font-mono font-bold mb-4 ${status === 'finished' ? 'text-success' : 'text-primary'}`}>
            {formatTimer(seconds)}
          </Text>

          <Text className={`text-base font-medium mb-6 ${status === 'finished' ? 'text-success' : 'text-text'}`}>
            {status === 'finished' ? t('restTimer.readyForNextSet') : t('restTimer.resting')}
          </Text>

          {/* Quick Actions */}
          <View className="flex-row gap-3 w-full justify-center mb-6">
            <TouchableOpacity
              className="flex-1 bg-background p-4 rounded-xl border border-border items-center min-h-[52px] justify-center"
              onPress={() => onAddTime(30)}
              accessibilityLabel={t('restTimer.add30sAccessibility')}
              accessibilityRole="button"
            >
              <Text className="text-text font-bold text-base">+30s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 bg-background p-4 rounded-xl border border-border items-center min-h-[52px] justify-center"
              onPress={() => onAddTime(-10)}
              accessibilityLabel={t('restTimer.minus10sAccessibility')}
              accessibilityRole="button"
            >
              <Text className="text-text font-bold text-base">-10s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-1 p-4 rounded-xl items-center min-h-[52px] justify-center ${status === 'finished' ? 'bg-success' : 'bg-primary'}`}
              onPress={onSkip}
              accessibilityLabel={status === 'finished' ? t('restTimer.continueAccessibility') : t('restTimer.skipAccessibility')}
              accessibilityRole="button"
            >
              <Text className="text-white font-bold text-base">{status === 'finished' ? t('restTimer.continue') : t('restTimer.skip')}</Text>
            </TouchableOpacity>
          </View>

          {nextExerciseName && (
            <View className="items-center pt-4 border-t border-border w-full">
              <Text className="text-subtext text-xs font-bold uppercase mb-1">{t('restTimer.nextExerciseLabel')}</Text>
              <Text className="text-text font-semibold text-base">{nextExerciseName}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </>
  );
}

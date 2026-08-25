import { View, Text, TouchableOpacity, Animated, PanResponder, Modal, Keyboard, AccessibilityInfo } from 'react-native';
import type { PanResponderGestureState } from 'react-native';
import { useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReactiveReducedMotion } from '@/hooks/use-reactive-reduced-motion';
import { focusAccessibilityNode } from '@/src/utils/accessibility';
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

// A swipe is a deliberate downward drag: it must travel vertically AND stay
// vertically dominant. 0.9 tolerance (≈48°) accepts natural diagonal drift —
// the strict 1.25 ratio (≈38°) captured so late that the sheet never tracked
// the finger and dismissed abruptly on release (S5 device QA regression).
const isDownwardDismissGesture = (gestureState: PanResponderGestureState) =>
  gestureState.dy > 18 && gestureState.dy > Math.abs(gestureState.dx) * 0.9;

const shouldDismissFromGesture = (gestureState: PanResponderGestureState) =>
  gestureState.dy > 100 || (gestureState.dy > 40 && gestureState.vy > 0.8);

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
  const insets = useSafeAreaInsets();
  const reducedMotion = useReactiveReducedMotion();
  const slideAnim = useRef(new Animated.Value(1)).current;
  const titleRef = useRef<Text>(null);
  const announcedRef = useRef(false);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const reducedMotionRef = useRef(reducedMotion);
  useEffect(() => {
    reducedMotionRef.current = reducedMotion;
  }, [reducedMotion]);

  const resetSlidePosition = () => {
    slideAnim.stopAnimation();
    if (reducedMotionRef.current) {
      slideAnim.setValue(0);
      return;
    }

    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => isDownwardDismissGesture(gestureState),
      onMoveShouldSetPanResponderCapture: (_, gestureState) => isDownwardDismissGesture(gestureState),
      onPanResponderMove: (evt, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(gestureState.dy / 500);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        if (shouldDismissFromGesture(gestureState)) {
          slideAnim.stopAnimation();
          if (reducedMotionRef.current) {
            slideAnim.setValue(1);
            onCloseRef.current();
          } else {
            Animated.timing(slideAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: true,
            }).start((res) => {
              if (res && res.finished === false) {
                return;
              }
              onCloseRef.current();
            });
          }
        } else {
          resetSlidePosition();
        }
      },
      onPanResponderTerminate: resetSlidePosition,
    })
  ).current;

  useEffect(() => {
    slideAnim.stopAnimation();

    if (visible) {
      if (reducedMotion) {
        slideAnim.setValue(0);
      } else {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 11,
        }).start();
      }
    } else {
      slideAnim.setValue(1);
    }

    return () => {
      slideAnim.stopAnimation();
    };
  }, [visible, slideAnim, reducedMotion]);

  useEffect(() => {
    if (!visible || status !== 'finished') {
      announcedRef.current = false;
      return;
    }

    if (!announcedRef.current) {
      AccessibilityInfo.announceForAccessibility(t('restTimer.readyForNextSet'));
      announcedRef.current = true;
    }
  }, [visible, status, t]);

  if (!visible) return null;

  const slideOffset = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 500],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      accessibilityViewIsModal
      onRequestClose={onClose}
      onShow={() => {
        Keyboard.dismiss();
        focusAccessibilityNode(titleRef.current);
      }}
    >
      {/* Backdrop - tap to close */}
      <TouchableOpacity
        activeOpacity={1}
        className="absolute top-0 left-0 right-0 bottom-0 bg-black/40"
        accessible={false}
        onPress={onClose}
      />

      {/* Bottom Sheet with swipe-to-dismiss */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          transform: [{ translateY: slideOffset }],
          zIndex: 999,
          elevation: 999,
        }}
        accessible={false}
        accessibilityViewIsModal
        {...panResponder.panHandlers}
      >
        <View
          className="bg-card rounded-t-3xl pt-3 px-6 shadow-xl"
          style={{ paddingBottom: Math.max(insets.bottom, 24) }}
        >
          <View className="w-10 h-1 bg-border rounded-full self-center mb-5" />

          <View className="items-center">
            <Text
              ref={titleRef}
              accessible={true}
              accessibilityRole="header"
              onAccessibilityEscape={onClose}
              className="text-subtext text-sm font-bold uppercase tracking-widest mb-2"
            >
              {t('restTimer.rest')}
            </Text>

            <Text
              accessible={true}
              accessibilityRole="timer"
              accessibilityLabel={`${t('restTimer.rest')}: ${formatTimer(seconds)}`}
              onAccessibilityEscape={onClose}
              className={`text-7xl font-mono font-bold mb-4 ${status === 'finished' ? 'text-successText' : 'text-primaryText'}`}
            >
              {formatTimer(seconds)}
            </Text>

            <Text
              accessible
              onAccessibilityEscape={onClose}
              className={`text-base font-medium mb-6 ${status === 'finished' ? 'text-successText' : 'text-text'}`}
            >
              {status === 'finished' ? t('restTimer.readyForNextSet') : t('restTimer.resting')}
            </Text>

            {/* Quick Actions */}
            <View className="flex-row gap-3 w-full justify-center mb-6">
              <TouchableOpacity
                className="flex-1 bg-background p-4 rounded-xl border border-border items-center min-h-[52px] justify-center"
                onPress={() => onAddTime(30)}
                accessibilityLabel={t('restTimer.add30sAccessibility')}
                accessibilityRole="button"
                onAccessibilityEscape={onClose}
              >
                <Text className="text-text font-bold text-base">+30s</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="flex-1 bg-background p-4 rounded-xl border border-border items-center min-h-[52px] justify-center"
                onPress={() => onAddTime(-10)}
                accessibilityLabel={t('restTimer.minus10sAccessibility')}
                accessibilityRole="button"
                onAccessibilityEscape={onClose}
              >
                <Text className="text-text font-bold text-base">-10s</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className={`flex-1 p-4 rounded-xl items-center min-h-[52px] justify-center ${status === 'finished' ? 'bg-success' : 'bg-primary'}`}
                onPress={onSkip}
                accessibilityLabel={status === 'finished' ? t('restTimer.continueAccessibility') : t('restTimer.skipAccessibility')}
                accessibilityRole="button"
                onAccessibilityEscape={onClose}
              >
                <Text className={`font-bold text-base ${status === 'finished' ? 'text-onSuccess' : 'text-onPrimary'}`}>
                  {status === 'finished' ? t('restTimer.continue') : t('restTimer.skip')}
                </Text>
              </TouchableOpacity>
            </View>

            {nextExerciseName && (
              <View
                accessible
                accessibilityLabel={`${t('restTimer.nextExerciseLabel')}: ${nextExerciseName}`}
                onAccessibilityEscape={onClose}
                className="items-center pt-4 border-t border-border w-full"
              >
                <Text className="text-subtext text-xs font-bold uppercase mb-1">{t('restTimer.nextExerciseLabel')}</Text>
                <Text className="text-text font-semibold text-base">{nextExerciseName}</Text>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

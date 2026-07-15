import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReactiveReducedMotion } from '@/hooks/use-reactive-reduced-motion';

interface ToastProps {
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
  duration?: number;
  onHide?: () => void;
}

export function Toast({
  visible,
  message,
  type = 'success',
  duration = 2000,
  onHide,
}: ToastProps) {
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const onHideRef = useRef(onHide);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReactiveReducedMotion();

  useEffect(() => {
    onHideRef.current = onHide;
  }, [onHide]);

  useEffect(() => {
    slideAnim.stopAnimation();

    if (!visible) {
      slideAnim.setValue(-100);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;

    if (reducedMotion) {
      slideAnim.setValue(0);
      timer = setTimeout(() => {
        slideAnim.setValue(-100);
        onHideRef.current?.();
      }, duration);
    } else {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();

      timer = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start((res) => {
          if (res && res.finished === false) {
            return;
          }
          onHideRef.current?.();
        });
      }, duration);
    }

    return () => {
      if (timer) clearTimeout(timer);
      slideAnim.stopAnimation();
    };
  }, [visible, message, duration, slideAnim, reducedMotion]);

  if (!visible) return null;

  const getBgColor = () => {
    switch (type) {
      case 'error':
        return 'bg-danger';
      case 'info':
        return 'bg-secondary';
      case 'success':
      default:
        return 'bg-success';
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'error':
        return 'text-onDanger';
      case 'info':
        return 'text-onSecondary';
      case 'success':
      default:
        return 'text-onSuccess';
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          top: insets.top + 12,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View
        accessible
        accessibilityRole="alert"
        accessibilityLabel={message}
        accessibilityLiveRegion={type === 'error' ? 'assertive' : 'polite'}
        className={`${getBgColor()} px-4 py-3 rounded-xl shadow-lg mx-4 flex-row items-center gap-3`}
      >
        <Text className={`${getTextColor()} font-semibold text-base flex-1`}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
  },
});

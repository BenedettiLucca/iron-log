import React, { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';

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

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();

      const timer = setTimeout(() => {
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          onHide?.();
        });
      }, duration);

      return () => clearTimeout(timer);
    } else {
      slideAnim.setValue(-100);
    }
  }, [visible, duration]);

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

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View className={`${getBgColor()} px-4 py-3 rounded-xl shadow-lg mx-4 flex-row items-center gap-3`}>
        <Text className="text-white font-semibold text-base flex-1">
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
});

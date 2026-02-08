import React, { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';

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
  const slideAnim = useRef(new Animated.Value(1)).current;

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
  }, [visible]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop */}
      <TouchableOpacity
        activeOpacity={1}
        className="absolute top-0 left-0 right-0 bottom-0 bg-black/40"
        onPress={onClose}
      />

      {/* Bottom Sheet */}
      <Animated.View
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl pt-3 pb-8 px-6 shadow-xl"
        style={{
          transform: [{ translateY: slideAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 500]
          }) }],
        }}
      >
        <View className="w-10 h-1 bg-border rounded-full self-center mb-5" />

        <View className="items-center">
          <Text className="text-subtext text-sm font-bold uppercase tracking-widest mb-2">Descanso</Text>

          <Text className={`text-7xl font-mono font-bold mb-4 ${status === 'finished' ? 'text-success' : 'text-primary'}`}>
            {formatTime(seconds)}
          </Text>

          <Text className={`text-base font-medium mb-6 ${status === 'finished' ? 'text-success' : 'text-secondary'}`}>
            {status === 'finished' ? '✓ Pronto para próxima série' : '⏱️ Descansando...'}
          </Text>

          {/* Quick Actions */}
          <View className="flex-row gap-3 w-full justify-center mb-6">
            <TouchableOpacity
              className="flex-1 bg-background p-4 rounded-xl border border-border items-center min-h-[52px] justify-center"
              onPress={() => onAddTime(30)}
            >
              <Text className="text-text font-bold text-base">+30s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 bg-background p-4 rounded-xl border border-border items-center min-h-[52px] justify-center"
              onPress={() => onAddTime(-10)}
            >
              <Text className="text-text font-bold text-base">-10s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 bg-primary p-4 rounded-xl items-center min-h-[52px] justify-center"
              onPress={onSkip}
            >
              <Text className="text-white font-bold text-base">Pular</Text>
            </TouchableOpacity>
          </View>

          {nextExerciseName && (
            <View className="items-center pt-4 border-t border-border w-full">
              <Text className="text-subtext text-xs font-bold uppercase mb-1">Próximo:</Text>
              <Text className="text-text font-semibold text-base">{nextExerciseName}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </>
  );
}

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
        style={styles.backdrop}
        onPress={onClose}
      />

      {/* Bottom Sheet */}
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            transform: [{ translateY: slideAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 500]
            }) }],
          }
        ]}
      >
        <View style={styles.handle} />

        <View style={styles.content}>
          <Text style={styles.title}>Descanso</Text>

          <Text style={styles.timer}>
            {formatTime(seconds)}
          </Text>

          <Text style={[styles.status, status === 'finished' && styles.statusFinished]}>
            {status === 'finished' ? '✓ Pronto para próxima série' : '⏱️ Descansando...'}
          </Text>

          {/* Quick Actions */}
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => onAddTime(30)}
            >
              <Text style={styles.quickActionText}>+30s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.quickActionButton}
              onPress={() => onAddTime(-10)}
            >
              <Text style={styles.quickActionText}>-10s</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionButton, styles.skipButton]}
              onPress={onSkip}
            >
              <Text style={[styles.quickActionText, styles.skipButtonText]}>Pular</Text>
            </TouchableOpacity>
          </View>

          {nextExerciseName && (
            <View style={styles.nextExercise}>
              <Text style={styles.nextExerciseLabel}>Próximo:</Text>
              <Text style={styles.nextExerciseName}>{nextExerciseName}</Text>
            </View>
          )}
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 32,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  timer: {
    fontSize: 64,
    fontWeight: '700',
    color: '#3D405B',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  status: {
    fontSize: 16,
    fontWeight: '500',
    color: '#3D5A80',
    marginBottom: 24,
  },
  statusFinished: {
    color: '#81B29A',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  quickActionButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#F4F1DE',
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3D405B',
  },
  skipButton: {
    backgroundColor: '#E07A5F',
  },
  skipButtonText: {
    color: '#FFFFFF',
  },
  nextExercise: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    width: '100%',
  },
  nextExerciseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  nextExerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3D405B',
  },
});

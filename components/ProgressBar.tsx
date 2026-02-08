import React, { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
  variant?: 'header' | 'modal' | 'compact';
  showLabel?: boolean;
  animated?: boolean;
}

export function ProgressBar({
  current,
  total,
  variant = 'header',
  showLabel = true,
  animated = true,
}: ProgressBarProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;

  useEffect(() => {
    if (animated) {
      Animated.timing(progressAnim, {
        toValue: percentage,
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(percentage);
    }
  }, [percentage, animated]);

  const getVariantStyles = () => {
    switch (variant) {
      case 'modal':
        return {
          height: 8,
          borderRadius: 4,
        };
      case 'compact':
        return {
          height: 4,
          borderRadius: 2,
        };
      case 'header':
      default:
        return {
          height: 6,
          borderRadius: 3,
        };
    }
  };

  const barStyle = getVariantStyles();

  return (
    <View style={styles.container}>
      {showLabel && variant !== 'compact' && (
        <Text style={styles.label}>
          {current} de {total} {total === 1 ? 'exercício' : 'exercícios'}
        </Text>
      )}
      <View style={[styles.track, barStyle]}>
        <Animated.View
          style={[
            styles.fill,
            barStyle,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3D405B',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  track: {
    backgroundColor: '#E0E0E0',
    overflow: 'hidden',
  },
  fill: {
    backgroundColor: '#E07A5F',
  },
});

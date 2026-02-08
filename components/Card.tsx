import React, { View, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';

export type CardVariant = 'default' | 'bordered' | 'elevated' | 'flat';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  pressable?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  contentPadding?: boolean;
}

export function Card({
  children,
  variant = 'default',
  pressable = false,
  onPress,
  style,
  contentPadding = true,
}: CardProps) {
  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'bordered':
        return {
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E0E0E0',
          ...StyleSheet.hairlineWidth,
        };
      case 'elevated':
        return {
          backgroundColor: '#FFFFFF',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          elevation: 3,
        };
      case 'flat':
        return {
          backgroundColor: 'transparent',
        };
      case 'default':
      default:
        return {
          backgroundColor: '#FFFFFF',
          borderWidth: 1,
          borderColor: '#E0E0E0',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 1,
        };
    }
  };

  const cardStyle: ViewStyle = {
    borderRadius: 12,
    overflow: 'hidden',
    ...getVariantStyles(),
    ...(contentPadding && { padding: 16 }),
    ...style,
  };

  if (pressable && onPress) {
    return (
      <TouchableOpacity onPress={onPress} style={cardStyle} activeOpacity={0.7}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

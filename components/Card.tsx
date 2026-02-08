import React, { View, TouchableOpacity, ViewStyle } from 'react-native';

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
  const getVariantClasses = () => {
    switch (variant) {
      case 'bordered':
        return 'bg-card border border-border';
      case 'elevated':
        return 'bg-card shadow-md';
      case 'flat':
        return 'bg-transparent';
      case 'default':
      default:
        return 'bg-card border border-border shadow-sm';
    }
  };

  const cardClasses = `${getVariantClasses()} rounded-2xl overflow-hidden ${
    contentPadding ? 'p-4' : ''
  }`;

  if (pressable && onPress) {
    return (
      <TouchableOpacity onPress={onPress} className={cardClasses} activeOpacity={0.7} style={style}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View className={cardClasses} style={style}>{children}</View>;
}

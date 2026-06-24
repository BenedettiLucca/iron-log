import type { ReactNode } from 'react';
import { View, TouchableOpacity, ViewStyle } from 'react-native';
import { useHaptics } from '@/hooks/use-haptics';

export type CardVariant = 'default' | 'bordered';

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  pressable?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
  contentPadding?: boolean;
  className?: string;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link';
}

export function Card({
  children,
  variant = 'default',
  pressable = false,
  onPress,
  style,
  contentPadding = true,
  className = '',
  accessibilityLabel,
  accessibilityRole,
}: CardProps) {
  const { trigger } = useHaptics();

  const getVariantClasses = () => {
    switch (variant) {
      case 'bordered':
        return 'bg-card border border-border';
      case 'default':
      default:
        return 'bg-card border border-border shadow-sm';
    }
  };

  const handlePress = () => {
    if (onPress) {
      trigger('medium');
      onPress();
    }
  };

  const cardClasses = `${getVariantClasses()} rounded-2xl overflow-hidden ${
    contentPadding ? 'p-4' : ''
  } ${className}`;

  if (pressable && onPress) {
    return (
      <TouchableOpacity
        onPress={handlePress}
        className={cardClasses}
        activeOpacity={0.7}
        style={style}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole || 'button'}
      >
        {children}
      </TouchableOpacity>
    );
  }

  return <View className={cardClasses} style={style}>{children}</View>;
}

import type { ReactNode } from 'react';
import { View, Pressable, ViewStyle } from 'react-native';

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
  const getVariantClasses = () => {
    switch (variant) {
      case 'bordered':
      case 'default':
      default:
        return 'bg-card border border-border';
    }
  };

  const cardClasses = `${getVariantClasses()} rounded-2xl overflow-hidden ${
    contentPadding ? 'p-4' : ''
  } ${className}`;

  if (pressable && onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={`${cardClasses} active:opacity-[0.92]`}
        style={style}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole || 'button'}
      >
        {children}
      </Pressable>
    );
  }

  return <View className={cardClasses} style={style}>{children}</View>;
}

import React, { TouchableOpacity, Text, ActivityIndicator, View, ViewStyle, TextStyle } from 'react-native';
import { useState } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const [isPressed, setIsPressed] = useState(false);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-2 min-h-[36px]';
      case 'lg':
        return 'px-6 py-4 min-h-[56px]';
      case 'md':
      default:
        return 'px-4 py-3 min-h-[44px]';
    }
  };

  const getTextSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs font-semibold';
      case 'lg':
        return 'text-lg font-bold';
      case 'md':
      default:
        return 'text-sm font-semibold';
    }
  };

  const getVariantClasses = () => {
    const baseClasses = 'rounded-xl items-center justify-center flex-row';

    switch (variant) {
      case 'secondary':
        return `${baseClasses} bg-transparent border border-secondary ${isPressed ? 'bg-secondary/20' : ''}`;
      case 'danger':
        return `${baseClasses} bg-danger ${isPressed ? 'opacity-80' : ''}`;
      case 'ghost':
        return `${baseClasses} bg-transparent ${isPressed ? 'bg-black/5' : ''}`;
      case 'success':
        return `${baseClasses} bg-success ${isPressed ? 'opacity-80' : ''}`;
      case 'primary':
      default:
        return `${baseClasses} bg-primary ${isPressed ? 'opacity-80' : ''}`;
    }
  };

  const getTextClasses = () => {
    switch (variant) {
      case 'secondary':
        return 'text-secondary';
      case 'danger':
      case 'success':
      case 'primary':
        return 'text-white';
      case 'ghost':
      default:
        return 'text-text';
    }
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        { opacity: disabled ? 0.5 : 1 },
        fullWidth && { width: '100%' },
        style,
      ]}
      className={`${getVariantClasses()} ${getSizeClasses()}`}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          {icon && <View className="mr-2">{icon}</View>}
          <Text
            className={`${getTextSizeClasses()} ${getTextClasses()}`}
            style={textStyle}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

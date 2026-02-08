import React, { TouchableOpacity, Text, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
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

  const getSizeStyles = (): { view: ViewStyle; text: TextStyle } => {
    switch (size) {
      case 'sm':
        return {
          view: { paddingHorizontal: 12, paddingVertical: 8, minHeight: 36 },
          text: { fontSize: 12, fontWeight: '600' },
        };
      case 'lg':
        return {
          view: { paddingHorizontal: 24, paddingVertical: 16, minHeight: 56 },
          text: { fontSize: 18, fontWeight: '700' },
        };
      case 'md':
      default:
        return {
          view: { paddingHorizontal: 16, paddingVertical: 12, minHeight: 44 },
          text: { fontSize: 14, fontWeight: '600' },
        };
    }
  };

  const getVariantStyles = (): { view: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'secondary':
        return {
          view: {
            backgroundColor: isPressed ? 'rgba(61, 90, 128, 0.2)' : 'transparent',
            borderWidth: 1,
            borderColor: '#3D5A80',
          },
          text: { color: '#3D5A80' },
        };
      case 'danger':
        return {
          view: {
            backgroundColor: isPressed ? 'rgba(239, 100, 100, 0.8)' : '#EF6464',
          },
          text: { color: '#FFFFFF' },
        };
      case 'ghost':
        return {
          view: {
            backgroundColor: isPressed ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
          },
          text: { color: '#3D405B' },
        };
      case 'success':
        return {
          view: {
            backgroundColor: isPressed ? 'rgba(129, 178, 154, 0.8)' : '#81B29A',
          },
          text: { color: '#FFFFFF' },
        };
      case 'primary':
      default:
        return {
          view: {
            backgroundColor: isPressed ? '#C96A52' : '#E07A5F',
          },
          text: { color: '#FFFFFF' },
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    opacity: disabled ? 0.5 : 1,
    ...sizeStyles.view,
    ...variantStyles.view,
    ...(fullWidth && { width: '100%' }),
    ...style,
  };

  const contentTextStyle: TextStyle = {
    ...sizeStyles.text,
    ...variantStyles.text,
    ...textStyle,
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={() => setIsPressed(true)}
      onPressOut={() => setIsPressed(false)}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={containerStyle}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <>
          {icon && <View style={{ marginRight: 8 }}>{icon}</View>}
          <Text style={contentTextStyle}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

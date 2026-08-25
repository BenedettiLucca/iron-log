import type { ReactNode } from 'react';
import { Text, ActivityIndicator, View, ViewStyle, TextStyle, Pressable } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useHaptics, type HapticFeedbackType } from '@/hooks/use-haptics';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { useReactiveReducedMotion } from '@/hooks/use-reactive-reduced-motion';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

const HAPTIC_BY_VARIANT: Record<ButtonVariant, HapticFeedbackType> = {
  primary: 'medium',
  secondary: 'light',
  danger: 'warning',
  ghost: 'light',
  success: 'medium',
};

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  className?: string;
  accessibilityLabel?: string;
  onAccessibilityEscape?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  className = '',
  accessibilityLabel,
  onAccessibilityEscape,
}: ButtonProps) {
  const theme = useThemeColors();
  const scale = useSharedValue(1);
  const isReducedMotion = useReactiveReducedMotion();
  const { trigger } = useHaptics();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (disabled || loading || isReducedMotion) return;
    scale.value = withTiming(0.98, { duration: 80 });
  };

  const handlePressOut = () => {
    if (disabled || loading || isReducedMotion) {
      scale.value = 1;
      return;
    }
    scale.value = withTiming(1, { duration: 120 });
  };

  const handlePress = () => {
    if (disabled || loading) return;

    // Trigger haptic feedback based on variant
    trigger(HAPTIC_BY_VARIANT[variant]);

    onPress();
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-4 py-2 min-h-[44px]';
      case 'lg':
        return 'px-8 py-4 min-h-[60px]';
      case 'md':
      default:
        return 'px-6 py-3.5 min-h-[50px]';
    }
  };

  const getTextSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs font-bold';
      case 'lg':
        return 'text-lg font-bold';
      case 'md':
      default:
        return 'text-sm font-bold';
    }
  };

  const getVariantClasses = () => {
    const baseClasses = 'rounded-2xl items-center justify-center flex-row shadow-sm';

    switch (variant) {
      case 'secondary':
        return `${baseClasses} bg-background border-2 border-secondary/20 active:bg-secondarySurface`;
      case 'danger':
        return `${baseClasses} bg-danger active:opacity-90`;
      case 'ghost':
        return `${baseClasses} bg-transparent border-transparent shadow-none active:bg-black/5`;
      case 'success':
        return `${baseClasses} bg-success active:opacity-90`;
      case 'primary':
      default:
        return `${baseClasses} bg-primary active:opacity-90`;
    }
  };

  const getTextClasses = () => {
    switch (variant) {
      case 'secondary':
        return 'text-secondaryText';
      case 'danger':
        return 'text-onDanger';
      case 'success':
        return 'text-onSuccess';
      case 'primary':
        return 'text-onPrimary';
      case 'ghost':
      default:
        return 'text-subtext';
    }
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      accessibilityLabel={accessibilityLabel || title}
      accessibilityRole="button"
      onAccessibilityEscape={onAccessibilityEscape}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={[
        animatedStyle,
        { opacity: disabled ? 0.6 : 1 },
        fullWidth && { width: '100%' },
        style,
      ]}
      className={`${getVariantClasses()} ${getSizeClasses()} ${className}`}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'secondary'
              ? theme.secondaryText
              : variant === 'ghost'
              ? theme.subtext
              : variant === 'danger'
              ? theme.onDanger
              : variant === 'success'
              ? theme.onSuccess
              : theme.onPrimary
          }
        />
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
    </AnimatedPressable>
  );
}

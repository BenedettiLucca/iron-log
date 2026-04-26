import type { ReactNode } from 'react';
import { Text, ActivityIndicator, View, ViewStyle, TextStyle, Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useHaptics } from '@/hooks/use-haptics';
import { Colors } from '@/constants/colors';

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
  icon?: ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  className?: string;
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
}: ButtonProps) {
  const scale = useSharedValue(1);
  const { trigger } = useHaptics();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (disabled || loading) return;
    scale.value = withSpring(0.96, { damping: 10, stiffness: 300 });
  };

  const handlePressOut = () => {
    if (disabled || loading) return;
    scale.value = withSpring(1, { damping: 10, stiffness: 300 });
  };

  const handlePress = () => {
    if (disabled || loading) return;

    // Trigger haptic feedback based on variant
    if (variant === 'danger') {
      trigger('warning');
    } else {
      trigger('medium');
    }

    onPress();
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-4 py-2 min-h-[40px]';
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
        return 'text-xs font-bold tracking-wider uppercase';
      case 'lg':
        return 'text-lg font-bold tracking-widest uppercase';
      case 'md':
      default:
        return 'text-sm font-bold tracking-wider uppercase';
    }
  };

  const getVariantClasses = () => {
    const baseClasses = 'rounded-2xl items-center justify-center flex-row shadow-sm';

    switch (variant) {
      case 'secondary':
        return `${baseClasses} bg-background border-2 border-secondary/20 active:bg-secondary/10`;
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
        return 'text-secondary';
      case 'danger':
      case 'success':
      case 'primary':
        return 'text-white';
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
      style={[
        animatedStyle,
        { opacity: disabled ? 0.6 : 1 },
        fullWidth && { width: '100%' },
        style,
      ]}
      className={`${getVariantClasses()} ${getSizeClasses()} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? Colors.secondary : Colors.white} />
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

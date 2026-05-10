import type { ReactNode } from 'react';
import type { GestureResponderEvent, TouchableOpacityProps } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { useHaptics } from '@/hooks/use-haptics';

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' | 'selection';

interface PressableProps extends TouchableOpacityProps {
  hapticType?: HapticType;
  children: ReactNode;
}

export function Pressable({
  hapticType = 'medium',
  onPress,
  accessibilityRole = 'button',
  children,
  ...rest
}: PressableProps) {
  const { trigger } = useHaptics();

  const handlePress = (e: GestureResponderEvent) => {
    trigger(hapticType);
    onPress?.(e);
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      accessibilityRole={accessibilityRole}
      {...rest}
    >
      {children}
    </TouchableOpacity>
  );
}

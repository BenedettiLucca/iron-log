import { useState } from 'react';
import { TextInput, View, Text, TextInputProps, ViewStyle, NativeSyntheticEvent, TextInputFocusEventData } from 'react-native';
import { useHaptics } from '@/hooks/use-haptics';
import { Colors } from '@/constants/colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  success?: boolean;
  containerStyle?: ViewStyle;
  maxLength?: number;
  showCharacterCount?: boolean;
}

export function Input({
  label,
  error,
  success,
  containerStyle,
  style,
  maxLength,
  showCharacterCount = false,
  value,
  ...textInputProps
}: InputProps) {
  const { trigger } = useHaptics();
  const [isFocused, setIsFocused] = useState(false);

  // Animate border color
  const borderColor = isFocused
    ? Colors.primary // Primary color when focused
    : error
    ? Colors.red400 // Error red
    : success
    ? Colors.green500 // Success green
    : Colors.secondary; // Default border

  const handleFocus = (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
    setIsFocused(true);
    trigger('selection');
    textInputProps.onFocus?.(e);
  };

  const handleBlur = (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
    setIsFocused(false);
    textInputProps.onBlur?.(e);
  };

  const characterCount = typeof value === 'string' ? value.length : 0;

  return (
    <View style={containerStyle}>
      {label && (
        <Text className="text-text text-xs font-semibold mb-1.5 uppercase tracking-wider">
          {label}
        </Text>
      )}
      <View className="relative">
        <TextInput
          className={`bg-card rounded-xl px-4 py-3 text-base text-text min-h-[44px]`}
          style={[
            {
              borderColor,
              borderWidth: 2,
            },
            style,
          ]}
          placeholderTextColor={Colors.darkSubtext}
          onFocus={handleFocus}
          onBlur={handleBlur}
          value={value}
          maxLength={maxLength}
          {...textInputProps}
        />
        {showCharacterCount && maxLength && (
          <Text className="absolute right-3 top-1/2 -translate-y-1/2 text-subtext text-xs">
            {characterCount}/{maxLength}
          </Text>
        )}
      </View>
      {error && (
        <Text className="text-danger text-xs mt-1">
          {error}
        </Text>
      )}
      {success && !error && (
        <Text className="text-success text-xs mt-1">
          ✓ Válido
        </Text>
      )}
    </View>
  );
}

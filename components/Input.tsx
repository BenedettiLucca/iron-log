import { useState, forwardRef } from 'react';
import {
  TextInput,
  View,
  Text,
  TextInputProps,
  ViewStyle,
  useColorScheme,
  StyleSheet,
} from 'react-native';
import { getThemeColors } from '@/constants/colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  maxLength?: number;
  showCharacterCount?: boolean;
  className?: string;
}

export const Input = forwardRef<TextInput, InputProps>(function Input(
  {
    label,
    error,
    containerStyle,
    style,
    maxLength,
    showCharacterCount = false,
    value,
    editable = true,
    onFocus,
    onBlur,
    className = '',
    accessibilityState,
    accessibilityLabel,
    accessibilityHint,
    ...textInputProps
  },
  ref
) {
  const colorScheme = useColorScheme();
  const theme = getThemeColors(colorScheme);
  const [isFocused, setIsFocused] = useState(false);

  const disabled = editable === false;

  const borderColor = error
    ? theme.dangerText
    : isFocused && !disabled
    ? theme.primaryText
    : theme.border;

  const handleFocus: NonNullable<TextInputProps['onFocus']> = (event) => {
    setIsFocused(true);
    onFocus?.(event);
  };

  const handleBlur: NonNullable<TextInputProps['onBlur']> = (event) => {
    setIsFocused(false);
    onBlur?.(event);
  };

  const characterCount = typeof value === 'string' ? value.length : 0;

  const flattenedStyle = StyleSheet.flatten(style) || {};
  const callerMinHeight = typeof flattenedStyle.minHeight === 'number' ? flattenedStyle.minHeight : 0;
  const finalMinHeight = Math.max(callerMinHeight, 44);

  const baseClassName = `bg-card rounded-xl px-4 py-3 text-base text-text min-h-[44px]${disabled ? ' opacity-60' : ''}`;
  const finalClassName = className ? `${baseClassName} ${className}` : baseClassName;

  const mergedAccessibilityState = {
    ...accessibilityState,
    disabled,
  };
  const mergedAccessibilityLabel = accessibilityLabel ?? label;
  const mergedAccessibilityHint = error ?? accessibilityHint;

  return (
    <View style={containerStyle}>
      {label && (
        <Text className="text-text text-xs font-semibold mb-1.5 uppercase tracking-wider">
          {label}
        </Text>
      )}
      <View className="relative">
        <TextInput
          ref={ref}
          className={finalClassName}
          style={[
            {
              borderColor,
              borderWidth: 2,
            },
            style,
            {
              minHeight: finalMinHeight,
            },
          ]}
          placeholderTextColor={theme.subtext}
          onFocus={handleFocus}
          onBlur={handleBlur}
          value={value}
          maxLength={maxLength}
          editable={editable}
          accessibilityState={mergedAccessibilityState}
          accessibilityLabel={mergedAccessibilityLabel}
          accessibilityHint={mergedAccessibilityHint}
          {...textInputProps}
        />
        {showCharacterCount && maxLength && (
          <Text className="absolute right-3 top-1/2 -translate-y-1/2 text-subtext text-xs">
            {characterCount}/{maxLength}
          </Text>
        )}
      </View>
      {error && (
        <Text className="text-dangerText text-xs mt-1" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
});

import React, { TextInput, View, Text, TextInputProps } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: any;
}

export function Input({
  label,
  error,
  containerStyle,
  style,
  ...textInputProps
}: InputProps) {
  return (
    <View style={containerStyle}>
      {label && (
        <Text className="text-text text-xs font-semibold mb-1.5 uppercase tracking-wider">
          {label}
        </Text>
      )}
      <TextInput
        className={`bg-card border border-border rounded-xl px-4 py-3 text-base text-text min-h-[44px] ${
          error ? 'border-danger' : ''
        }`}
        placeholderTextColor="#9CA3AF"
        {...textInputProps}
        style={style}
      />
      {error && (
        <Text className="text-danger text-xs mt-1">
          {error}
        </Text>
      )}
    </View>
  );
}

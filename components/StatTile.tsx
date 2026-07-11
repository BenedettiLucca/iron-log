import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { Colors } from '@/constants/colors';

interface StatTileProps {
  value: string | number;
  label: string;
  accentColor?: 'primary' | 'secondary' | 'warning' | 'success';
  icon?: ReactNode;
  className?: string;
}

export function StatTile({
  value,
  label,
  accentColor,
  icon,
  className = '',
}: StatTileProps) {
  const getAccentColorHex = () => {
    switch (accentColor) {
      case 'primary': return Colors.primary;
      case 'secondary': return Colors.secondary;
      case 'warning': return Colors.warning;
      case 'success': return Colors.success;
      default: return undefined;
    }
  };

  const getBgClass = () => {
    switch (accentColor) {
      case 'primary': return 'bg-primary/10';
      case 'secondary': return 'bg-secondary/10';
      case 'warning': return 'bg-warning/10';
      case 'success': return 'bg-success/10';
      default: return 'bg-text/5';
    }
  };

  const accentColorHex = getAccentColorHex();

  return (
    <View
      style={accentColorHex ? { borderTopWidth: 3, borderTopColor: accentColorHex } : undefined}
      className={`bg-card border border-border rounded-2xl p-3.5 items-center flex-shrink-0 ${className}`}
    >
      {icon && (
        <View className={`w-8 h-8 rounded-full items-center justify-center mb-1.5 ${getBgClass()}`}>
          {icon}
        </View>
      )}
      <Text className="text-2xl font-extrabold text-text tracking-tight font-display">
        {value}
      </Text>
      <Text className="text-2xs font-bold uppercase text-subtext tracking-wider mt-0.5 text-center">
        {label}
      </Text>
    </View>
  );
}

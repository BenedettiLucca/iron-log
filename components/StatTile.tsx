import type { ReactNode } from 'react';
import { View, Text } from 'react-native';
import { useThemeColors } from '@/hooks/use-theme-colors';

interface StatTileProps {
  value: string | number;
  label: string;
  accentColor?: 'primary' | 'secondary' | 'warning' | 'success';
  icon?: ReactNode;
  className?: string;
  delta?: string;
  deltaType?: 'positive' | 'negative' | 'neutral';
}

export function StatTile({
  value,
  label,
  accentColor,
  icon,
  className = '',
  delta,
  deltaType = 'neutral',
}: StatTileProps) {
  const theme = useThemeColors();
  const getAccentColorHex = () => {
    switch (accentColor) {
      case 'primary': return theme.primaryText;
      case 'secondary': return theme.secondaryText;
      case 'warning': return theme.warningText;
      case 'success': return theme.successText;
      default: return undefined;
    }
  };

  const getBgClass = () => {
    switch (accentColor) {
      case 'primary': return 'bg-primarySurface';
      case 'secondary': return 'bg-secondarySurface';
      case 'warning': return 'bg-warningSurface';
      case 'success': return 'bg-successSurface';
      default: return 'bg-text/5';
    }
  };

  const accentColorHex = getAccentColorHex();

  return (
    <View
      style={accentColorHex ? { borderTopWidth: 3, borderTopColor: accentColorHex } : undefined}
      className={`bg-card border border-border rounded-2xl p-3.5 items-center flex-shrink-0 ${className}`}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${label}: ${value}${delta ? `, ${delta}` : ''}`}
    >
      {icon && (
        <View className={`w-8 h-8 rounded-full items-center justify-center mb-1.5 ${getBgClass()}`}>
          {icon}
        </View>
      )}
      <Text className="text-2xl font-extrabold text-text tracking-tight">
        {value}
      </Text>
      <Text className="text-2xs font-bold uppercase text-subtext tracking-wider mt-0.5 text-center">
        {label}
      </Text>
      {delta && (
        <Text className={`text-2xs font-bold mt-1.5 ${
          deltaType === 'positive' ? 'text-successText' : deltaType === 'negative' ? 'text-dangerText' : 'text-subtext'
        }`}>
          {delta}
        </Text>
      )}
    </View>
  );
}

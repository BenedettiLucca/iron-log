import React from 'react';
import { View, Text } from 'react-native';
import { Card } from './Card';

interface StreakCardProps {
  currentStreak: number;
  longestStreak: number;
  label: string;
  icon?: string;
}

/**
 * Display streak information with fire icon
 */
export function StreakCard({ currentStreak, longestStreak, label, icon = '🔥' }: StreakCardProps) {
  return (
    <Card className="flex-1">
      <View className="items-center">
        <Text className="text-4xl mb-2">{icon}</Text>
        <Text className="text-text font-black text-3xl mb-1">{currentStreak}</Text>
        <Text className="text-subtext text-xs font-bold uppercase tracking-wider mb-2">{label}</Text>
        {longestStreak > 0 && (
          <Text className="text-subtext/60 text-[10px]">Recorde: {longestStreak}</Text>
        )}
      </View>
    </Card>
  );
}

/**
 * Stats row showing multiple streak metrics
 */
interface StreakStatsRowProps {
  dailyStreak: number;
  monthlyStreak: number;
  totalCheckins: number;
}

export function StreakStatsRow({ dailyStreak, monthlyStreak, totalCheckins }: StreakStatsRowProps) {
  return (
    <View className="flex-row gap-3 mb-4">
      <StreakCard currentStreak={dailyStreak} longestStreak={0} label="Dias" />
      <StreakCard currentStreak={monthlyStreak} longestStreak={0} label="Meses" icon="📅" />
      <StreakCard currentStreak={totalCheckins} longestStreak={0} label="Total" icon="✓" />
    </View>
  );
}

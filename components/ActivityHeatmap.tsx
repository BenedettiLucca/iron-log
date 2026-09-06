import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useI18n, getLocaleForLanguage } from '@/src/i18n';
import { useThemeColors } from '@/hooks/use-theme-colors';
import { Card } from '@/components/Card';
import { SectionHeader } from '@/components/SectionHeader';
import {
  ActivityHeatmapService,
  DailyActivityBucket,
  HeatmapDay,
} from '@/services/ActivityHeatmapService';

interface ActivityHeatmapProps {
  data?: DailyActivityBucket[];
  isLoading?: boolean;
  onDayPress?: (date: string, bucket?: DailyActivityBucket) => void;
  className?: string;
}

const CELL_SIZE = 11;
const CELL_GAP = 3;
const WEEKS_COUNT = 53;

function getCellColor(
  intensity: 0 | 1 | 2 | 3,
  isFuture: boolean,
  isDark: boolean,
  primaryColor: string
): string {
  if (isFuture) {
    return 'transparent';
  }
  switch (intensity) {
    case 1:
      return isDark ? 'rgba(232, 146, 124, 0.35)' : 'rgba(158, 66, 46, 0.3)';
    case 2:
      return isDark ? 'rgba(232, 146, 124, 0.65)' : 'rgba(158, 66, 46, 0.65)';
    case 3:
      return primaryColor;
    case 0:
    default:
      return isDark ? '#2D2624' : '#E8E4D0';
  }
}

export function ActivityHeatmap({
  data: propData,
  onDayPress,
  className = '',
}: ActivityHeatmapProps) {
  const { t, language } = useI18n();
  const theme = useThemeColors();
  const router = useRouter();
  const isDark = theme.background === '#1D1917';

  const [localData, setLocalData] = useState<DailyActivityBucket[]>([]);
  const [selectedDay, setSelectedDay] = useState<HeatmapDay | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (propData) {
      setLocalData(propData);
    } else {
      let isMounted = true;
      ActivityHeatmapService.getDailyActivity().then((buckets) => {
        if (isMounted) {
          setLocalData(buckets);
        }
      });
      return () => {
        isMounted = false;
      };
    }
  }, [propData]);

  const grid = useMemo(() => {
    const locale = getLocaleForLanguage(language);
    return ActivityHeatmapService.buildHeatmap(localData, WEEKS_COUNT, new Date(), locale);
  }, [localData, language]);

  const handleCellPress = (day: HeatmapDay) => {
    if (day.isFuture) return;
    setSelectedDay(day);

    if (onDayPress) {
      const bucket = localData.find((b) => b.date === day.date);
      onDayPress(day.date, bucket);
    } else if (day.sessions > 0) {
      router.push('/(tabs)/history');
    }
  };

  const hours = Math.floor(grid.totalMinutes / 60);
  const minutes = grid.totalMinutes % 60;

  // Weekday abbreviations (Mon, Wed, Fri)
  const weekdayLabels = useMemo(() => {
    const locale = getLocaleForLanguage(language);
    const d = new Date(2026, 0, 5); // Monday Jan 5 2026
    const labels: string[] = [];
    for (let i = 0; i < 7; i++) {
      try {
        labels.push(d.toLocaleDateString(locale, { weekday: 'narrow' }));
      } catch {
        labels.push(['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]);
      }
      d.setDate(d.getDate() + 1);
    }
    return labels;
  }, [language]);

  return (
    <Card className={className}>
      <View className="flex-row items-center justify-between mb-2">
        <SectionHeader label={t('bioAnalytics.activityHeatmap')} />
        <Text className="text-2xs font-bold text-subtext">
          {t('bioAnalytics.heatmapTotalWorkouts', { count: grid.totalSessions })}
        </Text>
      </View>

      {/* Summary Row */}
      <View className="flex-row items-center justify-between mb-4 px-1">
        <View className="flex-row gap-4">
          <View>
            <Text className="text-xs font-bold text-text">
              {t('bioAnalytics.heatmapActiveDays', { count: grid.activeDays })}
            </Text>
            <Text className="text-2xs text-subtext">{t('bioAnalytics.heatmapSubtitle')}</Text>
          </View>
        </View>
        {grid.totalMinutes > 0 && (
          <View className="items-end">
            <Text className="text-xs font-bold text-text">
              {t('bioAnalytics.heatmapTotalHours', { hours, minutes })}
            </Text>
            <Text className="text-2xs text-subtext">{t('bioAnalytics.total')}</Text>
          </View>
        )}
      </View>

      {/* Heatmap Grid View */}
      <View className="flex-row">
        {/* Weekday labels */}
        <View className="pt-4 pr-1 justify-between" style={{ height: 7 * (CELL_SIZE + CELL_GAP) }}>
          <Text className="text-2xs text-subtext leading-none">{weekdayLabels[0]}</Text>
          <Text className="text-2xs text-subtext leading-none">{weekdayLabels[2]}</Text>
          <Text className="text-2xs text-subtext leading-none">{weekdayLabels[4]}</Text>
        </View>

        {/* Scrollable Columns */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          onContentSizeChange={() => {
            scrollViewRef.current?.scrollToEnd({ animated: false });
          }}
          className="flex-1"
        >
          <View>
            {/* Month Labels Row */}
            <View className="flex-row mb-1" style={{ height: 12 }}>
              {grid.weeks.map((week) => (
                <View
                  key={`month-${week.weekIndex}`}
                  style={{ width: CELL_SIZE + CELL_GAP }}
                >
                  {week.monthLabel ? (
                    <Text
                      numberOfLines={1}
                      className="text-2xs text-subtext font-bold uppercase"
                      style={{ width: 32 }}
                    >
                      {week.monthLabel}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>

            {/* Week Columns */}
            <View className="flex-row">
              {grid.weeks.map((week) => (
                <View
                  key={`week-${week.weekIndex}`}
                  style={{
                    flexDirection: 'column',
                    marginRight: CELL_GAP,
                    gap: CELL_GAP,
                  }}
                >
                  {week.days.map((day) => {
                    const isSelected = selectedDay?.date === day.date;
                    const cellBg = getCellColor(
                      day.intensity,
                      day.isFuture,
                      isDark,
                      theme.primary
                    );

                    const a11yLabel = day.sessions > 0
                      ? t('bioAnalytics.heatmapDayA11y', {
                          date: day.date,
                          sessions: day.sessions,
                          minutes: day.minutes,
                        })
                      : t('bioAnalytics.heatmapDayEmptyA11y', { date: day.date });

                    return (
                      <TouchableOpacity
                        key={day.date}
                        disabled={day.isFuture}
                        onPress={() => handleCellPress(day)}
                        activeOpacity={0.7}
                        accessibilityLabel={a11yLabel}
                        accessibilityRole="button"
                        style={{
                          width: CELL_SIZE,
                          height: CELL_SIZE,
                          borderRadius: 2,
                          backgroundColor: cellBg,
                          borderWidth: isSelected ? 1.5 : day.isFuture ? 0 : 0.5,
                          borderColor: isSelected
                            ? theme.primaryText
                            : isDark
                            ? 'rgba(255,255,255,0.06)'
                            : 'rgba(0,0,0,0.06)',
                        }}
                      />
                    );
                  })}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>

      {/* Selected Day Toast/Info */}
      {selectedDay && (
        <View className="mt-3 p-2 bg-text/5 rounded-xl flex-row items-center justify-between">
          <Text className="text-xs font-bold text-text">{selectedDay.date}</Text>
          <Text className="text-xs text-subtext">
            {selectedDay.sessions > 0
              ? `${selectedDay.sessions} ${t('bioAnalytics.heatmapTotalWorkouts', { count: selectedDay.sessions })} · ${selectedDay.minutes} min`
              : t('bioAnalytics.heatmapNoWorkouts')}
          </Text>
        </View>
      )}

      {/* Legend Row */}
      <View className="flex-row items-center justify-between mt-3 pt-2 border-t border-border/50">
        <Text className="text-2xs text-subtext">{t('bioAnalytics.heatmapSubtitle')}</Text>
        <View className="flex-row items-center gap-1.5">
          <Text className="text-2xs text-subtext">{t('bioAnalytics.heatmapLess')}</Text>
          {[0, 1, 2, 3].map((lvl) => (
            <View
              key={`legend-${lvl}`}
              style={{
                width: 9,
                height: 9,
                borderRadius: 2,
                backgroundColor: getCellColor(
                  lvl as 0 | 1 | 2 | 3,
                  false,
                  isDark,
                  theme.primary
                ),
                borderWidth: 0.5,
                borderColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              }}
            />
          ))}
          <Text className="text-2xs text-subtext">{t('bioAnalytics.heatmapMore')}</Text>
        </View>
      </View>
    </Card>
  );
}

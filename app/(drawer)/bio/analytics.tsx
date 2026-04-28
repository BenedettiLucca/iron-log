import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { Stack } from 'expo-router';
import { useState, useEffect, useCallback } from 'react';
import { AnalyticsService } from '../../../services/AnalyticsService';
import type { DashboardAnalytics } from '../../../services/AnalyticsService';
import { Card } from '../../../components/Card';
import { SkeletonList, SkeletonCard } from '../../../components/Skeleton';
import { EmptyState } from '../../../components/EmptyState';
import { logger } from '@/services/logger';
import { Colors } from '@/constants/colors';

export default function AnalyticsScreen() {
  const [data, setData] = useState<DashboardAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const analytics = await AnalyticsService.getFullAnalytics();
      setData(analytics);
    } catch (e) {
      logger.error('Failed to load analytics', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAnalytics();
    setRefreshing(false);
  }, [loadAnalytics]);

  if (loading && !data) {
    return (
      <ScrollView className="flex-1 bg-background" contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Stack.Screen options={{ title: 'Dados' }} />
        <SkeletonCard>
          <View className="items-center py-4" />
        </SkeletonCard>
        <View className="flex-row gap-3">
          <SkeletonCard className="flex-1 py-4" />
          <SkeletonCard className="flex-1 py-4" />
          <SkeletonCard className="flex-1 py-4" />
        </View>
        <SkeletonList count={3} />
      </ScrollView>
    );
  }

  if (!data) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ title: 'Dados' }} />
        <EmptyState
          icon="📊"
          title="Sem dados suficientes"
          description="Complete alguns treinos para ver suas análises."
        />
      </View>
    );
  }

  const { strengthScore, consistency, volumeTrends, topExercises, totalPRs, estimated1RM } = data;

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
      }
    >
      <Stack.Screen options={{ title: 'Dados' }} />

      {/* Strength Score */}
      <Card>
        <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-3">Strength Score</Text>
        <View className="items-center mb-4">
          <Text className="text-text text-5xl font-black">{strengthScore.totalScore}</Text>
          <Text className="text-primary text-lg font-bold mt-1">{strengthScore.label}</Text>
        </View>
        <View className="gap-2">
          <View className="flex-row justify-between items-center">
            <Text className="text-subtext text-sm">Volume</Text>
            <View className="flex-row items-center gap-2 flex-1 ml-4">
              <View className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                <View className="h-full bg-primary rounded-full" style={{ width: `${(strengthScore.volumeScore / 40) * 100}%` }} />
              </View>
              <Text className="text-text text-xs font-bold min-w-[42px] text-right flex-shrink-0">{strengthScore.volumeScore}/40</Text>
            </View>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-subtext text-sm">Intensidade</Text>
            <View className="flex-row items-center gap-2 flex-1 ml-4">
              <View className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                <View className="h-full bg-secondary rounded-full" style={{ width: `${(strengthScore.intensityScore / 30) * 100}%` }} />
              </View>
              <Text className="text-text text-xs font-bold min-w-[42px] text-right flex-shrink-0">{strengthScore.intensityScore}/30</Text>
            </View>
          </View>
          <View className="flex-row justify-between items-center">
            <Text className="text-subtext text-sm">Consistência</Text>
            <View className="flex-row items-center gap-2 flex-1 ml-4">
              <View className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                <View className="h-full bg-success rounded-full" style={{ width: `${(strengthScore.consistencyScore / 30) * 100}%` }} />
              </View>
              <Text className="text-text text-xs font-bold min-w-[42px] text-right flex-shrink-0">{strengthScore.consistencyScore}/30</Text>
            </View>
          </View>
        </View>
      </Card>

      {/* Consistency Stats */}
      <View className="flex-row gap-3 mt-2">
        <Card className="flex-1 items-center py-4">
          <Text className="text-text text-2xl font-bold">{consistency.sessionsThisWeek}</Text>
          <Text className="text-subtext text-xs font-bold uppercase mt-1">Esta Semana</Text>
        </Card>
        <Card className="flex-1 items-center py-4">
          <Text className="text-text text-2xl font-bold">{consistency.sessionsThisMonth}</Text>
          <Text className="text-subtext text-xs font-bold uppercase mt-1">Este Mês</Text>
        </Card>
        <Card className="flex-1 items-center py-4">
          <Text className="text-text text-2xl font-bold">{consistency.totalSessions}</Text>
          <Text className="text-subtext text-xs font-bold uppercase mt-1">Total</Text>
        </Card>
      </View>

      {/* Streak + Frequency */}
      <View className="flex-row gap-3 mt-2">
        <Card className="flex-1">
          <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-2">🔥 Streak Atual</Text>
          <Text className="text-text text-3xl font-black">{consistency.currentStreak}</Text>
          <Text className="text-subtext text-xs">semanas consecutivas</Text>
        </Card>
        <Card className="flex-1">
          <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-2">⭐ Melhor Streak</Text>
          <Text className="text-text text-3xl font-black">{consistency.longestStreak}</Text>
          <Text className="text-subtext text-xs">semanas consecutivas</Text>
        </Card>
      </View>

      {/* Frequency */}
      <Card>
        <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-2">Frequência Semanal</Text>
        <Text className="text-text text-3xl font-black">{consistency.weeklyFrequency}x</Text>
        <Text className="text-subtext text-xs">média nas últimas 12 semanas</Text>
      </Card>

      {/* Volume Trends */}
      {volumeTrends.length > 0 && (
        <Card>
          <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-3">📈 Volume Semanal (Últimas 12 Semanas)</Text>
          <View className="gap-1">
            {(() => {
              const maxVolume = Math.max(...volumeTrends.map(w => w.totalVolume), 1);
              return volumeTrends.slice(-12).map((week, idx) => {
              const barWidth = (week.totalVolume / maxVolume) * 100;
              return (
                <View key={week.week} className="flex-row items-center gap-2">
                  <Text className="text-subtext text-2xs font-mono w-12">{week.week.slice(-2)}w</Text>
                  <View className="flex-1 h-4 bg-border/30 rounded overflow-hidden">
                    <View
                      className="h-full bg-primary/70 rounded"
                      style={{ width: `${Math.max(barWidth, 2)}%` }}
                    />
                  </View>
                  <Text className="text-subtext text-2xs font-mono w-14 text-right">
                    {week.totalVolume >= 1000 ? `${(week.totalVolume / 1000).toFixed(1)}k` : week.totalVolume}kg
                  </Text>
                </View>
              );
            });
            })()}
          </View>
        </Card>
      )}

      {/* Top Exercise Progressions */}
      {topExercises.length > 0 && (
        <Card>
          <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-3">🏆 Exercícios em Progressão</Text>
          <View className="gap-3">
            {topExercises.map(ex => (
              <View key={ex.exerciseId} className="flex-row justify-between items-center">
                <View className="flex-1">
                  <Text className="text-text text-sm font-bold">{ex.exerciseName}</Text>
                  <Text className="text-subtext text-xs">{ex.currentMaxWeight}kg (era {ex.previousMaxWeight || '?'}kg)</Text>
                </View>
                <View className={`px-2 py-1 rounded ${ex.progress > 0 ? 'bg-success/10' : 'bg-danger/10'}`}>
                  <Text className={`text-xs font-bold ${ex.progress > 0 ? 'text-success' : 'text-danger'}`}>
                    {ex.progress > 0 ? '+' : ''}{ex.progress}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Estimated 1RM */}
      {estimated1RM.length > 0 && (
        <Card>
          <Text className="text-subtext text-xs font-bold uppercase tracking-widest mb-3">💪 1RM Estimado (Epley)</Text>
          <View className="gap-2">
            {estimated1RM.slice(0, 8).map(item => (
              <View key={item.exercise} className="flex-row justify-between items-center">
                <Text className="text-text text-sm flex-1" numberOfLines={1}>{item.exercise}</Text>
                <Text className="text-text text-sm font-bold">{item.estimated1RM}kg</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* PR Count */}
      <Card className="items-center py-6">
        <Text className="text-text text-4xl font-black">{totalPRs}</Text>
        <Text className="text-subtext text-xs font-bold uppercase tracking-widest mt-2">Recordes Pessoais</Text>
      </Card>

      <View className="h-8" />
    </ScrollView>
  );
}

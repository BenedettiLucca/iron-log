import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { db } from '@/db/client';
import { bodyMetrics } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';

export default function AnalyticsScreen() {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState({
    weightChangeRate: 0,
    averageWeight: 0,
    totalEntries: 0,
    firstEntryDate: null as Date | null,
    lastEntryDate: null as Date | null,
  });

  useEffect(() => {
    calculateAnalytics();
  }, []);

  const calculateAnalytics = async () => {
    try {
      const allMetrics = await db.select().from(bodyMetrics).orderBy(desc(bodyMetrics.date));

      if (allMetrics.length === 0) {
        setMetrics([]);
        return;
      }

      // Filter metrics with weight
      const weightMetrics = allMetrics.filter((m: any) => m.weight !== null && m.weight !== undefined);

      if (weightMetrics.length === 0) {
        setMetrics(allMetrics);
        setAnalytics({
          weightChangeRate: 0,
          averageWeight: 0,
          totalEntries: allMetrics.length,
          firstEntryDate: new Date(allMetrics[allMetrics.length - 1].date),
          lastEntryDate: new Date(allMetrics[0].date),
        });
        return;
      }

      // Calculate average weight
      const totalWeight = weightMetrics.reduce((sum: number, m: any) => sum + (m.weight || 0), 0);
      const averageWeight = totalWeight / weightMetrics.length;

      // Calculate weight change rate (kg/week)
      const firstWeight = weightMetrics[weightMetrics.length - 1].weight;
      const lastWeight = weightMetrics[0].weight;
      const firstDate = new Date(weightMetrics[weightMetrics.length - 1].date);
      const lastDate = new Date(weightMetrics[0].date);
      const weeksDiff = Math.max((lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7), 1);
      const weightChangeRate = ((lastWeight - firstWeight) / weeksDiff);

      setMetrics(allMetrics);
      setAnalytics({
        weightChangeRate,
        averageWeight,
        totalEntries: allMetrics.length,
        firstEntryDate: firstDate,
        lastEntryDate: lastDate,
      });
    } catch (error) {
      console.error('Error calculating analytics:', error);
    }
  };

  if (metrics.length === 0) {
    return (
      <View className="flex-1 bg-background">
        <Stack.Screen options={{ title: 'Análise' }} />
        <EmptyState
          icon="📊"
          title="Sem dados suficientes"
          description="Registre suas métricas para ver análises e tendências."
        />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ title: 'Análise' }} />

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ gap: 16 }}>
        {/* Weight Change Rate */}
        <Card>
          <Text className="text-subtext text-xs font-bold uppercase mb-2">Variação de Peso</Text>
          <View className="flex-row items-end gap-2">
            <Text className={`text-4xl font-black ${analytics.weightChangeRate >= 0 ? 'text-success' : 'text-danger'}`}>
              {analytics.weightChangeRate >= 0 ? '+' : ''}
              {analytics.weightChangeRate.toFixed(2)}
            </Text>
            <Text className="text-subtext text-sm mb-1">kg/semana</Text>
          </View>
        </Card>

        {/* Average Weight */}
        <Card>
          <Text className="text-subtext text-xs font-bold uppercase mb-2">Peso Médio</Text>
          <View className="flex-row items-end gap-2">
            <Text className="text-4xl font-black text-text">
              {analytics.averageWeight.toFixed(1)}
            </Text>
            <Text className="text-subtext text-sm mb-1">kg</Text>
          </View>
        </Card>

        {/* Statistics Grid */}
        <View className="flex-row gap-3">
          <Card className="flex-1">
            <Text className="text-subtext text-[10px] font-bold uppercase mb-1">Total de Registros</Text>
            <Text className="text-2xl font-black text-text">{analytics.totalEntries}</Text>
          </Card>

          <Card className="flex-1">
            <Text className="text-subtext text-[10px] font-bold uppercase mb-1">Período</Text>
            <Text className="text-2xl font-black text-text">
              {analytics.firstEntryDate && analytics.lastEntryDate
                ? Math.ceil(
                    (analytics.lastEntryDate.getTime() - analytics.firstEntryDate.getTime()) /
                      (1000 * 60 * 60 * 24 * 30)
                  )
                : 0}
            </Text>
            <Text className="text-subtext text-[10px]">meses</Text>
          </Card>
        </View>

        {/* Trend Analysis */}
        <Card>
          <Text className="text-subtext text-xs font-bold uppercase mb-3">Tendência</Text>
          <View className="flex-row items-center gap-3">
            <View
              className={`w-16 h-16 rounded-full items-center justify-center ${
                analytics.weightChangeRate > 0.1
                  ? 'bg-success/20'
                  : analytics.weightChangeRate < -0.1
                  ? 'bg-danger/20'
                  : 'bg-secondary/20'
              }`}
            >
              <Text className="text-3xl">
                {analytics.weightChangeRate > 0.1 ? '📈' : analytics.weightChangeRate < -0.1 ? '📉' : '➡️'}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-text font-bold text-sm mb-1">
                {analytics.weightChangeRate > 0.1
                  ? 'Ganhando peso'
                  : analytics.weightChangeRate < -0.1
                  ? 'Perdendo peso'
                  : 'Estável'}
              </Text>
              <Text className="text-subtext text-xs">
                {analytics.weightChangeRate > 0.1
                  ? 'Você está ganhando peso consistentemente'
                  : analytics.weightChangeRate < -0.1
                  ? 'Você está perdendo peso consistentemente'
                  : 'Seu peso está estável'}
              </Text>
            </View>
          </View>
        </Card>

        {/* Info Card */}
        <Card className="bg-secondary/10 border-secondary/20">
          <Text className="text-secondary text-xs font-bold uppercase mb-2">💡 Dica</Text>
          <Text className="text-subtext text-xs leading-5">
            Para mudanças de peso saudáveis, tente manter uma variação entre -0.5 a +0.5 kg por semana.
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}
